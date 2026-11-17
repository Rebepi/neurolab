import { useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Play, RotateCcw, Search } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { GLOSSARY_ITEMS, LEARNING_PHASES, NETWORK_FAMILIES } from '../constants'
import { sigmoid } from '../math'

export function FamiliesCatalogTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {NETWORK_FAMILIES.map(fam => (
        <div
          key={fam.id}
          className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-4 hover:border-indigo-500/50 transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-white font-bold text-base">{fam.title}</h4>
              <p className="text-indigo-400 text-xs font-medium mt-0.5">{fam.tag}</p>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${fam.badgeColor}`}>
              {fam.badge}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/75 border border-slate-800/90 rounded-xl p-3">
            {fam.flow.map((stage, idx) => (
              <div key={stage} className="flex items-center gap-1.5">
                <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] font-mono text-cyan-300">
                  {stage}
                </span>
                {idx < fam.flow.length - 1 && <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />}
              </div>
            ))}
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">{fam.desc}</p>

          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 text-xs space-y-2">
            <p className="text-slate-400 font-semibold uppercase tracking-wider">Casos de Uso Empresarial:</p>
            <ul className="space-y-1.5">
              {fam.useCases.map((uc, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{uc}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <strong className="text-slate-300">Insumo compatible:</strong> {fam.inputRule}
          </p>
        </div>
      ))}
    </div>
  )
}

export function LearningCycleTab() {
  const [activePhase, setActivePhase] = useState(0)
  const [simWeight, setSimWeight] = useState(0.4)
  const [stepCount, setStepCount] = useState(0)

  const xInput = 1.0
  const yTarget = 1.0
  const lr = 0.5
  const yPred = sigmoid(simWeight * xInput)
  const loss = 0.5 * (yTarget - yPred) ** 2
  const grad = (yPred - yTarget) * yPred * (1 - yPred) * xInput

  const advanceIteration = () => {
    const nextW = Number((simWeight - lr * grad).toFixed(4))
    setSimWeight(nextW)
    setStepCount(c => c + 1)
    setActivePhase(p => (p + 1) % 4)
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <span>El Ciclo de Aprendizaje de una Red Neuronal</span>
              <InfoTip
                title="Iteración de Entrenamiento"
                text="Haz clic en cada fase o ejecuta iteraciones reales de gradiente descendente para ver cómo el peso se ajusta."
                size="xs"
              />
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Cuatro fases matemáticas consecutivas ejecutadas sobre cada lote durante el entrenamiento
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={advanceIteration}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Simular Paso ({stepCount})
            </button>
            <button
              type="button"
              onClick={() => { setSimWeight(0.4); setStepCount(0); setActivePhase(0) }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-xs flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {LEARNING_PHASES.map((phase, idx) => {
            const isCurrent = activePhase === idx
            return (
              <button
                key={phase.step}
                type="button"
                onClick={() => setActivePhase(idx)}
                className={`text-left rounded-xl p-4 space-y-2 border transition-all ${
                  isCurrent
                    ? 'bg-indigo-950/35 border-indigo-500 shadow-lg shadow-indigo-500/15'
                    : 'bg-slate-950/75 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-indigo-400/80 font-mono">{phase.step}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                    {phase.badge}
                  </span>
                </div>
                <h5 className="text-white font-bold text-sm leading-tight">{phase.title}</h5>
                <div className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800 font-mono text-[11px] text-cyan-300">
                  {phase.formula}
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{phase.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 font-mono text-xs">
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-sans uppercase">Peso Actual (W)</p>
            <p className="text-indigo-300 font-bold text-base mt-0.5">{simWeight.toFixed(4)}</p>
          </div>
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-sans uppercase">Predicción ŷ (Objetivo = 1.0)</p>
            <p className="text-emerald-400 font-bold text-base mt-0.5">{yPred.toFixed(4)}</p>
          </div>
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-sans uppercase">Error Cuadrático (Loss)</p>
            <p className="text-amber-400 font-bold text-base mt-0.5">{loss.toFixed(5)}</p>
          </div>
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-sans uppercase">Gradiente ∂L/∂W</p>
            <p className="text-cyan-400 font-bold text-base mt-0.5">{grad.toFixed(5)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GlossaryTab() {
  const [glossaryQuery, setGlossaryQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos')
  const [expandedGlossary, setExpandedGlossary] = useState<string | null>('neurona')

  const categories = ['Todos', ...Array.from(new Set(GLOSSARY_ITEMS.map(i => i.category)))]

  const filteredGlossary = GLOSSARY_ITEMS.filter(item => {
    const matchesCat = categoryFilter === 'Todos' || item.category === categoryFilter
    const q = glossaryQuery.toLowerCase()
    const matchesQuery =
      !q ||
      item.term.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-lg">Glosario Técnico de Redes Neuronales</h3>
          <p className="text-slate-400 text-xs">Conceptos esenciales de Deep Learning para el equipo de ingeniería</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar término..."
            value={glossaryQuery}
            onChange={e => setGlossaryQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              categoryFilter === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredGlossary.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400 space-y-2">
          <p>No se encontraron términos que coincidan con tu filtro.</p>
          <button
            type="button"
            onClick={() => { setGlossaryQuery(''); setCategoryFilter('Todos') }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredGlossary.map(item => {
            const isExpanded = expandedGlossary === item.id
            return (
              <div key={item.id} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setExpandedGlossary(isExpanded ? null : item.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold text-sm">{item.term}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-medium">
                      {item.category}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-3 pt-2 text-xs text-slate-300 border-t border-slate-800/60 bg-slate-900/20 leading-relaxed">
                      {item.desc}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
