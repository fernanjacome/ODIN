import { MdAssessment, MdPlayCircleOutline } from 'react-icons/md'

interface Props {
  moduleName: string
  onOpenReports: () => void
}

export function NoActiveSession({ moduleName, onOpenReports }: Props) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 430, maxWidth: '90%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 7, padding: 24, textAlign: 'center' }}>
        <div style={{ width: 42, height: 42, margin: '0 auto 12px', borderRadius: 7, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
          <MdPlayCircleOutline size={24} />
        </div>
        <strong style={{ display: 'block', color: '#111827', fontSize: 15 }}>Sin sesión de simulación activa</strong>
        <p style={{ color: '#6b7280', fontSize: 11, lineHeight: '17px', margin: '7px 0 15px' }}>
          {moduleName} mostrará únicamente la información generada durante la próxima sesión iniciada desde el simulador.
        </p>
        <button type="button" onClick={onOpenReports} style={{ height: 30, border: '1px solid #bfdbfe', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600, padding: '0 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <MdAssessment size={14} /> Consultar sesiones anteriores
        </button>
      </div>
    </div>
  )
}
