import { MdNotificationsActive } from 'react-icons/md'
import type { AlertDto, AtmDto, CashEstimationAtmDto, CashEstimationDto } from '../types'

interface Props {
  atms: AtmDto[]
  alerts: AlertDto[]
  cashEstimation?: CashEstimationDto | null
  showAlerts?: boolean
}

export function SummaryCards({ atms, alerts, cashEstimation, showAlerts = true }: Props) {
  const online = atms.filter(a => a.status === 'Online').length
  const warning = atms.filter(a => a.status === 'Warning').length
  const fuera = atms.filter(a => a.status === 'FueraDeServicio').length
  const sinEfec = atms.filter(a => a.status === 'SinEfectivo').length
  const offline = atms.filter(a => a.status === 'Offline').length
  const alertCount = alerts.length
  const estimationByAtm = Object.fromEntries(
    (cashEstimation?.atms ?? []).map(item => [item.atmId, item])
  ) as Record<string, CashEstimationAtmDto | undefined>
  const networkCash = atms.reduce((sum, atm) => sum + totalCash(atm), 0)
  const projectedNetworkCash = atms.reduce((sum, atm) => {
    const estimated = estimationByAtm[atm.id]
    return sum + (estimated?.projectedCashTotal ?? totalCash(atm))
  }, 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, overflow: 'hidden' }}>
      <Pill label="Efectivo red" value={fmtMoney(networkCash)} color="#15803d" />
      <Pill label="Estimado red" value={fmtMoney(projectedNetworkCash)} color={projectedNetworkCash < networkCash ? '#b45309' : '#15803d'} />
      {showAlerts && <Pill label="Alertas" value={String(alertCount)} color={alertCount > 0 ? '#b45309' : '#6b7280'} icon={<MdNotificationsActive size={12} color={alertCount > 0 ? '#b45309' : '#16a34a'} />} />}
      <Sep />
      <Pill label="Total" value={String(atms.length)} color="#374151" bold />
      <CountDot label="En linea" value={online} color="#22c55e" />
      <CountDot label="Advertencia" value={warning} color="#f59e0b" />
      <CountDot label="Fuera" value={fuera} color="#dc2626" />
      <CountDot label="Sin efectivo" value={sinEfec} color="#7c3aed" />
      <CountDot label="Desconectado" value={offline} color="#9ca3af" />
    </div>
  )
}

function totalCash(atm: AtmDto) {
  return atm.cassettes
    .filter(c => !c.isRejectCassette)
    .reduce((sum, c) => sum + c.denomination * c.currentBillCount, 0)
}

function fmtMoney(value: number) {
  return '$' + Math.round(value).toLocaleString('es-EC')
}

function Pill({ label, value, color, bold, icon }: { label: string; value: string; color: string; bold?: boolean; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: bold ? 700 : 600, color }}>{value}</span>
      <span style={{ fontSize: 10, color: '#9ca3af' }}>{label}</span>
    </div>
  )
}

function CountDot({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div title={label} style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: value > 0 ? color : '#e5e7eb', flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: value > 0 ? 700 : 400, color: value > 0 ? '#374151' : '#9ca3af' }}>{value}</span>
      <span style={{ fontSize: 10, color: '#9ca3af' }}>{label}</span>
    </div>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: '#d1d5db', flexShrink: 0 }} />
}
