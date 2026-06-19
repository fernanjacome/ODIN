import { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAssessment, MdDelete, MdHistory, MdPictureAsPdf, MdSearch, MdSelectAll, MdSwapHoriz } from 'react-icons/md'
import { api } from '../api/client'
import type { AlertDto, OperationalLoadSeriesDto, RunSummaryDto, TransactionDto, TransactionPageDto, TransactionSummaryDto } from '../types'
import { OperationalLoadSeriesChart, SessionSummaryCharts } from './TransactionsPanel'
import { formatSessionCode } from '../utils/sessionIdentity'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Props {
  runs: RunSummaryDto[]
  onRunsChanged?: () => void
}

function fmtDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('es-EC', { hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(minutes?: number) {
  if (!minutes) return '-'
  return minutes < 60 ? `${minutes.toFixed(1)} min` : `${(minutes / 60).toFixed(1)} h`
}

function fmtMoney(value: number) { return `$${Math.round(value).toLocaleString('es-EC')}` }

function alertLabel(type: string) {
  const labels: Record<string, string> = {
    NetworkDown: 'Red desconectada', NetworkRestored: 'Red restaurada',
    DeviceFailure: 'Falla de equipo', PaperEmpty: 'Papel agotado', PaperLow: 'Papel bajo',
    CashCritical: 'Efectivo critico', CashLow: 'Efectivo bajo', CashReloaded: 'Efectivo recargado',
  }
  return labels[type] ?? type
}

const PAGE_SIZE = 20

export function ReportsPanel({ runs, onRunsChanged }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Todas')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [transactions, setTransactions] = useState<TransactionDto[]>([])
  const [alerts, setAlerts] = useState<AlertDto[]>([])
  const [detailView, setDetailView] = useState<'transactions' | 'alerts'>('transactions')
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week' | 'month' | 'year'>('hour')
  const [series, setSeries] = useState<OperationalLoadSeriesDto | null>(null)
  const [summary, setSummary] = useState<TransactionSummaryDto | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [txPage, setTxPage] = useState(1)
  const [alertPage, setAlertPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return runs.filter(run => {
      const matchesStatus = status === 'Todas' || run.status === status
      const matchesQuery = !needle ||
        run.scenarioName.toLowerCase().includes(needle) ||
        run.runId.toLowerCase().includes(needle) ||
        run.randomSeed.toString().includes(needle)
      return matchesStatus && matchesQuery
    })
  }, [query, runs, status])

  const selected = runs.find(run => run.runId === selectedRunId) ?? null
  const hasReport = Boolean(series && summary)

  const loadReport = useCallback(async (runId: string, gran: string) => {
    setLoadingReport(true); setReportError('')
    try {
      const [sr, sm, tr, al] = await Promise.all([
        api.getOperationalLoadSeries({ runId, granularity: gran }),
        api.getTransactionSummary({ runId }),
        api.getTransactions({ page: 1, pageSize: 500, runId }),
        api.getAlerts(runId),
      ])
      setSeries(sr as OperationalLoadSeriesDto)
      setSummary(sm as TransactionSummaryDto)
      setTransactions(((tr as TransactionPageDto).items ?? []))
      setAlerts(al as AlertDto[])
      setTxPage(1); setAlertPage(1)
    } catch { setReportError('No se pudo consultar el reporte.') }
    finally { setLoadingReport(false) }
  }, [])

  useEffect(() => {
    if (!selectedRunId) {
      setTransactions([]); setAlerts([]); setSeries(null); setSummary(null); setReportError('')
      return
    }
    setTransactions([]); setAlerts([]); setSeries(null); setSummary(null); setReportError('')
    setTxPage(1); setAlertPage(1)
  }, [selectedRunId])

  function handleGranularityChange(gran: string) {
    setGranularity(gran as typeof granularity)
  }

  function handleConsultReport() {
    if (!selectedRunId) return
    void loadReport(selectedRunId, granularity)
  }

  useEffect(() => {
    if (rows.length === 0) { setSelectedRunId(null); return }
    if (!selectedRunId || !rows.some(run => run.runId === selectedRunId)) setSelectedRunId(rows[0].runId)
  }, [rows, selectedRunId])

  async function handleDeleteSelected() {
    if (selectedForDelete.size === 0) return
    const label = selectedForDelete.size === 1 ? 'esta sesion' : `estas ${selectedForDelete.size} sesiones`
    if (!confirm(`Eliminar ${label} y todos sus datos asociados?`)) return
    setDeleting(true)
    try {
      for (const runId of selectedForDelete) { await api.deleteRun(runId) }
      setSelectedForDelete(new Set())
      setSelectMode(false)
      if (selectedRunId && selectedForDelete.has(selectedRunId)) setSelectedRunId(null)
      onRunsChanged?.()
    } catch { setReportError('Error al eliminar sesiones.') }
    finally { setDeleting(false) }
  }

  function handleSessionClick(runId: string) {
    if (selectMode) {
      setSelectedForDelete(prev => {
        const next = new Set(prev)
        if (next.has(runId)) next.delete(runId); else next.add(runId)
        return next
      })
    } else {
      setSelectedRunId(runId)
    }
  }

  function toggleSelectMode() {
    if (selectMode) { setSelectMode(false); setSelectedForDelete(new Set()) }
    else setSelectMode(true)
  }

  // Pagination
  const txTotalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE))
  const txSlice = transactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE)
  const alertTotalPages = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE))
  const alertSlice = alerts.slice((alertPage - 1) * PAGE_SIZE, alertPage * PAGE_SIZE)

  async function exportPdf() {
    if (!selected) return
    setExporting(true)
    try {
      const sessionCode = formatSessionCode(selected.randomSeed)
      const statusLabel = selected.status === 'Completed' ? 'Completada' : selected.status === 'Running' ? 'Activa' : 'Interrumpida'
      const pdf = new jsPDF('l', 'mm', 'a4')
      const pageW = 277
      const W = pageW
      const LM = 10

      pdf.setFillColor(37, 99, 235)
      pdf.rect(0, 0, pageW + 20, 32, 'F')

      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)
      pdf.text('Reporte de simulacion - ODIN', LM, 10)

      pdf.setFontSize(12)
      pdf.text(selected.scenarioName, LM, 18)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(219, 234, 254)
      pdf.text(`${sessionCode}  |  ${selected.atmCount} ATMs  |  ${selected.speedMultiplier}x  |  ${statusLabel}  |  ${fmtDate(selected.startedAtSimulated)} - ${fmtDuration(selected.durationSimulatedMinutes)}  |  ${selected.totalEvents.toLocaleString('es-EC')} eventos`, LM, 25)

      let y = 38

      const chartEl = document.querySelector('[data-report-chart]') as HTMLElement | null
      if (chartEl) {
        const chartCanvas = await html2canvas(chartEl, { scale: 2, backgroundColor: '#fff', useCORS: true })
        const chartImg = chartCanvas.toDataURL('image/jpeg', 0.92)
        const ratio = chartCanvas.height / chartCanvas.width
        const chartW = W
        const chartH = chartW * ratio
        if (y + chartH > 195) { pdf.addPage(); y = 14 }
        pdf.addImage(chartImg, 'JPEG', LM, y, chartW, chartH)
        y += chartH + 8
      }

      if (transactions.length > 0) {
        if (y > 170) { pdf.addPage(); y = 14 }
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(55, 65, 81)
        pdf.text(`Transacciones (${transactions.length})`, LM, y)
        y += 5
        const txCols = [38, 30, 30, 40, 30, 26, 56]
        const txHeaders = ['Transaccion', 'Tipo', 'Cajero', 'Ciudad', 'Monto', 'Result.', 'Hora']
        y = drawTableHeader(pdf, LM, y, txCols, txHeaders)
        for (const t of transactions.slice(0, 150)) {
          if (y > 190) { pdf.addPage(); y = 14; y = drawTableHeader(pdf, LM, y, txCols, txHeaders) }
          const row = [t.flowKey, t.type, t.atmId, t.city, t.amount > 0 ? fmtMoney(t.amount) : '-', t.isSuccessful ? 'OK' : 'Fallo', fmtDate(t.completedAt)]
          y = drawTableRow(pdf, LM, y, txCols, row)
        }
        if (transactions.length > 150) {
          pdf.setFontSize(7); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'italic')
          pdf.text(`... y ${transactions.length - 150} transacciones mas`, LM + W / 2, y + 3, { align: 'center' })
          y += 6
        }
        y += 4
      }

      if (alerts.length > 0) {
        if (y > 170) { pdf.addPage(); y = 14 }
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(55, 65, 81)
        pdf.text(`Alertas (${alerts.length})`, LM, y)
        y += 5
        const alCols = [30, 40, 28, 110, 52]
        const alHeaders = ['Cajero', 'Tipo', 'Severidad', 'Mensaje', 'Hora']
        y = drawTableHeader(pdf, LM, y, alCols, alHeaders)
        for (const a of alerts.slice(0, 80)) {
          if (y > 190) { pdf.addPage(); y = 14; y = drawTableHeader(pdf, LM, y, alCols, alHeaders) }
          const row = [a.atmId, alertLabel(a.alertType), a.severity, a.message.substring(0, 60), fmtDate(a.triggeredAt)]
          y = drawTableRow(pdf, LM, y, alCols, row)
        }
        if (alerts.length > 80) {
          pdf.setFontSize(7); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'italic')
          pdf.text(`... y ${alerts.length - 80} alertas mas`, LM + W / 2, y + 3, { align: 'center' })
          y += 6
        }
      }

      const pageCount = pdf.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(156, 163, 175)
        pdf.text(`Generado por ODIN · ${new Date().toLocaleString('es-EC', { hour12: false })}`, LM, 205)
        pdf.text(`Pagina ${i} de ${pageCount}`, LM + W, 205, { align: 'right' })
      }

      pdf.save(`ODIN_Reporte_${sessionCode}_${selected.scenarioName.replace(/\s+/g, '_')}.pdf`)
    } catch (e) {
      console.error('Error exportando PDF:', e)
      alert('Error al generar el PDF. Intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 8, overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={panelStyle}>
        <div style={headerStyle}>
          <MdHistory size={15} color="#2563eb" /><strong>Sesiones</strong>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={toggleSelectMode} title={selectMode ? 'Cancelar seleccion' : 'Seleccionar para eliminar'} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: selectMode ? '#2563eb' : '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}>
            <MdSelectAll size={16} />
          </button>
          {selectMode && selectedForDelete.size > 0 && (
            <button type="button" onClick={handleDeleteSelected} disabled={deleting} style={deleteSmall}>
              <MdDelete size={12} /> Eliminar ({selectedForDelete.size})
            </button>
          )}
          <span style={{ color: '#64748b', fontSize: 10 }}>{rows.length}</span>
        </div>
        <div style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 90px', gap: 5 }}>
          <div style={searchStyle}><MdSearch size={13} color="#94a3b8" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Escenario o sesion" style={inputStyle} /></div>
          <select value={status} onChange={e => setStatus(e.target.value)} style={controlStyle}><option>Todas</option><option value="Completed">Completadas</option><option value="Interrupted">Interrumpidas</option><option value="Running">Activas</option></select>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {rows.map(run => {
            const active = !selectMode && run.runId === selectedRunId
            const isSelected = selectMode && selectedForDelete.has(run.runId)
            return (
              <button key={run.runId} type="button" onClick={() => handleSessionClick(run.runId)} style={{
                width: '100%', display: 'block', border: 0, borderBottom: '1px solid #eef2f7', textAlign: 'left', cursor: 'pointer', padding: '7px 10px',
                background: isSelected ? '#dbeafe' : active ? '#eff6ff' : '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <strong style={{ color: active ? '#1d4ed8' : '#111827', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.scenarioName}</strong>
                  <Status status={run.status} />
                </div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{formatSessionCode(run.randomSeed)} · {fmtDate(run.startedAtSimulated)} · {fmtDuration(run.durationSimulatedMinutes)}</div>
                <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 1 }}>{run.speedMultiplier}x · {run.atmCount} ATM · {run.totalEvents.toLocaleString('es-EC')} ev</div>
              </button>
            )
          })}
          {rows.length === 0 && <Empty text="No existen sesiones para los filtros." />}
        </div>
      </aside>

      {/* Main */}
      <main style={{ minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {!selected && <div style={{ ...panelStyle, height: '100%' }}><Empty text="Selecciona una sesion para ver su reporte." /></div>}
        {selected && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
            {/* Toolbar */}
            <section style={{ ...panelStyle, flexShrink: 0 }}>
              <div style={headerStyle}>
                <MdAssessment size={15} color="#2563eb" />
                <strong>{selected.scenarioName}</strong>
                <div style={{ flex: 1 }} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 10, fontWeight: 600 }}>
                  Agrupar
                  <select value={granularity} onChange={e => handleGranularityChange(e.target.value)} style={controlStyle}>
                    <option value="hour">Horas</option><option value="day">Dias</option><option value="week">Semanas</option><option value="month">Meses</option>
                  </select>
                </label>
                <button type="button" onClick={handleConsultReport} disabled={loadingReport} style={{ height: 26, border: `1px solid ${loadingReport ? '#d1d5db' : '#1d4ed8'}`, borderRadius: 5, background: loadingReport ? '#f3f4f6' : '#2563eb', color: loadingReport ? '#94a3b8' : '#fff', fontSize: 11, fontWeight: 700, padding: '0 8px', cursor: loadingReport ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  <MdSearch size={14} /> Consultar reporte
                </button>
                <button type="button" onClick={exportPdf} disabled={!hasReport || exporting} title="Exportar reporte como PDF" style={{ height: 26, border: `1px solid ${hasReport ? '#2563eb' : '#d1d5db'}`, borderRadius: 5, background: hasReport ? '#eff6ff' : '#f3f4f6', color: hasReport ? '#2563eb' : '#94a3b8', fontSize: 11, fontWeight: 700, padding: '0 8px', cursor: hasReport && !exporting ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  <MdPictureAsPdf size={14} /> {exporting ? 'Generando...' : 'PDF'}
                </button>
                {loadingReport && <span style={{ color: '#2563eb', fontSize: 10, fontWeight: 600 }}>Cargando...</span>}
              </div>
              {reportError && <div style={{ padding: '5px 10px', color: '#dc2626', fontSize: 11, fontWeight: 600 }}>{reportError}</div>}
            </section>

            {/* Report content */}
            <section style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {loadingReport && !hasReport && <div style={{ ...panelStyle, minHeight: 200 }}><Empty text="Cargando reporte..." /></div>}
              {!loadingReport && !hasReport && <div style={{ ...panelStyle, minHeight: 200 }}><Empty text="Sin datos para esta sesion." /></div>}
              {hasReport && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
                  <div data-report-chart style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {series && <OperationalLoadSeriesChart series={series} sessionLabel={formatSessionCode(selected.randomSeed)} rangeText="Sesion completa" />}
                    <SessionSummaryCharts summary={summary} />
                  </div>

                  {/* Detail tables with pagination */}
                  <div style={panelStyle}>
                    <div style={headerStyle}>
                      <MdSwapHoriz size={15} color="#2563eb" /><strong>Detalle</strong>
                      <button type="button" onClick={() => { setDetailView('transactions'); setTxPage(1) }} style={viewButton(detailView === 'transactions')}>Transacciones</button>
                      <button type="button" onClick={() => { setDetailView('alerts'); setAlertPage(1) }} style={viewButton(detailView === 'alerts')}>Alertas</button>
                      <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 10 }}>
                        {detailView === 'transactions' ? `${transactions.length} transacciones` : `${alerts.length} alertas`}
                      </span>
                    </div>
                    <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
                      {detailView === 'transactions' && txSlice.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}><tr><th style={th}>Transaccion</th><th style={th}>Tipo</th><th style={th}>Cajero</th><th style={th}>Ciudad</th><th style={rightTh}>Monto</th><th style={rightTh}>Duracion</th><th style={th}>Resultado</th><th style={th}>Hora</th></tr></thead>
                          <tbody>{txSlice.map((item, i) => <tr key={item.id} style={{ borderTop: '1px solid #eef2f7', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}><td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{item.flowKey}</td><td style={td}>{item.type}</td><td style={{ ...td, fontWeight: 600 }}>{item.atmId}</td><td style={td}>{item.city}</td><td style={rightTd}>{item.amount > 0 ? fmtMoney(item.amount) : '-'}</td><td style={rightTd}>{item.durationSimulatedSeconds.toFixed(1)}s</td><td style={td}>{item.isSuccessful ? 'Exitosa' : 'Fallida'}</td><td style={td}>{fmtDate(item.completedAt)}</td></tr>)}</tbody>
                        </table>
                      )}
                      {detailView === 'transactions' && transactions.length === 0 && <Empty text="Sin transacciones para esta sesion." />}
                      {detailView === 'alerts' && alertSlice.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}><tr><th style={th}>Cajero</th><th style={th}>Tipo</th><th style={th}>Severidad</th><th style={th}>Mensaje</th><th style={th}>Hora</th></tr></thead>
                          <tbody>{alertSlice.map((alert, i) => <tr key={alert.id} style={{ borderTop: '1px solid #eef2f7', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}><td style={{ ...td, fontWeight: 600 }}>{alert.atmId}</td><td style={td}>{alertLabel(alert.alertType)}</td><td style={{ ...td, color: alert.severity === 'Critical' ? '#dc2626' : alert.severity === 'Warning' ? '#b45309' : '#2563eb', fontWeight: 600 }}>{alert.severity}</td><td style={{ ...td, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.message}</td><td style={td}>{fmtDate(alert.triggeredAt)}</td></tr>)}</tbody>
                        </table>
                      )}
                      {detailView === 'alerts' && alerts.length === 0 && <Empty text="Sin alertas para esta sesion." />}
                    </div>
                    {/* Pagination */}
                    {detailView === 'transactions' && txTotalPages > 1 && (
                      <Pagination page={txPage} totalPages={txTotalPages} onPageChange={setTxPage} />
                    )}
                    {detailView === 'alerts' && alertTotalPages > 1 && (
                      <Pagination page={alertPage} totalPages={alertTotalPages} onPageChange={setAlertPage} />
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  return (
    <div style={{ borderTop: '1px solid #e5e7eb', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 0 }}>
      <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} style={pageBtn(page <= 1)}>Anterior</button>
      <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Pagina {page} de {totalPages}</span>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={pageBtn(page >= totalPages)}>Siguiente</button>
    </div>
  )
}

function Status({ status }: { status: string }) {
  const running = status === 'Running' || status === 'Initialized'
  const completed = status === 'Completed'
  const label = running ? 'Activa' : completed ? 'Completada' : 'Interrumpida'
  const color = running ? '#15803d' : completed ? '#2563eb' : '#b45309'
  return <span style={{ border: `1px solid ${color}33`, background: `${color}10`, color, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
}

function Empty({ text }: { text: string }) {
  return <div style={{ height: '100%', minHeight: 100, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 16 }}>{text}</div>
}

function drawTableHeader(pdf: jsPDF, x: number, y: number, cols: number[], headers: string[]): number {
  pdf.setFillColor(243, 244, 246)
  pdf.rect(x, y - 3, cols.reduce((a, b) => a + b, 0), 6, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(55, 65, 81)
  let cx = x
  for (let i = 0; i < headers.length; i++) {
    pdf.text(headers[i], cx + 1, y)
    cx += cols[i]
  }
  pdf.setDrawColor(209, 213, 219)
  pdf.setLineWidth(0.3)
  pdf.line(x, y + 1, x + cols.reduce((a, b) => a + b, 0), y + 1)
  return y + 5
}

function drawTableRow(pdf: jsPDF, x: number, y: number, cols: number[], values: string[]): number {
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(51, 65, 85)
  let cx = x
  for (let i = 0; i < values.length; i++) {
    const text = values[i].length > Math.floor(cols[i] / 1.8) ? values[i].substring(0, Math.floor(cols[i] / 1.8)) + '..' : values[i]
    pdf.text(text, cx + 1, y)
    cx += cols[i]
  }
  pdf.setDrawColor(238, 242, 247)
  pdf.setLineWidth(0.15)
  pdf.line(x, y + 1.5, x + cols.reduce((a, b) => a + b, 0), y + 1.5)
  return y + 4
}

const panelStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }
const headerStyle: React.CSSProperties = { height: 36, minHeight: 36, borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', color: '#334155', fontSize: 11, flexShrink: 0 }
const searchStyle: React.CSSProperties = { height: 26, border: '1px solid #d1d5db', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, padding: '0 6px', background: '#fff', minWidth: 0 }
const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, border: 0, outline: 0, fontSize: 11, background: 'transparent', color: '#334155' }
const controlStyle: React.CSSProperties = { height: 24, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', color: '#334155', fontSize: 10, fontWeight: 600 }
const th: React.CSSProperties = { padding: '7px 6px', color: '#64748b', fontSize: 11, textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 700 }
const rightTh: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '6px', color: '#334155', whiteSpace: 'nowrap', fontSize: 11 }
const rightTd: React.CSSProperties = { ...td, textAlign: 'right' }
const viewButton = (active: boolean): React.CSSProperties => ({ height: 24, border: `1px solid ${active ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: 5, background: active ? '#eff6ff' : '#fff', color: active ? '#1d4ed8' : '#64748b', fontSize: 11, fontWeight: 700, padding: '0 8px', cursor: 'pointer' })
const deleteSmall: React.CSSProperties = { height: 22, border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600, padding: '0 6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }
const pageBtn = (disabled: boolean): React.CSSProperties => ({ height: 24, border: '1px solid #d1d5db', borderRadius: 4, background: disabled ? '#f9fafb' : '#fff', color: disabled ? '#d1d5db' : '#374151', fontSize: 10, fontWeight: 600, padding: '0 10px', cursor: disabled ? 'default' : 'pointer' })
