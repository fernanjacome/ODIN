import { useMemo, useState } from 'react'
import { MdSearch, MdTrendingDown } from 'react-icons/md'
import type { CashEstimationAtmDto, CashEstimationDto } from '../types'

interface Props {
  estimation: CashEstimationDto | null
}

const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const riskOrder: Record<string, number> = { 'Sin efectivo': 0, 'Crítico': 1, Advertencia: 2, Normal: 3 }

function riskStyle(risk: string) {
  if (risk === 'Sin efectivo') return { fg: '#374151', bg: '#f3f4f6', border: '#d1d5db', bar: '#9ca3af' }
  if (risk === 'Crítico') return { fg: '#b91c1c', bg: '#fee2e2', border: '#fecaca', bar: '#dc2626' }
  if (risk === 'Advertencia') return { fg: '#b45309', bg: '#fff7ed', border: '#fed7aa', bar: '#f59e0b' }
  return { fg: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', bar: '#16a34a' }
}

function fillPct(c: CashEstimationAtmDto['cassettes'][number]) {
  return Math.max(0, Math.min(100, c.projectedBillCount / Math.max(1, c.capacityInBills) * 100))
}

function avgFill(atm: CashEstimationAtmDto) {
  const cs = atm.cassettes.filter(c => !c.isRejectCassette)
  if (cs.length === 0) return 0
  return cs.reduce((s, c) => s + fillPct(c), 0) / cs.length
}

function hoursUntilCritical(atm: CashEstimationAtmDto, horizonMin: number) {
  if (atm.projectedCashDelta >= 0 || atm.currentCashTotal <= 0) return null
  const rate = Math.abs(atm.projectedCashDelta) / Math.max(1, horizonMin / 60)
  if (rate <= 0) return null
  const threshold = atm.currentCashTotal * 0.15
  const cashToConsume = atm.currentCashTotal - threshold
  if (cashToConsume <= 0) return 0
  return Math.round(cashToConsume / rate)
}

export function CashEstimationPanel({ estimation }: Props) {
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('Todas')
  const [risk, setRisk] = useState('Todos')
  const [expanded, setExpanded] = useState<string | null>(null)

  const cities = useMemo(() => [...new Set((estimation?.atms ?? []).map(a => a.city).filter(Boolean))].sort(), [estimation])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(estimation?.atms ?? [])]
      .filter(atm => {
        const mq = !needle || atm.atmId.toLowerCase().includes(needle) || atm.city.toLowerCase().includes(needle)
        const mc = city === 'Todas' || atm.city === city
        const mr = risk === 'Todos' || atm.riskLevel === risk
        return mq && mc && mr
      })
      .sort((a, b) => (riskOrder[a.riskLevel] ?? 9) - (riskOrder[b.riskLevel] ?? 9) || a.projectedCashDelta - b.projectedCashDelta)
  }, [estimation, city, query, risk])

  const horizonMin = estimation?.horizonMinutes ?? 60

  if (!estimation) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, color: '#9ca3af', fontSize: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <MdTrendingDown size={28} color="#d1d5db" />
          <span>Sin datos de estimacion. Inicia una simulacion para ver proyecciones.</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Proyeccion por cajero</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>Horizonte {horizonMin} min · {estimation.sampleFlows} retiros</span>
        <div style={{ flex: 1 }} />
        <div style={searchBoxStyle}>
          <MdSearch size={13} color="#9ca3af" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ATM o ciudad" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 11, width: '100%', minWidth: 0 }} />
        </div>
        <FG label="Ciudad"><select value={city} onChange={e => setCity(e.target.value)} style={selStyle}><option>Todas</option>{cities.map(c => <option key={c}>{c}</option>)}</select></FG>
        <FG label="Riesgo"><select value={risk} onChange={e => setRisk(e.target.value)} style={selStyle}><option>Todos</option><option>Normal</option><option>Advertencia</option><option>Critico</option><option>Sin efectivo</option></select></FG>
        <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{filtered.length} cajeros</span>
      </div>

      {/* ATM list */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Sin cajeros para los filtros aplicados.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {filtered.map(atm => (
            <AtmCard key={atm.atmId} atm={atm} horizonMin={horizonMin} isExpanded={expanded === atm.atmId} onToggle={() => setExpanded(expanded === atm.atmId ? null : atm.atmId)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AtmCard({ atm, horizonMin, isExpanded, onToggle }: { atm: CashEstimationAtmDto; horizonMin: number; isExpanded: boolean; onToggle: () => void }) {
  const d = atm.projectedCashDelta
  const rs = riskStyle(atm.riskLevel)
  const fill = avgFill(atm)
  const hoursLeft = hoursUntilCritical(atm, horizonMin)
  const cassettes = atm.cassettes.filter(c => !c.isRejectCassette)

  return (
    <div onClick={onToggle} style={{ border: `1px solid ${rs.border}`, borderLeft: `4px solid ${rs.bar}`, borderRadius: 5, background: isExpanded ? '#f8faff' : '#fff', cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 80px 70px', alignItems: 'center', gap: 6, padding: '6px 10px', minHeight: 38 }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontFamily: 'monospace', fontSize: 11, color: '#111827' }}>{atm.atmId}</strong>
          <div style={{ fontSize: 9, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{atm.city}</div>
        </div>

        {/* Fill bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${fill}%`, background: rs.bar, borderRadius: 3, transition: 'width 0.3s' }} />
            <span style={{ position: 'absolute', left: 6, top: 0, lineHeight: '16px', fontSize: 10, fontWeight: 700, color: fill > 40 ? '#fff' : '#374151' }}>{Math.round(fill)}% llenado</span>
          </div>
          {hoursLeft !== null && (
            <span style={{ fontSize: 10, fontWeight: 700, color: hoursLeft <= 2 ? '#dc2626' : '#b45309', whiteSpace: 'nowrap' }} title="Horas estimadas hasta nivel critico">
              ~{hoursLeft}h
            </span>
          )}
        </div>

        <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#374151' }}>{money.format(atm.currentCashTotal)}<div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>actual</div></div>
        <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#374151' }}>{money.format(atm.projectedCashTotal)}<div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>estimado</div></div>
        <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: d < 0 ? '#b45309' : '#15803d' }}>{d < 0 ? '' : '+'}{money.format(d)}</div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: `1px solid ${rs.border}`, background: '#f9fafb', padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{atm.displayName || atm.location} — detalle por gaveta</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cassettes.length, 4)}, 1fr)`, gap: 8 }}>
            {cassettes.map(c => {
              const pct = fillPct(c)
              const currentPct = Math.max(0, Math.min(100, c.currentBillCount / Math.max(1, c.capacityInBills) * 100))
              const barColor = pct <= 10 ? '#dc2626' : pct <= 30 ? '#f59e0b' : '#16a34a'
              return (
                <div key={c.cassetteKey} style={{ border: '1px solid #e5e7eb', borderRadius: 5, padding: '6px 8px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{c.cassetteKey}</span>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>${c.denomination}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 2 }}>actual</div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${currentPct}%`, background: '#94a3b8', borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 2 }}>estimado</div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#6b7280' }}>
                    <span>{c.currentBillCount} → {c.projectedBillCount}</span>
                    <span style={{ fontWeight: 600, color: barColor }}>{Math.round(pct)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{label}:</span>{children}</div>
}

const searchBoxStyle: React.CSSProperties = { height: 28, width: 150, border: '1px solid #d1d5db', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, padding: '0 6px', background: '#fff' }
const selStyle: React.CSSProperties = { height: 28, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', color: '#374151', fontSize: 11, fontWeight: 600, padding: '0 6px', outline: 0 }
