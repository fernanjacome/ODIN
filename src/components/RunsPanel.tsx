import { useMemo, useState } from 'react'
import { MdAssessment, MdCheckCircle, MdError, MdSearch, MdSpeed, MdWarning } from 'react-icons/md'
import type { RunSummaryDto, ThesisValidationDto } from '../types'
import { formatSessionCode } from '../utils/sessionIdentity'

interface Props {
  runs: RunSummaryDto[]
  validation: ThesisValidationDto | null
}

function metricColor(ok: boolean) {
  return ok
    ? { fg: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' }
    : { fg: '#b45309', bg: '#fff7ed', border: '#fed7aa' }
}

function MetricCard({
  label,
  value,
  target,
  ok,
  higherIsBetter,
}: {
  label: string
  value: number
  target: number
  ok: boolean
  higherIsBetter: boolean
}) {
  const color = metricColor(ok)
  const progress = higherIsBetter
    ? Math.min(100, value / target * 100)
    : value <= 0
      ? 100
      : Math.min(100, target / value * 100)

  return (
    <div style={{ border: `1px solid ${color.border}`, background: color.bg, borderRadius: 5, padding: '6px 7px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {ok ? <MdCheckCircle size={13} color={color.fg} /> : <MdWarning size={13} color={color.fg} />}
        <span style={{ fontSize: 10, color: '#374151', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 3 }}>
        <span style={{ fontSize: 15, color: color.fg, fontWeight: 600 }}>{value.toFixed(1)}%</span>
        <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
          {higherIsBetter ? `>= ${target}%` : `<= ${target}%`}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: '#ffffff', overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: `${progress}%`, height: '100%', background: color.fg }} />
      </div>
    </div>
  )
}

export function RunsPanel({ runs, validation }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const latest = validation?.latestRun

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return runs
      .filter(run => !needle ||
        run.scenarioName.toLowerCase().includes(needle) ||
        run.status.toLowerCase().includes(needle) ||
        run.randomSeed.toString().includes(needle))
      .sort((left, right) => {
        if (sort === 'events') return right.totalEvents - left.totalEvents
        if (sort === 'cashError') return left.avgAbsolutePercError - right.avgAbsolutePercError
        if (sort === 'latency') return right.eventsUnder2SecPercent - left.eventsUnder2SecPercent
        return new Date(right.startedAtReal).getTime() - new Date(left.startedAtReal).getTime()
      })
  }, [query, runs, sort])

  return (
    <div className="bg-white rounded border border-gray-200 flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      <div className="px-2 py-1 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
        <div className="flex items-center gap-1.5">
          <MdAssessment size={14} className="text-blue-500" />
          <span className="font-semibold text-gray-700" style={{ fontSize: 12 }}>Validación de tesis</span>
        </div>
        <span className="text-gray-400" style={{ fontSize: 11 }}>{rows.length} de {validation?.completedRuns ?? runs.length}</span>
      </div>

      <div style={{ height: 34, borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, padding: '0 7px', flexShrink: 0 }}>
        <div style={{ width: 150, height: 24, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', padding: '0 6px' }}>
          <MdSearch size={13} color="#9ca3af" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar sesión" style={inputStyle} />
        </div>
        <select value={sort} onChange={event => setSort(event.target.value)} style={controlStyle}>
          <option value="recent">Recientes</option>
          <option value="events">Eventos</option>
          <option value="latency">Latencia</option>
          <option value="cashError">Error efectivo</option>
        </select>
      </div>

      <div className="overflow-y-auto flex-1" style={{ padding: 8 }}>
        {!latest && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-1 text-gray-400">
            <MdError size={24} className="text-gray-300" />
            <span style={{ fontSize: 12 }}>Sin simulaciones completadas</span>
          </div>
        )}

        {latest && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <MdSpeed size={16} color="#2563eb" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, color: '#111827', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {latest.scenarioName}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {latest.totalEvents.toLocaleString('es-EC')} eventos evaluados
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 7 }}>
              <MetricCard label="Eventos bajo 2 s" value={latest.eventsUnder2SecPercent} target={95} ok={latest.latencyGoalMet} higherIsBetter />
              <MetricCard label="Coincidencia de estado" value={latest.stateMatchPercent} target={85} ok={latest.stateGoalMet} higherIsBetter />
              <MetricCard label="Error efectivo" value={latest.avgAbsolutePercError} target={15} ok={latest.cashErrorGoalMet} higherIsBetter={false} />
            </div>
          </>
        )}

        {rows.map(run => (
          <div key={run.runId} style={{ borderTop: '1px solid #f3f4f6', padding: '6px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {run.scenarioName}
              </span>
              <span style={{ fontSize: 10, color: '#1d4ed8', flexShrink: 0 }}>{formatSessionCode(run.randomSeed)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 4, fontSize: 10 }}>
              <span style={{ color: run.eventsUnder2SecPercent >= 95 ? '#15803d' : '#b45309', fontWeight: 600 }}>2s {run.eventsUnder2SecPercent.toFixed(1)}%</span>
              <span style={{ color: run.avgAbsolutePercError <= 15 ? '#15803d' : '#b45309', fontWeight: 600 }}>Err {run.avgAbsolutePercError.toFixed(1)}%</span>
              <span style={{ color: run.stateMatchPercent >= 85 ? '#15803d' : '#b45309', fontWeight: 600 }}>Est {run.stateMatchPercent.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const controlStyle: React.CSSProperties = {
  height: 24,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  color: '#374151',
  fontSize: 11,
  fontWeight: 600,
  padding: '0 6px',
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
