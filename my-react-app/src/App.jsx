import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const PUMPS = [
  {
    id: 'PMP-01',
    name: 'North Intake',
    zone: 'North Ridge',
    x: 220,
    y: 185,
    temp: 71,
    pressure: 138,
    flow: 312,
    vibe: 27,
  },
  {
    id: 'PMP-02',
    name: 'Central Hub',
    zone: 'Central Plateau',
    x: 320,
    y: 265,
    temp: 74,
    pressure: 144,
    flow: 305,
    vibe: 29,
  },
  {
    id: 'PMP-03',
    name: 'East Valve',
    zone: 'Eastern Gate',
    x: 430,
    y: 232,
    temp: 69,
    pressure: 140,
    flow: 318,
    vibe: 26,
  },
  {
    id: 'PMP-04',
    name: 'South Output',
    zone: 'Southern Basin',
    x: 290,
    y: 380,
    temp: 73,
    pressure: 136,
    flow: 308,
    vibe: 30,
  },
  {
    id: 'PMP-05',
    name: 'West Station',
    zone: 'Western Cliffs',
    x: 185,
    y: 305,
    temp: 70,
    pressure: 142,
    flow: 315,
    vibe: 28,
  },
]

const ENGINEER_DIRECTORY = [
  {
    id: 'ENG-01',
    name: 'Ava Tran',
    homeZone: 'North Ridge',
    skillset: ['Intake Systems', 'Pressure Recovery'],
    shift: 'On',
  },
  {
    id: 'ENG-02',
    name: 'Mateo Singh',
    homeZone: 'Southern Basin',
    skillset: ['Thermals', 'Motor Diagnostics'],
    shift: 'On',
  },
  {
    id: 'ENG-03',
    name: 'Priya Nwosu',
    homeZone: 'Central Plateau',
    skillset: ['SCADA', 'Flow Sensors'],
    shift: 'On',
  },
  {
    id: 'ENG-04',
    name: 'Jonah Reyes',
    homeZone: 'Eastern Gate',
    skillset: ['Valve Control', 'Field Response'],
    shift: 'On',
  },
  {
    id: 'ENG-05',
    name: 'Lena Okafor',
    homeZone: 'Western Cliffs',
    skillset: ['Reliability', 'Instrumentation'],
    shift: 'Off',
  },
]

const MANAGER_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'incidentReports', label: 'Incident Reports' },
  { id: 'ongoingTickets', label: 'Ongoing Tickets' },
  { id: 'pumpHistory', label: 'Pump History' },
]

const ENGINEER_TABS = [
  { id: 'myTickets', label: 'My Tickets' },
  { id: 'mapLog', label: 'Map & Event Log' },
  { id: 'incidentReports', label: 'Incident Reports' },
  { id: 'pumpHistory', label: 'Pump History' },
]

const TICKET_STAGES = ['Detected', 'Assigned', 'En Route', 'In Progress', 'Resolved']

const T_WARN = 85
const T_CRIT = 100
const V_WARN = 50
const V_CRIT = 70
const P_WARN = 115

const PUMP_BY_ID = Object.fromEntries(PUMPS.map((pump) => [pump.id, pump]))
const pumpHistorySeed = buildPumpHistorySeed()

function createInitialPumpHistoryLive() {
  return Object.fromEntries(
    Object.entries(pumpHistorySeed).map(([pumpId, history]) => [pumpId, { ...history, healthTimeline: [...history.healthTimeline] }]),
  )
}

function createInitialAccounts() {
  const managerAccount = {
    id: 'ACC-MGR-01',
    name: 'Island Manager',
    username: 'manager',
    password: 'manager123',
    role: 'manager',
    engineerId: null,
    createdAt: new Date().toISOString(),
  }

  const engineerAccounts = ENGINEER_DIRECTORY.map((engineer) => ({
    id: `ACC-${engineer.id}`,
    name: engineer.name,
    username: engineer.name.toLowerCase().replace(/[^a-z0-9]+/g, '.'),
    password: 'engineer123',
    role: 'engineer',
    engineerId: engineer.id,
    createdAt: new Date().toISOString(),
  }))

  return [managerAccount, ...engineerAccounts]
}

function createInitialEngineerProfiles() {
  return ENGINEER_DIRECTORY.map((engineer, index) => ({
    id: engineer.id,
    name: engineer.name,
    homeZone: engineer.homeZone,
    skillset: engineer.skillset,
    isActive: engineer.shift !== 'Off',
    onCall: engineer.shift === 'On',
    currentLocation: engineer.homeZone,
    profilePhoto: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(engineer.name)}`,
    etaMinutes: 0,
    updatedAt: new Date(Date.now() - index * 4000).toISOString(),
  }))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function createNominalState() {
  return PUMPS.map((pump) => ({ ...pump, fault: false, faultTick: 0, faultCycles: 0, warnTick: null }))
}

function createInitialState() {
  return createNominalState().map((pump) => {
    if (pump.id !== 'PMP-04') return pump

    return {
      ...pump,
      fault: true,
      faultTick: 8,
      temp: 91,
      pressure: 111,
      flow: 272,
      vibe: 53,
      faultCycles: 1,
      warnTick: 0,
    }
  })
}

function toReadableStatus(status) {
  if (status === 'open') return 'Open'
  if (status === 'resolved') return 'Resolved'
  return status
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function buildPumpSnapshot(pump, createdAt = new Date()) {
  return {
    capturedAt: createdAt.toISOString(),
    status: getStatus(pump),
    temp: Math.round(pump.temp),
    pressure: Math.round(pump.pressure),
    flow: Math.round(pump.flow),
    vibe: Math.round(pump.vibe),
  }
}

function buildIncidentReport(pump, snapshot) {
  const severityLine =
    snapshot.status === 'crit'
      ? 'Critical telemetry breach detected.'
      : snapshot.status === 'warn'
        ? 'Warning threshold breach detected.'
        : 'Advisory telemetry anomaly detected.'

  return `AI incident summary: ${pump.name} in ${pump.zone}. ${severityLine} Snapshot at report time - temp ${snapshot.temp} degC, pressure ${snapshot.pressure} psi, flow ${snapshot.flow} L/min, vibe ${snapshot.vibe} Hz.`
}

function createThreadEntry(author, message, createdAt = new Date()) {
  const authorDescriptor = typeof author === 'string' ? { name: author, role: author } : author
  const role = authorDescriptor.role || 'system'

  return {
    id: `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    author: authorDescriptor.name,
    authorRole: role,
    message,
    createdAt: createdAt.toISOString(),
    time: formatClock(createdAt),
  }
}

function createInitialTickets() {
  const now = Date.now()

  return [
    {
      id: 'INC-2404',
      pumpId: 'PMP-04',
      severity: 'high',
      status: 'open',
      workflowStatus: 'in_progress',
      openedTick: -10,
      openedAt: new Date(now - 28 * 60 * 1000).toISOString(),
      resolvedAt: null,
      assignedEngineerId: 'ENG-02',
      responseTargetMinutes: 45,
      report:
        'AI incident summary: sustained thermal drift at South Output was followed by pressure sag and a vibration spike. Failure mode points to motor cooling degradation with secondary flow restriction risk.',
      dispatchRecommendation:
        'Dispatch Mateo Singh first. He is the closest thermal specialist and can stabilize motor load before the incident propagates into downstream production loss.',
      escalated: false,
      thread: [
        createThreadEntry({ name: 'Mateo Singh', role: 'engineer' }, 'On site at South Output. Beginning thermal scan and coupling inspection.'),
        createThreadEntry({ name: 'Island Manager', role: 'manager' }, 'Manager note: prioritize restoring pressure before the midnight production window.'),
        createThreadEntry({ name: 'System', role: 'system' }, 'Ticket auto-created from telemetry threshold breach.'),
      ],
    },
    {
      id: 'INC-2317',
      pumpId: 'PMP-02',
      severity: 'medium',
      status: 'resolved',
      workflowStatus: 'resolved',
      openedTick: -80,
      openedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 62 * 60 * 1000).toISOString(),
      assignedEngineerId: 'ENG-03',
      responseTargetMinutes: 60,
      report:
        'AI incident summary: Central Hub experienced intermittent sensor drift causing false low-flow alerts. Root cause was traced to a connector integrity issue inside the SCADA enclosure.',
      dispatchRecommendation:
        'Priya Nwosu was correctly assigned based on SCADA specialization and central proximity.',
      escalated: false,
      thread: [createThreadEntry({ name: 'System', role: 'system' }, 'Resolved after connector replacement and calibration validation.')],
    },
    {
      id: 'INC-2288',
      pumpId: 'PMP-05',
      severity: 'low',
      status: 'resolved',
      workflowStatus: 'resolved',
      openedTick: -120,
      openedAt: new Date(now - 11 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(now - 11 * 24 * 60 * 60 * 1000 + 38 * 60 * 1000).toISOString(),
      assignedEngineerId: 'ENG-05',
      responseTargetMinutes: 90,
      report:
        'AI incident summary: West Station reported a transient vibration spike during startup. Event cleared after alignment check and no secondary anomalies were detected.',
      dispatchRecommendation:
        'Reliability-focused follow-up recommended only if two more transient spikes occur within 30 days.',
      escalated: false,
      thread: [createThreadEntry({ name: 'System', role: 'system' }, 'Resolved during startup window with no further action required.')],
    },
    {
      id: 'INC-2263',
      pumpId: 'PMP-01',
      severity: 'high',
      status: 'resolved',
      workflowStatus: 'resolved',
      openedTick: -150,
      openedAt: new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(now - 21 * 24 * 60 * 60 * 1000 + 96 * 60 * 1000).toISOString(),
      assignedEngineerId: 'ENG-01',
      responseTargetMinutes: 45,
      report:
        'AI incident summary: North Intake suffered a pressure collapse caused by debris accumulation near the intake throat. Manual clearing and sensor re-baselining restored normal operation.',
      dispatchRecommendation:
        'Preventive intake screening should be advanced by one week for the next two cycles.',
      escalated: true,
      thread: [createThreadEntry({ name: 'System', role: 'system' }, 'Escalated during event due to upstream throughput risk. Resolved after debris removal.')],
    },
  ]
}

function buildPumpHistorySeed() {
  return Object.fromEntries(
    PUMPS.map((pump, pumpIndex) => {
      const healthTimeline = Array.from({ length: 30 }, (_, dayIndex) =>
        clamp(86 - pumpIndex * 4 - Math.floor(dayIndex / 7) * 3 + ((dayIndex + pumpIndex) % 5) - 2, 24, 96),
      )
      const maintenance = Array.from({ length: 8 }, (_, slot) => (slot + pumpIndex) % 3 !== 0)
      const sensorEvents = 1 + ((pumpIndex * 3) % 4)

      return [
        pump.id,
        {
          healthTimeline,
          maintenance,
          sensorEvents,
          sensorReliability: 97 - pumpIndex * 4,
          recommendation:
            pump.id === 'PMP-04'
              ? 'Flag for inspection now, and open a replacement evaluation if another high-severity incident occurs this week.'
              : pump.id === 'PMP-01'
                ? 'Advance intake maintenance by one cycle and inspect debris barriers.'
                : 'Continue scheduled maintenance and monitor for trend breaks.',
        },
      ]
    }),
  )
}

function getStatus(pump) {
  if (pump.temp >= T_CRIT || pump.vibe >= V_CRIT) return 'crit'
  if (pump.temp >= T_WARN || pump.vibe >= V_WARN || pump.pressure <= P_WARN) return 'warn'
  return 'ok'
}

function getSeverityLabel(pump) {
  const status = getStatus(pump)
  if (status === 'crit') return 'high'
  if (status === 'warn') return 'medium'
  return 'low'
}

function getValClass(value, warn, crit) {
  if (value >= crit) return 'val-crit'
  if (value >= warn) return 'val-warn'
  return 'val-ok'
}

function jitter(value, range) {
  return value + (Math.random() - 0.5) * range
}

function formatClock(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getOpenMinutes(ticket, tick) {
  if (ticket.status === 'resolved' && ticket.resolvedAt) {
    return Math.max(1, Math.round((new Date(ticket.resolvedAt) - new Date(ticket.openedAt)) / 60000))
  }

  return Math.max(1, (tick - ticket.openedTick) * 3)
}

function getTicketStage(ticket, tick) {
  if (ticket.status === 'resolved') return 'Resolved'

  if (ticket.workflowStatus) {
    if (ticket.workflowStatus === 'assigned') return 'Assigned'
    if (ticket.workflowStatus === 'en_route') return 'En Route'
    if (ticket.workflowStatus === 'in_progress') return 'In Progress'
  }

  const elapsedMinutes = getOpenMinutes(ticket, tick)
  if (elapsedMinutes < 6) return 'Detected'
  if (elapsedMinutes < 12) return 'Assigned'
  if (elapsedMinutes < 24) return 'En Route'
  return 'In Progress'
}

function getSlaRemaining(ticket, tick) {
  if (ticket.status === 'resolved') return null
  return ticket.responseTargetMinutes - getOpenMinutes(ticket, tick)
}

function getRiskScore(telemetryState, tickets, tick) {
  const crits = telemetryState.filter((pump) => getStatus(pump) === 'crit').length
  const warns = telemetryState.filter((pump) => getStatus(pump) === 'warn').length
  const openTickets = tickets.filter((ticket) => ticket.status === 'open').length
  const avgTemp = telemetryState.reduce((sum, pump) => sum + pump.temp, 0) / telemetryState.length
  const avgVibe = telemetryState.reduce((sum, pump) => sum + pump.vibe, 0) / telemetryState.length

  return clamp(
    Math.round(crits * 26 + warns * 11 + openTickets * 9 + (avgTemp - 70) * 1.1 + (avgVibe - 28) * 1.6),
    4,
    100,
  )
}

function getRiskBand(score) {
  if (score < 30) return 'ok'
  if (score <= 70) return 'warn'
  return 'crit'
}

function deriveEngineers(engineerProfiles, tickets, tick) {
  return engineerProfiles.map((engineer) => {
    const assignment = tickets
      .filter((ticket) => ticket.status === 'open' && ticket.assignedEngineerId === engineer.id)
      .sort((left, right) => new Date(right.openedAt) - new Date(left.openedAt))[0]

    if (!assignment) {
      return {
        ...engineer,
        status: engineer.isActive ? (engineer.onCall ? 'On Call' : 'Available') : 'Off Shift',
        location: engineer.currentLocation,
        currentAssignment: 'None',
        etaMinutes: engineer.onCall && engineer.isActive ? engineer.etaMinutes : null,
      }
    }

    const stage = getTicketStage(assignment, tick)
    const stageStatus =
      stage === 'Detected' || stage === 'Assigned'
        ? 'On Call'
        : stage === 'En Route'
          ? 'En Route'
          : 'On Site'

    const etaMinutes =
      stage === 'Detected'
        ? 22
        : stage === 'Assigned'
          ? 14
          : stage === 'En Route'
            ? clamp(18 - getOpenMinutes(assignment, tick) / 2, 5, 18)
            : 0

    return {
      ...engineer,
      status: stageStatus,
      location: engineer.currentLocation || PUMP_BY_ID[assignment.pumpId]?.zone || engineer.homeZone,
      currentAssignment: assignment.id,
      etaMinutes: Math.round(engineer.etaMinutes > 0 ? engineer.etaMinutes : etaMinutes),
    }
  })
}

function recommendEngineerForPump(pump, engineers) {
  const ranked = [...engineers]
    .filter((engineer) => engineer.status !== 'Off Shift')
    .sort((left, right) => scoreEngineer(right, pump) - scoreEngineer(left, pump))

  return ranked[0] ?? null
}

function scoreEngineer(engineer, pump) {
  let score = 0
  if (engineer.homeZone === pump.zone) score += 4
  if (engineer.status === 'Available') score += 5
  if (engineer.status === 'On Call') score += 2
  if (engineer.skillset.some((skill) => pump.name.toLowerCase().includes(skill.split(' ')[0].toLowerCase()))) {
    score += 3
  }
  if (engineer.skillset.some((skill) => ['Thermals', 'Motor Diagnostics', 'Reliability', 'Flow Sensors'].includes(skill))) {
    score += 1
  }
  return score
}

function buildTelemetryContext(state, selectedId, logs, summaryLine, tickets, engineers, riskScore, tick) {
  const selectedPump = state.find((pump) => pump.id === selectedId) ?? null
  const faultedPumps = state.filter((pump) => pump.fault).map((pump) => pump.id)

  return {
    generatedAt: new Date().toISOString(),
    summaryLine,
    riskScore,
    selectedPump,
    faultedPumps,
    pumps: state.map((pump) => ({
      id: pump.id,
      name: pump.name,
      zone: pump.zone,
      status: getStatus(pump),
      temp: Number(pump.temp.toFixed(2)),
      pressure: Number(pump.pressure.toFixed(2)),
      flow: Number(pump.flow.toFixed(2)),
      vibe: Number(pump.vibe.toFixed(2)),
      fault: pump.fault,
      faultTick: pump.faultTick,
    })),
    recentLogs: logs.slice(0, 12).map((entry) => ({
      time: entry.time,
      level: entry.level,
      message: entry.message,
    })),
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      pumpId: ticket.pumpId,
      severity: ticket.severity,
      status: ticket.status,
      stage: getTicketStage(ticket, tick),
      mttrMinutes: ticket.status === 'resolved' ? getOpenMinutes(ticket, tick) : null,
      slaRemainingMinutes: getSlaRemaining(ticket, tick),
      assignedEngineerId: ticket.assignedEngineerId,
      escalated: ticket.escalated,
    })),
    engineers: engineers.map((engineer) => ({
      id: engineer.id,
      name: engineer.name,
      status: engineer.status,
      location: engineer.location,
      currentAssignment: engineer.currentAssignment,
      etaMinutes: engineer.etaMinutes,
      skillset: engineer.skillset,
    })),
  }
}

async function askGemini(userMessage, telemetryContext) {
  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: userMessage,
      telemetryContext,
    }),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error || 'Gemini request failed')
  }

  return payload
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <div className={`metric-card ${tone ? `metric-card-${tone}` : ''}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  )
}

function StagePipeline({ stage }) {
  const currentIndex = TICKET_STAGES.indexOf(stage)

  return (
    <div className="stage-pipeline">
      {TICKET_STAGES.map((item, index) => (
        <div
          key={item}
          className={`stage-pill ${index < currentIndex ? 'done' : ''} ${item === stage ? 'active' : ''}`}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

function App() {
  const [accounts, setAccounts] = useState(createInitialAccounts)
  const [engineerProfiles, setEngineerProfiles] = useState(createInitialEngineerProfiles)
  const [authUser, setAuthUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [accountModalForm, setAccountModalForm] = useState({ name: '', username: '', password: '' })
  const [accountModalNotice, setAccountModalNotice] = useState('')
  const [managerTicketFilter, setManagerTicketFilter] = useState('all')
  const [engineerTab, setEngineerTab] = useState('myTickets')

  const [telemetryState, setTelemetryState] = useState(createInitialState)
  const [pumpHistoryLive, setPumpHistoryLive] = useState(createInitialPumpHistoryLive)
  const [selectedId, setSelectedId] = useState('PMP-04')
  const [clock, setClock] = useState(formatClock)
  const [tick, setTick] = useState(0)
  const [logs, setLogs] = useState(() => [
    { id: 'log-1', time: formatClock(), message: 'Hack Island telemetry online', level: 'ok' },
    { id: 'log-2', time: formatClock(), message: 'INC-2404 active at South Output', level: 'warn' },
  ])
  const [tickets, setTickets] = useState(createInitialTickets)
  const [managerTab, setManagerTab] = useState('dashboard')
  const [selectedTicketId, setSelectedTicketId] = useState('INC-2404')
  const [selectedEngineerId, setSelectedEngineerId] = useState('ENG-02')
  const [pumpHistoryFocus, setPumpHistoryFocus] = useState('PMP-04')
  const [expandedReports, setExpandedReports] = useState([])
  const [historyFilters, setHistoryFilters] = useState({
    pump: 'all',
    severity: 'all',
    dateRange: '30d',
    resolution: 'all',
  })
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'boot-msg',
      role: 'assistant',
      text:
        'AI copilot online. Ask for root-cause analysis, dispatch choices, production impact, or a management summary.',
      ts: formatClock(),
    },
  ])
  const [isAiBusy, setIsAiBusy] = useState(false)
  const [ticketUpdateInput, setTicketUpdateInput] = useState('')
  const statusByPumpRef = useRef({})
  const tickRef = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatClock())
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

          // Cycle faults across pumps so each unit demonstrates warn/crit states over time.
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
    }, 1500)

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

    if (tick % 10 === 0) {
      const nominal = telemetryState.filter((pump) => getStatus(pump) === 'ok')
      if (nominal.length) {
        nextLogs.push({
          id: `nominal-${tick}`,
          time: formatClock(now),
          message: `${nominal.map((pump) => pump.id).join(', ')} - nominal`,
          level: 'ok',
        })
      }
    }

    setTickets((previous) => {
      const next = [...previous]
      const engineersNow = deriveEngineers(engineerProfiles, next, tick)
      let createdCount = 0
      let updatedCount = 0

      telemetryState.forEach((pump) => {
        const status = getStatus(pump)
        if (status === 'ok') return

        const openTicketIndex = next.findIndex((ticket) => ticket.pumpId === pump.id && ticket.status === 'open')
        if (openTicketIndex >= 0) {
          const openTicket = next[openTicketIndex]
          const priorSnapshotStatus = openTicket.reportedSnapshot?.status || null

          // Keep incident reports synchronized with live incident changes (e.g. warn -> crit).
          if (priorSnapshotStatus !== status) {
            const snapshot = buildPumpSnapshot(pump, now)
            next[openTicketIndex] = {
              ...openTicket,
              severity: getSeverityLabel(pump),
              report: buildIncidentReport(pump, snapshot),
              reportedSnapshot: snapshot,
              thread: [
                createThreadEntry(
                  { name: 'System', role: 'system' },
                  `Incident report refreshed from live telemetry (${status.toUpperCase()}).`,
                  now,
                ),
                ...openTicket.thread,
              ],
            }
            updatedCount += 1
          }

          return
        }

        const snapshot = buildPumpSnapshot(pump, now)
        const recommendedEngineer = recommendEngineerForPump(pump, engineersNow)

        next.unshift({
          id: `INC-${String(Date.now() + Math.floor(Math.random() * 1000)).slice(-4)}`,
          pumpId: pump.id,
          severity: getSeverityLabel(pump),
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
          thread: [
            createThreadEntry(
              { name: 'System', role: 'system' },
              `Ticket auto-created from ${status.toUpperCase()} telemetry threshold breach.`,
              now,
            ),
          ],
        })
        createdCount += 1
      })

      return createdCount || updatedCount ? next : previous
    })

    if (nextLogs.length) {
      setLogs((previous) => [...nextLogs.reverse(), ...previous].slice(0, 48))
    }
  }, [tick, telemetryState, engineerProfiles])

  useEffect(() => {
    if (tick === 0) return

    setPumpHistoryLive((previous) => {
      const next = { ...previous }

      telemetryState.forEach((pump) => {
        const current = next[pump.id] || pumpHistorySeed[pump.id]
        const status = getStatus(pump)
        const health = clamp(
          Math.round(100 - (pump.temp - 65) * 1.2 - (pump.vibe - 24) * 1.5 - Math.max(0, 125 - pump.pressure) * 0.7),
          20,
          100,
        )

        next[pump.id] = {
          ...current,
          healthTimeline: [...current.healthTimeline.slice(-29), health],
          sensorEvents: current.sensorEvents + (status === 'crit' ? 1 : 0),
          sensorReliability: clamp(current.sensorReliability - (status === 'crit' ? 0.4 : status === 'warn' ? 0.2 : -0.1), 75, 99),
        }
      })

      return next
    })
  }, [tick, telemetryState])

  const openTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'open').sort((left, right) => new Date(right.openedAt) - new Date(left.openedAt)),
    [tickets],
  )

  const sortedTickets = useMemo(
    () => [...tickets].sort((left, right) => new Date(right.openedAt) - new Date(left.openedAt)),
    [tickets],
  )

  const isManager = authUser?.role === 'manager'
  const ownEngineerId = authUser?.engineerId || null
  const ownEngineerProfile = useMemo(
    () => engineerProfiles.find((profile) => profile.id === ownEngineerId) ?? null,
    [engineerProfiles, ownEngineerId],
  )

  const visibleTickets = useMemo(() => {
    if (isManager) {
      if (managerTicketFilter === 'open') return sortedTickets.filter((ticket) => ticket.status === 'open')
      if (managerTicketFilter === 'resolved') return sortedTickets.filter((ticket) => ticket.status === 'resolved')
      return sortedTickets
    }

    if (!ownEngineerId) return []
    return sortedTickets.filter((ticket) => ticket.assignedEngineerId === ownEngineerId)
  }, [isManager, managerTicketFilter, ownEngineerId, sortedTickets])

  const selectedTicket = useMemo(
    () => visibleTickets.find((ticket) => ticket.id === selectedTicketId) ?? visibleTickets[0] ?? null,
    [selectedTicketId, visibleTickets],
  )

  useEffect(() => {
    if (!selectedTicket && visibleTickets[0]) {
      setSelectedTicketId(visibleTickets[0].id)
      return
    }

    if (selectedTicketId && !visibleTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(visibleTickets[0]?.id ?? '')
    }
  }, [selectedTicket, selectedTicketId, visibleTickets])

  const engineers = useMemo(() => deriveEngineers(engineerProfiles, tickets, tick), [engineerProfiles, tickets, tick])
  const selectedEngineer = useMemo(
    () => engineers.find((engineer) => engineer.id === selectedEngineerId) ?? engineers[0] ?? null,
    [engineers, selectedEngineerId],
  )

  const summaryLine = useMemo(() => {
    const crits = telemetryState.filter((pump) => getStatus(pump) === 'crit').length
    const warns = telemetryState.filter((pump) => getStatus(pump) === 'warn').length

    if (crits > 0) return `${crits} CRITICAL - IMMEDIATE ACTION REQUIRED`
    if (warns > 0) return `${warns} WARNING - MONITORING ELEVATED`
    return `${telemetryState.length} UNITS MONITORED - SYSTEM NOMINAL`
  }, [telemetryState])

  const riskScore = useMemo(() => getRiskScore(telemetryState, tickets, tick), [telemetryState, tickets, tick])
  const riskBand = getRiskBand(riskScore)

  const kpis = useMemo(() => {
    const activeIncidents = openTickets.length
    const uptime = clamp(99.3 - activeIncidents * 1.8 - riskScore * 0.03, 82.1, 99.9)
    const engineersOnCall = engineers.filter((engineer) => engineer.status !== 'Off Shift').length
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
    const incidents24h = tickets.filter((ticket) => new Date(ticket.openedAt).getTime() >= twentyFourHoursAgo)
    const estimatedProductionLoss = incidents24h.reduce((sum, ticket) => {
      if (ticket.severity === 'high') return sum + 18400
      if (ticket.severity === 'medium') return sum + 7600
      return sum + 2300
    }, 0)

    return {
      uptime: `${uptime.toFixed(1)}%`,
      activeIncidents,
      engineersOnCall,
      estimatedProductionLoss,
    }
  }, [engineers, openTickets, riskScore, tickets])

  const telemetryContext = useMemo(
    () => buildTelemetryContext(telemetryState, selectedId, logs, summaryLine, tickets, engineers, riskScore, tick),
    [engineers, logs, riskScore, selectedId, summaryLine, telemetryState, tickets, tick],
  )

  const pumpInsights = useMemo(
    () =>
      PUMPS.map((pump) => {
        const history = pumpHistoryLive[pump.id]
        const failures90d = tickets.filter((ticket) => ticket.pumpId === pump.id).length
        const latestScore = history.healthTimeline.at(-1)

        return {
          ...pump,
          ...history,
          failures90d,
          latestScore,
        }
      }),
    [pumpHistoryLive, tickets],
  )

  const filteredHistory = useMemo(() => {
    const now = Date.now()
    const ranges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      all: Number.POSITIVE_INFINITY,
    }

    return [...tickets]
      .filter((ticket) => (historyFilters.pump === 'all' ? true : ticket.pumpId === historyFilters.pump))
      .filter((ticket) =>
        historyFilters.severity === 'all' ? true : ticket.severity === historyFilters.severity,
      )
      .filter((ticket) =>
        historyFilters.resolution === 'all' ? true : ticket.status === historyFilters.resolution,
      )
      .filter((ticket) => now - new Date(ticket.openedAt).getTime() <= ranges[historyFilters.dateRange])
      .sort((left, right) => new Date(right.openedAt) - new Date(left.openedAt))
  }, [historyFilters, tickets])

  const submitAiPrompt = async (prompt, options = {}) => {
    const trimmed = prompt.trim()
    if (!trimmed || isAiBusy) return

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      ts: formatClock(),
    }

    setChatMessages((previous) => [userMessage, ...previous])
    setIsAiBusy(true)

    try {
      const response = await askGemini(trimmed, telemetryContext)
      const assistantMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: response.text,
        ts: formatClock(),
      }
      setChatMessages((previous) => [assistantMessage, ...previous])

      if (options.ticketId) {
        setTickets((previous) =>
          previous.map((ticket) =>
            ticket.id === options.ticketId
              ? {
                  ...ticket,
                  escalated: true,
                  thread: [
                    createThreadEntry({ name: 'System', role: 'system' }, `AI escalation draft: ${response.text}`),
                    ...ticket.thread,
                  ],
                }
              : ticket,
          ),
        )
      }
    } catch (error) {
      const errorMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: `Flare request failed: ${error.message}`,
        ts: formatClock(),
      }
      setChatMessages((previous) => [errorMessage, ...previous])

      if (options.ticketId) {
        setTickets((previous) =>
          previous.map((ticket) =>
            ticket.id === options.ticketId
              ? {
                  ...ticket,
                  thread: [
                    createThreadEntry({ name: 'System', role: 'system' }, `Escalation attempt failed: ${error.message}`),
                    ...ticket.thread,
                  ],
                }
              : ticket,
          ),
        )
      }
    } finally {
      setIsAiBusy(false)
    }
  }

  const sendToAi = async () => {
    const message = chatInput.trim()
    if (!message) return
    setChatInput('')
    await submitAiPrompt(message)
  }

  const injectFault = () => {
    let targetPump = null

    setTelemetryState((previous) => {
      const candidates = previous.filter((pump) => !pump.fault)
      if (!candidates.length) return previous

      targetPump = candidates[Math.floor(Math.random() * candidates.length)]
      return previous.map((pump) => {
        if (pump.id !== targetPump.id) return pump

        return {
          ...pump,
          fault: true,
          faultTick: 0,
          warnTick: tickRef.current,
          temp: Math.max(pump.temp + 14, 88),
          pressure: Math.max(pump.pressure - 18, 108),
          flow: Math.max(pump.flow - 40, 240),
          vibe: Math.max(pump.vibe + 20, 49),
        }
      })
    })

    if (!targetPump) return

    const recommendedEngineer = recommendEngineerForPump(targetPump, engineers)
    const snapshot = buildPumpSnapshot({
      ...targetPump,
      temp: targetPump.temp + 14,
      pressure: targetPump.pressure - 18,
      flow: targetPump.flow - 40,
      vibe: targetPump.vibe + 20,
    })
    const newTicket = {
      id: `INC-${String(Date.now()).slice(-4)}`,
      pumpId: targetPump.id,
      severity: getSeverityLabel({ ...targetPump, temp: targetPump.temp + 14, vibe: targetPump.vibe + 20, pressure: targetPump.pressure - 18 }),
      status: 'open',
      workflowStatus: 'assigned',
      openedTick: tick,
      openedAt: new Date().toISOString(),
      resolvedAt: null,
      assignedEngineerId: recommendedEngineer?.id ?? null,
      responseTargetMinutes: recommendedEngineer?.id ? 45 : 60,
      report: buildIncidentReport(targetPump, snapshot),
      reportedSnapshot: snapshot,
      dispatchRecommendation: recommendedEngineer
        ? `${recommendedEngineer.name} recommended based on zone ${recommendedEngineer.homeZone}, current status ${recommendedEngineer.status}, and fit with ${targetPump.zone}.`
        : 'No active engineer recommendation available. Escalate to senior engineering now.',
      escalated: false,
      thread: [
        createThreadEntry({ name: 'System', role: 'system' }, `Ticket opened for ${targetPump.name}. Auto-assignment recommendation prepared.`),
      ],
    }

    setTickets((previous) => [newTicket, ...previous])
    setSelectedTicketId(newTicket.id)
    setSelectedId(targetPump.id)
    setManagerTab('ongoingTickets')
    setLogs((previous) => [
      { id: `fault-${Date.now()}`, time: formatClock(), message: `${targetPump.id} - fault injected, ticket ${newTicket.id} opened`, level: 'warn' },
      ...previous,
    ])
  }

  useEffect(() => {
    if (!authUser || !isManager) return

    const onKeyDown = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase()
      const isTypingTarget =
        targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || event.target?.isContentEditable

      if (isTypingTarget || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      if (event.key.toLowerCase() !== 'p') return

      event.preventDefault()
      injectFault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [authUser, isManager, injectFault])

  const resetAll = () => {
    const resolvedAt = new Date().toISOString()
    setTelemetryState(createNominalState())
    statusByPumpRef.current = {}
    setSelectedId('PMP-01')
    setTick(0)
    tickRef.current = 0
    setTickets((previous) =>
      previous.map((ticket) =>
        ticket.status === 'open'
          ? {
              ...ticket,
              status: 'resolved',
              workflowStatus: 'resolved',
              resolvedAt,
              thread: [createThreadEntry({ name: 'System', role: 'system' }, 'Ticket resolved during full system reset.'), ...ticket.thread],
            }
          : ticket,
      ),
    )
    setLogs([{ id: `reset-${Date.now()}`, time: formatClock(), message: 'System reset - all pumps nominal', level: 'ok' }])
  }

  const toggleReportExpansion = (ticketId) => {
    setExpandedReports((previous) =>
      previous.includes(ticketId) ? previous.filter((id) => id !== ticketId) : [...previous, ticketId],
    )
  }

  const sendTicketUpdate = () => {
    if (!selectedTicket || !ticketUpdateInput.trim()) return

    const actor =
      authUser?.role === 'manager'
        ? { name: authUser.name, role: 'manager' }
        : { name: authUser?.name || 'Engineer', role: 'engineer' }

    setTickets((previous) =>
      previous.map((ticket) =>
        ticket.id === selectedTicket.id
          ? {
              ...ticket,
              thread: [createThreadEntry(actor, ticketUpdateInput.trim()), ...ticket.thread],
            }
          : ticket,
      ),
    )
    setTicketUpdateInput('')
  }

  const assignTicketToEngineer = (ticketId, engineerId) => {
    if (!engineerId) return
    const engineer = engineers.find((item) => item.id === engineerId)
    const ticket = tickets.find((item) => item.id === ticketId)
    const targetZone = ticket ? PUMP_BY_ID[ticket.pumpId]?.zone : null

    setTickets((previous) =>
      previous.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              assignedEngineerId: engineerId,
              workflowStatus: 'assigned',
              thread: [
                createThreadEntry(
                  { name: authUser?.name || 'Manager', role: 'manager' },
                  `Assigned ${engineer?.name || engineerId} to this ticket.`,
                ),
                ...ticket.thread,
              ],
            }
          : ticket,
      ),
    )

    if (engineer) {
      setEngineerProfiles((previous) =>
        previous.map((profile) =>
          profile.id === engineerId
            ? { ...profile, onCall: true, isActive: true, currentLocation: targetZone || profile.currentLocation, etaMinutes: 18 }
            : profile,
        ),
      )
    }
  }

  const updateTicketStatus = (ticketId, workflowStatus) => {
    const now = new Date()
    const status = workflowStatus === 'resolved' ? 'resolved' : 'open'

    setTickets((previous) =>
      previous.map((ticket) => {
        if (ticket.id !== ticketId) return ticket

        const threadEntry =
          workflowStatus === 'resolved'
            ? `Marked ticket as resolved.`
            : `Updated ticket status to ${toReadableStatus(workflowStatus)}.`

        return {
          ...ticket,
          workflowStatus,
          status,
          resolvedAt: workflowStatus === 'resolved' ? now.toISOString() : ticket.resolvedAt,
          thread: [
            createThreadEntry(
              authUser?.role === 'manager'
                ? { name: authUser.name, role: 'manager' }
                : { name: authUser?.name || 'Engineer', role: 'engineer' },
              threadEntry,
              now,
            ),
            ...ticket.thread,
          ],
        }
      }),
    )

    const resolvedTicket = tickets.find((ticket) => ticket.id === ticketId)
    if (workflowStatus === 'resolved' && resolvedTicket) {
      const baseline = PUMP_BY_ID[resolvedTicket.pumpId]
      setTelemetryState((previous) =>
        previous.map((pump) =>
          pump.id === resolvedTicket.pumpId
            ? { ...pump, fault: false, faultTick: 0, warnTick: null, temp: baseline.temp, pressure: baseline.pressure, flow: baseline.flow, vibe: baseline.vibe }
            : pump,
        ),
      )
      setLogs((previous) => [
        {
          id: `resolve-${Date.now()}`,
          time: formatClock(now),
          message: `${resolvedTicket.pumpId} returned to nominal. ${resolvedTicket.id} resolved.`,
          level: 'ok',
        },
        ...previous,
      ])
    }
  }

  const escalateTicket = async (ticket) => {
    const pump = PUMP_BY_ID[ticket.pumpId]
    await submitAiPrompt(
      `Draft a concise escalation message for ${ticket.id}. Pump: ${pump.name}. Severity: ${ticket.severity}. Current stage: ${getTicketStage(ticket, tick)}. Include business risk, requested support, and immediate next steps.`,
      { ticketId: ticket.id },
    )
  }

  const printIncidentHistory = () => {
  const tableHTML = document.querySelector('.incident-table').outerHTML;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Incident Reports</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
          th { background: #f0f0f0; }
          .severity-pill { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          .severity-high { background: #fee2e2; color: #991b1b; }
          .severity-medium { background: #fef3c7; color: #92400e; }
          .severity-low { background: #d1fae5; color: #065f46; }
          .link-btn { display: none; }
          .expanded-row { display: none; }
        </style>
      </head>
      <body>
        <h2>Incident Reports</h2>
        ${tableHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

  const handleLogin = (event) => {
    event.preventDefault()
    const username = loginForm.username.trim().toLowerCase()
    const password = loginForm.password.trim()

    const account = accounts.find(
      (item) => item.username.toLowerCase() === username && item.password === password,
    )

    if (!account) {
      setLoginError('Invalid username or password.')
      return
    }

    setAuthUser(account)
    setLoginError('')
    setAccountModalForm({ name: account.name, username: account.username, password: account.password })
    setAccountModalNotice('')

    if (account.role !== 'manager' && account.engineerId) {
      setSelectedEngineerId(account.engineerId)
    }
  }

  const handleLogout = () => {
    setAuthUser(null)
    setLoginForm({ username: '', password: '' })
    setLoginError('')
    setTicketUpdateInput('')
    setAccountModalOpen(false)
    setAccountModalNotice('')
  }

  const updateOwnAccount = (event) => {
    event.preventDefault()
    if (!authUser) return

    const nextName = accountModalForm.name.trim()
    const nextUsername = accountModalForm.username.trim().toLowerCase()
    const nextPassword = accountModalForm.password.trim()
    if (!nextName || !nextUsername || !nextPassword) {
      setAccountModalNotice('Name, username, and password are required.')
      return
    }

    setAccounts((previous) =>
      previous.map((account) =>
        account.id === authUser.id
          ? { ...account, name: nextName, username: nextUsername, password: nextPassword }
          : account,
      ),
    )
    if (authUser.engineerId) {
      setEngineerProfiles((previous) =>
        previous.map((profile) =>
          profile.id === authUser.engineerId ? { ...profile, name: nextName, updatedAt: new Date().toISOString() } : profile,
        ),
      )
    }
    setAuthUser((previous) => (previous ? { ...previous, name: nextName, username: nextUsername, password: nextPassword } : previous))
    setAccountModalNotice('Account updated.')
  }

  const updateEngineerProfile = (profileId, updates) => {
    setEngineerProfiles((previous) =>
      previous.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              ...updates,
              etaMinutes: Math.max(0, Number(updates.etaMinutes ?? profile.etaMinutes) || 0),
              updatedAt: new Date().toISOString(),
            }
          : profile,
      ),
    )
  }

  const selectedPumpHistory = pumpInsights.find((pump) => pump.id === pumpHistoryFocus) ?? pumpInsights[0]
  const selectedEngineerAssignment = ownEngineerId
    ? openTickets.find((ticket) => ticket.assignedEngineerId === ownEngineerId) ?? null
    : null

  const workspaceView = isManager ? 'manager' : 'engineer'

  const openAccountModal = () => {
    if (!authUser) return
    setAccountModalForm({
      name: authUser.name,
      username: authUser.username,
      password: authUser.password,
    })
    setAccountModalNotice('')
    setAccountModalOpen(true)
  }

  if (!authUser) {
    return (
      <div className="login-shell">
        <section className="login-card surface">
          <div className="eyebrow">CHEVRON HACK ISLAND</div>
          <h1>Operations Login</h1>
          <p className="login-copy">
            Sign in as manager or engineer to access the proper workspace.
          </p>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Username
              <input
                type="text"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((previous) => ({ ...previous, username: event.target.value }))
                }
                placeholder="manager"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="Enter password"
              />
            </label>
            {loginError ? <p className="form-error">{loginError}</p> : null}
            <button type="submit" className="btn">SIGN IN</button>
          </form>

          <div className="login-hint">
            <div>Demo manager: `manager` / `manager123`</div>
            <div>Demo engineers use generated usernames with `engineer123`.</div>
          </div>
        </section>
      </div>
    )
  }

  return (
  <div className="ops-shell">
  <header className="topbar surface" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <img src="/image.png" alt="logo" style={{ height: '40px' }} />
  </div>

  <div className={`risk-chip risk-chip-${riskBand}`}>
    <span>Risk Heat Score</span>
    <strong>{riskScore}</strong>
  </div>

  <div className="topbar-controls">
    <div className="user-badge">
      <span>{authUser.role.toUpperCase()}</span>
      <button type="button" className="user-name-btn" onClick={openAccountModal}>
        {authUser.name}
      </button>
      <button type="button" className="link-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  </div>
</header>
      <section className="kpi-strip">
        <MetricCard label="Uptime %" value={kpis.uptime} detail="Rolling 24h asset availability" tone="ok" />
        <MetricCard
          label="Active Incidents"
          value={String(kpis.activeIncidents)}
          detail="Open telemetry-driven tickets"
          tone={openTickets.length ? 'warn' : 'ok'}
        />
        <MetricCard
          label="Engineers On Call"
          value={String(kpis.engineersOnCall)}
          detail="Shift-active roster coverage"
        />
        <MetricCard
          label="Est. Production Loss Today"
          value={`$${kpis.estimatedProductionLoss.toLocaleString()}`}
          detail="Projected daily impact"
          tone={kpis.estimatedProductionLoss ? 'crit' : 'ok'}
        />
      </section>

      {workspaceView === 'manager' ? (
        <>
          <nav className="tab-strip">
            {MANAGER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={managerTab === tab.id ? 'active' : ''}
                onClick={() => setManagerTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {managerTab === 'dashboard' && (
            <section className="manager-grid">
              <section className="surface map-surface">
                <div className="map-title">
                  HACK ISLAND - <span>FIELD OPS GRID</span>
                </div>
                <div className="live-indicator">
                  <div className="dot"></div>
                  <span>{clock}</span>
                </div>
                <svg className="island-map" viewBox="0 0 700 500" role="img" aria-label="Pump telemetry map">
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <rect width="700" height="500" fill="#060d14" />
                  <g stroke="#0d1a24" strokeWidth="0.5" opacity="0.7">
                    <line x1="0" y1="50" x2="700" y2="50" />
                    <line x1="0" y1="100" x2="700" y2="100" />
                    <line x1="0" y1="150" x2="700" y2="150" />
                    <line x1="0" y1="200" x2="700" y2="200" />
                    <line x1="0" y1="250" x2="700" y2="250" />
                    <line x1="0" y1="300" x2="700" y2="300" />
                    <line x1="0" y1="350" x2="700" y2="350" />
                    <line x1="0" y1="400" x2="700" y2="400" />
                    <line x1="0" y1="450" x2="700" y2="450" />
                    <line x1="70" y1="0" x2="70" y2="500" />
                    <line x1="140" y1="0" x2="140" y2="500" />
                    <line x1="210" y1="0" x2="210" y2="500" />
                    <line x1="280" y1="0" x2="280" y2="500" />
                    <line x1="350" y1="0" x2="350" y2="500" />
                    <line x1="420" y1="0" x2="420" y2="500" />
                    <line x1="490" y1="0" x2="490" y2="500" />
                    <line x1="560" y1="0" x2="560" y2="500" />
                    <line x1="630" y1="0" x2="630" y2="500" />
                  </g>
                  <polygon
                    points="120,420 90,340 110,260 160,200 200,160 280,120 360,100 440,110 520,140 570,200 590,270 570,350 530,410 460,450 380,460 300,455 220,450 160,440"
                    fill="#0f1e12"
                    stroke="#1a3020"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="220,240 260,200 320,190 380,200 420,230 400,270 360,280 300,285 260,270"
                    fill="#142018"
                  />
                  <polygon points="300,160 340,150 380,165 360,195 320,195 295,180" fill="#142018" />
                  <g stroke="#1e3028" strokeWidth="1.5" strokeDasharray="6,3" fill="none" opacity="0.8">
                    <path d="M200,380 Q250,320 300,280 Q360,250 420,240" />
                    <path d="M300,280 Q290,230 280,180" />
                    <path d="M420,240 Q470,260 500,310" />
                    <path d="M200,380 Q180,340 190,300 Q200,260 220,240" />
                  </g>

                  {telemetryState.map((pump) => {
                    const status = getStatus(pump)
                    const color =
                      status === 'crit' ? '#ff3b3b' : status === 'warn' ? '#ffaa00' : '#00e87a'
                    const isSelected = pump.id === selectedId

                    return (
                      <g
                        key={pump.id}
                        className="pump-marker"
                        transform={`translate(${pump.x},${pump.y})`}
                        onClick={() => {
                          setSelectedId(pump.id)
                          setPumpHistoryFocus(pump.id)
                        }}
                      >
                        {(status === 'crit' || status === 'warn') && (
                          <circle
                            className="pulse-ring"
                            r="14"
                            fill="none"
                            stroke={color}
                            strokeWidth="1.5"
                            opacity="0.6"
                          />
                        )}
                        <circle
                          r={isSelected ? 13 : 11}
                          fill="#0a0e14"
                          stroke={color}
                          strokeWidth={isSelected ? 2 : 1.5}
                          filter={isSelected ? 'url(#glow)' : undefined}
                        />
                        <circle r="5" fill={color} />
                        <text
                          y="-18"
                          textAnchor="middle"
                          fontSize="10"
                          fontFamily="Share Tech Mono, monospace"
                          fill={color}
                        >
                          {`${pump.id} ${Math.round(pump.temp)} degC`}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </section>

              <aside className="surface telemetry-rail">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">LIVE TELEMETRY</div>
                  </div>
                </div>

                <div className="pump-list">
                  {telemetryState.map((pump) => {
                    const status = getStatus(pump)
                    const tempPct = Math.min(100, ((pump.temp - 60) / 70) * 100)
                    const barColor =
                      status === 'crit' ? 'var(--crit)' : status === 'warn' ? 'var(--warn)' : 'var(--ok)'

                    return (
                      <button
                        key={pump.id}
                        type="button"
                        className={`pump-card ${status} ${pump.id === selectedId ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedId(pump.id)
                          setPumpHistoryFocus(pump.id)
                        }}
                      >
                        <div className="pump-card-header">
                          <span className="pump-id">
                            {pump.id} <span className="pump-name">{pump.name}</span>
                          </span>
                          <span className={`pump-status status-${status}`}>{status.toUpperCase()}</span>
                        </div>
                        <div className="pump-metrics">
                          <div className="pump-metric">
                            <div className="pump-metric-label">TEMP degC</div>
                            <div className={`pump-metric-val ${getValClass(pump.temp, T_WARN, T_CRIT)}`}>
                              {Math.round(pump.temp)}
                            </div>
                          </div>
                          <div className="pump-metric">
                            <div className="pump-metric-label">FLOW L/MIN</div>
                            <div className={`pump-metric-val ${getValClass(310 - pump.flow, 70, 130)}`}>
                              {Math.round(pump.flow)}
                            </div>
                          </div>
                          <div className="pump-metric">
                            <div className="pump-metric-label">PRESSURE PSI</div>
                            <div className={`pump-metric-val ${getValClass(145 - pump.pressure, 30, 45)}`}>
                              {Math.round(pump.pressure)}
                            </div>
                          </div>
                          <div className="pump-metric">
                            <div className="pump-metric-label">VIBRATION Hz</div>
                            <div className={`pump-metric-val ${getValClass(pump.vibe, V_WARN, V_CRIT)}`}>
                              {Math.round(pump.vibe)}
                            </div>
                          </div>
                        </div>
                        <div className="temp-bar-wrap">
                          <div className="temp-bar-bg">
                            <div
                              className="temp-bar-fill"
                              style={{ width: `${tempPct.toFixed(1)}%`, background: barColor }}
                            ></div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="log-area">
                  <h3>EVENT LOG</h3>
                  {logs.map((entry) => (
                    <div key={entry.id} className="log-entry">
                      <span className="log-t">{entry.time}</span>
                      <span className={`log-${entry.level}`}>{entry.message}</span>
                    </div>
                  ))}
                </div>

              </aside>

              <aside className="surface ai-panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">LIVE QA VIA AI</div>
                  </div>
                </div>

                <div className="ai-context">
                  <h3>LIVE CONTEXT SNAPSHOT</h3>
                  <p>
                    Faulted pumps: <strong>{telemetryContext.faultedPumps.join(', ') || 'NONE'}</strong>
                  </p>
                  <p className="ai-summary">{summaryLine}</p>
                </div>

                <div className="ai-chat-feed">
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`ai-msg ai-msg-${message.role}`}>
                      <div className="ai-msg-meta">
                        <span>{message.role.toUpperCase()}</span>
                        <span>{message.ts}</span>
                      </div>
                      <p>{message.text}</p>
                    </div>
                  ))}
                </div>

                <form
                  className="ai-input-wrap"
                  onSubmit={(event) => {
                    event.preventDefault()
                    sendToAi()
                  }}
                >
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    className="ai-input"
                    placeholder="Ask Flare about anomalies, dispatch choices, production impact, or maintenance recommendations..."
                  ></textarea>
                  <button type="submit" className="btn" disabled={isAiBusy || !chatInput.trim()}>
                    {isAiBusy ? 'THINKING...' : 'ASK FLARE'}
                  </button>
                </form>
              </aside>
            </section>
          )}

          {managerTab === 'incidentReports' && (
            <section className="surface manager-surface incident-report-surface">
              <div className="panel-header panel-header-spread">
                <div>
                  <div className="eyebrow">ALL TICKET HISTORY LOG</div>
                  <h2>Incident Reports</h2>
                </div>
                <button type="button" className="btn narrow-btn" onClick={printIncidentHistory}>
                  EXPORT TO PDF
                </button>
              </div>

              <div className="filter-bar">
                <select
                  value={historyFilters.pump}
                  onChange={(event) => setHistoryFilters((previous) => ({ ...previous, pump: event.target.value }))}
                >
                  <option value="all">All Pumps</option>
                  {PUMPS.map((pump) => (
                    <option key={pump.id} value={pump.id}>
                      {pump.id}
                    </option>
                  ))}
                </select>
                <select
                  value={historyFilters.severity}
                  onChange={(event) => setHistoryFilters((previous) => ({ ...previous, severity: event.target.value }))}
                >
                  <option value="all">All Severities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={historyFilters.dateRange}
                  onChange={(event) => setHistoryFilters((previous) => ({ ...previous, dateRange: event.target.value }))}
                >
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All dates</option>
                </select>
                <select
                  value={historyFilters.resolution}
                  onChange={(event) =>
                    setHistoryFilters((previous) => ({ ...previous, resolution: event.target.value }))
                  }
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="table-shell">
                <table className="incident-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Pump</th>
                      <th>Severity</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>MTTR</th>
                      <th>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((ticket) => {
                      const expanded = expandedReports.includes(ticket.id)
                      return (
                        <>
                          <tr key={ticket.id}>
                            <td>{ticket.id}</td>
                            <td>{ticket.pumpId}</td>
                            <td>
                              <span className={`severity-pill severity-${ticket.severity}`}>{ticket.severity}</span>
                            </td>
                            <td>{formatDate(ticket.openedAt)}</td>
                            <td>{ticket.status}</td>
                            <td>{ticket.status === 'resolved' ? `${getOpenMinutes(ticket, tick)} min` : '--'}</td>
                            <td>
                              <button type="button" className="link-btn" onClick={() => toggleReportExpansion(ticket.id)}>
                                {expanded ? 'Hide' : 'Expand'}
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={`${ticket.id}-expanded`} className="expanded-row">
                              <td colSpan="7">
                                <div className="report-body">{ticket.report}</div>
                                {ticket.reportedSnapshot ? (
                                  <div className="report-body" style={{ marginTop: '8px', color: '#9ec5d8' }}>
                                    Snapshot {formatDate(ticket.reportedSnapshot.capturedAt)}: {ticket.reportedSnapshot.status.toUpperCase()} · temp {ticket.reportedSnapshot.temp} degC · pressure {ticket.reportedSnapshot.pressure} psi · flow {ticket.reportedSnapshot.flow} L/min · vibe {ticket.reportedSnapshot.vibe} Hz
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {managerTab === 'ongoingTickets' && (
            <section className="manager-split-grid ticket-workspace">
              <div className="surface tickets-column">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">ACTIVE RESPONSE</div>
                    <h2>Ongoing Tickets</h2>
                  </div>
                  <p>{openTickets.length} open / {tickets.length} total</p>
                </div>

                <div className="filter-bar">
                  <select
                    value={managerTicketFilter}
                    onChange={(event) => setManagerTicketFilter(event.target.value)}
                  >
                    <option value="all">All Tickets</option>
                    <option value="open">Open Tickets</option>
                    <option value="resolved">Resolved Tickets</option>
                  </select>
                </div>

                <div className="ticket-stack">
                  {visibleTickets.map((ticket) => {
                    const pump = PUMP_BY_ID[ticket.pumpId]
                    const stage = getTicketStage(ticket, tick)
                    const slaRemaining = getSlaRemaining(ticket, tick)
                    const engineer = engineers.find((item) => item.id === ticket.assignedEngineerId)
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        className={`ticket-card ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTicketId(ticket.id)}
                      >
                        <div className="ticket-card-top">
                          <div>
                            <strong>{ticket.id}</strong>
                            <p>
                              {pump.name} · {pump.zone}
                            </p>
                          </div>
                          <span className={`severity-pill severity-${ticket.severity}`}>{ticket.severity}</span>
                        </div>
                        <StagePipeline stage={stage} />
                        <div className="ticket-meta-grid">
                          <div>
                            <span>SLA</span>
                            <strong className={slaRemaining !== null && slaRemaining < 10 ? 'sla-breach' : ''}>
                              {slaRemaining} min
                            </strong>
                          </div>
                          <div>
                            <span>Assigned</span>
                            <strong>{engineer?.name ?? 'Unassigned'}</strong>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="surface ticket-detail-column">
                {selectedTicket ? (
                  <>
                    <div className="panel-header panel-header-spread">
                      <div>
                        <div className="eyebrow">LIVE TICKET DETAIL</div>
                        <h2>{selectedTicket.id}</h2>
                      </div>
                      <button
                        type="button"
                        className="btn narrow-btn"
                        onClick={() => escalateTicket(selectedTicket)}
                        disabled={isAiBusy}
                      >
                        ESCALATE
                      </button>
                    </div>

                    <div className="ticket-summary-grid">
                      <div className="detail-chip">
                        <span>Pump</span>
                        <strong>{selectedTicket.pumpId}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Status</span>
                        <strong>{toReadableStatus(selectedTicket.workflowStatus || selectedTicket.status)}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>SLA</span>
                        <strong>{getSlaRemaining(selectedTicket, tick)} min</strong>
                      </div>
                      <div className="detail-chip">
                        <span>MTTR Target</span>
                        <strong>{selectedTicket.responseTargetMinutes} min</strong>
                      </div>
                    </div>

                    <div className="controls">
                      <select
                        className="ticket-control-select"
                        value={selectedTicket.assignedEngineerId || ''}
                        onChange={(event) => assignTicketToEngineer(selectedTicket.id, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {engineers
                          .filter((engineer) => engineer.isActive)
                          .map((engineer) => (
                            <option key={engineer.id} value={engineer.id}>
                              {engineer.name} ({engineer.status})
                            </option>
                          ))}
                      </select>
                      <select
                        className="ticket-control-select"
                        value={selectedTicket.workflowStatus || 'in_progress'}
                        onChange={(event) => {
                          updateTicketStatus(selectedTicket.id, event.target.value)
                        }}
                      >
                        <option value="assigned">Assigned</option>
                        <option value="en_route">En Route</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    <div className="ticket-notes">
                      <h3>AI Dispatch Recommendation</h3>
                      <p>{selectedTicket.dispatchRecommendation}</p>
                    </div>

                    <div className="ticket-thread">
                      <h3>Live Chat Thread</h3>
                      {selectedTicket.thread.map((entry) => (
                        <div key={entry.id} className={`thread-entry thread-${entry.authorRole || 'system'}`}>
                          <div className="thread-meta">
                            <span>{entry.author}</span>
                            <span>{entry.time}</span>
                          </div>
                          <p>{entry.message}</p>
                        </div>
                      ))}
                    </div>

                    <div className="ticket-update-box">
                      <textarea
                        value={ticketUpdateInput}
                        onChange={(event) => setTicketUpdateInput(event.target.value)}
                        placeholder="Field or manager update..."
                      ></textarea>
                      <button type="button" className="btn" onClick={sendTicketUpdate}>
                        SEND UPDATE
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">No open tickets.</div>
                )}
              </div>

              <div className="surface engineers-column">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">DISPATCH VIEW</div>
                    <h2>Available Engineers</h2>
                  </div>
                </div>

                <div className="engineer-stack">
                  {engineers.map((engineer) => (
                    <button
                      key={engineer.id}
                      type="button"
                      className={`engineer-card ${selectedEngineerId === engineer.id ? 'selected' : ''}`}
                      onClick={() => setSelectedEngineerId(engineer.id)}
                    >
                      <div className="engineer-card-top">
                        <strong>{engineer.name}</strong>
                        <span className={`status-pill status-${engineer.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {engineer.status}
                        </span>
                      </div>
                      <p>{engineer.location}</p>
                      <p>Assignment: {engineer.currentAssignment}</p>
                      <p>ETA: {engineer.etaMinutes === null ? '--' : `${engineer.etaMinutes} min`}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {managerTab === 'pumpHistory' && (
            <section className="manager-split-grid history-grid">
              <div className="surface pump-history-column">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">30-DAY HEALTH</div>
                    <h2>Pump History</h2>
                  </div>
                </div>
                <div className="history-card-stack">
                  {pumpInsights.map((pump) => (
                    <button
                      key={pump.id}
                      type="button"
                      className={`history-card ${pumpHistoryFocus === pump.id ? 'selected' : ''}`}
                      onClick={() => setPumpHistoryFocus(pump.id)}
                    >
                      <div className="history-card-top">
                        <strong>{pump.id}</strong>
                        <span>{pump.failures90d} incidents / 90d</span>
                      </div>
                      <div className="mini-chart">
                        {pump.healthTimeline.map((point, index) => (
                          <span key={`${pump.id}-${index}`} style={{ height: `${point}%` }}></span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="surface history-detail-column">
                {selectedPumpHistory && (
                  <>
                    <div className="panel-header">
                      <div>
                        <div className="eyebrow">PREDICTIVE MAINTENANCE LAYER</div>
                        <h2>{selectedPumpHistory.id}</h2>
                      </div>
                      <p>{selectedPumpHistory.name}</p>
                    </div>

                    <div className="history-detail-grid">
                      <div className="detail-chip">
                        <span>Latest Health</span>
                        <strong>{selectedPumpHistory.latestScore}/100</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Sensor Reliability</span>
                        <strong>{selectedPumpHistory.sensorReliability}%</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Failure Frequency</span>
                        <strong>{selectedPumpHistory.failures90d} / 90d</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Zone</span>
                        <strong>{selectedPumpHistory.zone}</strong>
                      </div>
                    </div>

                    <div className="history-block">
                      <h3>Maintenance Compliance Tracker</h3>
                      <div className="compliance-grid">
                        {selectedPumpHistory.maintenance.map((item, index) => (
                          <span key={`${selectedPumpHistory.id}-m-${index}`} className={item ? 'ok' : 'missed'}>
                            {item ? 'OK' : 'MISS'}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="history-block">
                      <h3>Sensor Reliability Log</h3>
                      <p>
                        {selectedPumpHistory.sensorEvents} suspicious sensor events in the recent review window.
                      </p>
                    </div>

                    <div className="history-block">
                      <h3>AI Recommendation</h3>
                      <p>{selectedPumpHistory.recommendation}</p>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

        </>
      ) : (
        <>
          <nav className="tab-strip">
            {ENGINEER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={engineerTab === tab.id ? 'active' : ''}
                onClick={() => setEngineerTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {engineerTab === 'myTickets' && (
            <section className="manager-split-grid">
              <div className="surface tickets-column">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">MY ASSIGNMENTS</div>
                    <h2>My Tickets</h2>
                  </div>
                  <p>{visibleTickets.length} tickets</p>
                </div>
                <div className="ticket-stack">
                  {visibleTickets.map((ticket) => {
                    const pump = PUMP_BY_ID[ticket.pumpId]
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        className={`ticket-card ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTicketId(ticket.id)}
                      >
                        <div className="ticket-card-top">
                          <div>
                            <strong>{ticket.id}</strong>
                            <p>
                              {pump.name} · {pump.zone}
                            </p>
                          </div>
                          <span className={`severity-pill severity-${ticket.severity}`}>{ticket.severity}</span>
                        </div>
                        <StagePipeline stage={getTicketStage(ticket, tick)} />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="surface ticket-detail-column">
                {selectedTicket ? (
                  <>
                    <div className="panel-header">
                      <div>
                        <div className="eyebrow">LIVE TICKET</div>
                        <h2>{selectedTicket.id}</h2>
                      </div>
                      <p>{selectedTicket.pumpId}</p>
                    </div>
                    <StagePipeline stage={getTicketStage(selectedTicket, tick)} />
                    <div className="controls">
                      <select
                        value={selectedTicket.workflowStatus || 'in_progress'}
                        onChange={(event) => updateTicketStatus(selectedTicket.id, event.target.value)}
                      >
                        <option value="assigned">Assigned</option>
                        <option value="en_route">En Route</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div className="ticket-thread engineer-thread">
                      <h3>Live Thread</h3>
                      {selectedTicket.thread.map((entry) => (
                        <div key={entry.id} className={`thread-entry thread-${entry.authorRole || 'system'}`}>
                          <div className="thread-meta">
                            <span>{entry.author}</span>
                            <span>{entry.time}</span>
                          </div>
                          <p>{entry.message}</p>
                        </div>
                      ))}
                    </div>
                    <div className="ticket-update-box">
                      <textarea
                        value={ticketUpdateInput}
                        onChange={(event) => setTicketUpdateInput(event.target.value)}
                        placeholder="Send update from the field..."
                      ></textarea>
                      <button type="button" className="btn" onClick={sendTicketUpdate}>
                        POST FIELD UPDATE
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">No tickets are currently assigned.</div>
                )}
              </div>

              <div className="surface engineer-ai-side">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">MY PROFILE</div>
                    <h2>{ownEngineerProfile?.name || 'Engineer Profile'}</h2>
                  </div>
                </div>
                {ownEngineerProfile ? (
                  <div className="ticket-update-box">
                    <label>
                      Is Active
                      <select
                        value={ownEngineerProfile.isActive ? 'true' : 'false'}
                        onChange={(event) => updateEngineerProfile(ownEngineerProfile.id, { isActive: event.target.value === 'true' })}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                    <label>
                      On Call
                      <select
                        value={ownEngineerProfile.onCall ? 'true' : 'false'}
                        onChange={(event) => updateEngineerProfile(ownEngineerProfile.id, { onCall: event.target.value === 'true' })}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                    <label>
                      Current Location
                      <input
                        type="text"
                        value={ownEngineerProfile.currentLocation}
                        onChange={(event) => updateEngineerProfile(ownEngineerProfile.id, { currentLocation: event.target.value })}
                      />
                    </label>
                    <label>
                      Profile Photo URL
                      <input
                        type="text"
                        value={ownEngineerProfile.profilePhoto}
                        onChange={(event) => updateEngineerProfile(ownEngineerProfile.id, { profilePhoto: event.target.value })}
                      />
                    </label>
                    <label>
                      ETA Minutes
                      <input
                        type="number"
                        min="0"
                        value={ownEngineerProfile.etaMinutes}
                        onChange={(event) => updateEngineerProfile(ownEngineerProfile.id, { etaMinutes: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="empty-state">No profile attached to this account.</div>
                )}
              </div>
            </section>
          )}

          {engineerTab === 'mapLog' && (
            <section className="manager-grid">
              <section className="surface map-surface">
                <div className="map-title">
                  HACK ISLAND - <span>FIELD OPS GRID</span>
                </div>
                <div className="live-indicator">
                  <div className="dot"></div>
                  <span>{clock}</span>
                </div>
                <svg className="island-map" viewBox="0 0 700 500" role="img" aria-label="Pump telemetry map">
                  <rect width="700" height="500" fill="#060d14" />
                  {telemetryState.map((pump) => {
                    const status = getStatus(pump)
                    const color = status === 'crit' ? '#ff3b3b' : status === 'warn' ? '#ffaa00' : '#00e87a'
                    return (
                      <g key={pump.id} transform={`translate(${pump.x},${pump.y})`} onClick={() => setSelectedId(pump.id)}>
                        <circle r="11" fill="#0a0e14" stroke={color} strokeWidth="1.5" />
                        <circle r="5" fill={color} />
                      </g>
                    )
                  })}
                </svg>
              </section>

              <aside className="surface telemetry-rail">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">LIVE TELEMETRY</div>
                  </div>
                </div>
                <div className="pump-list">
                  {telemetryState.map((pump) => {
                    const status = getStatus(pump)
                    return (
                      <button key={pump.id} type="button" className={`pump-card ${status}`} onClick={() => setPumpHistoryFocus(pump.id)}>
                        <div className="pump-card-header">
                          <span className="pump-id">{pump.id}</span>
                          <span className={`pump-status status-${status}`}>{status.toUpperCase()}</span>
                        </div>
                        <div className="pump-metric-label">Temp {Math.round(pump.temp)} degC</div>
                      </button>
                    )
                  })}
                </div>
                <div className="log-area">
                  <h3>EVENT LOG</h3>
                  {logs.map((entry) => (
                    <div key={entry.id} className="log-entry">
                      <span className="log-t">{entry.time}</span>
                      <span className={`log-${entry.level}`}>{entry.message}</span>
                    </div>
                  ))}
                </div>
              </aside>

              <aside className="surface ai-panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">ASSISTED CONTEXT</div>
                  </div>
                </div>
                <div className="ai-context">
                  <h3>LIVE CONTEXT SNAPSHOT</h3>
                  <p>
                    Faulted pumps: <strong>{telemetryContext.faultedPumps.join(', ') || 'NONE'}</strong>
                  </p>
                  <p className="ai-summary">{summaryLine}</p>
                </div>
              </aside>
            </section>
          )}

          {engineerTab === 'incidentReports' && (
            <section className="surface manager-surface incident-report-surface">
              <div className="panel-header panel-header-spread">
                <div>
                  <div className="eyebrow">ALL TICKET HISTORY LOG</div>
                  <h2>Incident Reports</h2>
                </div>
              </div>
              <div className="table-shell">
                <table className="incident-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Pump</th>
                      <th>Severity</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>MTTR</th>
                      <th>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>{ticket.id}</td>
                        <td>{ticket.pumpId}</td>
                        <td>{ticket.severity}</td>
                        <td>{formatDate(ticket.openedAt)}</td>
                        <td>{ticket.status}</td>
                        <td>{ticket.status === 'resolved' ? `${getOpenMinutes(ticket, tick)} min` : '--'}</td>
                        <td>{ticket.report}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {engineerTab === 'pumpHistory' && (
            <section className="manager-split-grid history-grid">
              <div className="surface pump-history-column">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">30-DAY HEALTH</div>
                    <h2>Pump History</h2>
                  </div>
                </div>
                <div className="history-card-stack">
                  {pumpInsights.map((pump) => (
                    <button
                      key={pump.id}
                      type="button"
                      className={`history-card ${pumpHistoryFocus === pump.id ? 'selected' : ''}`}
                      onClick={() => setPumpHistoryFocus(pump.id)}
                    >
                      <div className="history-card-top">
                        <strong>{pump.id}</strong>
                        <span>{pump.failures90d} incidents / 90d</span>
                      </div>
                      <div className="mini-chart">
                        {pump.healthTimeline.map((point, index) => (
                          <span key={`${pump.id}-${index}`} style={{ height: `${point}%` }}></span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="surface history-detail-column">
                {selectedPumpHistory ? (
                  <>
                    <div className="panel-header">
                      <div>
                        <div className="eyebrow">CURRENT HISTORY DETAIL</div>
                        <h2>{selectedPumpHistory.id}</h2>
                      </div>
                      <p>{selectedPumpHistory.name}</p>
                    </div>
                    <div className="history-detail-grid">
                      <div className="detail-chip">
                        <span>Latest Health</span>
                        <strong>{selectedPumpHistory.latestScore}/100</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Sensor Reliability</span>
                        <strong>{selectedPumpHistory.sensorReliability}%</strong>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          )}

        </>
      )}

      {accountModalOpen && (
        <div className="account-modal-backdrop" role="presentation" onClick={() => setAccountModalOpen(false)}>
          <section className="surface account-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header panel-header-spread">
              <div>
                <div className="eyebrow">ACCOUNT SETTINGS</div>
                <h2>Update My Account</h2>
              </div>
              <button type="button" className="link-btn" onClick={() => setAccountModalOpen(false)}>
                CLOSE
              </button>
            </div>
            <form className="account-form account-form-modal" onSubmit={updateOwnAccount}>
              <input
                type="text"
                placeholder="Name"
                value={accountModalForm.name}
                onChange={(event) => setAccountModalForm((previous) => ({ ...previous, name: event.target.value }))}
              />
              <input
                type="text"
                placeholder="Username"
                value={accountModalForm.username}
                onChange={(event) => setAccountModalForm((previous) => ({ ...previous, username: event.target.value }))}
              />
              <input
                type="text"
                placeholder="Password"
                value={accountModalForm.password}
                onChange={(event) => setAccountModalForm((previous) => ({ ...previous, password: event.target.value }))}
              />
              <button type="submit" className="btn">SAVE ACCOUNT</button>
            </form>
            {accountModalNotice ? <div className="account-notice">{accountModalNotice}</div> : null}
          </section>
        </div>
      )}
    </div>
  )
}

export default App
