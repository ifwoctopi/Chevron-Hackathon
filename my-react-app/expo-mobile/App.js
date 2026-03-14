import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  ENGINEER_TABS,
  MANAGER_TABS,
  PUMPS,
  PUMP_BY_ID,
  buildIncidentReport,
  buildPumpSnapshot,
  clamp,
  createInitialAccounts,
  createInitialEngineerProfiles,
  createInitialLogs,
  createInitialPumpHistoryLive,
  createInitialState,
  createInitialTickets,
  createThreadEntry,
  deriveEngineers,
  formatClock,
  formatDate,
  getOpenMinutes,
  getRiskBand,
  getRiskScore,
  getStatus,
  getTicketStage,
  jitter,
  pumpHistorySeed,
  recommendEngineerForPump,
} from '../shared/opsShared'

const COLORS = {
  bg: '#eef3f8',
  panel: '#ffffff',
  panelSoft: '#f5f8fc',
  border: '#d6e0ea',
  text: '#203241',
  muted: '#708396',
  blue: '#0050AA',
  red: '#E21836',
  green: '#14804a',
  amber: '#b16b00',
}

function Pill({ label, tone = 'neutral' }) {
  const style =
    tone === 'crit'
      ? styles.pillCrit
      : tone === 'warn'
        ? styles.pillWarn
        : tone === 'ok'
          ? styles.pillOk
          : styles.pillNeutral

  return (
    <View style={[styles.pill, style]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>{subtitle}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

function MetricCard({ label, value, detail }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  )
}

function MapPanel({ telemetryState, selectedId, onSelect }) {
  return (
    <View style={styles.mapShell}>
      <View style={styles.mapGrid}>
        {telemetryState.map((pump) => {
          const status = getStatus(pump)
          const color = status === 'crit' ? COLORS.red : status === 'warn' ? COLORS.amber : COLORS.green
          const selected = pump.id === selectedId

          return (
            <Pressable
              key={pump.id}
              onPress={() => onSelect(pump.id)}
              style={[
                styles.mapMarker,
                {
                  left: `${(pump.x / 700) * 100}%`,
                  top: `${(pump.y / 500) * 100}%`,
                  borderColor: color,
                  backgroundColor: selected ? '#ffffff' : '#f6fbff',
                  transform: [{ translateX: -18 }, { translateY: -18 }],
                },
              ]}
            >
              <View style={[styles.mapDot, { backgroundColor: color }]} />
              <Text style={styles.mapMarkerText}>{pump.id}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function TicketCard({ ticket, tick }) {
  const tone = ticket.severity === 'high' ? 'crit' : ticket.severity === 'medium' ? 'warn' : 'ok'
  return (
    <View style={styles.listCard}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.cardTitle}>{ticket.id}</Text>
          <Text style={styles.cardSub}>{ticket.pumpId} · {formatDate(ticket.openedAt)}</Text>
        </View>
        <Pill label={ticket.severity.toUpperCase()} tone={tone} />
      </View>
      <Text style={styles.cardBody}>{ticket.report}</Text>
      <View style={styles.metaRow}>
        <Pill label={ticket.status === 'resolved' ? 'Resolved' : getTicketStage(ticket, tick)} tone={ticket.status === 'resolved' ? 'ok' : 'neutral'} />
        <Text style={styles.metaText}>
          {ticket.status === 'resolved' ? `${getOpenMinutes(ticket, tick)} min MTTR` : `Target ${ticket.responseTargetMinutes} min`}
        </Text>
      </View>
    </View>
  )
}

export default function App() {
  const [accounts] = useState(createInitialAccounts)
  const [engineerProfiles, setEngineerProfiles] = useState(createInitialEngineerProfiles)
  const [authUser, setAuthUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [telemetryState, setTelemetryState] = useState(createInitialState)
  const [pumpHistoryLive, setPumpHistoryLive] = useState(createInitialPumpHistoryLive)
  const [selectedId, setSelectedId] = useState('PMP-04')
  const [tick, setTick] = useState(0)
  const [logs, setLogs] = useState(createInitialLogs)
  const [tickets, setTickets] = useState(createInitialTickets)
  const [managerTab, setManagerTab] = useState('dashboard')
  const [engineerTab, setEngineerTab] = useState('myTickets')
  const [pumpHistoryFocus, setPumpHistoryFocus] = useState('PMP-04')
  const statusByPumpRef = useRef({})
  const tickRef = useRef(0)

  const activeTab = authUser?.role === 'manager' ? managerTab : engineerTab
  const availableTabs = authUser?.role === 'manager' ? MANAGER_TABS : ENGINEER_TABS

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((previous) => {
        const next = previous + 1
        tickRef.current = next
        return next
      })

      setTelemetryState((previous) =>
        previous.map((pump, index) => {
          const baseline = PUMP_BY_ID[pump.id]
          const cycleTick = tickRef.current

          if (pump.fault) {
            const nextFaultTick = pump.faultTick + 1
            const currentStatus = getStatus(pump)
            const nextWarnTick = currentStatus === 'warn' && (pump.warnTick === null || pump.warnTick === undefined)
              ? cycleTick
              : pump.warnTick
            const shouldEscalateToCrit =
              nextWarnTick !== null && nextWarnTick !== undefined && cycleTick - nextWarnTick >= 7

            if (shouldEscalateToCrit) {
              return {
                ...pump,
                faultTick: nextFaultTick,
                warnTick: nextWarnTick,
                temp: Math.max(pump.temp + 2.2, 104),
                pressure: Math.max(pump.pressure - 1.2, 96),
                flow: Math.max(pump.flow - 3.2, 205),
                vibe: Math.max(pump.vibe + 2.4, 74),
              }
            }

            return {
              ...pump,
              faultTick: nextFaultTick,
              warnTick: nextWarnTick,
              temp: Math.min(124, pump.temp + 0.8 + Math.random() * 0.7),
              pressure: Math.max(92, pump.pressure - 0.6 - Math.random() * 0.35),
              flow: Math.max(175, pump.flow - 1.5 - Math.random() * 1.2),
              vibe: Math.min(94, pump.vibe + 1 + Math.random() * 0.6),
            }
          }

          const drift = Math.sin((cycleTick + index * 4) / 3)
          const jittered = {
            temp: Math.max(baseline.temp - 3, Math.min(baseline.temp + 3, jitter(pump.temp + drift * 0.25, 1.1))),
            pressure: Math.max(
              baseline.pressure - 8,
              Math.min(baseline.pressure + 8, jitter(pump.pressure - drift * 0.7, 2.8)),
            ),
            flow: Math.max(baseline.flow - 18, Math.min(baseline.flow + 14, jitter(pump.flow + drift * 2.4, 4.8))),
            vibe: Math.max(baseline.vibe - 3, Math.min(baseline.vibe + 3, jitter(pump.vibe + drift * 0.3, 1.3))),
          }

          const shouldRotateFault =
            cycleTick > 0 &&
            cycleTick % 8 === 0 &&
            (pump.faultCycles || 0) === 0 &&
            index === Math.floor(cycleTick / 8) % PUMPS.length

          if (shouldRotateFault) {
            return {
              ...pump,
              fault: true,
              faultTick: 0,
              warnTick: cycleTick,
              temp: Math.max(jittered.temp + 16, 87),
              pressure: Math.max(jittered.pressure - 20, 102),
              flow: Math.max(jittered.flow - 36, 230),
              vibe: Math.max(jittered.vibe + 22, 50),
            }
          }

          return {
            ...pump,
            ...jittered,
          }
        }),
      )

      setEngineerProfiles((previous) =>
        previous.map((profile) => ({
          ...profile,
          etaMinutes: profile.onCall && profile.etaMinutes > 0 ? profile.etaMinutes - 1 : profile.etaMinutes,
        })),
      )
    }, 3000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (tick === 0) return

    const now = new Date()
    const nextLogs = []

    telemetryState.forEach((pump) => {
      const currentStatus = getStatus(pump)
      const previousStatus = statusByPumpRef.current[pump.id] || 'ok'
      const crossedToIncident =
        (currentStatus === 'warn' || currentStatus === 'crit') && previousStatus === 'ok'

      if (crossedToIncident) {
        nextLogs.push({
          id: `incident-${tick}-${pump.id}`,
          time: formatClock(now),
          message: `${pump.id} ${currentStatus.toUpperCase()} - incident report updated from live telemetry`,
          level: currentStatus === 'crit' ? 'crit' : 'warn',
        })
      } else if (currentStatus === 'crit' && tick % 2 === 0) {
        nextLogs.push({
          id: `crit-${tick}-${pump.id}`,
          time: formatClock(now),
          message: `${pump.id} CRITICAL - temp ${Math.round(pump.temp)} degC, vibe ${Math.round(pump.vibe)} Hz`,
          level: 'crit',
        })
      } else if (currentStatus === 'warn' && tick % 4 === 0) {
        nextLogs.push({
          id: `warn-${tick}-${pump.id}`,
          time: formatClock(now),
          message: `${pump.id} WARNING - elevated readings sustained`,
          level: 'warn',
        })
      }

      if (currentStatus === 'ok' && previousStatus !== 'ok') {
        nextLogs.push({
          id: `recover-${tick}-${pump.id}`,
          time: formatClock(now),
          message: `${pump.id} recovered to nominal telemetry`,
          level: 'ok',
        })
      }

      statusByPumpRef.current[pump.id] = currentStatus
    })

    setLogs((previous) => [...nextLogs, ...previous].slice(0, 40))

    setTickets((previous) => {
      const next = [...previous]
      const engineersNow = deriveEngineers(engineerProfiles, next, tick)

      telemetryState.forEach((pump) => {
        const status = getStatus(pump)
        if (status === 'ok') return

        const openTicketIndex = next.findIndex((ticket) => ticket.pumpId === pump.id && ticket.status === 'open')
        if (openTicketIndex >= 0) {
          const openTicket = next[openTicketIndex]
          const priorSnapshotStatus = openTicket.reportedSnapshot?.status || null

          if (priorSnapshotStatus !== status) {
            const snapshot = buildPumpSnapshot(pump, now)
            next[openTicketIndex] = {
              ...openTicket,
              severity: status === 'crit' ? 'high' : 'medium',
              report: buildIncidentReport(pump, snapshot),
              reportedSnapshot: snapshot,
              thread: [
                createThreadEntry({ name: 'System', role: 'system' }, `Incident report refreshed from live telemetry (${status.toUpperCase()}).`, now),
                ...openTicket.thread,
              ],
            }
          }

          return
        }

        const snapshot = buildPumpSnapshot(pump, now)
        const recommendedEngineer = recommendEngineerForPump(pump, engineersNow)

        next.unshift({
          id: `INC-${String(Date.now() + Math.floor(Math.random() * 1000)).slice(-4)}`,
          pumpId: pump.id,
          severity: status === 'crit' ? 'high' : 'medium',
          status: 'open',
          workflowStatus: 'assigned',
          openedTick: tick,
          openedAt: now.toISOString(),
          resolvedAt: null,
          assignedEngineerId: recommendedEngineer?.id ?? null,
          responseTargetMinutes: recommendedEngineer?.id ? 45 : 60,
          report: buildIncidentReport(pump, snapshot),
          reportedSnapshot: snapshot,
          dispatchRecommendation: recommendedEngineer
            ? `${recommendedEngineer.name} recommended based on ${recommendedEngineer.currentLocation || recommendedEngineer.homeZone}.`
            : 'No available engineer. Escalate and assign manually.',
          escalated: false,
          thread: [createThreadEntry({ name: 'System', role: 'system' }, `Ticket auto-created from ${status.toUpperCase()} telemetry threshold breach.`, now)],
        })
      })

      return next
    })

    setPumpHistoryLive((previous) => {
      const next = { ...previous }

      telemetryState.forEach((pump) => {
        const current = next[pump.id] || pumpHistorySeed[pump.id]
        const status = getStatus(pump)
        const health = clamp(
          Math.round((current.healthTimeline.at(-1) || 80) - (status === 'crit' ? 6 : status === 'warn' ? 3 : -1)),
          22,
          98,
        )

        next[pump.id] = {
          ...current,
          healthTimeline: [...current.healthTimeline.slice(-29), health],
          sensorEvents: current.sensorEvents + (status === 'crit' ? 1 : 0),
          sensorReliability: clamp(current.sensorReliability - (status === 'crit' ? 1 : 0), 72, 99),
        }
      })

      return next
    })
  }, [engineerProfiles, telemetryState, tick])

  const openTickets = useMemo(() => tickets.filter((ticket) => ticket.status === 'open'), [tickets])
  const engineers = useMemo(() => deriveEngineers(engineerProfiles, tickets, tick), [engineerProfiles, tickets, tick])
  const ownEngineerId = authUser?.engineerId || null
  const visibleTickets = useMemo(() => {
    if (authUser?.role === 'manager') return tickets
    return tickets.filter((ticket) => ticket.assignedEngineerId === ownEngineerId || ticket.pumpId === selectedId)
  }, [authUser?.role, ownEngineerId, selectedId, tickets])

  const riskScore = useMemo(() => getRiskScore(telemetryState, tickets, tick), [telemetryState, tickets, tick])
  const riskBand = getRiskBand(riskScore)

  const kpis = useMemo(() => {
    const uptime = clamp(99.3 - openTickets.length * 1.8 - riskScore * 0.03, 82.1, 99.9)
    const engineersOnCall = engineers.filter((engineer) => engineer.status !== 'Offline').length
    const incidents24h = tickets.length
    const estimatedProductionLoss = incidents24h * 7800 + openTickets.length * 12400
    return {
      uptime: `${uptime.toFixed(1)}%`,
      activeIncidents: openTickets.length,
      engineersOnCall,
      estimatedProductionLoss,
    }
  }, [engineers, openTickets.length, riskScore, tickets.length])

  const selectedPumpHistory = pumpHistoryLive[pumpHistoryFocus]

  const handleLogin = () => {
    const username = loginForm.username.trim().toLowerCase()
    const password = loginForm.password.trim()
    const account = accounts.find((item) => item.username.toLowerCase() === username && item.password === password)
    if (!account) {
      setLoginError('Invalid username or password.')
      return
    }

    setAuthUser(account)
    setLoginError('')
  }

  if (!authUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.loginShell}>
          <View style={styles.loginCard}>
            <Text style={styles.brandEyebrow}>FLARE MOBILE</Text>
            <Text style={styles.loginTitle}>Operations Command Center</Text>
            <Text style={styles.loginCopy}>Shared demo data with the browser app, packaged for Expo on iPhone.</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              autoCapitalize="none"
              value={loginForm.username}
              onChangeText={(value) => setLoginForm((previous) => ({ ...previous, username: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={loginForm.password}
              onChangeText={(value) => setLoginForm((previous) => ({ ...previous, password: value }))}
            />
            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </Pressable>
            <Text style={styles.hintText}>Manager: manager / manager123</Text>
            <Text style={styles.hintText}>Engineers: ava.tran / engineer123, mateo.singh / engineer123, etc.</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.shell}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brandEyebrow}>FLARE</Text>
            <Text style={styles.topbarTitle}>Operations Command Center</Text>
            <Text style={styles.topbarSub}>{authUser.role.toUpperCase()} · {authUser.name}</Text>
          </View>
          <View style={[styles.riskChip, riskBand === 'crit' ? styles.riskCrit : riskBand === 'warn' ? styles.riskWarn : styles.riskOk]}>
            <Text style={styles.riskLabel}>Risk Heat Score</Text>
            <Text style={styles.riskValue}>{riskScore}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {availableTabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => authUser.role === 'manager' ? setManagerTab(tab.id) : setEngineerTab(tab.id)}
                style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
              >
                <Text style={[styles.tabButtonText, activeTab === tab.id && styles.tabButtonTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.secondaryButton} onPress={() => setAuthUser(null)}>
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricRow}>
          <MetricCard label="Uptime" value={kpis.uptime} detail="Rolling asset availability" />
          <MetricCard label="Active Incidents" value={String(kpis.activeIncidents)} detail="Open telemetry-driven tickets" />
          <MetricCard label="Engineers On Call" value={String(kpis.engineersOnCall)} detail="Shift-active roster coverage" />
          <MetricCard label="Prod. Loss Today" value={`$${kpis.estimatedProductionLoss.toLocaleString()}`} detail="Projected daily impact" />
        </ScrollView>

        {(activeTab === 'dashboard' || activeTab === 'mapLog') && (
          <>
            <Section title="Island Telemetry Map" subtitle="Live overview">
              <MapPanel
                telemetryState={telemetryState}
                selectedId={selectedId}
                onSelect={(pumpId) => {
                  setSelectedId(pumpId)
                  setPumpHistoryFocus(pumpId)
                }}
              />
            </Section>

            <Section title="Event Log" subtitle="Latest activity">
              {logs.slice(0, 10).map((entry) => (
                <View key={entry.id} style={styles.logRow}>
                  <Text style={styles.logTime}>{entry.time}</Text>
                  <Text style={[styles.logText, entry.level === 'crit' ? styles.logCrit : entry.level === 'warn' ? styles.logWarn : styles.logOk]}>
                    {entry.message}
                  </Text>
                </View>
              ))}
            </Section>
          </>
        )}

        {(activeTab === 'dashboard' || activeTab === 'myTickets' || activeTab === 'ongoingTickets') && (
          <Section title={authUser.role === 'manager' ? 'Ongoing Tickets' : 'My Tickets'} subtitle="Live work queue">
            {visibleTickets.filter((ticket) => authUser.role === 'manager' || ticket.status === 'open').map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} tick={tick} />
            ))}
          </Section>
        )}

        {authUser.role === 'manager' && activeTab === 'dashboard' && (
          <Section title="Engineer Coverage" subtitle="Dispatch view">
            {engineers.map((engineer) => (
              <View key={engineer.id} style={styles.listCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardTitle}>{engineer.name}</Text>
                    <Text style={styles.cardSub}>{engineer.location || engineer.homeZone}</Text>
                  </View>
                  <Pill
                    label={engineer.status}
                    tone={engineer.status === 'Offline' ? 'crit' : engineer.status === 'On Call' || engineer.status === 'En Route' ? 'warn' : 'ok'}
                  />
                </View>
                <Text style={styles.cardBody}>{engineer.skillset.join(' · ')}</Text>
              </View>
            ))}
          </Section>
        )}

        {activeTab === 'incidentReports' && (
          <Section title="Incident Reports" subtitle="AI-generated summaries">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} tick={tick} />
            ))}
          </Section>
        )}

        {activeTab === 'pumpHistory' && selectedPumpHistory && (
          <Section title="Pump History" subtitle={pumpHistoryFocus}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pumpSelectorRow}>
              {PUMPS.map((pump) => (
                <Pressable
                  key={pump.id}
                  onPress={() => setPumpHistoryFocus(pump.id)}
                  style={[styles.pumpChip, pumpHistoryFocus === pump.id && styles.pumpChipActive]}
                >
                  <Text style={[styles.pumpChipText, pumpHistoryFocus === pump.id && styles.pumpChipTextActive]}>{pump.id}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.historyMetrics}>
              <MetricCard label="Health Score" value={String(selectedPumpHistory.healthTimeline.at(-1) || '--')} detail="Latest rolling score" />
              <MetricCard label="Sensor Reliability" value={`${selectedPumpHistory.sensorReliability}%`} detail="Current confidence" />
            </View>

            <View style={styles.listCard}>
              <Text style={styles.cardTitle}>Maintenance Compliance Tracker</Text>
              <View style={styles.complianceRow}>
                {selectedPumpHistory.maintenance.map((item, index) => (
                  <Pill key={`${pumpHistoryFocus}-${index}`} label={item ? 'OK' : 'MISS'} tone={item ? 'ok' : 'crit'} />
                ))}
              </View>
            </View>

            <View style={styles.listCard}>
              <Text style={styles.cardTitle}>Sensor Reliability Log</Text>
              <Text style={styles.cardBody}>{selectedPumpHistory.sensorEvents} suspicious sensor events in the recent review window.</Text>
            </View>

            <View style={styles.listCard}>
              <Text style={styles.cardTitle}>AI Recommendation</Text>
              <Text style={styles.cardBody}>{selectedPumpHistory.recommendation}</Text>
            </View>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  shell: {
    padding: 16,
    gap: 14,
  },
  loginShell: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    backgroundColor: COLORS.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12,
  },
  brandEyebrow: {
    color: COLORS.blue,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  loginTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
  },
  loginCopy: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
  },
  errorText: {
    color: COLORS.red,
  },
  hintText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  topbar: {
    backgroundColor: COLORS.blue,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  topbarTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  topbarSub: {
    color: '#dbe8f7',
    marginTop: 6,
  },
  riskChip: {
    minWidth: 110,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskOk: {
    backgroundColor: 'rgba(20, 128, 74, 0.22)',
  },
  riskWarn: {
    backgroundColor: 'rgba(177, 107, 0, 0.22)',
  },
  riskCrit: {
    backgroundColor: 'rgba(226, 24, 54, 0.22)',
  },
  riskLabel: {
    color: '#e6f0fb',
    fontSize: 11,
  },
  riskValue: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  tabRow: {
    gap: 8,
  },
  tabButton: {
    backgroundColor: '#dfe9f5',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: COLORS.blue,
  },
  tabButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  primaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  metricRow: {
    gap: 10,
  },
  metricCard: {
    width: 180,
    backgroundColor: COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
  },
  metricDetail: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    backgroundColor: COLORS.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionEyebrow: {
    color: COLORS.muted,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  mapShell: {
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#dce8f5',
    borderWidth: 1,
    borderColor: '#c9d7e8',
  },
  mapGrid: {
    flex: 1,
    backgroundColor: '#dce8f5',
  },
  mapMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mapMarkerText: {
    position: 'absolute',
    top: 40,
    width: 72,
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '700',
  },
  listCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardSub: {
    color: COLORS.muted,
    marginTop: 4,
  },
  cardBody: {
    color: COLORS.text,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  pillNeutral: {
    backgroundColor: '#edf2f8',
    borderColor: COLORS.border,
  },
  pillOk: {
    backgroundColor: '#e7f5ed',
    borderColor: '#b8dfc7',
  },
  pillWarn: {
    backgroundColor: '#fff2dd',
    borderColor: '#f2d19f',
  },
  pillCrit: {
    backgroundColor: '#fde8ec',
    borderColor: '#f3b9c4',
  },
  pillText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  logRow: {
    flexDirection: 'row',
    gap: 10,
  },
  logTime: {
    width: 72,
    color: COLORS.muted,
    fontSize: 12,
  },
  logText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  logOk: {
    color: COLORS.green,
  },
  logWarn: {
    color: COLORS.amber,
  },
  logCrit: {
    color: COLORS.red,
  },
  pumpSelectorRow: {
    gap: 8,
  },
  pumpChip: {
    backgroundColor: '#edf2f8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pumpChipActive: {
    backgroundColor: COLORS.blue,
  },
  pumpChipText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  pumpChipTextActive: {
    color: '#fff',
  },
  historyMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  complianceRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
  },
})