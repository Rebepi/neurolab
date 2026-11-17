import { jsPDF } from 'jspdf'
import {
  Project, Dataset, Architecture, ModelVersion, TrainingJob, AuditEvent, EpochMetric
} from '../types'
import type { ExecutiveDiagnostic } from '../modules/reports/types'

export interface PdfReportOptions {
  sections?: Record<string, boolean>
  auditEvents?: AuditEvent[]
  epochMetrics?: EpochMetric[]
  diagnostic?: ExecutiveDiagnostic
  auditorNotes?: string
  comparisonJob?: TrainingJob | null
}

export function generateProjectPdfReport(
  project: Project,
  dataset?: Dataset,
  architecture?: Architecture,
  model?: ModelVersion,
  job?: TrainingJob,
  options?: PdfReportOptions
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const sections = options?.sections ?? {
    projectContext: true,
    datasetEda: true,
    networkArch: true,
    trainingMetrics: true,
    modelRegistry: true,
    auditTrail: true,
  }

  let pageNumber = 1

  const drawHeader = (isFirst: boolean) => {
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pageWidth, isFirst ? 38 : 20, 'F')
    doc.setFillColor(13, 148, 136)
    doc.rect(0, isFirst ? 38 : 20, pageWidth, 1.5, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isFirst ? 17 : 11)
    doc.text('NEUROLAB ENTERPRISE STUDIO', 14, isFirst ? 16 : 13)

    if (isFirst) {
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text('Informe Ejecutivo de Auditoría, Trazabilidad y Certificación de Modelos Deep Learning', 14, 24)
      doc.text(`Emitido: ${new Date().toLocaleString('es-ES')}   |   Proyecto: ${project.name}`, 14, 31)
    } else {
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(`${project.name} · Continuación`, pageWidth - 14, 13, { align: 'right' })
    }
  }

  const drawFooter = () => {
    doc.setDrawColor(226, 232, 240)
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('NEUROLAB ENTERPRISE · Partición Test (15%) aislada sin fuga de datos', 14, pageHeight - 10)
    doc.text(`Página ${pageNumber}`, pageWidth - 14, pageHeight - 10, { align: 'right' })
  }

  drawHeader(true)
  drawFooter()
  let y = 49

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 22) {
      doc.addPage()
      pageNumber += 1
      drawHeader(false)
      drawFooter()
      y = 30
    }
  }

  const drawSectionTitle = (title: string) => {
    ensureSpace(18)
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(14, y - 5, pageWidth - 28, 9, 1.5, 1.5, 'F')
    doc.setFillColor(13, 148, 136)
    doc.rect(14, y - 5, 2.5, 9, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.text(title, 20, y + 1)
    y += 10
  }

  const writeLine = (label: string, value: string, extraGap = 5.5) => {
    const text = `${label}: ${value}`
    const wrapped = doc.splitTextToSize(text, pageWidth - 32)
    ensureSpace(wrapped.length * 4.8 + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(51, 65, 85)
    doc.text(wrapped, 16, y)
    y += wrapped.length * 4.8 + Math.max(0, extraGap - 4.8)
  }

  if (options?.diagnostic) {
    drawSectionTitle(`DICTAMEN EJECUTIVO: ${options.diagnostic.verdict}`)
    writeLine('Resumen de Salud IA', options.diagnostic.summary)
    options.diagnostic.recommendations.forEach((rec, i) => {
      writeLine(`Recomendación ${i + 1}`, rec, i === options.diagnostic!.recommendations.length - 1 ? 8 : 5)
    })
  }

  if (sections.projectContext !== false) {
    drawSectionTitle('1. CONTEXTO DEL PROYECTO')
    writeLine('Nombre del Workspace', project.name)
    writeLine('ID / Estado', `${project.id}  (${project.status})`)
    writeLine('Miembros Autorizados', `${project.members?.length ?? 1} integrante(s)`)
    if (project.tags?.length) {
      writeLine('Etiquetas', project.tags.map(t => `#${t}`).join('  '))
    }
    writeLine('Descripción Ejecutiva', project.description || 'Sin descripción registrada.', 8)
  }

  if (sections.datasetEda !== false) {
    drawSectionTitle('2. ESPECIFICACIÓN DEL DATASET Y PARTICIÓN EDA')
    if (dataset) {
      writeLine('Dataset Primario', `${dataset.name} (v${dataset.version})`)
      writeLine('Dimensionalidad y Objetivo', `${dataset.input_shape} features de entrada  ->  Target: ${dataset.target}`)
      writeLine('Tipo de Problema', `${dataset.metadata.problem_type}  |  Activación sugerida: ${dataset.metadata.output_activation}`)
      writeLine('Preprocesamiento', `Escalado ${dataset.metadata.scaler_applied} aplicado exclusivamente sobre Train`)
      writeLine(
        'Partición Estratificada',
        `Train 70% (${dataset.splits.train_count})  |  Val 15% (${dataset.splits.val_count})  |  Test Sellado 15% (${dataset.splits.test_count})`,
        8
      )
    } else {
      writeLine('Estado', 'No se ha vinculado un dataset aún.', 8)
    }
  }

  if (sections.networkArch !== false) {
    drawSectionTitle('3. TOPOLOGÍA DE RED NEURONAL')
    if (architecture) {
      writeLine('Arquitectura', `${architecture.name} (v${architecture.version})`)
      writeLine('Familia y Salida', `${architecture.family}  |  ${architecture.config.output_dim} unidad(es) (${architecture.config.output_activation})`)
      writeLine('Capacidad Entrenable', `${architecture.total_parameters.toLocaleString()} parámetros (pesos + sesgos)`)
      const layerFlow = architecture.config.layers
        .map(l => (l.type === 'Dense' ? `Dense(${l.units}, ${l.activation})` : l.type === 'Dropout' ? `Dropout(${l.rate})` : l.type))
        .join(' -> ')
      if (layerFlow) {
        writeLine('Secuencia de Capas', `Input(${architecture.config.input_shape}) -> ${layerFlow}`)
      }
      writeLine('Justificación Técnica', architecture.justification || 'Configuración estándar validada.', 8)
    } else {
      writeLine('Estado', 'Sin arquitectura configurada.', 8)
    }
  }

  if (sections.trainingMetrics !== false) {
    drawSectionTitle('4. RESULTADOS DE ENTRENAMIENTO Y EVALUACIÓN')
    const tm = job?.model_version?.test_metrics ?? model?.test_metrics
    if (job) {
      writeLine('Corrida Evaluada', `${job.id}  |  Estado: ${job.status}  (${job.current_epoch}/${job.total_epochs} épocas)`)
      writeLine(
        'Hiperparámetros',
        `Optimizador: ${job.hyperparams.optimizer.toUpperCase()}  |  LR: ${job.hyperparams.learning_rate}  |  Batch Size: ${job.hyperparams.batch_size}`
      )
    }
    if (tm) {
      writeLine('Exactitud en Test (Sellado)', `${(tm.test_accuracy * 100).toFixed(2)}%   |   Loss Test: ${tm.test_loss.toFixed(4)}`)
      writeLine(
        'Métricas Ponderadas',
        `Precision: ${(tm.precision * 100).toFixed(2)}%  |  Recall: ${(tm.recall * 100).toFixed(2)}%  |  F1-Score: ${(tm.f1_score * 100).toFixed(2)}%`
      )
      if (tm.total_test_samples) {
        writeLine('Muestras de Prueba Evaluadas', `${tm.total_test_samples} registros nunca vistos en entrenamiento`)
      }
    } else if (job) {
      writeLine(
        'Última Métrica Registrada',
        `Loss: ${job.loss != null ? job.loss.toFixed(4) : 'N/A'}  |  Accuracy: ${job.accuracy != null ? (job.accuracy * 100).toFixed(2) + '%' : 'N/A'}`
      )
    } else {
      writeLine('Estado', 'No existen entrenamientos completados aún.')
    }

    if (options?.comparisonJob && options.comparisonJob.id !== job?.id) {
      const baseAcc = job?.model_version?.test_metrics?.test_accuracy ?? job?.accuracy
      const compAcc = options.comparisonJob.model_version?.test_metrics?.test_accuracy ?? options.comparisonJob.accuracy
      if (baseAcc != null && compAcc != null) {
        const delta = (baseAcc - compAcc) * 100
        writeLine(
          'Comparativa vs Referencia',
          `${options.comparisonJob.arch_name || options.comparisonJob.id.slice(0, 8)} (${(compAcc * 100).toFixed(2)}%)  ->  Delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`
        )
      }
    }

    if (options?.epochMetrics && options.epochMetrics.length > 0) {
      const lastEp = options.epochMetrics[options.epochMetrics.length - 1]
      writeLine(
        'Convergencia Última Época',
        `Época ${lastEp.epoch}: train_loss=${lastEp.loss.toFixed(4)}, val_loss=${lastEp.val_loss.toFixed(4)}, val_acc=${(lastEp.val_accuracy * 100).toFixed(2)}%`
      )
    }
    if (model?.confusion_matrix && model.confusion_matrix.length > 0) {
      const cmText = model.confusion_matrix.map((row, r) => `Real ${r}: [${row.join(', ')}]`).join('   ')
      writeLine('Matriz de Confusión (Test)', cmText, 8)
    } else {
      y += 4
    }
  }

  if (sections.modelRegistry !== false) {
    drawSectionTitle('5. MODEL REGISTRY E INTEGRIDAD CRIPTOGRÁFICA')
    if (model) {
      writeLine('Versión Certificada', `${model.version}  (Artefacto Inmutable)`)
      writeLine('Estado de Gobernanza', model.status)
      writeLine('Firma Criptográfica SHA-256', model.checksum)
      writeLine('Fecha de Registro', new Date(model.created_at).toLocaleString('es-ES'), 8)
    } else {
      writeLine('Estado', 'No hay modelos publicados en el Model Registry.', 8)
    }
  }

  if (options?.auditorNotes && options.auditorNotes.trim()) {
    drawSectionTitle('OBSERVACIONES Y CONCLUSIONES DEL AUDITOR')
    writeLine('Notas Técnicas', options.auditorNotes.trim(), 8)
  }

  if (sections.auditTrail && options?.auditEvents) {
    drawSectionTitle('6. BITÁCORA DE AUDITORÍA RECIENTE')
    const slice = options.auditEvents.slice(0, 12)
    if (slice.length === 0) {
      writeLine('Auditoría', 'Sin eventos registrados para este proyecto.', 6)
    } else {
      slice.forEach(evt => {
        const dt = new Date(evt.created_at).toLocaleString('es-ES', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
        writeLine(`${dt} · ${evt.action}`, `Actor: ${evt.actor_name || evt.actor_id}`, 4.5)
      })
    }
  }

  const filename = `Reporte_NeuroLab_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  doc.save(filename)
}
