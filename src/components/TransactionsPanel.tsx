import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  MdCheckCircle,
  MdError,
  MdLocationCity,
  MdQueryStats,
  MdRefresh,
  MdSearch,
  MdShowChart,
  MdTableChart,
} from 'react-icons/md'
import { api } from '../api/client'
import { formatSessionCode } from '../utils/sessionIdentity'
import type {
  ActiveRunDto,
  OperationalLoadSeriesDto,
  OperationalLoadSeriesPointDto,
  TransactionDto,
  TransactionPageDto,
  TransactionSummaryDto,
} from '../types'

interface Props {
  activeRun: ActiveRunDto
}

interface Filters {
  query: string
  city: string
  type: string
  status: string
  from: string
  to: string
}

const emptyPage: TransactionPageDto = {
  total: 0,
  page: 1,
  pageSize: 100,
  totalPages: 1,
  items: [],
}

function fmtMoney(value: number) {
  const rounded = Math.round(value)
  return `${rounded < 0 ? '-' : ''}$${Math.abs(rounded).toLocaleString('es-EC')}`
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

function fmtDuration(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${(seconds / 60).toFixed(1)} min`
}

function typeColor(type: string) {
  return type === 'Retiro' ? '#2563eb' : '#7c3aed'
}

function toInputDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toQueryDateTime(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function shortSessionLabel(seed: number) {
  return formatSessionCode(seed)
}

function sameFilters(left: Filters, right: Filters) {
  return left.query === right.query &&
    left.city === right.city &&
    left.type === right.type &&
    left.status === right.status &&
    left.from === right.from &&
    left.to === right.to
}

function axisLabel(bucket: OperationalLoadSeriesPointDto, granularity?: string, showDate = false) {
  if (granularity !== 'hour') return { primary: bucket.label, secondary: '' }
  const match = bucket.key.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/)
  if (!match) return { primary: bucket.label, secondary: '' }

  const [, year, month, day, hour] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return {
    primary: `${hour}:00`,
    secondary: showDate
      ? date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
      : '',
  }
}

function rangeLabel(filters: Filters) {
  const left = filters.from ? fmtTime(toQueryDateTime(filters.from)) : 'inicio'
  const right = filters.to ? fmtTime(toQueryDateTime(filters.to)) : 'fin'
  return `${left} - ${right}`
}

export function TransactionsPanel({ activeRun }: Props) {
  const runId = activeRun.runId
  const defaultFilters = useMemo<Filters>(() => ({
    query: '',
    city: '',
    type: '',
    status: '',
    from: toInputDateTime(activeRun.startedAtSimulated),
    to: toInputDateTime(activeRun.endedAtSimulated ?? activeRun.plannedEndAtSimulated),
  }), [activeRun.endedAtSimulated, activeRun.plannedEndAtSimulated, activeRun.startedAtSimulated])

  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week' | 'month' | 'year'>('hour')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null)
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters)
  const [pageData, setPageData] = useState<TransactionPageDto>(emptyPage)
  const [series, setSeries] = useState<OperationalLoadSeriesDto | null>(null)
  const [summary, setSummary] = useState<TransactionSummaryDto | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)

  const rows = pageData.items
  const selected = rows.find(item => item.id === selectedTransactionId) ?? rows[0] ?? null
  const sessionLabel = shortSessionLabel(activeRun.randomSeed)

  const requestParams = useMemo(() => ({
    runId,
    query: appliedFilters.query.trim() || undefined,
    city: appliedFilters.city.trim() || undefined,
    type: appliedFilters.type || undefined,
    status: appliedFilters.status || undefined,
    from: toQueryDateTime(appliedFilters.from),
    to: toQueryDateTime(appliedFilters.to),
  }), [appliedFilters, runId])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (view === 'chart') {
        const [seriesResult, summaryResult] = await Promise.all([
          api.getOperationalLoadSeries({ ...requestParams, granularity }),
          api.getTransactionSummary(requestParams),
        ])
        setSeries(seriesResult as OperationalLoadSeriesDto)
        setSummary(summaryResult as TransactionSummaryDto)
      } else {
        const nextPage = await api.getTransactions({ ...requestParams, page, pageSize }) as TransactionPageDto
        setPageData(nextPage)
        setSelectedTransactionId(current => {
          if (current && nextPage.items.some(item => item.id === current)) return current
          return nextPage.items[0]?.id ?? null
        })
      }
      setLastLoadedAt(new Date().toLocaleTimeString('es-EC', { hour12: false }))
    } catch {
      setError('No se pudo consultar la sesión con los filtros actuales.')
    } finally {
      setLoading(false)
    }
  }, [granularity, page, pageSize, requestParams, view])

  useEffect(() => {
    setDraftFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
    setPage(1)
    setPageData(emptyPage)
    setSeries(null)
    setSummary(null)
    setSelectedTransactionId(null)
    setLastLoadedAt(null)
  }, [defaultFilters, runId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function applyFilters() {
    const from = toQueryDateTime(draftFilters.from)
    const to = toQueryDateTime(draftFilters.to)
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      setError('El rango Desde/Hasta no es válido.')
      return
    }

    if (sameFilters(draftFilters, appliedFilters)) {
      void loadData()
      return
    }

    setAppliedFilters(draftFilters)
    setPage(1)
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraftFilters(current => ({ ...current, [key]: value }))
  }

  const hasPrev = pageData.page > 1
  const hasNext = pageData.page < pageData.totalPages
  const currentRange = rangeLabel(appliedFilters)
  const canConsult = !loading

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <div style={filterPanelStyle}>
        <div style={filterHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ color: '#111827', fontSize: 12, fontWeight: 600 }}>Consulta de transacciones</span>
            <span style={seedChipStyle}>{sessionLabel}</span>
            <span style={{ color: '#64748b', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Gráfico, resumen y tabla usan el mismo rango.
            </span>
          </div>
          <span style={{ color: '#64748b', fontSize: 10, whiteSpace: 'nowrap' }}>Bajo demanda</span>
        </div>

        <div style={filterGridStyle}>
          <label style={fieldLabelStyle}>
            Buscar
            <span style={searchBoxStyle}>
              <MdSearch size={14} color="#94a3b8" />
              <input
                value={draftFilters.query}
                onChange={event => updateFilter('query', event.target.value)}
                placeholder="Transacción, cajero, ciudad o ubicación"
                style={inputStyle}
              />
            </span>
          </label>

          <label style={fieldLabelStyle}>
            Desde
            <input type="datetime-local" value={draftFilters.from} onChange={event => updateFilter('from', event.target.value)} style={controlStyle} />
          </label>

          <label style={fieldLabelStyle}>
            Hasta
            <input type="datetime-local" value={draftFilters.to} onChange={event => updateFilter('to', event.target.value)} style={controlStyle} />
          </label>

          <label style={fieldLabelStyle}>
            Ciudad
            <input value={draftFilters.city} onChange={event => updateFilter('city', event.target.value)} placeholder="Todas" style={controlStyle} />
          </label>

          <label style={fieldLabelStyle}>
            Tipo
            <select value={draftFilters.type} onChange={event => updateFilter('type', event.target.value)} style={controlStyle}>
              <option value="">Todos</option>
              <option value="Retiro">Retiro</option>
              <option value="Consulta">Consulta</option>
            </select>
          </label>

          <label style={fieldLabelStyle}>
            Resultado
            <select value={draftFilters.status} onChange={event => updateFilter('status', event.target.value)} style={controlStyle}>
              <option value="">Todos</option>
              <option value="success">Exitosas</option>
              <option value="failed">No exitosas</option>
            </select>
          </label>

          <button type="button" onClick={applyFilters} disabled={!canConsult} style={primaryButtonStyle(!canConsult)}>
            <MdRefresh size={14} /> Consultar
          </button>
        </div>
      </div>

      <div style={{ minHeight: 36, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          <StatusPill label="ID sesión" value={sessionLabel} />
          <StatusPill label="Transacciones" value={(summary?.totalTransactions ?? pageData.total).toLocaleString('es-EC')} color="#1d4ed8" />
          <StatusPill label="Rango" value={currentRange} wide />
          {lastLoadedAt && <StatusPill label="Consulta" value={lastLoadedAt} />}
          {loading && <span style={{ color: '#b45309', fontSize: 11 }}>Consultando...</span>}
          {error && <span style={{ color: '#dc2626', fontSize: 11 }}>{error}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <label style={toolbarControlStyle}>
            Agrupar
            <select value={granularity} onChange={event => setGranularity(event.target.value as typeof granularity)} style={toolbarSelectStyle}>
              <option value="hour">Horas</option>
              <option value="day">Días</option>
              <option value="week">Semanas</option>
              <option value="month">Meses</option>
              <option value="year">Años</option>
            </select>
          </label>
          <div style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 5, overflow: 'hidden' }}>
            <button type="button" onClick={() => setView('chart')} style={toggleButtonStyle(view === 'chart')}>
              <MdShowChart size={13} /> Gráfico
            </button>
            <button type="button" onClick={() => setView('table')} style={toggleButtonStyle(view === 'table')}>
              <MdTableChart size={13} /> Tabla
            </button>
          </div>
        </div>
      </div>

      {view === 'chart' ? (
        <>
          <OperationalLoadSeriesChart series={series} sessionLabel={sessionLabel} rangeText={currentRange} />
          <SessionSummaryCharts summary={summary} />
        </>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(680px, 1fr) 300px', gap: 8 }}>
          <div style={{ minHeight: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ minHeight: 38, flexShrink: 0, borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 8px', fontSize: 11, color: '#64748b' }}>
              <span>Detalle paginado de la sesión filtrada</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={tableRowsControlStyle}>
                  Filas
                  <select
                    value={pageSize}
                    onChange={event => {
                      setPageSize(Number(event.target.value))
                      setPage(1)
                    }}
                    style={toolbarSelectStyle}
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </label>
                <span>Página {pageData.page} de {pageData.totalPages}</span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 760, fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: 92 }} />
                  <col style={{ width: 72 }} />
                  <col style={{ width: 86 }} />
                  <col style={{ width: 86 }} />
                  <col style={{ width: 86 }} />
                  <col style={{ width: 105 }} />
                  <col style={{ width: 88 }} />
                  <col style={{ width: 122 }} />
                </colgroup>
                <thead style={{ background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={th}>Transacción</th>
                    <th style={th}>Tipo</th>
                    <th style={th}>Resultado</th>
                    <th style={th}>Cajero</th>
                    <th style={th}>Ciudad</th>
                    <th style={rightTh}>Monto</th>
                    <th style={rightTh}>Duración</th>
                    <th style={th}>Finalización</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(item => {
                    const selectedRow = item.id === selected?.id
                    return (
                      <tr key={item.id} onClick={() => setSelectedTransactionId(item.id)} style={{ borderTop: '1px solid #f3f4f6', background: selectedRow ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                        <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600, color: selectedRow ? '#1d4ed8' : '#111827' }}>{item.flowKey}</td>
                        <td style={td}><span style={{ color: typeColor(item.type), fontWeight: 600 }}>{item.type}</span></td>
                        <td style={td}><ResultBadge success={item.isSuccessful} /></td>
                        <td style={{ ...td, fontWeight: 600 }}>{item.atmId}</td>
                        <td style={td}>{item.city}</td>
                        <td style={{ ...rightTd, fontWeight: 600, color: item.amount > 0 ? '#15803d' : '#6b7280' }}>{item.amount > 0 ? fmtMoney(item.amount) : '-'}</td>
                        <td style={rightTd}>{fmtDuration(item.durationSimulatedSeconds)}</td>
                        <td style={{ ...td, color: '#6b7280' }}>{fmtTime(item.completedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>Sin transacciones para la consulta actual</div>}
            </div>
            <PaginationBar
              page={pageData.page}
              totalPages={pageData.totalPages}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPrev={() => setPage(value => Math.max(1, value - 1))}
              onNext={() => setPage(value => Math.min(pageData.totalPages, value + 1))}
            />
          </div>

          <TransactionDetail transaction={selected} />
        </div>
      )}
    </div>
  )
}

function niceAxisStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  const nice = normalized > 5 ? 10 : normalized > 2 ? 5 : normalized > 1 ? 2 : 1
  return Math.max(1, Math.round(nice * magnitude))
}

export function SessionSummaryCharts({ summary }: { summary: TransactionSummaryDto | null }) {
  const total = summary?.totalTransactions ?? 0
  const successful = summary?.successfulTransactions ?? 0
  const failed = summary?.failedTransactions ?? 0
  const successRate = total > 0 ? successful / total * 100 : 0

  return (
    <div style={{ height: 172, flexShrink: 0, display: 'grid', gridTemplateColumns: '0.95fr 1fr minmax(360px, 1.45fr)', gap: 8 }}>
      <TransactionMixChart withdrawals={summary?.withdrawals ?? 0} inquiries={summary?.inquiries ?? 0} />
      <ResultQualityChart successful={successful} failed={failed} totalAmount={summary?.successfulWithdrawalAmount ?? 0} successRate={successRate} />
      <CityVolumeChart items={(summary?.byCity ?? []).slice(0, 6)} />
    </div>
  )
}

export function OperationalLoadSeriesChart({ series, sessionLabel, rangeText }: { series: OperationalLoadSeriesDto | null; sessionLabel: string; rangeText: string }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1280)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setContainerWidth(Math.max(600, Math.round(e.contentRect.width)))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const buckets = series?.points ?? []
  const counts = buckets.map(item => item.transactions)
  const expectedCounts = buckets.map(item => item.expectedTransactions ?? 0)
  const total = series?.totalTransactions ?? 0
  const successful = series?.successfulTransactions ?? 0
  const failed = series?.failedTransactions ?? 0
  const expectedAvailable = Boolean(series?.expectedAvailable && buckets.some(item => item.expectedTransactions !== undefined))
  const expectedTotal = series?.expectedTransactions ?? expectedCounts.reduce((sum, item) => sum + item, 0)
  const peak = buckets.length > 0 ? buckets.reduce((current, next) => next.transactions > current.transactions ? next : current) : null
  const activeKey = hoveredKey ?? pinnedKey
  const selectedBar = activeKey === null ? null : buckets.find(item => item.key === activeKey) ?? null
  const selectedBarTitle = selectedBar
    ? detailPeriodLabel(selectedBar, series?.granularity)
    : ''
  const width = containerWidth
  const height = 206
  const left = 44
  const top = 20
  const right = 18
  const bottom = series?.granularity === 'hour' ? 46 : 38
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const step = niceAxisStep(Math.max(1, ...counts, ...expectedCounts) / 4)
  const axisMax = step * 4
  const slot = plotWidth / Math.max(1, buckets.length)
  const barWidth = Math.max(10, Math.min(64, slot * 0.54))
  const periodLabel = periodName(series?.granularity)
  const hourlyAcrossDays = series?.granularity === 'hour' && new Set(buckets.map(bucket => bucket.key.slice(0, 10))).size > 1
  const labelEvery = Math.max(1, Math.ceil(buckets.length / (series?.granularity === 'hour' ? 18 : 24)))
  const dataRangeText = series?.firstTransactionAt
    ? `Datos: ${fmtTime(series.firstTransactionAt)} - ${fmtTime(series.lastTransactionAt)}`
    : 'Sin datos en el rango'
  const pointY = (value: number) => top + plotHeight - (plotHeight * Math.min(value, axisMax) / axisMax)
  const linePath = buckets.map((bucket, index) => {
    const x = left + slot * index + slot / 2
    const y = pointY(bucket.successful)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
  const expectedPath = expectedAvailable
    ? buckets.map((bucket, index) => {
      const x = left + slot * index + slot / 2
      const y = pointY(bucket.expectedTransactions ?? 0)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    }).join(' ')
    : ''
  const failedPath = buckets
    .filter(bucket => bucket.failed > 0)
    .map(bucket => {
      const index = buckets.findIndex(item => item.key === bucket.key)
      const x = left + slot * index + slot / 2
      return `${x.toFixed(2)},${pointY(bucket.failed).toFixed(2)}`
    })
    .join(' ')

  return (
    <div style={{ flexShrink: 0, background: '#fff', border: '1px solid #dbe3ef', borderRadius: 6, overflow: 'hidden' }}>
      <ChartHeader
        title={`Resumen temporal - ${sessionLabel}`}
        subtitle={`Agrupado por ${periodLabel.toLowerCase()} | ${dataRangeText} | Filtro: ${rangeText}`}
        kpis={[
          { label: 'Total', value: total.toLocaleString('es-EC'), color: '#1d4ed8' },
          { label: 'Pico', value: peak ? `${peak.transactions} tx` : '-', sub: peak?.label, color: '#dc2626' },
          { label: 'Esperado', value: expectedAvailable ? expectedTotal.toLocaleString('es-EC', { maximumFractionDigits: 0 }) : '-', sub: expectedAvailable ? 'segun curva' : 'no comparable', color: expectedAvailable ? '#92400e' : '#94a3b8' },
          { label: 'Éxito', value: total > 0 ? `${(successful / total * 100).toFixed(1)}%` : '0.0%', color: total === 0 || successful / Math.max(1, total) >= 0.9 ? '#15803d' : '#b45309' },
          { label: periodLabel, value: buckets.length.toString(), sub: `${failed} fallidas`, color: '#475569' },
        ]}
      />

      {total === 0 && !expectedAvailable ? (
        <EmptyChart text="Sin transacciones agregadas para esta consulta." />
      ) : (
        <div ref={containerRef} style={{ padding: '10px 12px 4px', position: 'relative' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 196, display: 'block' }} role="img" aria-label="Transacciones por periodo">
            <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="#fff" stroke="#dbe3ef" />
            {[0, 1, 2, 3, 4].map(i => {
              const value = step * i
              const y = top + plotHeight - (plotHeight * value / axisMax)
              return <g key={i}><line x1={left} y1={y} x2={left + plotWidth} y2={y} stroke="#edf2f7" /><text x={4} y={y + 4} fontSize="10" fill="#94a3b8">{value}</text></g>
            })}
            {buckets.map((bucket, index) => {
              const barHeight = plotHeight * Math.min(bucket.transactions, axisMax) / axisMax
              const x = left + slot * index + (slot - barWidth) / 2
              const y = top + plotHeight - barHeight
              return (
                <g key={bucket.key}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={2}
                    fill={peak?.key === bucket.key ? '#ef4444' : '#2563eb'}
                    opacity={bucket.transactions === 0 ? 0.16 : activeKey === bucket.key ? 1 : 0.82}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(event: MouseEvent<SVGRectElement>) => {
                      setHoveredKey(bucket.key)
                      setCardPosition({ x: event.clientX, y: event.clientY })
                    }}
                    onMouseMove={(event: MouseEvent<SVGRectElement>) => setCardPosition({ x: event.clientX, y: event.clientY })}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={(event: MouseEvent<SVGRectElement>) => {
                      setPinnedKey(current => current === bucket.key ? null : bucket.key)
                      setCardPosition({ x: event.clientX, y: event.clientY })
                    }}
                  />
                  {(buckets.length <= 32 || index % labelEvery === 0) && (() => {
                    const label = axisLabel(bucket, series?.granularity, hourlyAcrossDays)
                    return (
                      <text x={x + barWidth / 2} y={height - (label.secondary ? 18 : 10)} fontSize="10" fill="#64748b" textAnchor="middle">
                        <tspan x={x + barWidth / 2}>{label.primary}</tspan>
                        {label.secondary && <tspan x={x + barWidth / 2} dy="12" fill="#94a3b8">{label.secondary}</tspan>}
                      </text>
                    )
                  })()}
                </g>
              )
            })}
            {expectedPath && <path d={expectedPath} fill="none" stroke="#d97706" strokeWidth="2.2" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />}
            {linePath && <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {failedPath && <polyline points={failedPath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          <ChartLegend expectedAvailable={expectedAvailable} />
          {selectedBar && cardPosition && <FloatingTooltip x={cardPosition.x} y={cardPosition.y} title={selectedBarTitle} item={selectedBar} pinned={pinnedKey === selectedBar.key} />}
        </div>
      )}
    </div>
  )
}

function detailPeriodLabel(bucket: OperationalLoadSeriesPointDto, granularity?: string) {
  if (granularity === 'hour') {
    const label = axisLabel(bucket, 'hour', true)
    return label.secondary ? `${label.secondary}, ${label.primary}` : label.primary
  }
  return bucket.label
}

function periodName(value?: string) {
  if (value === 'day') return 'Días'
  if (value === 'week') return 'Semanas'
  if (value === 'month') return 'Meses'
  if (value === 'year') return 'Años'
  return 'Horas'
}

function StatusPill({ label, value, color = '#334155', wide = false }: { label: string; value: string; color?: string; wide?: boolean }) {
  return (
    <span style={{ minWidth: wide ? 250 : 0, maxWidth: wide ? 380 : 210, height: 28, display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', padding: '0 8px', overflow: 'hidden' }}>
      <span style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      <span title={value} style={{ color, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </span>
  )
}

function ChartHeader({ title, subtitle, kpis }: { title: string; subtitle: string; kpis: Array<{ label: string; value: string; sub?: string; color: string }> }) {
  return (
    <div style={{ minHeight: 48, borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) repeat(5, minmax(86px, auto))', gap: 10, alignItems: 'center', padding: '7px 10px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 600, textTransform: 'uppercase' }}>{title}</div>
        <div style={{ color: '#64748b', fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
      </div>
      {kpis.map(item => <ChartKpi key={item.label} {...item} />)}
    </div>
  )
}

function ChartKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ minWidth: 86, textAlign: 'right' }}>
      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color, fontSize: 16, fontWeight: 600, lineHeight: '18px' }}>{value}</div>
      {sub && <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 500 }}>{sub}</div>}
    </div>
  )
}

function FloatingTooltip({ x, y, title, item, pinned }: { x: number; y: number; title: string; item: OperationalLoadSeriesPointDto; pinned: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: Math.min(window.innerWidth - 96, Math.max(96, x)),
        top: Math.min(window.innerHeight - 24, Math.max(86, y - 10)),
        transform: 'translate(-50%, -100%)',
        minWidth: 170,
        padding: '8px 9px',
        border: '1px solid #cbd5e1',
        borderRadius: 6,
        background: '#ffffff',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
        fontSize: 10,
        color: '#334155',
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ color: '#64748b' }}>{pinned ? 'Selección' : 'Periodo'}</span>
        <span style={{ color: '#111827', fontWeight: 600 }}>{title}</span>
      </div>
      <TooltipMetric label="Transacciones" value={item.transactions} color="#2563eb" />
      {item.expectedTransactions !== undefined && <TooltipMetric label="Esperadas" value={Math.round(item.expectedTransactions)} color="#92400e" />}
      <TooltipMetric label="Exitosas" value={item.successful} color="#15803d" />
      <TooltipMetric label="Fallidas" value={item.failed} color={item.failed > 0 ? '#ea580c' : '#94a3b8'} />
      <TooltipMetric label="Retiros" value={item.withdrawals} color="#334155" />
      <TooltipMetric label="Consultas" value={item.inquiries} color="#334155" />
    </div>
  )
}

function ChartLegend({ expectedAvailable }: { expectedAvailable: boolean }) {
  return (
    <div style={{ height: 18, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, color: '#64748b', fontSize: 10 }}>
      <Legend color="#2563eb" label="Transacciones" />
      {expectedAvailable && <Legend color="#d97706" label="Esperado" />}
      <Legend color="#10b981" label="Exitosas" />
      <Legend color="#f97316" label="Fallidas" />
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return <div style={{ height: 220, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>{text}</div>
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function TooltipMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, lineHeight: '17px' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value.toLocaleString('es-EC')}</span>
    </div>
  )
}

function PaginationBar({ page, totalPages, hasPrev, hasNext, onPrev, onNext }: { page: number; totalPages: number; hasPrev: boolean; hasNext: boolean; onPrev: () => void; onNext: () => void }) {
  return (
    <div style={{ height: 36, flexShrink: 0, borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 8px' }}>
      <button type="button" onClick={onPrev} disabled={!hasPrev} style={pagerButtonStyle(!hasPrev)}>Anterior</button>
      <span style={{ color: '#64748b', fontSize: 11 }}>Página {page} de {totalPages}</span>
      <button type="button" onClick={onNext} disabled={!hasNext} style={pagerButtonStyle(!hasNext)}>Siguiente</button>
    </div>
  )
}

function TransactionDetail({ transaction }: { transaction: TransactionDto | null }) {
  if (!transaction) {
    return <div style={detailContainer}><div style={{ margin: 'auto', color: '#9ca3af', fontSize: 11 }}>Selecciona una transacción</div></div>
  }

  return (
    <div style={detailContainer}>
      <div style={{ height: 40, flexShrink: 0, padding: '0 9px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MdQueryStats size={15} color="#2563eb" />
        <span style={{ color: '#374151', fontSize: 12, fontWeight: 600 }}>Detalle {transaction.flowKey}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 9 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <DetailMetric label="Resultado" value={transaction.isSuccessful ? 'Exitosa' : 'No exitosa'} color={transaction.isSuccessful ? '#15803d' : '#dc2626'} />
          <DetailMetric label="Tipo" value={transaction.type} color={typeColor(transaction.type)} />
          <DetailMetric label="Monto" value={transaction.amount > 0 ? fmtMoney(transaction.amount) : '-'} color="#15803d" />
          <DetailMetric label="Billetes" value={transaction.billCount.toString()} color="#374151" />
          <DetailMetric label="Duración simulada" value={fmtDuration(transaction.durationSimulatedSeconds)} color="#7c3aed" />
          <DetailMetric label="Latencia recepción" value={`${transaction.durationRealMilliseconds.toFixed(0)} ms`} color="#2563eb" />
        </div>

        <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#374151', fontSize: 11, fontWeight: 600 }}><MdLocationCity size={13} /> {transaction.atmId} - {transaction.city}</div>
          <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>{transaction.location}</div>
        </div>

        {transaction.cassetteMovements.length > 0 && (
          <section style={{ marginTop: 10 }}>
            <SectionLabel text="Movimientos por gaveta" />
            {transaction.cassetteMovements.map(item => (
              <div key={item.cassetteId} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 72px', gap: 6, alignItems: 'center', borderTop: '1px solid #f3f4f6', padding: '5px 0', fontSize: 10 }}>
                <span style={{ color: '#111827', fontWeight: 600 }}>{item.cassetteId}</span>
                <span style={{ color: '#6b7280' }}>{Math.abs(item.billDelta)} billetes</span>
                <span style={{ color: item.amountDelta < 0 ? '#b45309' : '#15803d', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(item.amountDelta)}</span>
              </div>
            ))}
          </section>
        )}

        <section style={{ marginTop: 10 }}>
          <SectionLabel text={`Etapas de la transacción (${transaction.steps.length})`} />
          {transaction.steps.map((step, index) => (
            <div key={step.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 6, padding: '5px 0', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ width: 16, height: 16, borderRadius: 999, background: step.severity === 'Warning' || step.severity === 'Critical' ? '#fee2e2' : '#dbeafe', color: step.severity === 'Warning' || step.severity === 'Critical' ? '#dc2626' : '#2563eb', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 600 }}>{index + 1}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 5 }}>
                  <span style={{ color: '#374151', fontSize: 10, fontWeight: 600 }}>{step.status || step.eventType}</span>
                  <span style={{ color: '#9ca3af', fontSize: 10 }}>{new Date(step.createdAt).toLocaleTimeString('es-EC', { hour12: false })}</span>
                </div>
                <div title={step.message} style={{ color: '#6b7280', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.message}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, overflow: 'hidden' }}>
      <div style={{ color: '#374151', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function TransactionMixChart({ withdrawals, inquiries }: { withdrawals: number; inquiries: number }) {
  const total = Math.max(1, withdrawals + inquiries)
  const withdrawalPct = withdrawals / total * 100
  const inquiryPct = inquiries / total * 100
  const radius = 34
  const circumference = 2 * Math.PI * radius

  return (
    <PanelShell title="Tipo de transacción - sesión filtrada">
      <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 12, alignItems: 'center', minHeight: 118 }}>
        <svg viewBox="0 0 96 96" style={{ width: 96, height: 96 }} role="img" aria-label="Distribución por tipo de transacción">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#eef2f7" strokeWidth="12" />
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#2563eb" strokeWidth="12" strokeDasharray={`${withdrawalPct / 100 * circumference} ${circumference}`} strokeLinecap="round" transform="rotate(-90 48 48)" />
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#7c3aed" strokeWidth="12" strokeDasharray={`${inquiryPct / 100 * circumference} ${circumference}`} strokeDashoffset={-(withdrawalPct / 100 * circumference)} strokeLinecap="round" transform="rotate(-90 48 48)" />
          <text x="48" y="45" textAnchor="middle" fontSize="15" fontWeight="600" fill="#111827">{withdrawals + inquiries}</text>
          <text x="48" y="59" textAnchor="middle" fontSize="9" fill="#64748b">tx</text>
        </svg>
        <div style={{ display: 'grid', gap: 10 }}>
          <LegendRow label="Retiros" value={withdrawals} color="#2563eb" pct={withdrawalPct} />
          <LegendRow label="Consultas" value={inquiries} color="#7c3aed" pct={inquiryPct} />
        </div>
      </div>
    </PanelShell>
  )
}

function ResultQualityChart({ successful, failed, totalAmount, successRate }: { successful: number; failed: number; totalAmount: number; successRate: number }) {
  const total = Math.max(1, successful + failed)
  return (
    <PanelShell title="Resultado - sesión filtrada">
      <div style={{ minHeight: 118, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CompactStat label="Exitosas" value={successful.toLocaleString('es-EC')} color="#15803d" />
          <CompactStat label="Fallidas" value={failed.toLocaleString('es-EC')} color={failed > 0 ? '#dc2626' : '#94a3b8'} />
        </div>
        <div style={{ height: 12, borderRadius: 999, overflow: 'hidden', background: '#eef2f7', display: 'flex' }}>
          <div title={`${successful} exitosas`} style={{ width: `${successful / total * 100}%`, background: '#16a34a' }} />
          <div title={`${failed} fallidas`} style={{ width: `${failed / total * 100}%`, background: '#ef4444' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', color: '#64748b', fontSize: 10 }}>
          <span>Efectivo dispensado</span>
          <span style={{ color: '#15803d', fontSize: 15, fontWeight: 600 }}>{fmtMoney(totalAmount)}</span>
          <span style={{ color: successRate >= 90 ? '#15803d' : '#b45309', fontSize: 13, fontWeight: 600 }}>{successRate.toFixed(1)}%</span>
        </div>
      </div>
    </PanelShell>
  )
}

function CityVolumeChart({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map(item => item.value))
  return (
    <PanelShell title="Volumen por ciudad - sesión filtrada">
      <div style={{ minHeight: 118, display: 'grid', gap: 9, alignContent: 'center' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '86px 1fr 44px', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#475569', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            <div style={{ height: 14, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' }}>
              <div title={`${item.label}: ${item.value} transacciones`} style={{ height: '100%', width: `${item.value / max * 100}%`, background: '#60a5fa', borderRadius: 999 }} />
            </div>
            <span style={{ color: '#2563eb', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{item.value}</span>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: '#9ca3af', fontSize: 11 }}>Sin datos</div>}
      </div>
    </PanelShell>
  )
}

function LegendRow({ label, value, color, pct }: { label: string; value: number; color: string; pct: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 7, alignItems: 'center', color: '#475569', fontSize: 11 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      <span>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pct.toFixed(0)}%)</span></span>
    </div>
  )
}

function CompactStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ border: '1px solid #edf2f7', background: '#f8fafc', borderRadius: 5, padding: '7px 8px' }}>
      <div style={{ color: '#64748b', fontSize: 10 }}>{label}</div>
      <div style={{ color, fontSize: 18, lineHeight: '20px', fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function ResultBadge({ success }: { success: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: `1px solid ${success ? '#bbf7d0' : '#fecaca'}`, background: success ? '#f0fdf4' : '#fef2f2', color: success ? '#15803d' : '#dc2626', borderRadius: 4, padding: '2px 5px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {success ? <MdCheckCircle size={11} /> : <MdError size={11} />}
      {success ? 'Exitosa' : 'No exitosa'}
    </span>
  )
}

function DetailMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', padding: '6px 7px', minWidth: 0 }}>
      <div style={{ color: '#6b7280', fontSize: 10 }}>{label}</div>
      <div style={{ color, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return <div style={{ color: '#374151', fontSize: 10, fontWeight: 600, marginBottom: 3 }}>{text}</div>
}

function toggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 26,
    padding: '0 10px',
    border: 0,
    background: active ? '#2563eb' : '#fff',
    color: active ? '#fff' : '#374151',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
  }
}

function pagerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 26,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    background: disabled ? '#f3f4f6' : '#fff',
    color: disabled ? '#9ca3af' : '#374151',
    fontSize: 10,
    fontWeight: 600,
    padding: '0 8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

const seedChipStyle: React.CSSProperties = {
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 999,
  padding: '2px 7px',
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const filterPanelStyle: React.CSSProperties = {
  minHeight: 66,
  flexShrink: 0,
  background: '#fff',
  border: '1px solid #dbe3ef',
  borderRadius: 6,
  padding: '5px 8px',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  gap: 4,
}

const filterHeaderStyle: React.CSSProperties = {
  minHeight: 22,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
}

const filterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 1.25fr) minmax(152px, 0.72fr) minmax(152px, 0.72fr) minmax(96px, 0.48fr) minmax(96px, 0.48fr) minmax(112px, 0.52fr) 106px',
  gap: 8,
  alignItems: 'end',
  minWidth: 0,
}

const fieldLabelStyle: React.CSSProperties = {
  minWidth: 0,
  display: 'grid',
  gap: 2,
  color: '#64748b',
  fontSize: 10,
  fontWeight: 600,
}

const searchBoxStyle: React.CSSProperties = {
  height: 26,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  padding: '0 8px',
}

const controlStyle: React.CSSProperties = {
  width: '100%',
  height: 26,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  color: '#374151',
  fontSize: 11,
  fontWeight: 500,
  padding: '0 7px',
  outline: 0,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  outline: 0,
  fontSize: 11,
  background: 'transparent',
  color: '#374151',
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 30,
    border: `1px solid ${disabled ? '#d1d5db' : '#1d4ed8'}`,
    borderRadius: 5,
    background: disabled ? '#f3f4f6' : '#2563eb',
    color: disabled ? '#9ca3af' : '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '0 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
  }
}

const toolbarControlStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  padding: '0 8px',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  background: '#fff',
  color: '#64748b',
  fontSize: 11,
}

const tableRowsControlStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  padding: '0 8px',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  background: '#fff',
  color: '#64748b',
  fontSize: 11,
}

const toolbarSelectStyle: React.CSSProperties = {
  border: 0,
  outline: 'none',
  color: '#111827',
  fontSize: 11,
  fontWeight: 500,
  background: 'transparent',
}

const th: React.CSSProperties = { padding: '6px', color: '#6b7280', fontSize: 10, textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }
const rightTh: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '6px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const rightTd: React.CSSProperties = { ...td, textAlign: 'right' }
const detailContainer: React.CSSProperties = { minHeight: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
