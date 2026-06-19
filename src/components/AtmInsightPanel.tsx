import {
  MdCheckCircle,
  MdCreditCard,
  MdLocalAtm,
  MdPrint,
  MdReceipt,
  MdWarning,
  MdWifi,
} from 'react-icons/md'
import type { ActiveRunDto, AtmDto, CashEstimationAtmDto, CashEstimationDto, EventDto } from '../types'

interface Props {
  selectedAtm: AtmDto | null
  cashEstimation: CashEstimationDto | null
  events: EventDto[]
  simulatedClock: string | null
  activeRun: ActiveRunDto | null
}

const CASSETTE_KEYS = ['C1', 'C2', 'C3', 'C4', 'RJ']

function fmt$(n: number) {
  return '$' + n.toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtTime(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-EC', {
    hour12: false,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stateColor(state: string) {
  if (state === 'Sin efectivo') return '#9ca3af'
  if (state === 'Crítico') return '#ef4444'
  if (state === 'Advertencia') return '#f59e0b'
  if (state === 'Rechazo crítico') return '#f97316'
  return '#22c55e'
}

function statusColor(status: string) {
  if (status === 'Online' || status === 'Normal') return '#16a34a'
  if (status === 'Warning') return '#b45309'
  if (status === 'Offline') return '#6b7280'
  return '#dc2626'
}

function diagnosticStatus(atm: AtmDto) {
  if (atm.status === 'Online') return 'Normalizado'
  if (atm.status === 'Warning') return 'Revisar estado'
  if (atm.status === 'Offline') return 'Sin conectividad'
  if (atm.status === 'SinEfectivo') return 'Sin efectivo'
  return 'Fuera de servicio'
}

function totalCash(atm: AtmDto) {
  return atm.cassettes
    .filter(cassette => !cassette.isRejectCassette)
    .reduce((sum, cassette) => sum + cassette.denomination * cassette.currentBillCount, 0)
}

function riskColor(risk: string) {
  if (risk === 'Crítico') return '#ef4444'
  if (risk === 'Advertencia') return '#f59e0b'
  if (risk === 'Sin efectivo') return '#6b7280'
  return '#22c55e'
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ height: 30, borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', padding: '0 9px', fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0 }}>
        {title}
      </div>
      <div style={{ padding: 9 }}>{children}</div>
    </div>
  )
}

function DeviceStatus({ icon, label, status }: { icon: React.ReactNode; label: string; status: string }) {
  const color = statusColor(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #f3f4f6', borderRadius: 4, padding: '5px 6px', minWidth: 0 }}>
      <span style={{ color, display: 'inline-flex' }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: '#6b7280', lineHeight: '11px' }}>{label}</div>
        <div style={{ fontSize: 11, color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status}</div>
      </div>
    </div>
  )
}

function CassetteDetail({ cassette, projected }: {
  cassette?: AtmDto['cassettes'][number]
  projected?: CashEstimationAtmDto['cassettes'][number]
}) {
  if (!cassette) return null

  const pct = Math.min(100, Math.max(0, cassette.fillPercent))
  const projectedPct = projected
    ? Math.min(100, Math.max(0, projected.projectedBillCount / projected.capacityInBills * 100))
    : undefined
  const color = stateColor(cassette.cashState)

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', padding: '6px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
        <span style={{ fontWeight: 600, color: '#111827' }}>{cassette.cassetteKey}</span>
        <span style={{ color: '#6b7280' }}>{cassette.isRejectCassette ? 'Rechazo' : `${fmt$(cassette.denomination)} por billete`}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: '#e5e7eb', marginTop: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color }} />
      </div>
      {projectedPct !== undefined && (
        <div style={{ height: 3, borderRadius: 999, background: '#eef2f7', marginTop: 3, overflow: 'hidden' }} title="Nivel estimado según consumo reciente">
          <div style={{ height: '100%', width: `${projectedPct}%`, borderRadius: 999, background: '#2563eb' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: '#6b7280' }}>
        <span>{cassette.currentBillCount}/{cassette.capacityInBills} billetes</span>
        <span style={{ color, fontWeight: 600 }}>{cassette.cashState}</span>
      </div>
    </div>
  )
}

export function AtmInsightPanel({ selectedAtm, cashEstimation, events, simulatedClock, activeRun }: Props) {
  const estimationByAtm = Object.fromEntries(
    (cashEstimation?.atms ?? []).map(item => [item.atmId, item])
  ) as Record<string, CashEstimationAtmDto | undefined>

  const selectedEstimation = selectedAtm ? estimationByAtm[selectedAtm.id] : undefined
  const selectedLastEvent = selectedAtm
    ? events.find(event => event.atmId === selectedAtm.id)
    : undefined

  return (
    <div style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
      <Panel title={selectedAtm ? `Detalle ${selectedAtm.id}` : 'Detalle de cajero'}>
        {!selectedAtm ? (
          <div style={{ height: 160, display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
            Selecciona un cajero para ver su información operativa.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{selectedAtm.displayName || selectedAtm.id}</div>
                <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedAtm.city} · {selectedAtm.location || 'Sin ubicación'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: '#6b7280' }}>Hora simulada</div>
                <div style={{ fontSize: 11, color: '#111827', fontWeight: 600 }}>{selectedLastEvent ? fmtTime(selectedLastEvent.createdAt) : simulatedClock ?? fmtTime(activeRun?.startedAtSimulated)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div style={metricBox}>
                <span style={{ color: '#6b7280', fontSize: 10 }}>Efectivo</span>
                <strong style={{ color: '#15803d', fontSize: 16 }}>{fmt$(totalCash(selectedAtm))}</strong>
              </div>
              <div style={metricBox}>
                <span style={{ color: '#6b7280', fontSize: 10 }}>Estimación</span>
                <strong style={{ color: selectedEstimation ? riskColor(selectedEstimation.riskLevel) : '#9ca3af', fontSize: 16 }}>
                  {selectedEstimation ? fmt$(selectedEstimation.projectedCashTotal) : '-'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
              <DeviceStatus icon={<MdLocalAtm size={15} />} label="Dispensador" status={selectedAtm.dispenserStatus} />
              <DeviceStatus icon={<MdCreditCard size={15} />} label="Lector" status={selectedAtm.cardReaderStatus} />
              <DeviceStatus icon={<MdPrint size={15} />} label="Impresora" status={selectedAtm.receiptPrinterStatus} />
              <DeviceStatus icon={<MdWifi size={15} />} label="Red" status={selectedAtm.networkStatus} />
              <DeviceStatus icon={<MdReceipt size={15} />} label="Papel" status={`${selectedAtm.receiptPaperCount} recibos`} />
              <DeviceStatus icon={selectedAtm.status === 'Online' ? <MdCheckCircle size={15} /> : <MdWarning size={15} />} label="Diagnóstico" status={diagnosticStatus(selectedAtm)} />
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 2 }}>
              {CASSETTE_KEYS.map(key => (
                <CassetteDetail
                  key={key}
                  cassette={selectedAtm.cassettes.find(cassette => cassette.cassetteKey === key)}
                  projected={selectedEstimation?.cassettes.find(cassette => cassette.cassetteKey === key)}
                />
              ))}
            </div>

          </>
        )}
      </Panel>
    </div>
  )
}

const metricBox: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 5,
  background: '#f9fafb',
  padding: '7px 8px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

