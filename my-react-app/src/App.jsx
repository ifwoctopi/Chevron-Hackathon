import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const PUMPS = [
  { id: 'PMP-01', name: 'North Intake', x: 220, y: 185, temp: 71, pressure: 138, flow: 312, vibe: 27 },
  { id: 'PMP-02', name: 'Central Hub', x: 320, y: 265, temp: 74, pressure: 144, flow: 305, vibe: 29 },
  { id: 'PMP-03', name: 'East Valve', x: 430, y: 232, temp: 69, pressure: 140, flow: 318, vibe: 26 },
  { id: 'PMP-04', name: 'South Output', x: 290, y: 380, temp: 73, pressure: 136, flow: 308, vibe: 30 },
  { id: 'PMP-05', name: 'West Station', x: 185, y: 305, temp: 70, pressure: 142, flow: 315, vibe: 28 },
]

const T_WARN = 85
const T_CRIT = 100
const V_WARN = 50
const V_CRIT = 70
const P_WARN = 115

const BASE_BY_ID = Object.fromEntries(PUMPS.map((pump) => [pump.id, pump]))

function createInitialState() {
  return PUMPS.map((pump) => ({ ...pump, fault: false, faultTick: 0 }))
}

function getStatus(pump) {
  if (pump.temp >= T_CRIT || pump.vibe >= V_CRIT) return 'crit'
  if (pump.temp >= T_WARN || pump.vibe >= V_WARN || pump.pressure <= P_WARN) return 'warn'
  return 'ok'
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

function makeLog(message, level) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: formatClock(),
    message,
    level,
  }
}

function App() {
  const [state, setState] = useState(createInitialState)
  const [selectedId, setSelectedId] = useState('PMP-01')
  const [clock, setClock] = useState(formatClock)
  const [logs, setLogs] = useState(() => [
    makeLog('Hack Island telemetry online', 'ok'),
    makeLog('5 pump units connected', 'ok'),
  ])
  const tickRef = useRef(0)

  const addLog = (message, level) => {
    setLogs((previous) => [makeLog(message, level), ...previous].slice(0, 31))
  }

  const injectFault = () => {
    setState((previous) => {
      const candidates = previous.filter((pump) => !pump.fault)
      if (!candidates.length) return previous

      const target = candidates[Math.floor(Math.random() * candidates.length)]
      const next = previous.map((pump) =>
        pump.id === target.id ? { ...pump, fault: true, faultTick: 0 } : pump,
      )

      addLog(`${target.id} - fault injected, overheating scenario active`, 'warn')
      return next
    })
  }

  const resetAll = () => {
    tickRef.current = 0
    setState(createInitialState())
    setLogs([makeLog('System reset - all pumps nominal', 'ok')])
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatClock())
      setState((previous) => {
        const next = previous.map((pump) => {
          if (pump.fault) {
            return {
              ...pump,
              faultTick: pump.faultTick + 1,
              temp: Math.min(122, pump.temp + 0.7 + Math.random() * 0.5),
              pressure: Math.max(92, pump.pressure - 0.3 - Math.random() * 0.2),
              flow: Math.max(185, pump.flow - 1 - Math.random() * 0.8),
              vibe: Math.min(92, pump.vibe + 0.8 + Math.random() * 0.5),
            }
          }

          const baseline = BASE_BY_ID[pump.id]
          return {
            ...pump,
            temp: Math.max(baseline.temp - 3, Math.min(baseline.temp + 3, jitter(pump.temp, 1.2))),
            pressure: Math.max(
              baseline.pressure - 8,
              Math.min(baseline.pressure + 8, jitter(pump.pressure, 3)),
            ),
            flow: Math.max(baseline.flow - 15, Math.min(baseline.flow + 15, jitter(pump.flow, 5))),
            vibe: Math.max(baseline.vibe - 3, Math.min(baseline.vibe + 3, jitter(pump.vibe, 1.5))),
          }
        })

        const tick = tickRef.current + 1
        tickRef.current = tick
        const pendingLogs = []

        if (tick % 4 === 0) {
          next.forEach((pump) => {
            const status = getStatus(pump)
            if (status === 'crit') {
              pendingLogs.push(
                makeLog(
                  `${pump.id} CRITICAL - temp ${Math.round(pump.temp)} degC, vibe ${Math.round(pump.vibe)}Hz`,
                  'crit',
                ),
              )
            } else if (status === 'warn' && pump.fault && pump.faultTick % 5 === 0) {
              pendingLogs.push(
                makeLog(`${pump.id} WARNING - temp rising ${Math.round(pump.temp)} degC`, 'warn'),
              )
            }
          })
        }

        if (tick % 10 === 0) {
          const nominal = next.filter((pump) => getStatus(pump) === 'ok')
          if (nominal.length) {
            pendingLogs.push(makeLog(`${nominal.map((pump) => pump.id).join(', ')} - nominal`, 'ok'))
          }
        }

        if (pendingLogs.length) {
          setLogs((previousLogs) => [...pendingLogs.reverse(), ...previousLogs].slice(0, 31))
        }

        return next
      })
    }, 1500)

    return () => clearInterval(timer)
  }, [])

  const faultCount = state.filter((pump) => pump.fault).length

  const summaryLine = useMemo(() => {
    const crits = state.filter((pump) => getStatus(pump) === 'crit').length
    const warns = state.filter((pump) => getStatus(pump) === 'warn').length

    if (crits > 0) return `${crits} CRITICAL - IMMEDIATE ACTION REQUIRED`
    if (warns > 0) return `${warns} WARNING - MONITORING ELEVATED`
    return `${state.length} UNITS MONITORED - SYSTEM NOMINAL`
  }, [state])

  return (
    <div className="app">
      <div className="map-area">
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

          {state.map((pump) => {
            const status = getStatus(pump)
            const color = status === 'crit' ? '#ff3b3b' : status === 'warn' ? '#ffaa00' : '#00e87a'
            const isSelected = pump.id === selectedId

            return (
              <g
                key={pump.id}
                className="pump-marker"
                transform={`translate(${pump.x},${pump.y})`}
                onClick={() => setSelectedId(pump.id)}
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
                  {`${pump.id}  ${Math.round(pump.temp)} degC`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>PUMP TELEMETRY</h2>
          <p>{summaryLine}</p>
        </div>

        <div className="pump-list">
          {state.map((pump) => {
            const status = getStatus(pump)
            const tempPct = Math.min(100, ((pump.temp - 60) / 70) * 100)
            const barColor =
              status === 'crit' ? 'var(--crit)' : status === 'warn' ? 'var(--warn)' : 'var(--ok)'

            return (
              <button
                key={pump.id}
                type="button"
                className={`pump-card ${status} ${pump.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(pump.id)}
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
                    <div className={`pump-metric-label`}>VIBRATION Hz</div>
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

        <div className="controls">
          <button className="btn btn-danger" type="button" onClick={injectFault}>
            {`INJECT FAULT${faultCount ? ` (${faultCount})` : ''}`}
          </button>
          <button className="btn" type="button" onClick={resetAll}>
            RESET
          </button>
        </div>
      </aside>
    </div>
  )
}

export default App
