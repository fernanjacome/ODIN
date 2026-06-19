import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  MdError,
  MdInfo,
  MdSearch,
  MdWarning,
} from 'react-icons/md'
import type { AlertDto, AtmDto } from '../types'

interface Props {
  alerts: AlertDto[]
  atms: AtmDto[]
}

function elapsed(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`
  return `${Math.floor(seconds / 86400)} d`
}

function fmtTime(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-EC', {
    hour12: false,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function alertLabel(type: string) {
  const labels: Record<string, string> = {
    NetworkDown: 'Red desconectada',
    NetworkRestored: 'Red restaurada',
    DeviceFailure: 'Falla de equipo',
    PaperEmpty: 'Papel agotado',
    PaperLow: 'Papel bajo',
    CashCritical: 'Efectivo critico',
    CashLow: 'Efectivo bajo',
    CashReloaded: 'Efectivo recargado',
  }
  return labels[type] ?? type
}

function severityLabel(severity: string) {
  if (severity === 'Critical') return 'Critica'
  if (severity === 'Warning') return 'Advertencia'
  return 'Informativa'
}

function severityIcon(severity: string) {
  if (severity === 'Critical') return <MdError size={18} color="#dc2626" />
  if (severity === 'Warning') return <MdWarning size={18} color="#b45309" />
  return <MdInfo size={18} color="#2563eb" />
}

function severityColor(severity: string) {
  if (severity === 'Critical') return '#dc2626'
  if (severity === 'Warning') return '#b45309'
  return '#2563eb'
}

function severityBg(severity: string) {
  if (severity === 'Critical') return '#fff7f7'
  if (severity === 'Warning') return '#fffbeb'
  return '#f8fbff'
}

function getAtm(alert: AlertDto, atmById: Record<string, AtmDto | undefined>) {
  return atmById[alert.atmId]
}

function alertCity(alert: AlertDto, atm?: AtmDto) {
  return alert.city || atm?.city || '-'
}

function alertLocation(alert: AlertDto, atm?: AtmDto) {
  return alert.location || atm?.location || '-'
}

export function AlertsPanel({ alerts, atms }: Props) {
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('Todas')
  const [city, setCity] = useState('Todas')
  const [category, setCategory] = useState('Todas')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const atmById = useMemo(
    () => Object.fromEntries(atms.map(atm => [atm.id, atm])) as Record<string, AtmDto | undefined>,
    [atms]
  )

  const cities = useMemo(
    () => [...new Set(alerts.map(alert => alertCity(alert, getAtm(alert, atmById))).filter(item => item && item !== '-'))].sort(),
    [alerts, atmById]
  )

  const categories = useMemo(
    () => [...new Set(alerts.map(alert => alert.category || 'Operacion'))].sort(),
    [alerts]
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return alerts
      .filter(alert => {
        const atm = getAtm(alert, atmById)
        const currentCity = alertCity(alert, atm)
        const currentCategory = alert.category || 'Operacion'
        const matchesSeverity = severity === 'Todas' || alert.severity === severity
        const matchesCity = city === 'Todas' || currentCity === city
        const matchesCategory = category === 'Todas' || currentCategory === category
        const matchesQuery = !needle ||
          alert.atmId.toLowerCase().includes(needle) ||
          alertLabel(alert.alertType).toLowerCase().includes(needle) ||
          currentCategory.toLowerCase().includes(needle) ||
          (alert.device ?? '').toLowerCase().includes(needle) ||
          currentCity.toLowerCase().includes(needle) ||
          alertLocation(alert, atm).toLowerCase().includes(needle) ||
          alert.message.toLowerCase().includes(needle)
        return matchesSeverity && matchesCity && matchesCategory && matchesQuery
      })
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
  }, [alerts, atmById, category, city, query, severity])

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !rows.some(alert => alert.id === selectedId)) {
      setSelectedId(rows[0].id)
    }
  }, [rows, selectedId])

  const selected = rows.find(alert => alert.id === selectedId) ?? rows[0] ?? null

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 8, overflow: 'hidden' }}>
      <section style={summaryStyle}>
        <div style={{ marginLeft: 0, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <div style={searchStyle}>
            <MdSearch size={14} color="#94a3b8" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cajero, ciudad, dispositivo o mensaje" style={inputStyle} />
          </div>
          <Filter label="Severidad">
            <select value={severity} onChange={event => setSeverity(event.target.value)} style={controlStyle}>
              <option>Todas</option>
              <option value="Critical">Criticas</option>
              <option value="Warning">Advertencias</option>
              <option value="Info">Informativas</option>
            </select>
          </Filter>
          <Filter label="Ciudad">
            <select value={city} onChange={event => setCity(event.target.value)} style={controlStyle}>
              <option>Todas</option>
              {cities.map(item => <option key={item}>{item}</option>)}
            </select>
          </Filter>
          <Filter label="Categoria">
            <select value={category} onChange={event => setCategory(event.target.value)} style={controlStyle}>
              <option>Todas</option>
              {categories.map(item => <option key={item}>{item}</option>)}
            </select>
          </Filter>
        </div>
      </section>

      <section style={{ minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(520px, 1fr) 330px', gap: 8, overflow: 'hidden' }}>
        <div style={panelStyle}>
          <div style={headerStyle}>
            <MdWarning size={15} color="#64748b" />
            <strong>Logs</strong>
            <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 10 }}>{rows.length} registros visibles</span>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.length === 0 && <Empty text="Sin alertas para los filtros seleccionados." />}
            {rows.map(alert => {
              const atm = getAtm(alert, atmById)
              const active = alert.id === selected?.id
              const color = severityColor(alert.severity)
              return (
                <button key={alert.id} type="button" onClick={() => setSelectedId(alert.id)} style={{
                  width: '100%',
                  border: 0,
                  borderLeft: `4px solid ${color}`,
                  borderBottom: '1px solid #eef2f7',
                  background: active ? '#eff6ff' : severityBg(alert.severity),
                  padding: '8px 10px',
                  display: 'grid',
                  gridTemplateColumns: '26px 96px minmax(0, 1fr) 90px',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}>
                  {severityIcon(alert.severity)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color, fontWeight: 700, fontSize: 11 }}>{severityLabel(alert.severity)}</div>
                    <div style={{ color: '#64748b', fontSize: 10 }}>{elapsed(alert.triggeredAt)} atras</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <strong style={{ color: '#111827', fontSize: 12 }}>{alert.atmId}</strong>
                      <span style={{ color: '#64748b', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alertLabel(alert.alertType)}</span>
                    </div>
                    <div style={{ color: '#475569', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.message}</div>
                  </div>
                  <div style={{ minWidth: 0, textAlign: 'right' }}>
                    <div style={{ color: '#334155', fontWeight: 700, fontSize: 10 }}>{alert.device || '-'}</div>
                    <div style={{ color: '#64748b', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alertCity(alert, atm)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <AlertDetail alert={selected} atm={selected ? getAtm(selected, atmById) : undefined} />
      </section>
    </div>
  )
}

function AlertDetail({ alert, atm }: { alert: AlertDto | null; atm?: AtmDto }) {
  if (!alert) {
    return <div style={panelStyle}><Empty text="Selecciona una alerta para ver el detalle." /></div>
  }

  const color = severityColor(alert.severity)
  const city = alertCity(alert, atm)
  const location = alertLocation(alert, atm)

  return (
    <aside style={panelStyle}>
      <div style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, background: severityBg(alert.severity) }}>
        {severityIcon(alert.severity)}
        <div style={{ flex: 1 }}>
          <div style={{ color, fontWeight: 700, fontSize: 13 }}>{alertLabel(alert.alertType)}</div>
          <div style={{ color: '#64748b', fontSize: 10 }}>{severityLabel(alert.severity)} · {elapsed(alert.triggeredAt)} atras</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: '#334155', fontSize: 12, lineHeight: '18px' }}>{alert.message}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <DetailCard label="Cajero" value={alert.atmId} sub={alert.atmName} />
          <DetailCard label="Ubicacion" value={city} sub={location !== city ? location : undefined} />
          <DetailCard label="Hora simulada" value={fmtTime(alert.simulatedAt)} />
          {alert.device && <DetailCard label="Dispositivo afectado" value={alert.device} />}
        </div>
      </div>
    </aside>
  )
}

function DetailCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 5, padding: '6px 8px', background: '#fafbfc' }}>
      <div style={{ color: '#94a3b8', fontSize: 9, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#111827', fontSize: 12, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ color: '#64748b', fontSize: 10 }}>{sub}</div>}
    </div>
  )
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
      {children}
    </label>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ height: '100%', minHeight: 120, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 16 }}>
      <div>
        <MdInfo size={28} />
        <div style={{ marginTop: 4, fontWeight: 600 }}>{text}</div>
      </div>
    </div>
  )
}

const summaryStyle: React.CSSProperties = {
  minHeight: 54,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '7px 10px',
  overflow: 'hidden',
}

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minHeight: 0,
}

const headerStyle: React.CSSProperties = {
  height: 36,
  minHeight: 36,
  borderBottom: '1px solid #e5e7eb',
  background: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 10px',
  color: '#334155',
  fontSize: 11,
}

const searchStyle: React.CSSProperties = {
  width: 270,
  height: 30,
  border: '1px solid #d1d5db',
  borderRadius: 5,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 8px',
  background: '#fff',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  outline: 0,
  fontSize: 11,
  background: 'transparent',
  color: '#334155',
}

const controlStyle: React.CSSProperties = {
  height: 28,
  border: '1px solid #d1d5db',
  borderRadius: 5,
  background: '#fff',
  color: '#334155',
  fontSize: 11,
  fontWeight: 600,
  maxWidth: 120,
}
