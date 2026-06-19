import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MdArrowDownward,
  MdArrowUpward,
  MdCheckCircle,
  MdCreditCard,
  MdError,
  MdLocalAtm,
  MdPrint,
  MdSearch,
  MdWarning,
  MdWifi,
  MdWifiOff,
} from 'react-icons/md'
import type { AtmDto, CashEstimationAtmDto, CashEstimationDto, EventDto } from '../types'

interface Props {
  atms: AtmDto[]
  cashEstimation: CashEstimationDto | null
  events: EventDto[]
  selectedAtmId: string | null
  onSelectAtm: (id: string) => void
  onVisibleAtmsChange?: (atms: AtmDto[]) => void
}

type SortKey = 'id' | 'city' | 'status' | 'cash' | 'estimated' | 'variation' | 'risk' | 'lastSeen'
type SortDirection = 'asc' | 'desc'

function fmt$(n: number) {
  return '$' + n.toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-EC', {
    hour12: false,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function totalCash(atm: AtmDto) {
  return atm.cassettes
    .filter(cassette => !cassette.isRejectCassette)
    .reduce((sum, cassette) => sum + cassette.denomination * cassette.currentBillCount, 0)
}

function riskRank(risk?: string) {
  if (risk === 'Crítico') return 3
  if (risk === 'Advertencia') return 2
  if (risk === 'Sin efectivo') return 1
  return 0
}

function riskStyle(risk: string) {
  if (risk === 'Crítico') return { bg: '#fee2e2', fg: '#b91c1c', border: '#fecaca' }
  if (risk === 'Advertencia') return { bg: '#fef3c7', fg: '#b45309', border: '#fde68a' }
  if (risk === 'Sin efectivo') return { bg: '#f3f4f6', fg: '#374151', border: '#d1d5db' }
  return { bg: '#dcfce7', fg: '#15803d', border: '#bbf7d0' }
}

function statusInfo(status: string) {
  if (status === 'Online') return { color: '#15803d', icon: MdCheckCircle, label: 'En línea' }
  if (status === 'Offline') return { color: '#6b7280', icon: MdError, label: 'Desconectado' }
  if (status === 'FueraDeServicio') return { color: '#dc2626', icon: MdError, label: 'Fuera de servicio' }
  if (status === 'SinEfectivo') return { color: '#7c3aed', icon: MdError, label: 'Sin efectivo' }
  return { color: '#b45309', icon: MdWarning, label: 'Advertencia' }
}

function deviceStyle(status: string) {
  if (status === 'Error') return { color: '#dc2626', bg: '#fee2e2', border: '#fecaca' }
  if (status === 'Warning') return { color: '#b45309', bg: '#fff7ed', border: '#fed7aa' }
  return { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' }
}

function SortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
  align?: 'left' | 'right' | 'center'
}) {
  const active = sortKey === activeKey
  const Icon = direction === 'asc' ? MdArrowUpward : MdArrowDownward
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      style={{
        width: '100%',
        border: 0,
        background: 'transparent',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        gap: 3,
        color: active ? '#1d4ed8' : '#4b5563',
        fontSize: 11,
        fontWeight: active ? 900 : 700,
        cursor: 'pointer',
      }}
    >
      {label}
      {active && <Icon size={11} />}
    </button>
  )
}

function StatusCell({ status }: { status: string }) {
  const info = statusInfo(status)
  const Icon = info.icon
  return (
    <span style={{ color: info.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <Icon size={14} />
      {info.label}
    </span>
  )
}

function DeviceSummary({ atm }: { atm: AtmDto }) {
  const items = [
    { status: atm.dispenserStatus, icon: MdLocalAtm, title: 'Dispensador' },
    { status: atm.cardReaderStatus, icon: MdCreditCard, title: 'Lector' },
    { status: atm.receiptPrinterStatus, icon: MdPrint, title: 'Impresora' },
    { status: atm.networkStatus, icon: atm.networkStatus === 'Error' ? MdWifiOff : MdWifi, title: 'Red' },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {items.map(item => {
        const Icon = item.icon
        const style = deviceStyle(item.status)
        return (
          <span
            key={item.title}
            title={`${item.title}: ${item.status}`}
            style={{
              color: style.color,
              background: style.bg,
              border: `1px solid ${style.border}`,
              width: 20,
              height: 20,
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={14} />
          </span>
        )
      })}
    </div>
  )
}

function EstimateCells({ estimation }: { estimation?: CashEstimationAtmDto }) {
  if (!estimation) {
    return (
      <>
        <td style={{ ...td, textAlign: 'right', color: '#d1d5db' }}>-</td>
        <td style={{ ...td, textAlign: 'right', color: '#d1d5db' }}>-</td>
        <td style={{ ...td, textAlign: 'center', color: '#d1d5db' }}>-</td>
      </>
    )
  }

  const delta = estimation.projectedCashDelta
  const deltaText = delta < 0 ? `-${fmt$(Math.abs(delta))}` : `+${fmt$(delta)}`
  const risk = riskStyle(estimation.riskLevel)

  return (
    <>
      <td style={{ ...td, textAlign: 'right' }}>
        <div style={{ fontWeight: 600, color: '#111827' }}>{fmt$(estimation.projectedCashTotal)}</div>
        <div style={{ fontSize: 10, color: '#6b7280', lineHeight: '12px' }}>estimado</div>
      </td>
      <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: delta < 0 ? '#b45309' : '#15803d' }}>
        {deltaText}
      </td>
      <td style={{ ...td, textAlign: 'center' }}>
        <span style={{ border: `1px solid ${risk.border}`, background: risk.bg, color: risk.fg, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {estimation.riskLevel}
        </span>
      </td>
    </>
  )
}

const ROW_HEIGHT = 52

export function AtmGrid({ atms, cashEstimation, events, selectedAtmId, onSelectAtm, onVisibleAtmsChange }: Props) {
  const [query, setQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('Todas')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [riskFilter, setRiskFilter] = useState('Todos')
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(600)

  const estimationByAtm = useMemo(() => Object.fromEntries(
    (cashEstimation?.atms ?? []).map(item => [item.atmId, item])
  ) as Record<string, CashEstimationAtmDto | undefined>, [cashEstimation])

  const cities = useMemo(
    () => [...new Set(atms.map(atm => atm.city).filter(Boolean))].sort(),
    [atms]
  )

  const latestEventByAtm = useMemo(() => {
    const result: Record<string, EventDto | undefined> = {}
    for (const event of events) {
      if (!event.atmId || result[event.atmId]) continue
      result[event.atmId] = event
    }
    return result
  }, [events])

  const lastRelevantEventByAtm = useMemo(() => {
    const result: Record<string, EventDto | undefined> = {}
    for (const event of events) {
      if (!event.atmId || result[event.atmId]) continue
      if (event.severity === 'Critical' || event.severity === 'Warning' || event.eventType.toLowerCase().includes('error')) {
        result[event.atmId] = event
      }
    }
    return result
  }, [events])

  const filteredAtms = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = atms.filter(atm => {
      const estimation = estimationByAtm[atm.id]
      const matchesQuery = !needle ||
        atm.id.toLowerCase().includes(needle) ||
        atm.displayName.toLowerCase().includes(needle) ||
        atm.city.toLowerCase().includes(needle) ||
        atm.location.toLowerCase().includes(needle)
      const matchesCity = cityFilter === 'Todas' || atm.city === cityFilter
      const matchesStatus = statusFilter === 'Todos' || atm.status === statusFilter
      const matchesRisk = riskFilter === 'Todos' || estimation?.riskLevel === riskFilter
      return matchesQuery && matchesCity && matchesStatus && matchesRisk
    })

    return rows.sort((left, right) => {
      const leftEst = estimationByAtm[left.id]
      const rightEst = estimationByAtm[right.id]
      const direction = sortDirection === 'asc' ? 1 : -1
      let value = 0

      if (sortKey === 'id') value = left.id.localeCompare(right.id)
      if (sortKey === 'city') value = left.city.localeCompare(right.city)
      if (sortKey === 'status') value = left.status.localeCompare(right.status)
      if (sortKey === 'cash') value = totalCash(left) - totalCash(right)
      if (sortKey === 'estimated') value = (leftEst?.projectedCashTotal ?? 0) - (rightEst?.projectedCashTotal ?? 0)
      if (sortKey === 'variation') value = ((leftEst?.projectedCashTotal ?? totalCash(left)) - totalCash(left)) - ((rightEst?.projectedCashTotal ?? totalCash(right)) - totalCash(right))
      if (sortKey === 'risk') value = riskRank(leftEst?.riskLevel) - riskRank(rightEst?.riskLevel)
      if (sortKey === 'lastSeen') value = new Date(latestEventByAtm[left.id]?.createdAt ?? 0).getTime() - new Date(latestEventByAtm[right.id]?.createdAt ?? 0).getTime()

      return value * direction
    })
  }, [atms, cityFilter, estimationByAtm, latestEventByAtm, query, riskFilter, sortDirection, sortKey, statusFilter])

  useEffect(() => {
    onVisibleAtmsChange?.(filteredAtms)
  }, [filteredAtms, onVisibleAtmsChange])

  function resetFilters() {
    setQuery('')
    setCityFilter('Todas')
    setStatusFilter('Todos')
    setRiskFilter('Todos')
    setSortKey('id')
    setSortDirection('asc')
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!filteredAtms.length) return
    const currentIndex = filteredAtms.findIndex(a => a.id === selectedAtmId)
    let nextIndex = currentIndex
    if (e.key === 'ArrowDown') { nextIndex = Math.min(filteredAtms.length - 1, currentIndex + 1); e.preventDefault() }
    else if (e.key === 'ArrowUp') { nextIndex = Math.max(0, currentIndex - 1); e.preventDefault() }
    else if (e.key === 'Enter' && currentIndex >= 0) { onSelectAtm(filteredAtms[currentIndex].id); return }
    else return
    if (nextIndex !== currentIndex && nextIndex >= 0) {
      onSelectAtm(filteredAtms[nextIndex].id)
      const el = scrollRef.current
      if (el) {
        const rowTop = nextIndex * ROW_HEIGHT
        if (rowTop < el.scrollTop) el.scrollTop = rowTop
        else if (rowTop + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = rowTop + ROW_HEIGHT - el.clientHeight
      }
    }
  }, [filteredAtms, selectedAtmId, onSelectAtm])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => { for (const e of entries) setViewHeight(e.contentRect.height) })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const buffer = 10
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer)
  const visibleCount = Math.ceil(viewHeight / ROW_HEIGHT) + buffer * 2
  const endIndex = Math.min(filteredAtms.length, startIndex + visibleCount)
  const totalHeight = filteredAtms.length * ROW_HEIGHT
  const offsetTop = startIndex * ROW_HEIGHT

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection(value => value === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(nextKey)
    setSortDirection(nextKey === 'id' ? 'asc' : 'desc')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb', padding: '6px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={searchBoxStyle}>
          <MdSearch size={14} color="#9ca3af" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar cajero, ciudad o ubicación"
            style={{ width: '100%', border: 0, outline: 0, fontSize: 11, color: '#374151', background: 'transparent', minWidth: 0 }}
          />
        </div>
        <FilterGroup label="Ciudad">
          <select value={cityFilter} onChange={event => setCityFilter(event.target.value)} style={controlStyle}>
            <option>Todas</option>
            {cities.map(city => <option key={city}>{city}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Estado">
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={controlStyle}>
            <option>Todos</option>
            <option value="Online">En linea</option>
            <option value="Warning">Advertencia</option>
            <option value="FueraDeServicio">Fuera de servicio</option>
            <option value="SinEfectivo">Sin efectivo</option>
            <option value="Offline">Desconectado</option>
          </select>
        </FilterGroup>
        <FilterGroup label="Riesgo">
          <select value={riskFilter} onChange={event => setRiskFilter(event.target.value)} style={controlStyle}>
            <option>Todos</option>
            <option>Normal</option>
            <option>Advertencia</option>
            <option>Critico</option>
            <option>Sin efectivo</option>
          </select>
        </FilterGroup>
        <button type="button" onClick={resetFilters} style={viewAllButtonStyle}>Ver todos</button>
        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {filteredAtms.length} de {atms.length} cajeros
        </span>
      </div>

      {atms.length === 0 ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 12 }}>
          Sin cajeros. Inicia el simulador con OutputApiEnabled = true y el backend corriendo.
        </div>
      ) : (
        <div ref={scrollRef} tabIndex={0} onKeyDown={handleKeyDown} onScroll={e => setScrollTop((e.target as HTMLElement).scrollTop)} style={{ flex: 1, minHeight: 0, overflow: 'auto', outline: 'none' }}>
          <table style={{ tableLayout: 'fixed', width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 890 }}>
            <colgroup>
              <col style={{ width: 72 }} />
              <col style={{ width: 76 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 62 }} />
              <col style={{ width: 74 }} />
              <col style={{ width: 330 }} />
            </colgroup>
            <thead style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={th}><SortButton label="Cajero" sortKey="id" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th style={th}><SortButton label="Ciudad" sortKey="city" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th style={th}><SortButton label="Estado" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th style={{ ...th, textAlign: 'center' }}>Dispositivos</th>
                <th style={th}><SortButton label="Efectivo" sortKey="cash" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" /></th>
                <th style={th}><SortButton label="Estimación" sortKey="estimated" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" /></th>
                <th style={th}><SortButton label="Var." sortKey="variation" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" /></th>
                <th style={th}><SortButton label="Riesgo" sortKey="risk" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="center" /></th>
                <th style={th}><SortButton label="Últ. evento" sortKey="lastSeen" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
              </tr>
            </thead>
            <tbody>
              {offsetTop > 0 && <tr style={{ height: offsetTop }} />}
              {filteredAtms.slice(startIndex, endIndex).map((atm, i) => {
                const rowIndex = startIndex + i
                const selected = atm.id === selectedAtmId
                const lastEvent = lastRelevantEventByAtm[atm.id] ?? latestEventByAtm[atm.id]
                const estimation = estimationByAtm[atm.id]
                const zebra = rowIndex % 2 === 1 ? '#f9fafb' : '#fff'
                const bg =
                  selected ? '#eff6ff' :
                  atm.status === 'FueraDeServicio' ? '#fff1f2' :
                  atm.status === 'SinEfectivo' ? '#f5f3ff' :
                  atm.status === 'Offline' ? '#f3f4f6' :
                  atm.status === 'Warning' ? '#fffbeb' : zebra

                return (
                  <tr
                    key={atm.id}
                    onClick={() => onSelectAtm(atm.id)}
                    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#f0f4ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = bg }}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: bg,
                      cursor: 'pointer',
                      verticalAlign: 'middle',
                      outline: selected ? '1px solid #bfdbfe' : undefined,
                    }}
                  >
                    <td style={{ ...td, paddingTop: 9, paddingBottom: 9 }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: selected ? '#1d4ed8' : '#111827' }}>{atm.id}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{atm.location || atm.displayName}</div>
                    </td>
                    <td style={{ ...td, color: '#374151', fontWeight: 600 }}>{atm.city}</td>
                    <td style={td}><StatusCell status={atm.status} /></td>
                    <td style={{ ...td, textAlign: 'center' }}><DeviceSummary atm={atm} /></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: '#15803d' }}>{fmt$(totalCash(atm))}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', lineHeight: '12px' }}>actual</div>
                    </td>
                    <EstimateCells estimation={estimation} />
                    <td style={{ ...td, color: lastEvent ? (lastEvent.severity === 'Critical' ? '#991b1b' : lastEvent.severity === 'Warning' ? '#92400e' : '#374151') : '#9ca3af', overflow: 'hidden' }}>
                      {lastEvent || atm.lastErrorMessage ? (
                        <div title={lastEvent?.message ?? atm.lastErrorMessage} style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            {lastEvent && (
                              <span style={{
                                flexShrink: 0,
                                border: `1px solid ${lastEvent.severity === 'Critical' ? '#fecaca' : lastEvent.severity === 'Warning' ? '#fed7aa' : '#dbeafe'}`,
                                background: lastEvent.severity === 'Critical' ? '#fee2e2' : lastEvent.severity === 'Warning' ? '#fff7ed' : '#eff6ff',
                                color: lastEvent.severity === 'Critical' ? '#b91c1c' : lastEvent.severity === 'Warning' ? '#b45309' : '#2563eb',
                                borderRadius: 999,
                                padding: '1px 5px',
                                fontSize: 10,
                                fontWeight: 600,
                              }}>{lastEvent.severity}</span>
                            )}
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600 }}>
                              {lastEvent?.message ?? atm.lastErrorMessage}
                            </span>
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: 10, lineHeight: '12px' }}>
                            {lastEvent ? fmtTime(lastEvent.createdAt) : 'Sin hora simulada'}
                          </div>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {totalHeight - offsetTop - (endIndex - startIndex) * ROW_HEIGHT > 0 && <tr style={{ height: totalHeight - offsetTop - (endIndex - startIndex) * ROW_HEIGHT }} />}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{label}:</span>
      {children}
    </div>
  )
}

const controlStyle: React.CSSProperties = {
  height: 30,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  color: '#374151',
  fontSize: 11,
  fontWeight: 600,
  padding: '0 8px',
  outline: 0,
}

const searchBoxStyle: React.CSSProperties = {
  height: 30,
  width: 260,
  maxWidth: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  borderRadius: 4,
  padding: '0 8px',
  minWidth: 180,
}

const viewAllButtonStyle: React.CSSProperties = {
  height: 30,
  alignSelf: 'end',
  border: '1px solid #bfdbfe',
  borderRadius: 4,
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: 11,
  fontWeight: 600,
  padding: '0 10px',
  cursor: 'pointer',
}

const th: React.CSSProperties = {
  padding: '7px 7px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 11,
  color: '#4b5563',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '7px 7px',
}
