import { jsPDF } from 'jspdf'
import {
  Project,
  Dataset,
  Architecture,
  ModelVersion,
  TrainingJob,
  AuditEvent,
  EpochMetric,
} from '../types'
import { DEFAULT_SECTION_ORDER, DEFAULT_SIGNATURES, PDF_THEME_COLORS } from '../modules/reports/constants'
import {
  computeLayerBreakdown,
  computePerClassMetrics,
  computeQuarterlyRoi,
  computeRoiProjection,
  formatAuditMetadata,
  formatJobDuration,
  parseCustomKvMetrics,
  parseCustomTable,
  problemLabel,
} from '../modules/reports/helpers'
import type {
  ComplianceCheckItem,
  CustomBlockTone,
  ExecutiveDiagnostic,
  ReportCustomizationConfig,
  SectionKey,
} from '../modules/reports/types'

export interface PdfReportOptions {
  sections?: Record<string, boolean>
  sectionOrder?: SectionKey[]
  auditEvents?: AuditEvent[]
  epochMetrics?: EpochMetric[]
  jobs?: TrainingJob[]
  models?: ModelVersion[]
  diagnostic?: ExecutiveDiagnostic
  auditorNotes?: string
  comparisonJob?: TrainingJob | null
  customization?: ReportCustomizationConfig
  complianceChecks?: ComplianceCheckItem[]
}

const CUSTOM_TONE_RGB: Record<CustomBlockTone, [number, number, number]> = {
  teal: [13, 148, 136],
  cyan: [2, 132, 199],
  indigo: [79, 70, 229],
  emerald: [16, 185, 129],
  amber: [217, 119, 6],
  rose: [225, 29, 72],
}

function cleanPdfText(input?: string | number | null): string {
  if (input === null || input === undefined) return '—'
  return String(input)
    .replace(/→|➔|➜|⟶/g, ' -> ')
    .replace(/←|⟵/g, ' <- ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≠/g, '!=')
    .replace(/Δ/g, 'Delta ')
    .replace(/σ/g, ' sigma')
    .replace(/μ/g, 'media ')
    .replace(/ŷ/g, 'y_hat')
    .replace(/W₁/g, 'W1')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—|–/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function generateProjectPdfReport(
  project: Project,
  dataset?: Dataset,
  architecture?: Architecture,
  model?: ModelVersion,
  job?: TrainingJob,
  options?: PdfReportOptions
) {
  const cfg = options?.customization
  const orientation = cfg?.pdfOrientation === 'landscape' ? 'landscape' : 'portrait'
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 13
  const contentW = pageWidth - margin * 2
  const isCompact = cfg?.pdfDensity === 'compact'
  const isLightHeader = cfg?.pdfHeaderStyle === 'light'
  const padScale = isCompact ? 0.85 : 1

  const accent = PDF_THEME_COLORS[cfg?.accentTheme || 'teal'].rgb
  const tm = job?.model_version?.test_metrics ?? model?.test_metrics ?? null
  const accVal = tm?.test_accuracy ?? job?.accuracy ?? null
  const lossVal = tm?.test_loss ?? job?.loss ?? null
  const f1Val = tm?.f1_score ?? null
  const precVal = tm?.precision ?? null
  const recVal = tm?.recall ?? null
  const diag = options?.diagnostic

  const sections = options?.sections ?? {
    projectContext: true,
    datasetEda: true,
    featureDictionary: true,
    networkArch: true,
    trainingMetrics: true,
    epochHistory: true,
    experimentsRanking: true,
    roiImpact: true,
    modelRegistry: true,
    complianceChecklist: true,
    customSections: true,
    auditTrail: true,
  }

  const orderedKeys = (options?.sectionOrder || DEFAULT_SECTION_ORDER).filter(
    k => sections[k] !== false
  )

  const drawHeader = (isFirst: boolean) => {
    const headerH = isFirst ? 39 : 18
    if (isLightHeader) {
      doc.setFillColor(248, 250, 252)
    } else {
      doc.setFillColor(10, 18, 36)
    }
    doc.rect(0, 0, pageWidth, headerH, 'F')

    doc.setFillColor(accent[0], accent[1], accent[2])
    doc.rect(0, headerH, pageWidth, 1.4, 'F')

    doc.setFillColor(accent[0], accent[1], accent[2])
    doc.roundedRect(margin, isFirst ? 8 : 4.5, isFirst ? 9 : 7, isFirst ? 9 : 7, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isFirst ? 11 : 8.5)
    doc.setTextColor(255, 255, 255)
    doc.text('A', margin + (isFirst ? 4.5 : 3.5), isFirst ? 14 : 9.2, { align: 'center' })

    const textStartX = margin + (isFirst ? 12 : 9.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isFirst ? 13 : 9.5)
    doc.setTextColor(isLightHeader ? 15 : 255, isLightHeader ? 23 : 255, isLightHeader ? 42 : 255)
    doc.text(
      cleanPdfText((cfg?.organizationName || 'AURA TELECOM ENTERPRISE AI STUDIO').toUpperCase()),
      textStartX,
      isFirst ? 12.2 : 8.2
    )

    if (!cfg || cfg.includeWatermark) {
      const stamp = cleanPdfText(
        `${cfg?.documentCode || 'NL-DOC'} · ${cfg?.confidentiality || 'CONFIDENCIAL CORPORATIVO'}`
      )
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.8)
      const badgeW = doc.getTextWidth(stamp) + 6
      const badgeX = pageWidth - margin - badgeW
      const badgeY = isFirst ? 7.5 : 4.8
      doc.setFillColor(isLightHeader ? 241 : 20, isLightHeader ? 245 : 32, isLightHeader ? 249 : 58)
      doc.setDrawColor(accent[0], accent[1], accent[2])
      doc.setLineWidth(0.3)
      doc.roundedRect(badgeX, badgeY, badgeW, 5.5, 1.5, 1.5, 'FD')
      doc.setTextColor(isLightHeader ? 15 : 226, isLightHeader ? 23 : 232, isLightHeader ? 42 : 240)
      doc.text(stamp, badgeX + badgeW / 2, badgeY + 3.7, { align: 'center' })
    }

    if (isFirst) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(isLightHeader ? 51 : 226, isLightHeader ? 65 : 232, isLightHeader ? 85 : 240)
      doc.text(
        cleanPdfText(cfg?.reportTitle || 'Informe Ejecutivo de Certificación y Auditoría IA'),
        textStartX,
        18.2
      )

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.8)
      doc.setTextColor(100, 116, 139)
      doc.text(
        cleanPdfText(
          `${cfg?.reportSubtitle || 'Evaluación de Generalización y Gobernanza MLOps'}  |  ${cfg?.departmentName || 'Dirección MLOps'} (${cfg?.reportVersion || 'v2.0'})`
        ),
        margin,
        25.5
      )

      doc.setFillColor(isLightHeader ? 226 : 17, isLightHeader ? 232 : 28, isLightHeader ? 240 : 52)
      doc.roundedRect(margin, 28.5, contentW, 7, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.4)
      doc.setTextColor(isLightHeader ? 30 : 203, isLightHeader ? 41 : 213, isLightHeader ? 59 : 225)
      doc.text(
        cleanPdfText(
          `Emitido: ${new Date().toLocaleString('es-ES')}   |   Workspace: ${project.name}   |   Autor: ${cfg?.signatures?.[0]?.name || cfg?.authorName || 'Admin Principal'}`
        ),
        margin + 3,
        33
      )
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      doc.text(cleanPdfText(`${project.name} · Continuación`), textStartX, 13)
    }
  }

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.3)
    doc.setTextColor(100, 116, 139)
    doc.text(
      cleanPdfText(
        `${cfg?.organizationName || 'Aura Telecom AI Studio'} · ${cfg?.documentCode || 'NL-DOC'} (${cfg?.reportVersion || 'v2.0'}) · ${cfg?.confidentiality || 'CONFIDENCIAL'}`
      ),
      margin,
      pageHeight - 8.2
    )
    if (cfg?.includePageNumbers !== false) {
      doc.setFont('helvetica', 'bold')
      doc.text(
        cleanPdfText(`Página ${pageNum} de ${totalPages}`),
        pageWidth - margin,
        pageHeight - 8.2,
        { align: 'right' }
      )
    }
  }

  drawHeader(true)
  let y = 45.5

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage()
      drawHeader(false)
      y = 23.5
    }
  }

  const drawSectionBanner = (
    num: string,
    title: string,
    rightPill?: string,
    minFollowSpace = 30
  ) => {
    ensureSpace(Math.max(14, minFollowSpace))
    doc.setFillColor(15, 23, 42)
    doc.roundedRect(margin, y, contentW, 7.6, 1.8, 1.8, 'F')

    doc.setFillColor(accent[0], accent[1], accent[2])
    doc.roundedRect(margin + 1.5, y + 1.1, 7, 5.4, 1.2, 1.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    doc.text(num, margin + 5, y + 4.8, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.1)
    doc.setTextColor(255, 255, 255)
    doc.text(cleanPdfText(title.toUpperCase()), margin + 11, y + 5)

    if (rightPill) {
      const cleanPill = cleanPdfText(rightPill)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.9)
      const pw = doc.getTextWidth(cleanPill) + 5
      doc.setFillColor(30, 41, 59)
      doc.roundedRect(pageWidth - margin - pw - 2, y + 1.2, pw, 5.2, 1.2, 1.2, 'F')
      doc.setTextColor(148, 163, 184)
      doc.text(cleanPill, pageWidth - margin - pw / 2 - 2, y + 4.6, { align: 'center' })
    }

    y += 9.5 * padScale
  }

  const drawMetricGrid = (
    items: Array<{
      label: string
      value: string
      sub?: string
      tone?: 'emerald' | 'cyan' | 'amber' | 'indigo' | 'rose' | 'slate'
    }>
  ) => {
    if (items.length === 0) return
    const cols = items.length
    const gap = 2.8
    const boxW = (contentW - gap * (cols - 1)) / cols
    const hasSub = items.some(i => Boolean(i.sub))
    const boxH = hasSub ? 16.5 : 13.5
    ensureSpace(boxH + 2.6)

    const toneMap: Record<string, [number, number, number]> = {
      emerald: [16, 185, 129],
      cyan: [2, 132, 199],
      amber: [217, 119, 6],
      indigo: [79, 70, 229],
      rose: [225, 29, 72],
      slate: [51, 65, 85],
    }

    items.forEach((item, idx) => {
      const bx = margin + idx * (boxW + gap)
      const rgb = toneMap[item.tone || 'slate']

      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.3)
      doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'FD')

      doc.setFillColor(rgb[0], rgb[1], rgb[2])
      doc.rect(bx + 1, y, boxW - 2, 1.2, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(100, 116, 139)
      const lblWrap = doc.splitTextToSize(cleanPdfText(item.label.toUpperCase()), boxW - 5)[0] || ''
      doc.text(lblWrap, bx + 2.8, y + 4.8)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(15, 23, 42)
      const valWrap = doc.splitTextToSize(cleanPdfText(item.value), boxW - 5)[0] || ''
      doc.text(valWrap, bx + 2.8, hasSub ? y + 10.6 : y + 10.4)

      if (item.sub) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.4)
        doc.setTextColor(100, 116, 139)
        const subWrap = doc.splitTextToSize(cleanPdfText(item.sub), boxW - 5)[0] || ''
        doc.text(subWrap, bx + 2.8, y + 14.5)
      }
    })

    y += boxH + 2.6 * padScale
  }

  const drawInfoCard = (rows: Array<{ label: string; value: string }>, cols = 2) => {
    const gap = 2.8
    const colW = (contentW - gap * (cols - 1)) / cols
    const rowH = 11
    const totalRows = Math.ceil(rows.length / cols)
    ensureSpace(totalRows * (rowH + 1.6) + 1.2)

    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        if (idx >= rows.length) break
        const item = rows[idx]
        const bx = margin + c * (colW + gap)
        const by = y + r * (rowH + 1.6)

        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.25)
        doc.roundedRect(bx, by, colW, rowH, 1.6, 1.6, 'FD')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.4)
        doc.setTextColor(100, 116, 139)
        doc.text(cleanPdfText(item.label.toUpperCase()), bx + 2.8, by + 4)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.1)
        doc.setTextColor(15, 23, 42)
        const cleanVal = cleanPdfText(item.value)
        const truncated = doc.splitTextToSize(cleanVal, colW - 5.5)[0] || '—'
        doc.text(truncated, bx + 2.8, by + 8.6)
      }
    }

    y += totalRows * (rowH + 1.6) + 1.2 * padScale
  }

  const drawTable = (
    headers: string[],
    rows: string[][],
    colFractions: number[],
    highlightRowFn?: (rIdx: number) => boolean
  ) => {
    const rowH = isCompact ? 5.2 : 5.8
    const colWidths = colFractions.map(f => f * contentW)
    const drawHeaderRow = () => {
      doc.setFillColor(226, 232, 240)
      doc.rect(margin, y, contentW, rowH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.6)
      doc.setTextColor(30, 41, 59)
      let xCur = margin + 2.5
      headers.forEach((h, i) => {
        const txt = doc.splitTextToSize(cleanPdfText(h.toUpperCase()), colWidths[i] - 3)[0] || ''
        doc.text(txt, xCur, y + rowH * 0.68)
        xCur += colWidths[i]
      })
      y += rowH
    }

    ensureSpace(rowH * 2 + 2)
    drawHeaderRow()

    rows.forEach((row, rIdx) => {
      if (y + rowH > pageHeight - 16) {
        doc.addPage()
        drawHeader(false)
        y = 23.5
        drawHeaderRow()
      }

      const highlighted = highlightRowFn?.(rIdx) ?? false
      if (highlighted) {
        doc.setFillColor(220, 252, 231)
      } else if (rIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252)
      } else {
        doc.setFillColor(255, 255, 255)
      }
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.2)
      doc.rect(margin, y, contentW, rowH, 'FD')

      let xCur = margin + 2.5
      row.forEach((cell, cIdx) => {
        doc.setFont('helvetica', cIdx === 0 || highlighted ? 'bold' : 'normal')
        doc.setFontSize(6.7)
        doc.setTextColor(highlighted ? 6 : 51, highlighted ? 95 : 65, highlighted ? 70 : 85)
        const raw = cleanPdfText(cell)
        const fitted = doc.splitTextToSize(raw, colWidths[cIdx] - 3.5)[0] || ''
        doc.text(fitted, xCur, y + rowH * 0.68)
        xCur += colWidths[cIdx]
      })
      y += rowH
    })

    y += 2.8 * padScale
  }

  if (diag && (cfg?.includeCoverSummary ?? true)) {
    drawMetricGrid([
      {
        label: 'Exactitud Test (15%)',
        value: accVal != null ? `${(accVal * 100).toFixed(2)}%` : '—',
        sub: `Meta SLA >= ${cfg?.targetSlaAccuracyPct ?? 75}% (${diag.slaPassed ? 'Cumplida' : 'Revisión'})`,
        tone: 'emerald',
      },
      {
        label: 'F1-Score Ponderado',
        value: f1Val != null ? `${(f1Val * 100).toFixed(2)}%` : '—',
        sub:
          precVal != null && recVal != null
            ? `Prec ${(precVal * 100).toFixed(1)}% · Rec ${(recVal * 100).toFixed(1)}%`
            : 'Balance Clases',
        tone: 'cyan',
      },
      {
        label: 'Health Score IA',
        value: `${diag.healthScore} / 100`,
        sub: `Brecha Loss: ${diag.overfitGap != null ? `${diag.overfitGap >= 0 ? '+' : ''}${diag.overfitGap.toFixed(4)}` : '0.0000'}`,
        tone: 'amber',
      },
      {
        label: 'Topología Activa',
        value: architecture ? `${architecture.total_parameters.toLocaleString('es')}` : '—',
        sub: architecture
          ? `${architecture.config.layers.length} capas (${architecture.family})`
          : 'Sin red',
        tone: 'indigo',
      },
      {
        label: 'Model Registry',
        value: model ? model.version : 'Sin modelo',
        sub: model ? `Estado: ${model.status}` : 'No certificado',
        tone: 'emerald',
      },
    ])

    const recLines = diag.recommendations.map((r, i) => `${i + 1}. ${cleanPdfText(r)}`)
    const summaryWrapped = doc.splitTextToSize(cleanPdfText(diag.summary), contentW - 10)
    const recWrapped = recLines.flatMap(line => doc.splitTextToSize(line, contentW - 10))
    const boxH = 11.5 + summaryWrapped.length * 3.9 + recWrapped.length * 3.7
    ensureSpace(boxH + 3.5)

    const verdictColor: [number, number, number] =
      diag.tone === 'optimal'
        ? [16, 185, 129]
        : diag.tone === 'warning'
          ? [217, 119, 6]
          : diag.tone === 'critical'
            ? [225, 29, 72]
            : [71, 85, 105]

    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(verdictColor[0], verdictColor[1], verdictColor[2])
    doc.setLineWidth(0.45)
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'FD')

    doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2])
    doc.rect(margin, y, 2.5, boxH, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.6)
    doc.setTextColor(verdictColor[0], verdictColor[1], verdictColor[2])
    doc.text(
      cleanPdfText(`DICTAMEN EJECUTIVO: ${diag.verdict} (HEALTH SCORE ${diag.healthScore}/100)`),
      margin + 5.5,
      y + 5.2
    )

    let innerY = y + 9.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.9)
    doc.setTextColor(30, 41, 59)
    doc.text(summaryWrapped, margin + 5.5, innerY)
    innerY += summaryWrapped.length * 3.9 + 0.8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(71, 85, 105)
    doc.text(recWrapped, margin + 5.5, innerY)

    y += boxH + 3.5 * padScale
  }

  orderedKeys.forEach((secKey, idx) => {
    const secNum = String(idx + 1).padStart(2, '0')

    if (secKey === 'projectContext') {
      drawSectionBanner(secNum, 'Contexto del Proyecto y Gobernanza RBAC', project.status, 34)
      drawInfoCard(
        [
          { label: 'Nombre del Workspace', value: project.name },
          { label: 'Identificador Técnico', value: project.id },
          {
            label: 'Equipo Autorizado RBAC',
            value: `${project.members?.length ?? 1} integrante(s) activo(s)`,
          },
          {
            label: 'Etiquetas Corporativas',
            value: project.tags?.length
              ? project.tags.map(t => `#${t}`).join('  ')
              : '#Producción #IA',
          },
        ],
        2
      )

      if (project.description) {
        const descWrap = doc.splitTextToSize(cleanPdfText(project.description), contentW - 8)
        const dh = descWrap.length * 3.9 + 4.8
        ensureSpace(dh + 3)
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(margin, y, contentW, dh, 1.6, 1.6, 'FD')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.9)
        doc.setTextColor(51, 65, 85)
        doc.text(descWrap, margin + 3.5, y + 4.4)
        y += dh + 3 * padScale
      }

      if (cfg?.includeRbacMembersTable && project.members && project.members.length > 0) {
        drawTable(
          ['Integrante RBAC', 'Correo Electrónico', 'Rol Asignado', 'Fecha'],
          project.members.map(m => [
            m.display_name,
            m.email,
            m.role,
            new Date(m.created_at).toLocaleDateString('es-ES'),
          ]),
          [0.28, 0.34, 0.24, 0.14]
        )
      }
    } else if (secKey === 'datasetEda' && dataset) {
      drawSectionBanner(
        secNum,
        'Especificación, Calidad y Partición EDA (70/15/15)',
        problemLabel(dataset.metadata?.problem_type),
        38
      )
      const colsSummary = dataset.metadata?.columns_summary || []
      const numCount = colsSummary.filter(c => c.dtype === 'numeric').length
      const catCount = colsSummary.filter(c => c.dtype === 'categorical').length
      const missingCount = colsSummary.reduce((a, c) => a + (c.missing || 0), 0)

      drawInfoCard(
        [
          { label: 'Dataset Primario', value: `${dataset.name} (v${dataset.version})` },
          {
            label: 'Dimensionalidad -> Target',
            value: `${dataset.input_shape} variables -> ${dataset.target}`,
          },
          {
            label: 'Escalado sin Fuga',
            value: `StandardScaler solo en Train (${dataset.splits.train_count} filas)`,
          },
          {
            label: 'Calidad y Tipos EDA',
            value: `${numCount} Num / ${catCount} Cat · ${missingCount} valores nulos`,
          },
        ],
        2
      )

      ensureSpace(15)
      const totalRows =
        (dataset.splits.train_count || 0) +
        (dataset.splits.val_count || 0) +
        (dataset.splits.test_count || 0)
      const trPct = totalRows > 0 ? (dataset.splits.train_count / totalRows) * 100 : 70
      const vaPct = totalRows > 0 ? (dataset.splits.val_count / totalRows) * 100 : 15

      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, y, contentW, 13, 1.8, 1.8, 'FD')

      const barX = margin + 3.5
      const barY = y + 2.8
      const barW = contentW - 7
      const barH = 3.4
      const wTrain = (barW * trPct) / 100
      const wVal = (barW * vaPct) / 100
      const wTest = barW - wTrain - wVal

      doc.setFillColor(79, 70, 229)
      doc.rect(barX, barY, wTrain, barH, 'F')
      doc.setFillColor(245, 158, 11)
      doc.rect(barX + wTrain, barY, wVal, barH, 'F')
      doc.setFillColor(16, 185, 129)
      doc.rect(barX + wTrain + wVal, barY, wTest, barH, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.1)
      doc.setTextColor(51, 65, 85)
      doc.text(
        cleanPdfText(
          `Train 70%: ${dataset.splits.train_count}   |   Validación 15%: ${dataset.splits.val_count}   |   Test Sellado 15%: ${dataset.splits.test_count} (Total: ${totalRows})`
        ),
        barX,
        y + 10.6
      )
      y += 15.5 * padScale
    } else if (secKey === 'featureDictionary' && dataset?.metadata?.columns_summary?.length) {
      const maxCols = cfg?.maxDictionaryColumns || 15
      const sliced = dataset.metadata.columns_summary.slice(0, maxCols)
      drawSectionBanner(
        secNum,
        'Diccionario Técnico de Variables del Dataset',
        `${sliced.length} de ${dataset.metadata.columns_summary.length} variables`,
        26
      )
      drawTable(
        ['Variable', 'Tipo', 'Nulos', 'Únicos', 'Rango / Top', 'Media +- Std'],
        sliced.map(col => [
          col.is_target ? `${col.name} [TARGET]` : col.name,
          col.dtype,
          String(col.missing),
          String(col.unique),
          col.dtype === 'numeric'
            ? `[${col.min ?? '-'} .. ${col.max ?? '-'}]`
            : Object.keys(col.top_values || {}).slice(0, 2).join(', ') || '-',
          col.dtype === 'numeric' && col.mean !== undefined
            ? `${col.mean.toFixed(2)} +- ${col.std?.toFixed(2) ?? '0'}`
            : '-',
        ]),
        [0.25, 0.13, 0.08, 0.09, 0.27, 0.18]
      )
    } else if (secKey === 'networkArch' && architecture) {
      drawSectionBanner(
        secNum,
        'Topología de Red Neuronal en TensorFlow / Keras',
        `${architecture.family} · v${architecture.version}`,
        38
      )
      drawInfoCard(
        [
          { label: 'Nombre de la Arquitectura', value: cleanPdfText(architecture.name) },
          {
            label: 'Parámetros / Capa de Salida',
            value: `${architecture.total_parameters.toLocaleString('es')} pesos · ${architecture.config.output_dim}u (${architecture.config.output_activation})`,
          },
        ],
        2
      )

      const allBlocks = [
        { title: 'INPUT', sub: `${architecture.config.input_shape} features`, col: [2, 132, 199] },
        ...architecture.config.layers.map((l, lIdx) => ({
          title: l.type === 'BatchNormalization' ? 'BATCHNORM' : l.type.toUpperCase(),
          sub:
            l.type === 'Dense'
              ? `${l.units}u · ${l.activation}`
              : l.type === 'Dropout'
                ? `rate ${l.rate}`
                : `Capa #${lIdx + 1}`,
          col:
            l.type === 'Dense'
              ? [79, 70, 229]
              : l.type === 'Dropout'
                ? [217, 119, 6]
                : [13, 148, 136],
        })),
        {
          title: 'OUTPUT',
          sub: `${architecture.config.output_dim}u · ${architecture.config.output_activation}`,
          col: accent,
        },
      ]

      ensureSpace(15.5)
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, y, contentW, 13, 1.8, 1.8, 'FD')

      const nB = allBlocks.length
      const arrowSpace = 2.6
      const blkW = Math.min(30, (contentW - 7 - (nB - 1) * arrowSpace) / nB)
      const totalRowW = nB * blkW + (nB - 1) * arrowSpace
      let curX = margin + (contentW - totalRowW) / 2

      allBlocks.forEach((b, bIdx) => {
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(b.col[0], b.col[1], b.col[2])
        doc.setLineWidth(0.35)
        doc.roundedRect(curX, y + 1.8, blkW, 9.4, 1.4, 1.4, 'FD')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.2)
        doc.setTextColor(b.col[0], b.col[1], b.col[2])
        doc.text(cleanPdfText(b.title), curX + blkW / 2, y + 5.5, { align: 'center' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        const cleanSub = doc.splitTextToSize(cleanPdfText(b.sub), blkW - 2.4)[0] || ''
        doc.text(cleanSub, curX + blkW / 2, y + 9.3, { align: 'center' })

        curX += blkW
        if (bIdx < nB - 1) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.6)
          doc.setTextColor(148, 163, 184)
          doc.text('->', curX + arrowSpace / 2, y + 7.2, { align: 'center' })
          curX += arrowSpace
        }
      })
      y += 15 * padScale

      if (cfg?.includeLayerParamsTable) {
        const rows = computeLayerBreakdown(architecture)
        drawTable(
          ['Capa', 'Tipo Keras', 'Forma Entrada', 'Forma Salida', 'Activación', 'Parámetros'],
          rows.map(r => [
            r.layerName,
            r.type,
            r.inputShape,
            r.outputShape,
            r.activation,
            r.params.toLocaleString('es'),
          ]),
          [0.2, 0.19, 0.17, 0.17, 0.14, 0.13]
        )
      }

      if (cfg?.includeArchJustification !== false && architecture.justification) {
        const jWrap = doc.splitTextToSize(cleanPdfText(architecture.justification), contentW - 8)
        const jh = jWrap.length * 3.8 + 4.5
        ensureSpace(jh + 2)
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(margin, y, contentW, jh, 1.5, 1.5, 'FD')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.6)
        doc.setTextColor(71, 85, 105)
        doc.text(jWrap, margin + 3.5, y + 4)
        y += jh + 2.5
      }
    } else if (secKey === 'trainingMetrics') {
      drawSectionBanner(
        secNum,
        'Evaluación en Partición Test, Radar, Curvas y Matriz',
        job
          ? `${job.hyperparams.optimizer.toUpperCase()} · LR ${job.hyperparams.learning_rate}`
          : undefined,
        55
      )

      drawMetricGrid([
        {
          label: 'Test Accuracy',
          value: accVal != null ? `${(accVal * 100).toFixed(2)}%` : '—',
          tone: 'emerald',
        },
        {
          label: 'Test Loss',
          value: lossVal != null ? lossVal.toFixed(4) : '—',
          tone: 'amber',
        },
        {
          label: 'Precision',
          value: precVal != null ? `${(precVal * 100).toFixed(2)}%` : '—',
          tone: 'indigo',
        },
        {
          label: 'Recall (Sensibilidad)',
          value: recVal != null ? `${(recVal * 100).toFixed(2)}%` : '—',
          tone: 'cyan',
        },
        {
          label: 'F1-Score',
          value: f1Val != null ? `${(f1Val * 100).toFixed(2)}%` : '—',
          tone: 'emerald',
        },
      ])

      const comparisonJob = options?.comparisonJob
      if (comparisonJob && comparisonJob.id !== job?.id) {
        const compAcc =
          comparisonJob.model_version?.test_metrics?.test_accuracy ?? comparisonJob.accuracy ?? null
        const compLoss =
          comparisonJob.model_version?.test_metrics?.test_loss ?? comparisonJob.loss ?? null
        const dAcc = accVal != null && compAcc != null ? (accVal - compAcc) * 100 : null
        const dLoss = lossVal != null && compLoss != null ? lossVal - compLoss : null
        ensureSpace(12)
        doc.setFillColor(240, 249, 255)
        doc.setDrawColor(14, 165, 233)
        doc.setLineWidth(0.3)
        doc.roundedRect(margin, y, contentW, 9.5, 1.5, 1.5, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.1)
        doc.setTextColor(3, 105, 161)
        doc.text(
          cleanPdfText(
            `Comparativa vs ${comparisonJob.arch_name || comparisonJob.id}: Acc ${
              compAcc != null ? `${(compAcc * 100).toFixed(2)}%` : '—'
            } | Delta Acc ${dAcc != null ? `${dAcc >= 0 ? '+' : ''}${dAcc.toFixed(2)}%` : '—'} | Delta Loss ${
              dLoss != null ? `${dLoss >= 0 ? '+' : ''}${dLoss.toFixed(4)}` : '—'
            }`
          ),
          margin + 3,
          y + 6
        )
        y += 11.5 * padScale
      }

      const epList = cfg?.includeChartsInView === false ? [] : options?.epochMetrics || []
      const showRadar = cfg?.includeRadarChart !== false
      const cm =
        cfg?.includeConfusionMatrix !== false && model?.confusion_matrix?.length
          ? model.confusion_matrix
          : null

      const blocksCount = (epList.length > 1 ? 1 : 0) + (showRadar ? 1 : 0) + (cm ? 1 : 0)
      if (blocksCount > 0) {
        const panelH = 31
        ensureSpace(panelH + 3.5)
        const gap = 2.4
        const panelW = (contentW - gap * (blocksCount - 1)) / blocksCount
        let curX = margin

        if (epList.length > 1) {
          doc.setFillColor(248, 250, 252)
          doc.setDrawColor(226, 232, 240)
          doc.roundedRect(curX, y, panelW, panelH, 1.8, 1.8, 'FD')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.6)
          doc.setTextColor(30, 41, 59)
          doc.text(cleanPdfText(`CURVAS (${epList.length} EP.)`), curX + 3, y + 4.6)

          const plotX = curX + 4
          const plotY = y + 7.6
          const plotW = panelW - 8
          const plotH = panelH - 13.8

          doc.setDrawColor(203, 213, 225)
          doc.setLineWidth(0.2)
          doc.line(plotX, plotY + plotH / 2, plotX + plotW, plotY + plotH / 2)
          doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH)

          const losses = epList.map(m => m.loss)
          const minL = Math.min(...losses, 0)
          const maxL = Math.max(...losses, 0.01)
          const spanL = Math.max(0.001, maxL - minL)

          doc.setDrawColor(217, 119, 6)
          doc.setLineWidth(0.6)
          for (let i = 0; i < epList.length - 1; i++) {
            const x1 = plotX + (i / (epList.length - 1)) * plotW
            const x2 = plotX + ((i + 1) / (epList.length - 1)) * plotW
            const y1 = plotY + (1 - (epList[i].loss - minL) / spanL) * plotH
            const y2 = plotY + (1 - (epList[i + 1].loss - minL) / spanL) * plotH
            doc.line(x1, y1, x2, y2)
          }

          doc.setDrawColor(16, 185, 129)
          doc.setLineWidth(0.7)
          for (let i = 0; i < epList.length - 1; i++) {
            const x1 = plotX + (i / (epList.length - 1)) * plotW
            const x2 = plotX + ((i + 1) / (epList.length - 1)) * plotW
            const y1 = plotY + (1 - Math.min(1, Math.max(0, epList[i].val_accuracy))) * plotH
            const y2 = plotY + (1 - Math.min(1, Math.max(0, epList[i + 1].val_accuracy))) * plotH
            doc.line(x1, y1, x2, y2)
          }

          const lastEp = epList[epList.length - 1]
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(5.9)
          doc.setTextColor(51, 65, 85)
          doc.text(
            cleanPdfText(
              `Val ${(lastEp.val_accuracy * 100).toFixed(1)}% · Loss ${lastEp.loss.toFixed(3)}`
            ),
            curX + panelW / 2,
            y + 28.6,
            { align: 'center' }
          )

          curX += panelW + gap
        }

        if (showRadar) {
          doc.setFillColor(248, 250, 252)
          doc.setDrawColor(226, 232, 240)
          doc.roundedRect(curX, y, panelW, panelH, 1.8, 1.8, 'FD')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.6)
          doc.setTextColor(30, 41, 59)
          doc.text('RADAR 5 EJES', curX + 3, y + 4.6)

          const cx = curX + panelW / 2
          const cy = y + 17.5
          const maxR = 9.5
          const radarAxes = [
            { l: 'Acc', v: accVal ?? 0.75 },
            { l: 'Prec', v: precVal ?? 0.75 },
            { l: 'Rec', v: recVal ?? 0.75 },
            { l: 'F1', v: f1Val ?? 0.75 },
            { l: 'Salud', v: (diag?.healthScore ?? 70) / 100 },
          ]

          const ptFor = (aIdx: number, frac: number) => {
            const ang = -Math.PI / 2 + (aIdx / radarAxes.length) * Math.PI * 2
            const r = maxR * Math.min(1, Math.max(0.1, frac))
            return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]
          }

          doc.setDrawColor(203, 213, 225)
          doc.setLineWidth(0.2)
          ;[0.5, 1].forEach(ring => {
            for (let i = 0; i < radarAxes.length; i++) {
              const p1 = ptFor(i, ring)
              const p2 = ptFor((i + 1) % radarAxes.length, ring)
              doc.line(p1[0], p1[1], p2[0], p2[1])
            }
          })

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(5.4)
          doc.setTextColor(100, 116, 139)
          radarAxes.forEach((ax, i) => {
            const pEnd = ptFor(i, 1)
            doc.line(cx, cy, pEnd[0], pEnd[1])
            const pLbl = ptFor(i, 1.28)
            doc.text(ax.l, pLbl[0], pLbl[1] + 1.2, { align: 'center' })
          })

          doc.setDrawColor(accent[0], accent[1], accent[2])
          doc.setLineWidth(0.7)
          for (let i = 0; i < radarAxes.length; i++) {
            const p1 = ptFor(i, radarAxes[i].v)
            const p2 = ptFor((i + 1) % radarAxes.length, radarAxes[(i + 1) % radarAxes.length].v)
            doc.line(p1[0], p1[1], p2[0], p2[1])
          }

          curX += panelW + gap
        }

        if (cm) {
          doc.setFillColor(248, 250, 252)
          doc.setDrawColor(226, 232, 240)
          doc.roundedRect(curX, y, panelW, panelH, 1.8, 1.8, 'FD')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.6)
          doc.setTextColor(30, 41, 59)
          doc.text(cleanPdfText('MATRIZ TEST'), curX + 3, y + 4.6)

          const rows = cm.length
          const cols = cm[0]?.length || 2
          const cellW = Math.min(20, (panelW - 18) / cols)
          const cellH = Math.min(8, (panelH - 13) / rows)
          const startTableX = curX + 12
          const startTableY = y + 9.5

          for (let c = 0; c < cols; c++) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(6)
            doc.setTextColor(100, 116, 139)
            doc.text(`P${c}`, startTableX + c * (cellW + 1.5) + cellW / 2, startTableY - 1.2, {
              align: 'center',
            })
          }

          for (let r = 0; r < rows; r++) {
            const ry = startTableY + r * (cellH + 1.5)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(6)
            doc.setTextColor(100, 116, 139)
            doc.text(`R${r}`, startTableX - 2, ry + cellH / 2 + 1, { align: 'right' })

            for (let c = 0; c < cols; c++) {
              const cxCell = startTableX + c * (cellW + 1.5)
              const isDiag = r === c
              doc.setFillColor(isDiag ? 209 : 254, isDiag ? 250 : 226, isDiag ? 229 : 226)
              doc.setDrawColor(isDiag ? 16 : 244, isDiag ? 185 : 63, isDiag ? 129 : 94)
              doc.roundedRect(cxCell, ry, cellW, cellH, 1, 1, 'FD')

              doc.setFont('helvetica', 'bold')
              doc.setFontSize(7.4)
              doc.setTextColor(isDiag ? 6 : 159, isDiag ? 95 : 18, isDiag ? 70 : 57)
              doc.text(String(cm[r][c]), cxCell + cellW / 2, ry + cellH / 2 + 1.1, {
                align: 'center',
              })
            }
          }
        }

        y += panelH + 2.8 * padScale
      }

      if (cfg?.includePerClassMetrics && model?.confusion_matrix?.length) {
        const classRows = computePerClassMetrics(
          model.confusion_matrix,
          dataset?.metadata?.target_classes
        )
        drawTable(
          ['Clase', 'Soporte', 'Predichos', 'Precision', 'Recall', 'F1-Score'],
          classRows.map(c => [
            c.classLabel,
            String(c.support),
            String(c.predicted),
            `${(c.precision * 100).toFixed(1)}%`,
            `${(c.recall * 100).toFixed(1)}%`,
            `${(c.f1 * 100).toFixed(1)}%`,
          ]),
          [0.28, 0.14, 0.14, 0.15, 0.15, 0.14]
        )
      }
    } else if (secKey === 'epochHistory' && options?.epochMetrics?.length) {
      const epList = options.epochMetrics
      const maxEp = cfg?.maxEpochsInTable || 15
      const sliced = epList.slice(0, maxEp)
      const bestEpNum = sliced.reduce(
        (b, cur) => (cur.val_accuracy > b.val_accuracy ? cur : b),
        sliced[0]
      ).epoch

      drawSectionBanner(
        secNum,
        'Historial de Entrenamiento por Época',
        `${sliced.length} de ${epList.length} ep. · Duración ${formatJobDuration(job?.started_at, job?.ended_at)}`,
        26
      )
      drawTable(
        ['Época', 'Train Loss', 'Train Acc', 'Val Loss', 'Val Acc', 'Brecha Loss'],
        sliced.map(ep => {
          const gap = ep.val_loss - ep.loss
          return [
            ep.epoch === bestEpNum ? `Época ${ep.epoch} (* Mejor)` : `Época ${ep.epoch}`,
            ep.loss.toFixed(4),
            `${(ep.accuracy * 100).toFixed(2)}%`,
            ep.val_loss.toFixed(4),
            `${(ep.val_accuracy * 100).toFixed(2)}%`,
            `${gap >= 0 ? '+' : ''}${gap.toFixed(4)}`,
          ]
        }),
        [0.24, 0.15, 0.15, 0.15, 0.16, 0.15],
        rIdx => sliced[rIdx]?.epoch === bestEpNum
      )
    } else if (secKey === 'experimentsRanking' && options?.jobs?.length) {
      const sorted = [...options.jobs].sort((a, b) => {
        const sA = a.model_version?.test_metrics?.test_accuracy ?? a.accuracy ?? 0
        const sB = b.model_version?.test_metrics?.test_accuracy ?? b.accuracy ?? 0
        return sB - sA
      })
      drawSectionBanner(
        secNum,
        'Ranking Histórico de Experimentos y Versiones',
        `${sorted.length} corridas`,
        26
      )
      drawTable(
        ['#', 'Arquitectura', 'Optimizador / Ep.', 'Estado', 'Loss', 'Accuracy'],
        sorted.map((j, jIdx) => {
          const score = j.model_version?.test_metrics?.test_accuracy ?? j.accuracy
          const loss = j.model_version?.test_metrics?.test_loss ?? j.loss
          return [
            `#${jIdx + 1}`,
            j.arch_name || j.id,
            `${j.hyperparams.optimizer.toUpperCase()} (${j.current_epoch}/${j.total_epochs})`,
            j.status,
            loss != null ? loss.toFixed(4) : '—',
            score != null ? `${(score * 100).toFixed(2)}%` : '—',
          ]
        }),
        [0.07, 0.34, 0.22, 0.14, 0.11, 0.12],
        rIdx => sorted[rIdx]?.id === job?.id
      )
      if (options?.models?.length) {
        drawTable(
          ['Versión', 'Estado', 'Accuracy', 'F1-Score', 'SHA-256 (Corto)'],
          options.models.map(m => [
            m.version,
            m.status,
            `${(m.test_metrics.test_accuracy * 100).toFixed(2)}%`,
            `${(m.test_metrics.f1_score * 100).toFixed(2)}%`,
            `${m.checksum.slice(0, 18)}...`,
          ]),
          [0.18, 0.2, 0.16, 0.16, 0.3],
          rIdx => options.models![rIdx]?.id === model?.id
        )
      }
    } else if (secKey === 'roiImpact' && cfg) {
      drawSectionBanner(
        secNum,
        'Simulación de Impacto Financiero y ROI Operativo',
        'Proyección 12 Meses',
        34
      )
      const roi = computeRoiProjection(cfg, accVal, recVal)
      drawMetricGrid([
        {
          label: 'Volumen Mensual',
          value: cfg.monthlyVolumeUnits.toLocaleString('es'),
          sub: `Costo unitario: $${cfg.unitRiskCostUsd} USD`,
          tone: 'slate',
        },
        {
          label: 'Detectados / Mes',
          value: roi.detectedCases.toLocaleString('es'),
          sub: `Tasa efectiva: ${roi.effectiveDetectionPct.toFixed(1)}%`,
          tone: 'cyan',
        },
        {
          label: 'Mitigados / Mes',
          value: roi.mitigatedCases.toLocaleString('es'),
          sub: `Éxito intervención: ${cfg.interventionSuccessPct}%`,
          tone: 'indigo',
        },
        {
          label: 'Ahorro Mensual Est.',
          value: `$${roi.monthlySavingsUsd.toLocaleString('es')}`,
          sub: 'USD / mes retenido',
          tone: 'emerald',
        },
        {
          label: 'Impacto Anual (12m)',
          value: `$${roi.annualSavingsUsd.toLocaleString('es')}`,
          sub: 'USD / año proyectado',
          tone: 'amber',
        },
      ])

      if (cfg.includeRoiQuarterlyChart) {
        const qList = computeQuarterlyRoi(roi.monthlySavingsUsd)
        const maxQ = Math.max(...qList.map(q => q.cumulativeUsd), 1)
        ensureSpace(16)
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(margin, y, contentW, 13.5, 1.8, 1.8, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(51, 65, 85)
        doc.text('ACUMULADO TRIMESTRAL PROYECTADO (Q1 - Q4)', margin + 3, y + 4.2)

        const qW = (contentW - 15) / 4
        qList.forEach((q, qIdx) => {
          const bx = margin + 3 + qIdx * (qW + 3)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.2)
          doc.setTextColor(71, 85, 105)
          doc.text(`${q.quarter.split(' ')[0]}: $${q.cumulativeUsd.toLocaleString('es')}`, bx, y + 8)
          doc.setFillColor(226, 232, 240)
          doc.roundedRect(bx, y + 9.2, qW, 2.2, 0.8, 0.8, 'F')
          doc.setFillColor(16, 185, 129)
          doc.roundedRect(bx, y + 9.2, Math.max(3, (q.cumulativeUsd / maxQ) * qW), 2.2, 0.8, 0.8, 'F')
        })
        y += 16 * padScale
      }
    } else if (secKey === 'modelRegistry' && model) {
      drawSectionBanner(
        secNum,
        'Model Registry e Integridad Criptográfica SHA-256',
        model.status,
        38
      )
      drawInfoCard(
        [
          { label: 'Versión Certificada', value: `${model.version} (Artefacto .keras Inmutable)` },
          { label: 'Estado de Gobernanza', value: model.status },
          {
            label: 'Fecha de Sellado',
            value: new Date(model.created_at).toLocaleString('es-ES'),
          },
        ],
        3
      )

      ensureSpace(12.2)
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.25)
      doc.roundedRect(margin, y, contentW, 10.2, 1.6, 1.6, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.3)
      doc.setTextColor(100, 116, 139)
      doc.text(cleanPdfText('FIRMA CRIPTOGRÁFICA SHA-256 COMPLETA (64 HEX)'), margin + 2.8, y + 3.8)
      doc.setFont('courier', 'bold')
      doc.setFontSize(7.9)
      doc.setTextColor(15, 23, 42)
      doc.text(cleanPdfText(model.checksum), margin + 2.8, y + 8.1)
      y += 12.2 * padScale

      if (options?.auditorNotes && options.auditorNotes.trim()) {
        const notesWrap = doc.splitTextToSize(cleanPdfText(options.auditorNotes.trim()), contentW - 8)
        const nh = notesWrap.length * 4 + 6.5
        ensureSpace(nh + 2.5)
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(79, 70, 229)
        doc.setLineWidth(0.35)
        doc.roundedRect(margin, y, contentW, nh, 1.8, 1.8, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.6)
        doc.setTextColor(79, 70, 229)
        doc.text('OBSERVACIONES DEL AUDITOR:', margin + 3.5, y + 4.2)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.8)
        doc.setTextColor(30, 41, 59)
        doc.text(notesWrap, margin + 3.5, y + 8)
        y += nh + 2.5
      }
    } else if (secKey === 'complianceChecklist' && options?.complianceChecks?.length) {
      const checks = options.complianceChecks
      const passed = checks.filter(c => c.passed).length
      drawSectionBanner(
        secNum,
        'Checklist de Gobernanza IA y Cumplimiento (ISO/IEC 42001)',
        `${passed}/${checks.length} Cumplidos`,
        40
      )

      const cols = 2
      const gap = 2.8
      const colW = (contentW - gap) / 2
      const cardH = 13.4
      const totalRows = Math.ceil(checks.length / cols)
      ensureSpace(totalRows * (cardH + 1.6) + 1.5)

      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < cols; c++) {
          const chkIdx = r * cols + c
          if (chkIdx >= checks.length) break
          const chk = checks[chkIdx]
          const bx = margin + c * (colW + gap)
          const by = y + r * (cardH + 1.6)

          doc.setFillColor(chk.passed ? 240 : 254, chk.passed ? 253 : 243, chk.passed ? 244 : 199)
          doc.setDrawColor(chk.passed ? 16 : 217, chk.passed ? 185 : 119, chk.passed ? 129 : 6)
          doc.setLineWidth(0.3)
          doc.roundedRect(bx, by, colW, cardH, 1.5, 1.5, 'FD')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)
          doc.setTextColor(chk.passed ? 6 : 146, chk.passed ? 95 : 64, chk.passed ? 70 : 14)
          const titleLine = doc.splitTextToSize(
            cleanPdfText(`[${chk.passed ? 'OK' : 'PENDIENTE'}] ${chk.title}`),
            colW - 5
          )[0]
          doc.text(titleLine, bx + 2.5, by + 4.2)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6.3)
          doc.setTextColor(71, 85, 105)
          const descLines = doc
            .splitTextToSize(cleanPdfText(chk.description), colW - 5)
            .slice(0, 2)
          doc.text(descLines, bx + 2.5, by + 7.8)
        }
      }
      y += totalRows * (cardH + 1.6) + 1.5 * padScale
    } else if (secKey === 'customSections' && cfg?.customBlocks?.some(b => b.enabled)) {
      const enabledBlocks = cfg.customBlocks.filter(b => b.enabled)
      drawSectionBanner(
        secNum,
        'Bloques y Anexos Personalizados',
        `${enabledBlocks.length} bloque(s)`,
        28
      )

      enabledBlocks.forEach(blk => {
        const toneRgb = CUSTOM_TONE_RGB[blk.tone] || accent
        if (blk.kind === 'kv_metrics') {
          ensureSpace(22)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8.2)
          doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2])
          doc.text(cleanPdfText(blk.title), margin, y + 3)
          y += 5
          const kvs = parseCustomKvMetrics(blk.content).slice(0, 5)
          drawMetricGrid(
            kvs.map(k => ({
              label: k.label,
              value: k.value,
              sub: k.note,
              tone: blk.tone === 'rose' || blk.tone === 'emerald' || blk.tone === 'amber' || blk.tone === 'cyan' || blk.tone === 'indigo' ? blk.tone : 'cyan',
            }))
          )
        } else if (blk.kind === 'table') {
          const tbl = parseCustomTable(blk.content)
          if (tbl.headers.length > 0) {
            ensureSpace(20)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8.2)
            doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2])
            doc.text(cleanPdfText(blk.title), margin, y + 3)
            y += 5
            const frac = 1 / tbl.headers.length
            drawTable(
              tbl.headers,
              tbl.rows,
              tbl.headers.map(() => frac)
            )
          }
        } else {
          const lines =
            blk.kind === 'bullets'
              ? blk.content
                  .split('\n')
                  .map(l => l.trim())
                  .filter(Boolean)
                  .map(l => `• ${cleanPdfText(l)}`)
              : [cleanPdfText(blk.content)]
          const wrapped = lines.flatMap(l => doc.splitTextToSize(l, contentW - 10))
          const bh = 10 + wrapped.length * 3.8
          ensureSpace(bh + 3)

          doc.setFillColor(248, 250, 252)
          doc.setDrawColor(toneRgb[0], toneRgb[1], toneRgb[2])
          doc.setLineWidth(0.35)
          doc.roundedRect(margin, y, contentW, bh, 1.8, 1.8, 'FD')
          doc.setFillColor(toneRgb[0], toneRgb[1], toneRgb[2])
          doc.rect(margin, y, 2.2, bh, 'F')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8.2)
          doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2])
          doc.text(cleanPdfText(blk.title), margin + 5, y + 5)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(51, 65, 85)
          doc.text(wrapped, margin + 5, y + 9.2)
          y += bh + 2.8
        }
      })
    } else if (secKey === 'auditTrail' && options?.auditEvents?.length) {
      const maxEv = cfg?.maxAuditEventsInPdf || 8
      const slice = options.auditEvents.slice(0, maxEv)
      drawSectionBanner(
        secNum,
        'Bitácora de Auditoría Reciente (RBAC)',
        `${slice.length} ${slice.length === 1 ? 'evento' : 'eventos'}`,
        24
      )
      drawTable(
        ['Fecha / Hora', 'Actor RBAC', 'Acción', 'Detalle Técnico'],
        slice.map(evt => {
          const dt = new Date(evt.created_at).toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
          return [
            dt,
            evt.actor_name || evt.actor_id,
            evt.action,
            formatAuditMetadata(evt.metadata),
          ]
        }),
        [0.16, 0.16, 0.22, 0.46]
      )
    }
  })

  const signers = cfg?.signatures && cfg.signatures.length > 0 ? cfg.signatures : DEFAULT_SIGNATURES
  if ((cfg?.includeSignaturesBlock ?? true) && signers.length > 0) {
    ensureSpace(22)
    y += 1.5
    const gap = 3.5
    const colW = (contentW - gap * (signers.length - 1)) / signers.length

    signers.forEach((sig, idx) => {
      const bx = margin + idx * (colW + gap)
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.3)
      doc.roundedRect(bx, y, colW, 19.5, 1.8, 1.8, 'FD')

      const stampText = cleanPdfText(sig.stamp || 'FIRMADO')
      const stampW = Math.min(colW - 6, Math.max(26, doc.getTextWidth(stampText) + 6))
      doc.setFillColor(accent[0], accent[1], accent[2])
      doc.roundedRect(bx + colW / 2 - stampW / 2, y + 1.8, stampW, 4, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.6)
      doc.setTextColor(255, 255, 255)
      doc.text(stampText, bx + colW / 2, y + 4.5, { align: 'center' })

      doc.setDrawColor(148, 163, 184)
      doc.line(bx + 5, y + 11.2, bx + colW - 5, y + 11.2)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.4)
      doc.setTextColor(15, 23, 42)
      const cleanName = doc.splitTextToSize(cleanPdfText(sig.name), colW - 5)[0] || ''
      doc.text(cleanName, bx + colW / 2, y + 14.8, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.3)
      doc.setTextColor(100, 116, 139)
      const cleanRole = doc.splitTextToSize(cleanPdfText(sig.role), colW - 5)[0] || ''
      doc.text(cleanRole, bx + colW / 2, y + 17.8, { align: 'center' })
    })
  }

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(p, totalPages)
  }

  const filename = `Reporte_Ejecutivo_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  doc.save(filename)
}
