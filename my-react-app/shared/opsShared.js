export const PUMPS = [
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

export const ENGINEER_DIRECTORY = [
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

export const MANAGER_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'ongoingTickets', label: 'Ongoing Tickets' },
  { id: 'incidentReports', label: 'Incident Reports' },
  { id: 'pumpHistory', label: 'Pump History' },
]

export const ENGINEER_TABS = [
  { id: 'myTickets', label: 'My Tickets' },
  { id: 'mapLog', label: 'Map & Event Log' },
  { id: 'incidentReports', label: 'Incident Reports' },
  { id: 'pumpHistory', label: 'Pump History' },
]

export const TICKET_STAGES = ['Detected', 'Assigned', 'En Route', 'In Progress', 'Resolved']

export const T_WARN = 85
export const T_CRIT = 100
export const V_WARN = 50
export const V_CRIT = 70
export const P_WARN = 115

export const PUMP_BY_ID = Object.fromEntries(PUMPS.map((pump) => [pump.id, pump]))

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

export function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function createThreadEntry(author, message, createdAt = new Date()) {
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

export function createInitialAccounts() {
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

export function createInitialEngineerProfiles() {
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

export function createNominalState() {
  return PUMPS.map((pump) => ({ ...pump, fault: false, faultTick: 0, faultCycles: 0, warnTick: null }))
}

export function createInitialState() {
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

export function toReadableStatus(status) {
  if (status === 'open') return 'Open'
  if (status === 'resolved') return 'Resolved'
  return status
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

export function getStatus(pump) {
  if (pump.temp >= T_CRIT || pump.vibe >= V_CRIT) return 'crit'
  if (pump.temp >= T_WARN || pump.vibe >= V_WARN || pump.pressure <= P_WARN) return 'warn'
  return 'ok'
}

export function getSeverityLabel(pump) {
  const status = getStatus(pump)
  if (status === 'crit') return 'high'
  if (status === 'warn') return 'medium'
  return 'low'
}

export function getValClass(value, warn, crit) {
  if (value >= crit) return 'val-crit'
  if (value >= warn) return 'val-warn'
  return 'val-ok'
}

export function jitter(value, range) {
  return value + (Math.random() - 0.5) * range
}

export function buildPumpSnapshot(pump, createdAt = new Date()) {
  return {
    capturedAt: createdAt.toISOString(),
    status: getStatus(pump),
    temp: Math.round(pump.temp),
    pressure: Math.round(pump.pressure),
    flow: Math.round(pump.flow),
    vibe: Math.round(pump.vibe),
  }
}

export function buildIncidentReport(pump, snapshot) {
  const severityLine =
    snapshot.status === 'crit'
      ? 'Critical telemetry breach detected.'
      : snapshot.status === 'warn'
        ? 'Warning threshold breach detected.'
        : 'Advisory telemetry anomaly detected.'

  return `AI incident summary: ${pump.name} in ${pump.zone}. ${severityLine} Snapshot at report time - temp ${snapshot.temp} degC, pressure ${snapshot.pressure} psi, flow ${snapshot.flow} L/min, vibe ${snapshot.vibe} Hz.`
}

export function buildPumpHistorySeed() {
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

export const pumpHistorySeed = buildPumpHistorySeed()

export function createInitialPumpHistoryLive() {
  return Object.fromEntries(
    Object.entries(pumpHistorySeed).map(([pumpId, history]) => [pumpId, { ...history, healthTimeline: [...history.healthTimeline] }]),
  )
}

export function createInitialTickets() {
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

export function createInitialLogs() {
  return [
    { id: 'log-1', time: formatClock(), message: 'Hack Island telemetry online', level: 'ok' },
    { id: 'log-2', time: formatClock(), message: 'INC-2404 active at South Output', level: 'warn' },
  ]
}

export function getOpenMinutes(ticket, tick) {
  if (ticket.status === 'resolved' && ticket.resolvedAt) {
    return Math.max(1, Math.round((new Date(ticket.resolvedAt) - new Date(ticket.openedAt)) / 60000))
  }

  return Math.max(1, (tick - ticket.openedTick) * 3)
}

export function getTicketStage(ticket, tick) {
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

export function getSlaRemaining(ticket, tick) {
  if (ticket.status === 'resolved') return null
  return ticket.responseTargetMinutes - getOpenMinutes(ticket, tick)
}

export function getRiskScore(telemetryState, tickets, tick) {
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

export function getRiskBand(score) {
  if (score < 30) return 'ok'
  if (score <= 70) return 'warn'
  return 'crit'
}

export function deriveEngineers(engineerProfiles, tickets, tick) {
  return engineerProfiles.map((engineer) => {
    const assignment = tickets
      .filter((ticket) => ticket.status === 'open' && ticket.assignedEngineerId === engineer.id)
      .sort((left, right) => new Date(right.openedAt) - new Date(left.openedAt))[0]

    if (!assignment) {
      return {
        ...engineer,
        status: engineer.isActive ? (engineer.onCall ? 'On Call' : 'Active') : 'Offline',
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

export function scoreEngineer(engineer, pump) {
  let score = 0
  if (engineer.homeZone === pump.zone) score += 4
  if (engineer.status === 'Active') score += 5
  if (engineer.status === 'On Call') score += 2
  if (engineer.skillset.some((skill) => pump.name.toLowerCase().includes(skill.split(' ')[0].toLowerCase()))) {
    score += 3
  }
  if (engineer.skillset.some((skill) => ['Thermals', 'Motor Diagnostics', 'Reliability', 'Flow Sensors'].includes(skill))) {
    score += 1
  }
  return score
}

export function recommendEngineerForPump(pump, engineers) {
  const ranked = [...engineers]
    .filter((engineer) => engineer.status !== 'Offline')
    .sort((left, right) => scoreEngineer(right, pump) - scoreEngineer(left, pump))

  return ranked[0] ?? null
}

export function buildTelemetryContext(state, selectedId, logs, summaryLine, tickets, engineers, riskScore, tick) {
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