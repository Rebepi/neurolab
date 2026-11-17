import type {
  Project, Dataset, Architecture, TrainingJob, ModelVersion, AuditEvent, EpochMetric, TestMetrics
} from '../../types/index'
import type { ExecutiveDiagnostic, SectionKey } from './types'

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

export function computeExecutiveDiagnostic(
  metrics: TestMetrics | null,
  job: TrainingJob | null,
  epochMetrics: EpochMetric[]
): ExecutiveDiagnostic {
  const acc = metrics?.test_accuracy ?? job?.accuracy ?? null
  const f1 = metrics?.f1_score ?? null
  const lastEp = epochMetrics.length > 0 ? epochMetrics[epochMetrics.length - 1] : null
  const overfitGap = lastEp ? lastEp.val_loss - lastEp.loss : null

  if (acc == null) {
    return {
      verdict: 'PENDIENTE DE EVALUACIÓN',
      tone: 'neutral',
      summary: 'Aún no existen métricas completadas para emitir un dictamen técnico automático.',
      recommendations: [
        'Ejecuta al menos un entrenamiento completo sobre el dataset procesado.',
        'Verifica la compatibilidad de entrada entre el dataset y la arquitectura seleccionada.',
      ],
      overfitGap: null,
    }
  }

  const recommendations: string[] = []
  let tone: ExecutiveDiagnostic['tone'] = 'optimal'
  let verdict = 'APTO PARA PRODUCCIÓN'

  if (overfitGap != null && overfitGap > 0.12) {
    tone = 'warning'
    verdict = 'POSIBLE SOBREAJUSTE DETECTADO'
    recommendations.push(
      `La pérdida de validación supera en +${overfitGap.toFixed(3)} a la de entrenamiento; considera añadir capas Dropout o reducir épocas.`
    )
  }

  if (acc < 0.65) {
    tone = 'critical'
    verdict = 'REQUIERE REENTRENAMIENTO'
    recommendations.push(
      'La exactitud en Test está por debajo del umbral operativo (65%). Prueba aumentar neuronas ocultas o ajustar el Learning Rate.'
    )
  } else if (acc < 0.8) {
    if (tone === 'optimal') {
      tone = 'warning'
      verdict = 'DESEMPEÑO MODERADO (REVISIÓN)'
    }
    recommendations.push(
      'Rendimiento aceptable pero optimizable mediante ajuste de hiperparámetros (Adam lr=0.001) o ingeniería de características.'
    )
  } else {
    recommendations.push(
      'Alta capacidad de generalización verificada sobre la partición de Test sellada (15%).'
    )
  }

  if (f1 != null && f1 + 0.08 < acc) {
    if (tone === 'optimal') {
      tone = 'warning'
      verdict = 'REVISAR DESBALANCE DE CLASES'
    }
    recommendations.push(
      `Brecha entre Accuracy (${(acc * 100).toFixed(1)}%) y F1-Score (${(f1 * 100).toFixed(1)}%); evalúa balanceo o umbral de decisión.`
    )
  }

  if (recommendations.length === 1 && tone === 'optimal') {
    recommendations.push('Sin signos significativos de overfitting; artefacto listo para certificación en Model Registry.')
  }

  const summary = `Exactitud consolidada de ${(acc * 100).toFixed(2)}%${
    f1 != null ? ` con F1-Score de ${(f1 * 100).toFixed(2)}%` : ''
  }${overfitGap != null ? ` y brecha Val-Train Loss de ${overfitGap >= 0 ? '+' : ''}${overfitGap.toFixed(4)}` : ''}.`

  return { verdict, tone, summary, recommendations, overfitGap }
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
}) {
  const { project, dataset, architecture, job, model, metrics, diagnostic, auditorNotes, sections } = params
  const lines: string[] = [
    `# Reporte Ejecutivo — ${project.name}`,
    `Generado: ${new Date().toLocaleString('es-ES')}`,
    `**Veredicto:** ${diagnostic.verdict} — ${diagnostic.summary}`,
    '',
  ]

  if (sections.projectContext) {
    lines.push(
      '## 1. Contexto del Proyecto',
      `- **Estado:** ${project.status} | **ID:** \`${project.id}\``,
      `- **Descripción:** ${project.description || 'Sin descripción'}`,
      ''
    )
  }

  if (sections.datasetEda && dataset) {
    lines.push(
      '## 2. Dataset y Partición EDA',
      `- **Dataset:** ${dataset.name} (v${dataset.version})`,
      `- **Features:** ${dataset.input_shape} → **Target:** \`${dataset.target}\``,
      `- **Splits (70/15/15):** Train ${dataset.splits.train_count} / Val ${dataset.splits.val_count} / Test Sellado ${dataset.splits.test_count}`,
      ''
    )
  }

  if (sections.networkArch && architecture) {
    lines.push(
      '## 3. Arquitectura de Red Neuronal',
      `- **Nombre:** ${architecture.name} (v${architecture.version}) · ${architecture.family}`,
      `- **Parámetros Entrenables:** ${architecture.total_parameters.toLocaleString('es')}`,
      ''
    )
  }

  if (sections.trainingMetrics && (metrics || job)) {
    const acc = metrics?.test_accuracy ?? job?.accuracy
    const loss = metrics?.test_loss ?? job?.loss
    lines.push(
      '## 4. Evaluación y Métricas',
      `- **Exactitud Test:** ${acc != null ? `${(acc * 100).toFixed(2)}%` : '—'} | **Loss:** ${loss != null ? loss.toFixed(4) : '—'}`,
      `- **Precision / Recall / F1:** ${
        metrics
          ? `${(metrics.precision * 100).toFixed(2)}% / ${(metrics.recall * 100).toFixed(2)}% / ${(metrics.f1_score * 100).toFixed(2)}%`
          : '—'
      }`,
      ''
    )
  }

  if (sections.modelRegistry && model) {
    lines.push(
      '## 5. Model Registry e Integridad',
      `- **Versión:** ${model.version} (${model.status})`,
      `- **SHA-256:** \`${model.checksum}\``,
      ''
    )
  }

  if (auditorNotes.trim()) {
    lines.push('## Observaciones del Auditor', auditorNotes.trim(), '')
  }

  return lines.join('\n')
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
    csv = 'created_at,actor,action\n' + auditEvents.map(e => `${e.created_at},"${e.actor_name || e.actor_id}",${e.action}`).join('\n')
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

