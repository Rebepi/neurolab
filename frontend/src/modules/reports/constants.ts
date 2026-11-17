import { FileText, Database, Layers, Activity, Package, ScrollText } from 'lucide-react'
import type { SectionKey } from './types'

export const SECTION_META: Array<{ key: SectionKey; label: string; desc: string; Icon: any }> = [
  { key: 'projectContext', label: 'Contexto del Proyecto', desc: 'Identidad, equipo y alcance', Icon: FileText },
  { key: 'datasetEda', label: 'Dataset y Partición EDA', desc: 'Splits 70/15/15 y escalado', Icon: Database },
  { key: 'networkArch', label: 'Topología de Red', desc: 'Capas, activaciones y parámetros', Icon: Layers },
  { key: 'trainingMetrics', label: 'Métricas y Comparativa', desc: 'Test sellado, curvas y deltas', Icon: Activity },
  { key: 'modelRegistry', label: 'Model Registry y SHA-256', desc: 'Inmutabilidad y firma digital', Icon: Package },
  { key: 'auditTrail', label: 'Bitácora de Auditoría', desc: 'Trazabilidad cronológica RBAC', Icon: ScrollText },
]

export const ACTION_BADGE: Record<string, string> = {
  PROJECT_CREATED: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  DATASET_UPLOADED: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  ARCHITECTURE_CREATED: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  TRAINING_QUEUED: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  TRAINING_COMPLETED: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  TRAINING_FAILED: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  MODEL_STATUS_CHANGED: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
}

