import type { CassetteDto } from '../types'

interface Props {
  cassette: CassetteDto
}

function barColor(state: string) {
  if (state === 'Sin efectivo') return 'bg-gray-300'
  if (state === 'Crítico') return 'bg-red-500'
  if (state === 'Advertencia') return 'bg-yellow-400'
  if (state === 'Rechazo crítico') return 'bg-red-500'
  return 'bg-green-500'
}

export function CassetteBar({ cassette }: Props) {
  const pct = Math.min(100, Math.max(0, cassette.fillPercent))
  const color = barColor(cassette.cashState)
  const label = cassette.isRejectCassette ? 'RJ' : cassette.cassetteKey

  return (
    <div className="flex items-center gap-1" title={`${label}: ${cassette.currentBillCount}/${cassette.capacityInBills} — ${cassette.cashState}`}>
      <span className="text-xs text-gray-500 w-5">{label}</span>
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
