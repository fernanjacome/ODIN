interface Props {
  value: string
  size?: 'sm' | 'md'
}

const STATUS_COLORS: Record<string, string> = {
  Online:   'bg-green-100 text-green-800',
  Warning:  'bg-yellow-100 text-yellow-800',
  Offline:  'bg-red-100 text-red-800',
  Normal:   'bg-green-100 text-green-700',
  Error:    'bg-red-100 text-red-700',
  Critical: 'bg-red-100 text-red-800',
  Info:     'bg-blue-100 text-blue-800',
}

export function StatusBadge({ value, size = 'sm' }: Props) {
  const color = STATUS_COLORS[value] ?? 'bg-gray-100 text-gray-700'
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${padding} ${color}`}>
      {value}
    </span>
  )
}
