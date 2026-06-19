import { useMemo, useState } from 'react'
import { MdError, MdInfo, MdSearch, MdWarning } from 'react-icons/md'
import type { EventDto } from '../types'

interface Props { events: EventDto[] }

const SEV_ICON: Record<string, React.ReactNode> = {
  Info: <MdInfo size={13} color="#3b82f6" />,
  Warning: <MdWarning size={13} color="#f59e0b" />,
  Critical: <MdError size={13} color="#ef4444" />,
}

const SEV_MSG: Record<string, string> = {
  Info: 'text-gray-700',
  Warning: 'text-yellow-800',
  Critical: 'text-red-700 font-medium',
}

function ts(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-EC', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return '??:??:??' }
}

function severityRank(severity: string) {
  if (severity === 'Critical') return 3
  if (severity === 'Warning') return 2
  return 1
}

export function EventLog({ events }: Props) {
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('Todas')
  const [sort, setSort] = useState('recent')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return events
      .filter(ev => {
        const matchesSeverity = severity === 'Todas' || ev.severity === severity
        const matchesQuery = !needle ||
          ev.atmId.toLowerCase().includes(needle) ||
          ev.message.toLowerCase().includes(needle) ||
          ev.eventType.toLowerCase().includes(needle)
        return matchesSeverity && matchesQuery
      })
      .sort((left, right) => {
        if (sort === 'atm') return left.atmId.localeCompare(right.atmId)
        if (sort === 'severity') return severityRank(right.severity) - severityRank(left.severity)
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
  }, [events, query, severity, sort])

  return (
    <div className="bg-white rounded border border-gray-200 flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      <div className="px-2 py-1 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
        <div className="flex items-center gap-1.5">
          <MdInfo size={14} className="text-blue-400" />
          <span className="font-semibold text-gray-700" style={{ fontSize: 12 }}>Log de eventos</span>
        </div>
        <span className="text-gray-400" style={{ fontSize: 11 }}>{rows.length} de {events.length}</span>
      </div>

      <div style={{ height: 34, borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, padding: '0 7px', flexShrink: 0 }}>
        <div style={{ width: 150, height: 24, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', padding: '0 6px' }}>
          <MdSearch size={13} color="#9ca3af" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar" style={inputStyle} />
        </div>
        <select value={severity} onChange={event => setSeverity(event.target.value)} style={controlStyle}>
          <option>Todas</option>
          <option>Info</option>
          <option>Warning</option>
          <option>Critical</option>
        </select>
        <select value={sort} onChange={event => setSort(event.target.value)} style={controlStyle}>
          <option value="recent">Recientes</option>
          <option value="severity">Severidad</option>
          <option value="atm">Cajero</option>
        </select>
      </div>

      <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
        {rows.length === 0 && (
          <p className="text-center text-gray-400 p-4" style={{ fontSize: 12 }}>Sin eventos</p>
        )}
        {rows.map(ev => (
          <div key={ev.id} className={`flex items-center gap-1.5 px-2 py-0.5 hover:bg-gray-50 ${ev.severity === 'Critical' ? 'bg-red-50' : ''}`}>
            <span className="text-gray-400 shrink-0 font-mono" style={{ fontSize: 10 }}>{ts(ev.createdAt)}</span>
            <span className="text-gray-500 shrink-0 w-12 overflow-hidden text-ellipsis" style={{ fontSize: 11 }}>{ev.atmId}</span>
            <span className="shrink-0">{SEV_ICON[ev.severity] ?? <MdInfo size={13} />}</span>
            <span className={`truncate ${SEV_MSG[ev.severity] ?? 'text-gray-700'}`} style={{ fontSize: 11 }}>{ev.message}</span>
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
