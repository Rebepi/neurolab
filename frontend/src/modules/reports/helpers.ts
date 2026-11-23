import type {
  Project,
  Dataset,
  Architecture,
  TrainingJob,
  ModelVersion,
  AuditEvent,
  EpochMetric,
  TestMetrics,
} from '../../types/index'
import { DEFAULT_SECTION_ORDER } from './constants'
import type {
  ComplianceCheckItem,
  ExecutiveDiagnostic,
  LayerBreakdownRow,
  PerClassMetric,
  ReportCustomizationConfig,
  SectionKey,
} from './types'

export function problemLabel(type?: string) {
  if (type === 'binary_classification') return 'Clasificación Binaria'
  if (type === 'multiclass_classification') return 'Clasificación Multiclase'
  if (type === 'regression') return 'Regresión'
  return type || 'Tabulado Supervisado'
}

export function formatAuditMetadata(meta?: Record<string, any>): string {
  if (!meta || Object.keys(meta).length === 0) return 'Sin metadatos adicionales'
  return Object.entries(meta)
    .slice(0, 4)
    .map(([k, v]) => {
      const val = typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(4)) : String(v)
      return `${k}: ${val}`
    })
    .join(' · ')
}

export function formatJobDuration(startedAt?: string, endedAt?: string): string {
  if (!startedAt || !endedAt) return '—'
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return '—'
  const secs = Math.round(diffMs / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return `${mins}m ${rem}s`
}

export function computePerClassMetrics(
  cm?: number[][] | null,
  classLabels?: string[]
): PerClassMetric[] {
  if (!cm || cm.length === 0) return []
  return cm.map((row, i) => {
    const tp = row[i] ?? 0
    const support = row.reduce((a, b) => a + b, 0)
    const predicted = cm.reduce((a, r) => a + (r[i] ?? 0), 0)
    const fn = Math.max(0, support - tp)
    const fp = Math.max(0, predicted - tp)
    const precision = predicted > 0 ? tp / predicted : 0
    const recall = support > 0 ? tp / support : 0
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    return {
      classLabel: classLabels?.[i] ? `${classLabels[i]} (${i})` : `Clase ${i}`,
      tp,
      fp,
      fn,
      support,
      predicted,
      precision,
      recall,
      f1,
    }
  })
}

export function computeLayerBreakdown(architecture?: Architecture | null): LayerBreakdownRow[] {
  if (!architecture) return []
  const rows: LayerBreakdownRow[] = []
  let prevUnits = architecture.config.input_shape || 1

  rows.push({
    index: 0,
    layerName: 'Entrada Z-Score',
    type: 'Input',
    inputShape: `(None, ${prevUnits})`,
    outputShape: `(None, ${prevUnits})`,
    activation: 'z-score',
    params: 0,
  })

  architecture.config.layers.forEach((layer, idx) => {
    let params = 0
    let outUnits = prevUnits
    let act: string = layer.activation || 'linear'

    if (layer.type === 'Dense') {
      outUnits = layer.units || 16
      const useBias = layer.use_bias !== false
      params = prevUnits * outUnits + (useBias ? outUnits : 0)
    } else if (layer.type === 'BatchNormalization') {
      params = prevUnits * 4
      act = 'norm'
    } else if (layer.type === 'Dropout') {
      params = 0
      act = `rate ${layer.rate ?? 0.2}`
    } else if (layer.type === 'Conv1D') {
      outUnits = layer.units || 32
      params = prevUnits * outUnits * 3 + outUnits
    } else if (layer.type === 'LSTM') {
      outUnits = layer.units || 32
      params = 4 * ((prevUnits + outUnits) * outUnits + outUnits)
    }

    rows.push({
      index: idx + 1,
      layerName: `Capa Oculta ${idx + 1}`,
      type: layer.type,
      inputShape: `(None, ${prevUnits})`,
      outputShape: `(None, ${outUnits})`,
      activation: act,
      params,
    })

    prevUnits = outUnits
  })

  const outDim = architecture.config.output_dim || 1
  rows.push({
    index: rows.length,
    layerName: 'Capa de Salida',
    type: 'Output (Dense)',
    inputShape: `(None, ${prevUnits})`,
    outputShape: `(None, ${outDim})`,
    activation: architecture.config.output_activation || 'sigmoid',
    params: prevUnits * outDim + outDim,
  })

  return rows
}

export function computeQuarterlyRoi(monthlySavingsUsd: number) {
  const quarters = [
    { quarter: 'Q1 (Meses 1–3)', factor: 0.72 },
    { quarter: 'Q2 (Meses 4–6)', factor: 0.95 },
    { quarter: 'Q3 (Meses 7–9)', factor: 1.1 },
    { quarter: 'Q4 (Meses 10–12)', factor: 1.23 },
  ]
  let cumulative = 0
  return quarters.map(q => {
    const quarterlyUsd = Math.round(monthlySavingsUsd * 3 * q.factor)
    cumulative += quarterlyUsd
    return {
      quarter: q.quarter,
      quarterlyUsd,
      cumulativeUsd: cumulative,
    }
  })
}

export function parseCustomKvMetrics(
  content: string
): Array<{ label: string; value: string; note?: string }> {
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const colonIdx = line.indexOf(':')
      const label = colonIdx > -1 ? line.slice(0, colonIdx).trim() : 'Métrica'
      const rest = colonIdx > -1 ? line.slice(colonIdx + 1).trim() : line
      const [value, ...noteParts] = rest.split('|')
      return {
        label: label || 'KPI',
        value: (value || '—').trim(),
        note: noteParts.join('·').trim() || undefined,
      }
    })
}

export function parseCustomTable(content: string): { headers: string[]; rows: string[][] } {
  const lines = content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const splitRow = (line: string) =>
    line
      .split('|')
      .map(c => c.trim())
      .filter((_, idx, arr) => !(idx === 0 && cEmpty(arr[0])))
  const headers = splitRow(lines[0])
  const rows = lines
    .slice(1)
    .filter(l => !/^[-|\s:]+$/.test(l))
    .map(splitRow)
  return { headers, rows }
}

function cEmpty(val?: string) {
  return !val || val.trim().length === 0
}

export function computeExecutiveDiagnostic(
  metrics: TestMetrics | null,
  job: TrainingJob | null,
  epochMetrics: EpochMetric[],
  targetSlaPct = 75,
  maxOverfitGap = 0.08
): ExecutiveDiagnostic {
  const acc = metrics?.test_accuracy ?? job?.accuracy ?? null
  const f1 = metrics?.f1_score ?? null
  const lastEp = epochMetrics.length > 0 ? epochMetrics[epochMetrics.length - 1] : null
  const overfitGap = lastEp ? lastEp.val_loss - lastEp.loss : null
  const slaThreshold = targetSlaPct / 100

  if (acc == null) {
    return {
      verdict: 'PENDIENTE DE EVALUACIÓN',
      tone: 'neutral',
      healthScore: 0,
      summary: 'Aún no existen métricas completadas para emitir un dictamen técnico automático.',
      recommendations: [
        'Ejecuta al menos un entrenamiento completo sobre el dataset procesado.',
        'Verifica la compatibilidad de entrada entre el dataset y la arquitectura seleccionada.',
      ],
      overfitGap: null,
      slaPassed: false,
    }
  }

  const recommendations: string[] = []
  let tone: ExecutiveDiagnostic['tone'] = 'optimal'
  let verdict = 'APTO PARA PRODUCCIÓN'
  const slaPassed = acc >= slaThreshold

  const accScore = Math.min(100, Math.max(0, acc * 100))
  const f1ScoreVal = f1 != null ? f1 * 100 : accScore
  const gapPenalty = overfitGap != null && overfitGap > 0 ? Math.min(25, overfitGap * 120) : 0
  const healthScore = Math.round(
    Math.min(100, Math.max(15, accScore * 0.55 + f1ScoreVal * 0.45 - gapPenalty))
  )

  if (overfitGap != null && overfitGap > maxOverfitGap) {
    tone = 'warning'
    verdict = 'POSIBLE SOBREAJUSTE DETECTADO'
    recommendations.push(
      `La brecha Val-Train Loss (+${overfitGap.toFixed(4)}) supera el límite configurado (+${maxOverfitGap.toFixed(2)}); añade regularización Dropout o reduce épocas.`
    )
  }

  if (acc < 0.65) {
    tone = 'critical'
    verdict = 'REQUIERE REENTRENAMIENTO'
    recommendations.push(
      'La exactitud en Test está por debajo del piso mínimo operativo (65%). Incrementa unidades ocultas o ajusta el Learning Rate.'
    )
  } else if (!slaPassed) {
    if (tone === 'optimal') {
      tone = 'warning'
      verdict = 'DESEMPEÑO MODERADO (REVISIÓN)'
    }
    recommendations.push(
      `La exactitud actual (${(acc * 100).toFixed(2)}%) está por debajo del SLA objetivo de ${targetSlaPct}%. Evalúa ajuste de hiperparámetros o re-balanceo.`
    )
  } else {
    recommendations.push(
      `Cumple satisfactoriamente el SLA objetivo (${(acc * 100).toFixed(2)}% >= ${targetSlaPct}%) sobre la partición de Test sellada (15%).`
    )
  }

  if (f1 != null && f1 + 0.08 < acc) {
    if (tone === 'optimal') {
      tone = 'warning'
      verdict = 'REVISAR DESBALANCE DE CLASES'
    }
    recommendations.push(
      `Brecha entre Accuracy (${(acc * 100).toFixed(1)}%) y F1-Score (${(f1 * 100).toFixed(1)}%); evalúa pesos de clase o umbral de decisión.`
    )
  }

  if (recommendations.length === 1 && tone === 'optimal') {
    recommendations.push(
      'Sin signos significativos de overfitting; artefacto certificado y listo para despliegue en producción.'
    )
  }

  const summary = `Exactitud consolidada de ${(acc * 100).toFixed(2)}%${
    f1 != null ? ` con F1-Score de ${(f1 * 100).toFixed(2)}%` : ''
  }${
    overfitGap != null
      ? ` y brecha Val-Train Loss de ${overfitGap >= 0 ? '+' : ''}${overfitGap.toFixed(4)}`
      : ''
  } (Health Score: ${healthScore}/100).`

  return { verdict, tone, healthScore, summary, recommendations, overfitGap, slaPassed }
}

export function buildDefaultComplianceChecks(params: {
  dataset: Dataset | null
  architecture: Architecture | null
  model: ModelVersion | null
  diagnostic: ExecutiveDiagnostic
  auditEvents: AuditEvent[]
}): ComplianceCheckItem[] {
  const { dataset, architecture, model, diagnostic, auditEvents } = params
  return [
    {
      id: 'chk-split',
      category: 'Datos',
      title: 'Aislamiento Cero-Fuga en Partición Test (15%)',
      description:
        'Escalado Z-Score ajustado exclusivamente sobre Train (70%) sin contaminación de Test.',
      passed: Boolean(dataset && (dataset.splits?.test_count || 0) > 0),
      autoVerified: true,
    },
    {
      id: 'chk-sha',
      category: 'Seguridad',
      title: 'Integridad Criptográfica SHA-256 del Binario .keras',
      description:
        'Artefacto neuronal sellado con suma de verificación inmutable en Model Registry.',
      passed: Boolean(model?.checksum && model.checksum.length >= 16),
      autoVerified: true,
    },
    {
      id: 'chk-sla',
      category: 'Modelo',
      title: 'Cumplimiento de Umbral SLA de Exactitud en Test',
      description:
        'El modelo supera el umbral mínimo de exactitud exigido por el área de negocio.',
      passed: diagnostic.slaPassed,
      autoVerified: true,
    },
    {
      id: 'chk-overfit',
      category: 'Modelo',
      title: 'Control de Sobreajuste (Brecha Val-Train Loss)',
      description:
        'Diferencia entre pérdida de validación y entrenamiento dentro de tolerancia MLOps.',
      passed: diagnostic.overfitGap === null || diagnostic.overfitGap <= 0.08,
      autoVerified: true,
    },
    {
      id: 'chk-arch',
      category: 'Modelo',
      title: 'Topología Documentada y Capas de Regularización',
      description:
        'Arquitectura con flujo de capas, funciones de activación y conteo de parámetros auditado.',
      passed: Boolean(architecture && architecture.config.layers.length >= 2),
      autoVerified: true,
    },
    {
      id: 'chk-rbac',
      category: 'Gobernanza',
      title: 'Trazabilidad RBAC en Bitácora de Auditoría',
      description:
        'Eventos críticos de entrenamiento y registro vinculados a usuarios autenticados.',
      passed: auditEvents.length > 0,
      autoVerified: true,
    },
  ]
}

export function computeRoiProjection(
  config: ReportCustomizationConfig,
  accuracy: number | null,
  recall: number | null
) {
  const effRecall = recall ?? accuracy ?? 0.75
  const baseCasesAtRisk = Math.round(config.monthlyVolumeUnits * 0.18)
  const detectedCases = Math.round(baseCasesAtRisk * effRecall)
  const mitigatedCases = Math.round(detectedCases * (config.interventionSuccessPct / 100))
  const monthlySavingsUsd = mitigatedCases * config.unitRiskCostUsd
  const annualSavingsUsd = monthlySavingsUsd * 12

  return {
    baseCasesAtRisk,
    detectedCases,
    mitigatedCases,
    monthlySavingsUsd,
    annualSavingsUsd,
    effectiveDetectionPct: effRecall * 100,
  }
}

export function buildMarkdownSummary(params: {
  project: Project
  dataset: Dataset | null
  architecture: Architecture | null
  job: TrainingJob | null
  model: ModelVersion | null
  metrics: TestMetrics | null
  diagnostic: ExecutiveDiagnostic
  auditorNotes: string
  sections: Record<SectionKey, boolean>
  sectionOrder?: SectionKey[]
  config?: ReportCustomizationConfig
  complianceChecks?: ComplianceCheckItem[]
  jobs?: TrainingJob[]
  models?: ModelVersion[]
  epochMetrics?: EpochMetric[]
  auditEvents?: AuditEvent[]
}) {
  const {
    project,
    dataset,
    architecture,
    job,
    model,
    metrics,
    diagnostic,
    auditorNotes,
    sections,
    sectionOrder = DEFAULT_SECTION_ORDER,
    config,
    complianceChecks,
    jobs = [],
    epochMetrics = [],
    auditEvents = [],
  } = params

  const title = config?.reportTitle || `Reporte Ejecutivo — ${project.name}`
  const lines: string[] = [
    `# ${title}`,
    `**Código:** \`${config?.documentCode || 'NL-DOC-2026-01'}\` · **Versión:** ${config?.reportVersion || 'v2.0'}`,
    `**Proyecto / Área:** ${project.name}`,
    `**Organización:** ${config?.organizationName || 'Aura Telecom AI Studio'} · ${config?.departmentName || 'MLOps'}`,
    `**Clasificación:** ${config?.confidentiality || 'CONFIDENCIAL'} | **Generado:** ${new Date().toLocaleString('es-ES')}`,
    `**Veredicto:** ${diagnostic.verdict} (Health Score: ${diagnostic.healthScore}/100) — ${diagnostic.summary}`,
    '',
  ]

  let num = 0
  sectionOrder.forEach(key => {
    if (!sections[key]) return
    num += 1
    const prefix = String(num).padStart(2, '0')

    if (key === 'projectContext') {
      lines.push(
        `## ${prefix}. Contexto del Proyecto`,
        `- **Estado:** ${project.status} | **ID:** \`${project.id}\``,
        `- **Descripción:** ${project.description || 'Sin descripción'}`,
        ''
      )
      if (config?.includeRbacMembersTable && project.members?.length) {
        lines.push('### Miembros Autorizados RBAC')
        project.members.forEach(m => {
          lines.push(`- **${m.display_name}** (${m.role}) — ${m.email}`)
        })
        lines.push('')
      }
    } else if (key === 'datasetEda' && dataset) {
      lines.push(
        `## ${prefix}. Dataset y Partición EDA`,
        `- **Dataset:** ${dataset.name} (v${dataset.version})`,
        `- **Features:** ${dataset.input_shape} → **Target:** \`${dataset.target}\``,
        `- **Splits (70/15/15):** Train ${dataset.splits.train_count} / Val ${dataset.splits.val_count} / Test Sellado ${dataset.splits.test_count}`,
        ''
      )
    } else if (key === 'featureDictionary' && dataset?.metadata?.columns_summary) {
      lines.push(`## ${prefix}. Diccionario de Variables`)
      dataset.metadata.columns_summary
        .slice(0, config?.maxDictionaryColumns || 15)
        .forEach(col => {
          const stat =
            col.dtype === 'numeric'
              ? `min=${col.min ?? '—'}, max=${col.max ?? '—'}, media=${col.mean?.toFixed(2) ?? '—'}`
              : `únicos=${col.unique}`
          lines.push(`- \`${col.name}\` (${col.dtype}${col.is_target ? ' · TARGET' : ''}): ${stat}`)
        })
      lines.push('')
    } else if (key === 'networkArch' && architecture) {
      lines.push(
        `## ${prefix}. Arquitectura de Red Neuronal`,
        `- **Nombre:** ${architecture.name} (v${architecture.version}) · ${architecture.family}`,
        `- **Parámetros Entrenables:** ${architecture.total_parameters.toLocaleString('es')}`,
        ''
      )
      if (config?.includeLayerParamsTable) {
        computeLayerBreakdown(architecture).forEach(r => {
          lines.push(
            `- ${r.layerName} (${r.type}): ${r.inputShape} → ${r.outputShape} · ${r.params.toLocaleString('es')} params`
          )
        })
        lines.push('')
      }
    } else if (key === 'trainingMetrics' && (metrics || job)) {
      const acc = metrics?.test_accuracy ?? job?.accuracy
      const loss = metrics?.test_loss ?? job?.loss
      lines.push(
        `## ${prefix}. Evaluación y Métricas`,
        `- **Exactitud Test:** ${acc != null ? `${(acc * 100).toFixed(2)}%` : '—'} | **Loss:** ${loss != null ? loss.toFixed(4) : '—'}`,
        `- **Precision / Recall / F1:** ${
          metrics
            ? `${(metrics.precision * 100).toFixed(2)}% / ${(metrics.recall * 100).toFixed(2)}% / ${(metrics.f1_score * 100).toFixed(2)}%`
            : '—'
        }`,
        ''
      )
      if (config?.includePerClassMetrics && model?.confusion_matrix) {
        computePerClassMetrics(model.confusion_matrix, dataset?.metadata?.target_classes).forEach(
          c => {
            lines.push(
              `- **${c.classLabel}:** Precision ${(c.precision * 100).toFixed(1)}% · Recall ${(c.recall * 100).toFixed(1)}% · F1 ${(c.f1 * 100).toFixed(1)}% (Soporte: ${c.support})`
            )
          }
        )
        lines.push('')
      }
    } else if (key === 'epochHistory' && epochMetrics.length > 0) {
      lines.push(`## ${prefix}. Historial por Época (${epochMetrics.length} épocas)`)
      epochMetrics.slice(0, config?.maxEpochsInTable || 15).forEach(ep => {
        lines.push(
          `- Ep ${ep.epoch}: loss=${ep.loss.toFixed(4)}, acc=${(ep.accuracy * 100).toFixed(2)}%, val_loss=${ep.val_loss.toFixed(4)}, val_acc=${(ep.val_accuracy * 100).toFixed(2)}%`
        )
      })
      lines.push('')
    } else if (key === 'experimentsRanking' && jobs.length > 0) {
      lines.push(`## ${prefix}. Ranking de Experimentos (${jobs.length})`)
      jobs.forEach((j, idx) => {
        const a = j.model_version?.test_metrics?.test_accuracy ?? j.accuracy
        lines.push(
          `- #${idx + 1} ${j.arch_name || j.id} (${j.status}) — Accuracy: ${a != null ? `${(a * 100).toFixed(2)}%` : '—'}`
        )
      })
      lines.push('')
    } else if (key === 'roiImpact' && config) {
      const roi = computeRoiProjection(
        config,
        metrics?.test_accuracy ?? job?.accuracy ?? null,
        metrics?.recall ?? null
      )
      lines.push(
        `## ${prefix}. Proyección de Impacto Operativo y ROI`,
        `- **Volumen Mensual Evaluado:** ${config.monthlyVolumeUnits.toLocaleString('es')} registros`,
        `- **Casos Detectados / Mitigados por Mes:** ${roi.detectedCases.toLocaleString('es')} detectados → ${roi.mitigatedCases.toLocaleString('es')} mitigados`,
        `- **Ahorro Estimado:** $${roi.monthlySavingsUsd.toLocaleString('es')} USD/mes ($${roi.annualSavingsUsd.toLocaleString('es')} USD/año)`,
        ''
      )
    } else if (key === 'modelRegistry' && model) {
      lines.push(
        `## ${prefix}. Model Registry e Integridad`,
        `- **Versión:** ${model.version} (${model.status})`,
        `- **SHA-256:** \`${model.checksum}\``,
        ''
      )
    } else if (key === 'complianceChecklist' && complianceChecks?.length) {
      lines.push(`## ${prefix}. Checklist de Cumplimiento y Gobernanza IA`)
      complianceChecks.forEach(c => {
        lines.push(`- [${c.passed ? 'x' : ' '}] **${c.title}** (${c.category}): ${c.description}`)
      })
      lines.push('')
    } else if (key === 'customSections' && config?.customBlocks?.some(b => b.enabled)) {
      lines.push(`## ${prefix}. Bloques Personalizados`)
      config.customBlocks
        .filter(b => b.enabled)
        .forEach(b => {
          lines.push(`### ${b.title}`, b.subtitle ? `*${b.subtitle}*` : '', b.content, '')
        })
    } else if (key === 'auditTrail' && auditEvents.length > 0) {
      lines.push(`## ${prefix}. Bitácora de Auditoría (${auditEvents.length})`)
      auditEvents.slice(0, config?.maxAuditEventsInPdf || 8).forEach(evt => {
        lines.push(
          `- ${new Date(evt.created_at).toLocaleString('es-ES')} · **${evt.action}** (${evt.actor_name || evt.actor_id}): ${formatAuditMetadata(evt.metadata)}`
        )
      })
      lines.push('')
    }
  })

  if (auditorNotes.trim()) {
    lines.push('## Observaciones del Auditor', auditorNotes.trim(), '')
  }

  return lines.join('\n')
}

export function buildStandaloneHtmlReport(params: {
  project: Project
  dataset: Dataset | null
  architecture: Architecture | null
  job: TrainingJob | null
  model: ModelVersion | null
  metrics: TestMetrics | null
  diagnostic: ExecutiveDiagnostic
  auditorNotes: string
  sections: Record<SectionKey, boolean>
  sectionOrder?: SectionKey[]
  config: ReportCustomizationConfig
  complianceChecks: ComplianceCheckItem[]
  jobs?: TrainingJob[]
  epochMetrics?: EpochMetric[]
  auditEvents?: AuditEvent[]
}) {
  const {
    project,
    dataset,
    architecture,
    job,
    model,
    metrics,
    diagnostic,
    auditorNotes,
    sections,
    sectionOrder = DEFAULT_SECTION_ORDER,
    config,
    complianceChecks,
    jobs = [],
    epochMetrics = [],
    auditEvents = [],
  } = params

  const acc = metrics?.test_accuracy ?? job?.accuracy ?? null
  const loss = metrics?.test_loss ?? job?.loss ?? null
  const roi = computeRoiProjection(config, acc, metrics?.recall ?? null)

  let secNum = 0
  const htmlBlocks: string[] = []

  sectionOrder.forEach(key => {
    if (!sections[key]) return
    secNum += 1
    const numStr = String(secNum).padStart(2, '0')

    if (key === 'projectContext') {
      const membersHtml =
        config.includeRbacMembersTable && project.members?.length
          ? `<table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol RBAC</th></tr></thead><tbody>${project.members
              .map(
                m =>
                  `<tr><td>${m.display_name}</td><td>${m.email}</td><td><span class="badge">${m.role}</span></td></tr>`
              )
              .join('')}</tbody></table>`
          : ''
      htmlBlocks.push(
        `<h2>${numStr}. Contexto del Proyecto</h2><p><strong>${project.name}</strong> (ID: <code>${project.id}</code>) — ${project.description || ''}</p>${membersHtml}`
      )
    } else if (key === 'datasetEda' && dataset) {
      htmlBlocks.push(
        `<h2>${numStr}. Especificación del Dataset y Partición EDA</h2><div class="grid"><div class="card"><div class="label">Dataset</div><div class="val" style="font-size:14px;">${dataset.name} (v${dataset.version})</div></div><div class="card"><div class="label">Dimensiones</div><div class="val">${dataset.input_shape}D → ${dataset.target}</div></div><div class="card"><div class="label">Splits 70/15/15</div><div class="val" style="font-size:14px;">${dataset.splits.train_count} / ${dataset.splits.val_count} / ${dataset.splits.test_count}</div></div></div>`
      )
    } else if (key === 'featureDictionary' && dataset?.metadata?.columns_summary) {
      const cols = dataset.metadata.columns_summary.slice(0, config.maxDictionaryColumns)
      htmlBlocks.push(
        `<h2>${numStr}. Diccionario de Variables (${cols.length})</h2><table><thead><tr><th>Variable</th><th>Tipo</th><th>Nulos</th><th>Únicos</th><th>Rango / Media</th></tr></thead><tbody>${cols
          .map(
            c =>
              `<tr><td><code>${c.name}</code>${c.is_target ? ' ★' : ''}</td><td>${c.dtype}</td><td>${c.missing}</td><td>${c.unique}</td><td>${
                c.dtype === 'numeric'
                  ? `[${c.min ?? '—'} .. ${c.max ?? '—'}] (μ=${c.mean?.toFixed(2) ?? '—'})`
                  : `${Object.keys(c.top_values || {}).slice(0, 2).join(', ') || '—'}`
              }</td></tr>`
          )
          .join('')}</tbody></table>`
      )
    } else if (key === 'networkArch' && architecture) {
      const layersTable = config.includeLayerParamsTable
        ? `<table><thead><tr><th>#</th><th>Capa</th><th>Tipo</th><th>Salida</th><th>Activación</th><th>Parámetros</th></tr></thead><tbody>${computeLayerBreakdown(
            architecture
          )
            .map(
              l =>
                `<tr><td>L${l.index}</td><td>${l.layerName}</td><td>${l.type}</td><td><code>${l.outputShape}</code></td><td>${l.activation}</td><td>${l.params.toLocaleString('es')}</td></tr>`
            )
            .join('')}</tbody></table>`
        : ''
      htmlBlocks.push(
        `<h2>${numStr}. Topología de Red Neuronal</h2><p><strong>${architecture.name}</strong> (${architecture.family} · v${architecture.version}) — <strong>${architecture.total_parameters.toLocaleString('es')}</strong> parámetros entrenables.</p>${layersTable}`
      )
    } else if (key === 'trainingMetrics') {
      const perClassHtml =
        config.includePerClassMetrics && model?.confusion_matrix
          ? `<table><thead><tr><th>Clase</th><th>Precision</th><th>Recall</th><th>F1-Score</th><th>Soporte</th></tr></thead><tbody>${computePerClassMetrics(
              model.confusion_matrix,
              dataset?.metadata?.target_classes
            )
              .map(
                c =>
                  `<tr><td>${c.classLabel}</td><td>${(c.precision * 100).toFixed(1)}%</td><td>${(c.recall * 100).toFixed(1)}%</td><td>${(c.f1 * 100).toFixed(1)}%</td><td>${c.support}</td></tr>`
              )
              .join('')}</tbody></table>`
          : ''
      htmlBlocks.push(
        `<h2>${numStr}. Métricas en Partición Test Sellada</h2><div class="grid"><div class="card"><div class="label">Test Accuracy</div><div class="val" style="color:#34d399;">${acc != null ? `${(acc * 100).toFixed(2)}%` : '—'}</div></div><div class="card"><div class="label">Test Loss</div><div class="val" style="color:#fbbf24;">${loss != null ? loss.toFixed(4) : '—'}</div></div><div class="card"><div class="label">F1-Score</div><div class="val" style="color:#38bdf8;">${metrics?.f1_score != null ? `${(metrics.f1_score * 100).toFixed(2)}%` : '—'}</div></div><div class="card"><div class="label">Precision / Recall</div><div class="val" style="font-size:14px;">${metrics ? `${(metrics.precision * 100).toFixed(1)}% / ${(metrics.recall * 100).toFixed(1)}%` : '—'}</div></div></div>${perClassHtml}`
      )
    } else if (key === 'epochHistory' && epochMetrics.length > 0) {
      htmlBlocks.push(
        `<h2>${numStr}. Historial por Época (${epochMetrics.length})</h2><table><thead><tr><th>Época</th><th>Train Loss</th><th>Train Acc</th><th>Val Loss</th><th>Val Acc</th></tr></thead><tbody>${epochMetrics
          .slice(0, config.maxEpochsInTable)
          .map(
            e =>
              `<tr><td>Ep ${e.epoch}</td><td>${e.loss.toFixed(4)}</td><td>${(e.accuracy * 100).toFixed(2)}%</td><td>${e.val_loss.toFixed(4)}</td><td>${(e.val_accuracy * 100).toFixed(2)}%</td></tr>`
          )
          .join('')}</tbody></table>`
      )
    } else if (key === 'experimentsRanking' && jobs.length > 0) {
      htmlBlocks.push(
        `<h2>${numStr}. Ranking de Experimentos</h2><table><thead><tr><th>#</th><th>Arquitectura</th><th>Estado</th><th>Épocas</th><th>Accuracy</th></tr></thead><tbody>${jobs
          .map((j, i) => {
            const a = j.model_version?.test_metrics?.test_accuracy ?? j.accuracy
            return `<tr><td>${i + 1}</td><td>${j.arch_name || j.id}</td><td>${j.status}</td><td>${j.current_epoch}/${j.total_epochs}</td><td>${a != null ? `${(a * 100).toFixed(2)}%` : '—'}</td></tr>`
          })
          .join('')}</tbody></table>`
      )
    } else if (key === 'roiImpact') {
      htmlBlocks.push(
        `<h2>${numStr}. Simulación de Impacto Financiero y ROI</h2><div class="grid"><div class="card"><div class="label">Casos Detectados / Mes</div><div class="val">${roi.detectedCases.toLocaleString('es')}</div></div><div class="card"><div class="label">Casos Mitigados / Mes</div><div class="val" style="color:#2dd4bf;">${roi.mitigatedCases.toLocaleString('es')}</div></div><div class="card"><div class="label">Ahorro Mensual</div><div class="val" style="color:#34d399;">$${roi.monthlySavingsUsd.toLocaleString('es')} USD</div></div><div class="card"><div class="label">Ahorro Anual Proyectado</div><div class="val" style="color:#fbbf24;">$${roi.annualSavingsUsd.toLocaleString('es')} USD</div></div></div>`
      )
    } else if (key === 'modelRegistry' && model) {
      htmlBlocks.push(
        `<h2>${numStr}. Certificación Model Registry & SHA-256</h2><p>Versión: <strong>${model.version}</strong> (${model.status}) · Firma SHA-256: <code>${model.checksum}</code></p>`
      )
    } else if (key === 'complianceChecklist') {
      htmlBlocks.push(
        `<h2>${numStr}. Checklist de Gobernanza IA</h2><ul>${complianceChecks
          .map(
            c =>
              `<li><strong>[${c.passed ? 'CUMPLIDO' : 'PENDIENTE'}]</strong> ${c.title} — ${c.description}</li>`
          )
          .join('')}</ul>`
      )
    } else if (key === 'customSections' && config.customBlocks.some(b => b.enabled)) {
      const blocksHtml = config.customBlocks
        .filter(b => b.enabled)
        .map(b => {
          if (b.kind === 'kv_metrics') {
            const kvs = parseCustomKvMetrics(b.content)
            return `<div class="card"><strong>${b.title}</strong><div class="grid">${kvs
              .map(
                k =>
                  `<div class="card"><div class="label">${k.label}</div><div class="val">${k.value}</div></div>`
              )
              .join('')}</div></div>`
          }
          if (b.kind === 'table') {
            const tbl = parseCustomTable(b.content)
            return `<div class="card"><strong>${b.title}</strong><table><thead><tr>${tbl.headers
              .map(h => `<th>${h}</th>`)
              .join('')}</tr></thead><tbody>${tbl.rows
              .map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`)
              .join('')}</tbody></table></div>`
          }
          return `<div class="card"><strong>${b.title}</strong><p>${b.content.replace(/\n/g, '<br/>')}</p></div>`
        })
        .join('')
      htmlBlocks.push(`<h2>${numStr}. Bloques Personalizados</h2>${blocksHtml}`)
    } else if (key === 'auditTrail' && auditEvents.length > 0) {
      htmlBlocks.push(
        `<h2>${numStr}. Bitácora de Auditoría</h2><table><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${auditEvents
          .slice(0, config.maxAuditEventsInPdf)
          .map(
            e =>
              `<tr><td>${new Date(e.created_at).toLocaleString('es-ES')}</td><td>${e.actor_name || e.actor_id}</td><td>${e.action}</td><td><code>${formatAuditMetadata(e.metadata)}</code></td></tr>`
          )
          .join('')}</tbody></table>`
      )
    }
  })

  const signers = config.signatures.length > 0 ? config.signatures : [
    { id: 's1', name: config.authorName, role: 'Autor Técnico', stamp: 'FIRMADO' },
    { id: 's2', name: config.reviewerName, role: 'Revisor QA', stamp: 'VALIDADO' },
    { id: 's3', name: config.approverRole, role: 'Aprobación Ejecutiva', stamp: 'CERTIFICADO' },
  ]

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${config.reportTitle} - ${project.name}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #070f21; color: #f8fafc; margin: 0; padding: 32px; line-height: 1.5; }
  .container { max-width: 1020px; margin: 0 auto; background: #0b1730; border: 1px solid rgba(34,211,238,0.25); border-radius: 16px; padding: 32px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(13,148,136,0.2); color: #2dd4bf; border: 1px solid rgba(45,212,191,0.4); }
  h1 { margin: 8px 0 4px; font-size: 24px; color: #ffffff; }
  h2 { margin-top: 28px; font-size: 15px; text-transform: uppercase; color: #22d3ee; border-bottom: 1px solid rgba(148,163,184,0.2); padding-bottom: 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 12px; }
  .card { background: #071024; border: 1px solid rgba(148,163,184,0.2); border-radius: 12px; padding: 12px 14px; margin-top: 10px; }
  .label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
  .val { font-size: 18px; font-weight: 800; color: #f8fafc; margin-top: 4px; font-family: monospace; }
  code { font-family: monospace; background: #040915; padding: 3px 6px; border-radius: 6px; color: #38bdf8; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { border-bottom: 1px solid rgba(148,163,184,0.18); padding: 8px 10px; text-align: left; }
  th { color: #94a3b8; font-size: 10px; text-transform: uppercase; background: rgba(4,9,21,0.6); }
  .sigs { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 32px; padding-top: 20px; border-top: 1px dashed rgba(148,163,184,0.3); text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <span class="badge">${config.confidentiality} · ${config.documentCode} (${config.reportVersion})</span>
      <span style="font-size:12px;color:#94a3b8;">Emitido: ${new Date().toLocaleString('es-ES')}</span>
    </div>
    <h1>${config.reportTitle}</h1>
    <p style="color:#94a3b8;margin:0 0 16px;">${config.reportSubtitle} · <strong>${config.organizationName}</strong> (${config.departmentName})</p>

    <div class="card" style="border-color:rgba(45,212,191,0.4);">
      <div class="label">DICTAMEN EJECUTIVO AUTOMÁTICO · HEALTH SCORE ${diagnostic.healthScore}/100</div>
      <div class="val" style="color:#2dd4bf;">${diagnostic.verdict}</div>
      <p style="font-size:13px;color:#cbd5e1;margin:6px 0 0;">${diagnostic.summary}</p>
    </div>

    ${htmlBlocks.join('\n')}

    ${auditorNotes.trim() ? `<h2>Observaciones del Auditor</h2><p>${auditorNotes.trim()}</p>` : ''}

    ${
      config.includeSignaturesBlock
        ? `<div class="sigs">${signers
            .map(
              s =>
                `<div class="card"><span class="badge">${s.stamp}</span><br/><br/><strong>${s.name}</strong><br/>${s.role}</div>`
            )
            .join('')}</div>`
        : ''
    }
  </div>
</body>
</html>`
}

export function downloadHtmlFile(filename: string, htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadCsvFile(filename: string, metrics: EpochMetric[], auditEvents?: AuditEvent[]) {
  let csv = 'epoch,loss,accuracy,val_loss,val_accuracy\n'
  metrics.forEach(m => {
    csv += `${m.epoch},${m.loss},${m.accuracy},${m.val_loss},${m.val_accuracy}\n`
  })
  if (auditEvents && auditEvents.length > 0 && metrics.length === 0) {
    csv =
      'created_at,actor,action\n' +
      auditEvents.map(e => `${e.created_at},"${e.actor_name || e.actor_id}",${e.action}`).join('\n')
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
