import { MdLocalAtm, MdWarning, MdCheckCircle, MdError, MdInfo } from 'react-icons/md'
import type { AtmDto, EventDto } from '../types'

interface Props { atms: AtmDto[]; events: EventDto[] }

// ── helpers ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, lineHeight: 1.2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function HBar({ label, value, max, color, suffix = '' }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#374151', marginBottom: 2 }}>
        <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{label}</span>
        <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 4 }}>{suffix}{value.toLocaleString()}</span>
      </div>
      <div style={{ height: 7, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function SectionTitle({ label }: { label: string }) {
  return <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
}

// ── component ──────────────────────────────────────────────────────────────

export function ChartPanel({ atms, events }: Props) {
  // KPIs
  const online  = atms.filter(a => a.status === 'Online').length
  const warning = atms.filter(a => a.status === 'Warning').length
  const fuera   = atms.filter(a => a.status === 'FueraDeServicio').length
  const sinEfec = atms.filter(a => a.status === 'SinEfectivo').length
  const offline = atms.filter(a => a.status === 'Offline').length

  const totalCash = atms.reduce((s, a) =>
    s + a.cassettes.filter(c => !c.isRejectCassette).reduce((cs, c) => cs + c.denomination * c.currentBillCount, 0)
  , 0)

  // Efectivo por cajero (para barra)
  const cashByAtm = atms.map(a => ({
    id: a.id,
    cash: a.cassettes.filter(c => !c.isRejectCassette).reduce((s, c) => s + c.denomination * c.currentBillCount, 0),
    status: a.status,
  })).sort((a, b) => b.cash - a.cash)
  const maxCash = Math.max(...cashByAtm.map(a => a.cash), 1)

  // Severidad de eventos (últimos 100)
  const recent = events.slice(0, 100)
  const sevInfo     = recent.filter(e => e.severity === 'Info').length
  const sevWarning  = recent.filter(e => e.severity === 'Warning').length
  const sevCritical = recent.filter(e => e.severity === 'Critical').length
  const incidents   = sevWarning + sevCritical
  const maxSev      = Math.max(sevInfo, sevWarning, sevCritical, 1)

  // Color por estado de cajero
  const cashColor = (status: string) => {
    if (status === 'FueraDeServicio') return '#dc2626'
    if (status === 'SinEfectivo')     return '#7c3aed'
    if (status === 'Warning')         return '#f59e0b'
    if (status === 'Offline')         return '#9ca3af'
    return '#22c55e'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 0 }}>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
        <SectionTitle label="Estado general" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <KpiCard label="En línea"    value={online}  color="#16a34a" />
          <KpiCard label="Advertencia" value={warning} color="#d97706" />
          <KpiCard label="Fuera serv." value={fuera}   color="#dc2626" />
          <KpiCard label="Sin efectivo" value={sinEfec} color="#7c3aed" />
          <KpiCard label="Desconectado" value={offline} color="#6b7280" />
          <KpiCard label="Incidencias" value={incidents} sub="ult. 100 eventos" color={incidents > 0 ? '#b45309' : '#6b7280'} />
        </div>
        <div style={{ marginTop: 8, textAlign: 'center', padding: '6px', background: '#f0fdf4', borderRadius: 5 }}>
          <div style={{ fontSize: 10, color: '#15803d', fontWeight: 600 }}>EFECTIVO TOTAL EN RED</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#15803d', fontFamily: 'monospace' }}>
            ${totalCash.toLocaleString('es-EC')}
          </div>
        </div>
      </div>

      {/* ── Efectivo por cajero ───────────────────────────────────────── */}
      {cashByAtm.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
          <SectionTitle label="Efectivo por cajero" />
          {cashByAtm.map(a => (
            <HBar key={a.id} label={a.id} value={a.cash} max={maxCash} color={cashColor(a.status)} suffix="$" />
          ))}
        </div>
      )}

      {/* ── Severidad de eventos ─────────────────────────────────────── */}
      {(sevInfo + sevWarning + sevCritical) > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
          <SectionTitle label={`Severidad (últ. ${recent.length})`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <MdInfo size={13} color="#3b82f6" />
            <span style={{ fontSize: 10, color: '#374151', width: 50 }}>Info</span>
            <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${sevInfo / maxSev * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6', width: 24, textAlign: 'right' }}>{sevInfo}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <MdWarning size={13} color="#f59e0b" />
            <span style={{ fontSize: 10, color: '#374151', width: 50 }}>Warning</span>
            <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${sevWarning / maxSev * 100}%`, height: '100%', background: '#f59e0b', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', width: 24, textAlign: 'right' }}>{sevWarning}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdError size={13} color="#ef4444" />
            <span style={{ fontSize: 10, color: '#374151', width: 50 }}>Critical</span>
            <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${sevCritical / maxSev * 100}%`, height: '100%', background: '#ef4444', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', width: 24, textAlign: 'right' }}>{sevCritical}</span>
          </div>
        </div>
      )}

      {/* ── Sin efectivo / Fuera de servicio ─────────────────────────── */}
      {(sinEfec > 0 || fuera > 0) && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
          {fuera > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <MdError size={13} color="#dc2626" />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626' }}>FUERA DE SERVICIO</span>
              </div>
              {atms.filter(a => a.status === 'FueraDeServicio').map(a => (
                <div key={a.id} style={{ fontSize: 11, fontFamily: 'monospace', color: '#dc2626', lineHeight: '16px', paddingLeft: 18 }}>{a.id}</div>
              ))}
            </>
          )}
          {sinEfec > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, marginTop: fuera > 0 ? 6 : 0 }}>
                <MdLocalAtm size={13} color="#7c3aed" />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed' }}>SIN EFECTIVO</span>
              </div>
              {atms.filter(a => a.status === 'SinEfectivo').map(a => (
                <div key={a.id} style={{ fontSize: 11, fontFamily: 'monospace', color: '#7c3aed', lineHeight: '16px', paddingLeft: 18 }}>{a.id}</div>
              ))}
            </>
          )}
        </div>
      )}

      {atms.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
          <MdCheckCircle size={24} color="#d1d5db" style={{ margin: '0 auto 6px' }} />
          <div>Sin datos todavía</div>
        </div>
      )}
    </div>
  )
}
