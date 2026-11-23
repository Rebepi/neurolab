import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  FilePlus2,
  Layers,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
} from 'lucide-react'
import type { ReportTemplatePreset, SectionKey } from '../types'
import type { CustomizerTab } from './ReportCustomizationModal'
import { SECTION_META } from '../constants'
import { InfoTip } from '../../../components/InfoTip'

interface ReportBuilderSidebarProps {
  selectedSections: Record<SectionKey, boolean>
  sectionOrder: SectionKey[]
  activePreset: ReportTemplatePreset
  onToggleSection: (key: SectionKey) => void
  onMoveSection: (key: SectionKey, dir: -1 | 1) => void
  onApplyPreset: (preset: ReportTemplatePreset) => void
  onOpenCustomizer: (tab?: CustomizerTab) => void
  customBlocksCount: number
}

const PRESETS: Array<{ id: ReportTemplatePreset; label: string; desc: string }> = [
  { id: 'executive', label: 'Ejecutivo (7/12)', desc: 'Contexto, Datos, Red, ROI y Firmas' },
  { id: 'technical', label: 'Técnico QA', desc: 'EDA, Diccionario, Capas y Épocas' },
  { id: 'compliance', label: 'Auditoría ISO', desc: 'Registry, Checklist y Bitácora' },
  { id: 'full', label: 'Completo (12/12)', desc: 'Todas las secciones y auditoría' },
]

export function ReportBuilderSidebar({
  selectedSections,
  sectionOrder,
  activePreset,
  onToggleSection,
  onMoveSection,
  onApplyPreset,
  onOpenCustomizer,
  customBlocksCount,
}: ReportBuilderSidebarProps) {
  const activeCount = Object.values(selectedSections).filter(Boolean).length

  return (
    <aside className="lg:col-span-4 xl:col-span-3 nl-cyber-panel animate-card-reveal nl-no-print rounded-2xl p-4 flex flex-col gap-3 lg:self-start lg:max-h-full lg:min-h-0 lg:overflow-hidden">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Constructor Modular</span>
          <InfoTip
            text="Activa, desactiva o reordena con ↑ ↓ las 12 secciones del informe. Todo se refleja en el PDF y la vista previa."
            size="xs"
          />
        </h2>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-[10.5px] font-bold">
          {activeCount}/{SECTION_META.length}
        </span>
      </div>

      <div className="space-y-1.5 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Plantillas</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenCustomizer('blocks')}
              className="text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5"
            >
              <FilePlus2 className="w-3 h-3" />
              <span>+ Bloque ({customBlocksCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCustomizer('identity')}
              className="text-amber-300 hover:text-amber-200 flex items-center gap-0.5"
            >
              <Sliders className="w-3 h-3" />
              <span>Ajustar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map(p => {
            const isSel = activePreset === p.id
            return (
              <button
                key={p.id}
                type="button"
                title={p.desc}
                onClick={() => onApplyPreset(p.id)}
                className={`px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                  isSel
                    ? 'bg-cyan-500/15 border-cyan-400/50 text-white shadow-sm'
                    : 'bg-slate-950/75 hover:bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <p className="text-[11px] font-bold truncate">{p.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 pt-2 border-t border-slate-800/80">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 shrink-0">
          Secciones del PDF ({activeCount} activas)
        </p>

        <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-0.5">
          {sectionOrder.map((key, idx) => {
          const sec = SECTION_META.find(s => s.key === key)
          if (!sec) return null
          const checked = selectedSections[sec.key]
          const Icon = sec.Icon
          const dynamicNum = String(idx + 1).padStart(2, '0')
          return (
            <div
              key={sec.key}
              role="button"
              tabIndex={0}
              title={sec.desc}
              onClick={() => onToggleSection(sec.key)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onToggleSection(sec.key)
                }
              }}
              className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-xl text-left border transition-all cursor-pointer ${
                checked
                  ? `bg-slate-950/90 ${sec.activeBoxCls} text-white`
                  : 'bg-slate-900/35 border-slate-800/75 text-slate-400 hover:bg-slate-900/75 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${sec.colorCls}`}
              >
                <Icon className="w-3 h-3" />
              </div>

              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <span className="text-[9.5px] font-mono text-slate-500 font-bold shrink-0">
                  {dynamicNum}
                </span>
                <span className="text-[11px] font-semibold truncate">{sec.label}</span>
              </div>

              <div
                className="flex items-center gap-0.5 shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onMoveSection(sec.key, -1)}
                  className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-25"
                  title="Subir sección"
                >
                  <ArrowUp className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === sectionOrder.length - 1}
                  onClick={() => onMoveSection(sec.key, 1)}
                  className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-25"
                  title="Bajar sección"
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                </button>
              </div>

              <div className="shrink-0">
                {checked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-600" />
                )}
              </div>
            </div>
          )
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-[10.5px] text-emerald-400 font-semibold shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Test (15%) aislado y verificado</span>
      </div>
    </aside>
  )
}
