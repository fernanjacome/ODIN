import { useState, useCallback, useEffect, useRef, type FormEvent } from 'react'
import {
  MdAssessment,
  MdAccountBalanceWallet,
  MdChevronLeft,
  MdChevronRight,
  MdLocalAtm,
  MdMenu,
  MdMemory,
  MdNotificationsActive,
  MdPeople,
  MdSignalWifi4Bar,
  MdSignalWifiOff,
  MdSwapHoriz,
} from 'react-icons/md'
import type { ActiveRunDto, AtmDto, EventDto, AlertDto, RunSummaryDto, CashEstimationDto, UserDto } from './types'
import { api, clearToken, getStoredToken, storeToken, type Session } from './api/client'
import { useSignalR } from './hooks/useSignalR'
import { SummaryCards } from './components/SummaryCards'
import { AtmGrid } from './components/AtmGrid'
import { AtmInsightPanel } from './components/AtmInsightPanel'
import { AlertsPanel } from './components/AlertsPanel'
import { ReportsPanel } from './components/ReportsPanel'
import { TransactionsPanel } from './components/TransactionsPanel'
import { UsersPanel } from './components/UsersPanel'
import { CashEstimationPanel } from './components/CashEstimationPanel'
import { NoActiveSession } from './components/NoActiveSession'
import { formatSessionCode } from './utils/sessionIdentity'

// ── Reloj simulado ─────────────────────────────────────────────────────────

interface ClockAnchor { simMs: number; realMs: number; speed: number; active: boolean }
type DashboardSection = 'atms' | 'alerts' | 'transactions' | 'estimation' | 'reports' | 'users'
type SimulatorStatus = 'running' | 'ready' | 'paused' | 'stopped' | 'disconnected'

function formatSimTime(ms: number) {
  return new Date(ms).toLocaleString('es-EC', {
    hour12: false, month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function simulatorInfo(status: SimulatorStatus) {
  if (status === 'running') return { label: 'Simulador ejecutando', color: '#15803d', connected: true }
  if (status === 'ready') return { label: 'Simulador preparado', color: '#2563eb', connected: true }
  if (status === 'paused') return { label: 'Simulador pausado', color: '#b45309', connected: false }
  if (status === 'stopped') return { label: 'Simulador finalizado', color: '#6b7280', connected: false }
  return { label: 'Simulador desconectado', color: '#dc2626', connected: false }
}

function SimulationHeaderStatus({
  activeRun,
  clockDisplay,
  clockActive,
  backendConnected,
  simulatorStatus,
  onVerifyBackend,
}: {
  activeRun: ActiveRunDto | null
  clockDisplay: string | null
  clockActive: boolean
  backendConnected: boolean
  simulatorStatus: SimulatorStatus
  onVerifyBackend?: () => void
}) {
  const simulator = simulatorInfo(simulatorStatus)
  const session = activeRun ? formatSessionCode(activeRun.randomSeed) : 'Sin sesión'
  const time = clockDisplay ?? 'sin hora'
  const speed = activeRun ? `${activeRun.speedMultiplier}x` : '-'
  const scenario = activeRun?.scenarioName ?? 'Sin simulación visible'

  return (
    <div
      title={`${scenario} | ${session} | ${simulator.label} | ${time}`}
      style={{
        marginLeft: 10,
        minWidth: 0,
        maxWidth: 760,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: `1px solid ${activeRun ? '#bfdbfe' : '#e5e7eb'}`,
        background: activeRun ? '#eff6ff' : '#f9fafb',
        borderRadius: 6,
        padding: '3px 9px',
        color: '#334155',
        fontSize: 11,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {backendConnected ? <MdSignalWifi4Bar size={15} color="#16a34a" /> : <MdSignalWifiOff size={15} color="#dc2626" />}
      <button type="button" onClick={onVerifyBackend} title="Verificar conexion con el backend" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: backendConnected ? '#15803d' : '#dc2626', fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
        {backendConnected ? 'Backend conectado' : 'Backend sin señal'}
      </button>
      <span style={{ width: 1, height: 15, background: '#cbd5e1', flexShrink: 0 }} />
      <MdMemory size={15} color={simulator.color} />
      <span style={{ color: simulator.color, fontWeight: 600, flexShrink: 0 }}>{simulator.label}</span>
      <span style={{ width: 1, height: 15, background: '#cbd5e1', flexShrink: 0 }} />
      <span style={{ color: '#1d4ed8', fontWeight: 600, flexShrink: 0 }}>{session}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: '#64748b' }}>{scenario}</span>
      <span style={{ width: 1, height: 15, background: '#cbd5e1', flexShrink: 0 }} />
      <span style={{ color: clockActive ? '#1d4ed8' : '#6b7280', fontFamily: 'monospace', fontWeight: 600, flexShrink: 0 }}>{time}</span>
      <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0 }}>{speed}</span>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [atms, setAtms] = useState<AtmDto[]>([])
  const [events, setEvents] = useState<EventDto[]>([])
  const [alerts, setAlerts] = useState<AlertDto[]>([])
  const [runs, setRuns] = useState<RunSummaryDto[]>([])
  const [activeRun, setActiveRun] = useState<ActiveRunDto | null>(null)
  const [cashEstimation, setCashEstimation] = useState<CashEstimationDto | null>(null)
  const [users, setUsers] = useState<UserDto[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [loginError, setLoginError] = useState('')
  const [activeSection, setActiveSection] = useState<DashboardSection>('atms')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedAtmId, setSelectedAtmId] = useState<string | null>(null)
  const [, setVisibleAtms] = useState<AtmDto[]>([])
  const [moduleLoading, setModuleLoading] = useState(false)
  const [moduleError, setModuleError] = useState<string | null>(null)
  const [backendReachable, setBackendReachable] = useState(true)

  // Reloj simulado
  const clockAnchor = useRef<ClockAnchor | null>(null)
  const activeRunRef = useRef<ActiveRunDto | null>(null)
  const activeSectionRef = useRef<DashboardSection>('atms')
  const pendingAtmUpdatesRef = useRef<Map<string, AtmDto>>(new Map())
  const atmFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cashRefreshInFlightRef = useRef(false)
  const lastCashRefreshAtRef = useRef(0)
  const [clockDisplay, setClockDisplay] = useState<string | null>(null)
  const [clockActive, setClockActive] = useState(false)

  const applyActiveRun = useCallback((run: ActiveRunDto | null) => {
    activeRunRef.current = run
    setActiveRun(run)
  }, [])

  const clearOperationalData = useCallback(() => {
    setEvents([])
    setAlerts([])
    setCashEstimation(null)
    setSelectedAtmId(null)
  }, [])

  const loadAtmModuleData = useCallback(async (runId: string) => {
    const [a, e, ce] = await Promise.allSettled([
      api.getAtms(),
      api.getEvents(150, runId),
      api.getCashEstimation(runId),
    ])

    if (activeRunRef.current?.runId !== runId || activeSectionRef.current !== 'atms') return
    if (a.status === 'fulfilled') setAtms(a.value as AtmDto[])
    if (e.status === 'fulfilled') setEvents(((e.value as { items?: EventDto[] }).items ?? []))
    if (ce.status === 'fulfilled') setCashEstimation(ce.value as CashEstimationDto)
  }, [])

  const loadAlertsModuleData = useCallback(async (runId: string) => {
    const [a, al] = await Promise.allSettled([
      api.getAtms(),
      api.getAlerts(runId),
    ])

    if (activeRunRef.current?.runId !== runId || activeSectionRef.current !== 'alerts') return
    if (a.status === 'fulfilled') setAtms(a.value as AtmDto[])
    if (al.status === 'fulfilled') setAlerts(al.value as AlertDto[])
  }, [])

  const loadEstimationModuleData = useCallback(async (runId: string) => {
    const [a, ce] = await Promise.allSettled([
      api.getAtms(),
      api.getCashEstimation(runId),
    ])
    if (activeRunRef.current?.runId !== runId || activeSectionRef.current !== 'estimation') return
    if (a.status === 'fulfilled') setAtms(a.value as AtmDto[])
    if (ce.status === 'fulfilled') setCashEstimation(ce.value as CashEstimationDto)
  }, [])

  const loadReportsModuleData = useCallback(async () => {
    const nextRuns = await api.getRuns().catch(() => null)
    if (activeSectionRef.current !== 'reports') return
    if (nextRuns) setRuns(nextRuns as RunSummaryDto[])
  }, [])

  const loadUsersModuleData = useCallback(async () => {
    const nextUsers = await api.getUsers().catch(() => null)
    if (activeSectionRef.current !== 'users') return
    if (nextUsers) setUsers(nextUsers as UserDto[])
  }, [])

  const loadActiveSectionData = useCallback(async (section: DashboardSection, run: ActiveRunDto | null) => {
    setModuleError(null)
    setModuleLoading(true)
    try {
      if (section === 'reports') {
        await loadReportsModuleData()
        return
      }

      if (section === 'users') {
        await loadUsersModuleData()
        return
      }

      if (!run) {
        clearOperationalData()
        return
      }

      if (section === 'atms') {
        await loadAtmModuleData(run.runId)
        return
      }

      if (section === 'alerts') {
        await loadAlertsModuleData(run.runId)
        return
      }

      if (section === 'estimation') {
        await loadEstimationModuleData(run.runId)
      }
    } catch {
      setModuleError('No se pudieron cargar los datos. Verifica que el backend esté activo.')
    } finally {
      setModuleLoading(false)
    }
  }, [clearOperationalData, loadAlertsModuleData, loadAtmModuleData, loadEstimationModuleData, loadReportsModuleData, loadUsersModuleData])

  const refreshCashEstimation = useCallback((runId: string) => {
    if (activeSectionRef.current !== 'atms' && activeSectionRef.current !== 'estimation') return

    const now = Date.now()
    const minInterval = activeSectionRef.current === 'estimation' ? 10_000 : 5_000
    if (cashRefreshInFlightRef.current || now - lastCashRefreshAtRef.current < minInterval) return

    cashRefreshInFlightRef.current = true
    lastCashRefreshAtRef.current = now
    api.getCashEstimation(runId)
      .then(next => {
        if (activeRunRef.current?.runId === runId && (activeSectionRef.current === 'atms' || activeSectionRef.current === 'estimation')) {
          setCashEstimation(next as CashEstimationDto)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        cashRefreshInFlightRef.current = false
      })
  }, [])

  const flushPendingAtmUpdates = useCallback(() => {
    atmFlushTimerRef.current = null
    const updates = Array.from(pendingAtmUpdatesRef.current.values())
    pendingAtmUpdatesRef.current.clear()
    if (updates.length === 0) return

    setAtms(prev => {
      const next = [...prev]
      const indexById = new Map(prev.map((atm, index) => [atm.id, index]))
      for (const atm of updates) {
        const index = indexById.get(atm.id)
        if (index === undefined) {
          indexById.set(atm.id, next.length)
          next.push(atm)
        } else {
          next[index] = atm
        }
      }
      return next
    })
  }, [])

  // Actualiza el anchor cuando llega un nuevo punto de referencia del backend
  const updateClockAnchor = useCallback((simTimeIso: string, speed: number, active = true) => {
    clockAnchor.current = {
      simMs: new Date(simTimeIso).getTime(),
      realMs: Date.now(),
      speed: Math.max(1, speed),
      active,
    }
    setClockActive(active)
  }, [])

  // Tick local a 500 ms — interpola la hora entre heartbeats
  useEffect(() => {
    const id = setInterval(() => {
      const a = clockAnchor.current
      if (!a) return
      const elapsed = Date.now() - a.realMs
      const simNow = a.active ? a.simMs + elapsed * a.speed : a.simMs
      setClockDisplay(formatSimTime(simNow))
    }, 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    activeSectionRef.current = activeSection
  }, [activeSection])

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return

    api.me()
      .then(user => setSession({ username: user.username, role: user.role, token }))
      .catch(() => {
        clearToken()
        setSession(null)
      })
  }, [])

  const loadAll = useCallback(async () => {
    if (!session) return

    try {
      const active = await api.getActiveRun().catch(() => null)
      const nextRun = active
        ? ((active as { activeRun?: ActiveRunDto | null }).activeRun ?? null)
        : null
      applyActiveRun(nextRun)
      if (!nextRun) clearOperationalData()

      // Intentar obtener la hora simulada actual del backend
      try {
        const clock = await api.getClock()
        updateClockAnchor(clock.simulatedTime, clock.speedMultiplier, clock.isActive)
      } catch { /* backend sin reloj activo — ok */ }

    } catch { /* silencioso */ }
  }, [applyActiveRun, clearOperationalData, session, updateClockAnchor])

  useEffect(() => { if (session) loadAll() }, [loadAll, session])

  useEffect(() => {
    if (atms.length === 0) {
      setSelectedAtmId(null)
      return
    }

    if (!selectedAtmId || !atms.some(atm => atm.id === selectedAtmId)) {
      setSelectedAtmId(atms[0].id)
    }
  }, [atms, selectedAtmId])

  useEffect(() => {
    if (!session) return
    void loadActiveSectionData(activeSection, activeRun)
  }, [activeRun, activeSection, loadActiveSectionData, session])

  useEffect(() => () => {
    if (atmFlushTimerRef.current) {
      clearTimeout(atmFlushTimerRef.current)
    }
    pendingAtmUpdatesRef.current.clear()
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError('')
    const data = new FormData(event.currentTarget)
    try {
      const next = await api.login(String(data.get('username') ?? ''), String(data.get('password') ?? ''))
      storeToken(next.token)
      setSession(next)
    } catch {
      setLoginError('Credenciales inválidas o backend no disponible')
    }
  }

  function handleLogout() {
    clearToken()
    setSession(null)
    setAtms([])
    setEvents([])
    setAlerts([])
    setRuns([])
    applyActiveRun(null)
    setCashEstimation(null)
    setUsers([])
    setSelectedAtmId(null)
    setClockDisplay(null)
    setClockActive(false)
    clockAnchor.current = null
  }

  // ── Handlers SignalR ──────────────────────────────────────────────────────

  const handleAtmUpdated = useCallback((atm: AtmDto) => {
    const section = activeSectionRef.current

    if (section === 'atms') {
      pendingAtmUpdatesRef.current.set(atm.id, atm)
      if (!atmFlushTimerRef.current) {
        atmFlushTimerRef.current = setTimeout(flushPendingAtmUpdates, 300)
      }
    } else {
      setAtms(prev => {
        const idx = prev.findIndex(a => a.id === atm.id)
        if (idx < 0) return prev
        const next = [...prev]
        next[idx] = atm
        return next
      })
    }

    const runId = activeRunRef.current?.runId
    if (runId && (section === 'atms' || section === 'estimation')) {
      refreshCashEstimation(runId)
    }
  }, [flushPendingAtmUpdates, refreshCashEstimation])

  const handleEventReceived = useCallback((ev: EventDto) => {
    if (!activeRunRef.current || ev.runId !== activeRunRef.current.runId) return
    const section = activeSectionRef.current

    if (section === 'atms') {
      setEvents(prev => [ev, ...prev].slice(0, 150))
    }

    if ((section === 'atms' || section === 'estimation') && ev.cassetteMovements.length > 0) {
      refreshCashEstimation(ev.runId)
    }
  }, [refreshCashEstimation])

  const handleAlertCreated = useCallback((alert: AlertDto) => {
    if (activeSectionRef.current === 'alerts') {
      setAlerts(prev => [alert, ...prev].slice(0, 500))
    }
  }, [])

  const handleClockTick = useCallback((tick: { simulatedTime: string; speedMultiplier: number; isActive?: boolean }) => {
    updateClockAnchor(tick.simulatedTime, tick.speedMultiplier, tick.isActive !== false)
  }, [updateClockAnchor])

  const handleOperationalRunChanged = useCallback((run: ActiveRunDto) => {
    applyActiveRun(run)
    const section = activeSectionRef.current
    const anchorTime = run.status === 'Running'
      ? run.startedAtSimulated
      : (run.endedAtSimulated ?? run.plannedEndAtSimulated ?? run.startedAtSimulated)
    updateClockAnchor(anchorTime, run.speedMultiplier, run.status === 'Running')
    if (section === 'atms' || section === 'alerts' || section === 'estimation') {
      api.getAtms().then(a => setAtms(a as AtmDto[])).catch(() => { })
    }
    if (section === 'reports' && run.status !== 'Running') {
      void loadReportsModuleData()
    }
  }, [applyActiveRun, loadReportsModuleData, updateClockAnchor])

  const handleOperationalRunCleared = useCallback(() => {
    applyActiveRun(null)
    clearOperationalData()
    setClockDisplay(null)
    setClockActive(false)
    clockAnchor.current = null
  }, [applyActiveRun, clearOperationalData])

  const connected = useSignalR({
    token: session?.token ?? null,
    onAtmUpdated: handleAtmUpdated,
    onEventReceived: handleEventReceived,
    onAlertCreated: handleAlertCreated,
    onClockTick: handleClockTick,
    onOperationalRunChanged: handleOperationalRunChanged,
    onOperationalRunCleared: handleOperationalRunCleared,
  })

  const navItems: Array<{ id: DashboardSection; label: string; icon: React.ElementType }> = [
    { id: 'atms', label: 'Cajeros', icon: MdLocalAtm },
    { id: 'alerts', label: 'Alertas', icon: MdNotificationsActive },
    { id: 'transactions', label: 'Transacciones', icon: MdSwapHoriz },
    { id: 'estimation', label: 'Estimación de efectivo', icon: MdAccountBalanceWallet },
    { id: 'reports', label: 'Reportes', icon: MdAssessment },
    { id: 'users', label: 'Usuarios', icon: MdPeople },
  ]

  const activeLabel = navItems.find(item => item.id === activeSection)?.label ?? 'Cajeros'
  const selectedAtm = atms.find(atm => atm.id === selectedAtmId) ?? null
  const isOperationalSection = activeSection === 'atms' || activeSection === 'alerts' || activeSection === 'transactions' || activeSection === 'estimation'
  const simulatorStatus: SimulatorStatus = !activeRun
    ? 'disconnected'
    : activeRun.status === 'Initialized'
      ? 'ready'
      : activeRun.status === 'Running' && clockActive
        ? 'running'
        : activeRun.status === 'Running'
          ? 'paused'
          : 'stopped'

  // ── Render ────────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f3f4f6', overflow: 'hidden' }}>
        <section style={{ padding: '48px 42px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0f172a', backgroundImage: 'url(/background.png)', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: '#2563eb', marginBottom: 16 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>OD</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>ODIN Dashboard</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Monitoreo y simulacion ATM</div>
          </div>
        </section>

        <section style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
          <form onSubmit={handleLogin} style={{ width: 340, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '26px 22px 20px', boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 18 }}>Iniciar sesion</div>

            <label style={loginLabelStyle}>Usuario</label>
            <input name="username" defaultValue="admin" autoComplete="username" style={loginInputStyle} />

            <label style={loginLabelStyle}>Contraseña</label>
            <input name="password" type="password" defaultValue="Admin123*" autoComplete="current-password" style={loginInputStyle} />

            {loginError && (
              <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 5, fontSize: 11, fontWeight: 600, padding: '7px 8px', marginBottom: 12 }}>
                {loginError}
              </div>
            )}

            <button type="submit" style={{ width: '100%', height: 38, background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Ingresar
            </button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f3f4f6' }}>

      {/* ── HEADER (44 px) ────────────────────────────────────────────── */}
      <header style={{ height: 44, minHeight: 44, flexShrink: 0, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 10 }}>OD</span>
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', whiteSpace: 'nowrap' }}>ODIN Dashboard</span>
        <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>Monitoreo ATM</span>
        <SimulationHeaderStatus
          activeRun={activeRun}
          clockDisplay={clockDisplay}
          clockActive={clockActive}
          backendConnected={connected && backendReachable}
          simulatorStatus={simulatorStatus}
          onVerifyBackend={async () => {
            try { await api.getActiveRun(); setBackendReachable(true) }
            catch { setBackendReachable(false) }
          }}
        />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{session.username} · {session.role}</span>
          <button onClick={handleLogout}
            style={{ padding: '3px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
        <aside style={{
          width: sidebarCollapsed ? 48 : 156,
          minWidth: sidebarCollapsed ? 48 : 156,
          transition: 'width 160ms ease, min-width 160ms ease',
          background: '#fff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 6px',
          gap: 6,
        }}>
          <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', padding: sidebarCollapsed ? 0 : '0 4px 0 8px' }}>
            {!sidebarCollapsed && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0 }}>
                <MdMenu size={14} />
                Menú
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(value => !value)}
              title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
              style={{
                width: 24,
                height: 24,
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: '#fff',
                color: '#4b5563',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              {sidebarCollapsed ? <MdChevronRight size={16} /> : <MdChevronLeft size={16} />}
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
            {navItems.map(item => {
              const Icon = item.icon
              const active = item.id === activeSection
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  style={{
                    height: 32,
                    border: `1px solid ${active ? '#bfdbfe' : 'transparent'}`,
                    borderRadius: 4,
                    background: active ? '#eff6ff' : 'transparent',
                    color: active ? '#1d4ed8' : '#4b5563',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    gap: 8,
                    padding: sidebarCollapsed ? 0 : '0 9px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: active ? 800 : 700,
                    textAlign: 'left',
                  }}
                >
                  <Icon size={16} />
                  {!sidebarCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                </button>
              )
            })}
          </nav>
        </aside>

        <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 38, minHeight: 38, flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, padding: '3px 8px', color: '#374151', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {activeLabel}
            </span>
            {isOperationalSection && <SummaryCards atms={atms} alerts={alerts} cashEstimation={cashEstimation} showAlerts={activeSection === 'alerts'} />}
          </div>

          <section style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 8px 8px', position: 'relative' }}>
            {moduleLoading && atms.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: '#f9fafb', padding: 16 }}>
                <style>{`@keyframes skPulse { 0%,100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ height: 14, width: 180, background: '#e5e7eb', borderRadius: 4, animation: 'skPulse 1.4s ease-in-out infinite' }} />
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 70px 90px 80px 1fr', gap: 10, alignItems: 'center' }}>
                      <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, animation: 'skPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                      <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, animation: 'skPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.05}s` }} />
                      <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, animation: 'skPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.1}s` }} />
                      <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, animation: 'skPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.15}s` }} />
                      <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, animation: 'skPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.2}s` }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {moduleError && (
              <div style={{ padding: '10px 14px', margin: '0 0 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{moduleError}</span>
                <button onClick={() => { setModuleError(null); loadActiveSectionData(activeSection, activeRun) }} style={{ border: '1px solid #fca5a5', borderRadius: 4, background: '#fff', color: '#b91c1c', fontSize: 11, fontWeight: 600, padding: '3px 10px', cursor: 'pointer' }}>Reintentar</button>
              </div>
            )}
            {activeSection === 'atms' && activeRun && atms.length > 0 && (
              <div style={{ height: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 258px', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <AtmGrid
                    atms={atms}
                    cashEstimation={cashEstimation}
                    events={events}
                    selectedAtmId={selectedAtmId}
                    onSelectAtm={setSelectedAtmId}
                    onVisibleAtmsChange={setVisibleAtms}
                  />
                </div>
                <div style={{ minWidth: 0, minHeight: 0, overflow: 'auto' }}>
                  <AtmInsightPanel
                    selectedAtm={selectedAtm}
                    cashEstimation={cashEstimation}
                    events={events}
                    simulatedClock={clockDisplay}
                    activeRun={activeRun}
                  />
                </div>
              </div>
            )}
            {activeSection === 'atms' && !activeRun && <NoActiveSession moduleName="El monitoreo de cajeros" onOpenReports={() => setActiveSection('reports')} />}
            {activeSection === 'atms' && activeRun && atms.length === 0 && <NoActiveSession moduleName="El monitoreo de cajeros" onOpenReports={() => setActiveSection('reports')} />}

            {activeSection === 'alerts' && activeRun && (
              <AlertsPanel alerts={alerts} atms={atms} />
            )}
            {activeSection === 'alerts' && !activeRun && <NoActiveSession moduleName="El monitoreo de alertas" onOpenReports={() => setActiveSection('reports')} />}

            {activeSection === 'transactions' && activeRun && (
              <TransactionsPanel
                activeRun={activeRun}
              />
            )}
            {activeSection === 'transactions' && !activeRun && <NoActiveSession moduleName="El registro de transacciones" onOpenReports={() => setActiveSection('reports')} />}

            {activeSection === 'estimation' && activeRun && (
              <CashEstimationPanel estimation={cashEstimation} />
            )}
            {activeSection === 'estimation' && !activeRun && <NoActiveSession moduleName="La estimación de efectivo" onOpenReports={() => setActiveSection('reports')} />}

            {activeSection === 'reports' && (
              <ReportsPanel runs={runs} onRunsChanged={() => api.getRuns().then(r => setRuns(r)).catch(() => { })} />
            )}

            {activeSection === 'users' && (
              <UsersPanel users={users} currentUsername={session.username} onUsersChanged={() => api.getUsers().then(u => setUsers(u)).catch(() => { })} />
            )}
          </section>
        </main>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const loginLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#374151',
  fontWeight: 600,
  marginBottom: 5,
}

const loginInputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  border: '1px solid #d1d5db',
  borderRadius: 5,
  padding: '0 10px',
  marginBottom: 12,
  outline: 0,
  color: '#111827',
  background: '#fff',
  fontSize: 13,
}
