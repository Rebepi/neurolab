import { useState } from 'react'
import { Activity, BookOpen, Search, Sliders, Sparkles } from 'lucide-react'
import type { FundamentalsSection } from './math'
import { NeuronSimulatorTab } from './components/NeuronSimulatorTab'
import { ActivationsLabTab } from './components/ActivationsLabTab'
import { FamiliesCatalogTab, GlossaryTab, LearningCycleTab } from './components/ReferenceTabs'

const SECTION_TABS: Array<{ id: FundamentalsSection; label: string; icon: typeof Sliders }> = [
  { id: 'neuron', label: 'Simulador de Neurona', icon: Sliders },
  { id: 'activations', label: 'Funciones de Activación', icon: Activity },
  { id: 'families', label: 'Catálogo de Redes', icon: Sparkles },
  { id: 'learning', label: 'Flujo de Aprendizaje', icon: BookOpen },
  { id: 'glossary', label: 'Glosario Interactivo', icon: Search },
]

export default function FundamentalsModule() {
  const [activeTab, setActiveTab] = useState<FundamentalsSection>('neuron')

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1.5 nl-cyber-panel animate-card-reveal rounded-2xl overflow-x-auto w-full lg:w-fit">
        {SECTION_TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div key={activeTab} className="animate-module-enter">
        {activeTab === 'neuron' && <NeuronSimulatorTab />}
        {activeTab === 'activations' && <ActivationsLabTab />}
        {activeTab === 'families' && <FamiliesCatalogTab />}
        {activeTab === 'learning' && <LearningCycleTab />}
        {activeTab === 'glossary' && <GlossaryTab />}
      </div>
    </div>
  )
}
