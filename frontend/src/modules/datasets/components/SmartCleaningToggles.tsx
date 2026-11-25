import { CalendarClock, Layers, Scale, Split, Type } from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'

interface SmartCleaningTogglesProps {
  normalizeText: boolean
  onChangeNormalizeText: (v: boolean) => void
  extractDates: boolean
  onChangeExtractDates: (v: boolean) => void
  groupRareCategories: boolean
  onChangeGroupRareCategories: (v: boolean) => void
  logTransformSkewed: boolean
  onChangeLogTransformSkewed: (v: boolean) => void
  stratifySplit: boolean
  onChangeStratifySplit: (v: boolean) => void
}

export function SmartCleaningToggles({
  normalizeText,
  onChangeNormalizeText,
  extractDates,
  onChangeExtractDates,
  groupRareCategories,
  onChangeGroupRareCategories,
  logTransformSkewed,
  onChangeLogTransformSkewed,
  stratifySplit,
  onChangeStratifySplit,
}: SmartCleaningTogglesProps) {
  const items = [
    {
      id: 'normalize_text',
      label: 'Reparar formatos y texto',
      sublabel: 'Monedas (S/, $, %) y mayúsculas',
      active: normalizeText,
      onToggle: () => onChangeNormalizeText(!normalizeText),
      icon: Type,
      tipTitle: 'Reparación de Formatos Numéricos y Texto',
      tipText:
        'Convierte columnas guardadas como texto con símbolos (ej. "S/ 1,250.50", "$450", "18%") a números reales y unifica categóricas con espacios o mayúsculas inconsistentes ("lima", "LIMA ").',
      tipHint: 'Evita perder variables monetarias como texto de alta cardinalidad.',
    },
    {
      id: 'extract_dates',
      label: 'Extraer rasgos de fechas',
      sublabel: 'Mes, día y fin de semana',
      active: extractDates,
      onToggle: () => onChangeExtractDates(!extractDates),
      icon: CalendarClock,
      tipTitle: 'Ingeniería Automática de Fechas',
      tipText:
        'Si una columna contiene fechas (ej. "2026-05-14"), extrae automáticamente variables numéricas predictivas (_mes, _dia_semana, _fin_semana) en lugar de descartarla.',
      tipHint: 'Captura estacionalidad y patrones semanales en modelos tabulares.',
    },
    {
      id: 'group_rare',
      label: 'Agrupar categorías raras',
      sublabel: 'Frecuencia < 1% → "Otros"',
      active: groupRareCategories,
      onToggle: () => onChangeGroupRareCategories(!groupRareCategories),
      icon: Layers,
      tipTitle: 'Compactación de Categorías Raras',
      tipText:
        'En variables categóricas con más de 8 niveles, agrupa las categorías poco frecuentes (< 1% de los datos) bajo el nivel "Otros".',
      tipHint: 'Evita explosión de columnas one-hot vacías y reduce el sobreajuste.',
    },
    {
      id: 'log1p',
      label: 'Corregir sesgo (log1p)',
      sublabel: 'Escala logarítmica si skew >= 2',
      active: logTransformSkewed,
      onToggle: () => onChangeLogTransformSkewed(!logTransformSkewed),
      icon: Scale,
      tipTitle: 'Transformación Logarítmica (log1p)',
      tipText:
        'Aplica log(1 + x) antes del escalado a variables positivas muy sesgadas (ej. ingresos, montos de transacción o antigüedad con colas largas).',
      tipHint: 'Mejora la estabilidad numérica durante entrenamiento e inferencia.',
    },
    {
      id: 'stratify',
      label: 'Partición estratificada',
      sublabel: 'Mantiene proporción de clases',
      active: stratifySplit,
      onToggle: () => onChangeStratifySplit(!stratifySplit),
      icon: Split,
      tipTitle: 'División Estratificada (Stratify)',
      tipText:
        'Garantiza que Train, Validación y Test conserven exactamente el mismo porcentaje de casos positivos y negativos en problemas de clasificación.',
      tipHint: 'Esencial cuando la clase objetivo es minoritaria (fraude, fuga, fallas).',
    },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
        <span>Transformaciones Inteligentes (AutoML)</span>
        <InfoTip
          title="Ingeniería de Datos Avanzada"
          text="Reglas avanzadas de limpieza estructural y transformación estadística previas al entrenamiento neuronal."
          side="right"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {items.map(item => {
          const Icon = item.icon
          return (
            <SystemTooltip
              key={item.id}
              title={item.tipTitle}
              label={item.tipText}
              hint={item.tipHint}
              side="top"
              className="flex w-full"
            >
              <button
                type="button"
                onClick={item.onToggle}
                className={`w-full text-left rounded-xl border p-2.5 transition-all flex flex-col justify-between gap-2 ${
                  item.active
                    ? 'bg-teal-500/15 border-teal-400/60 text-teal-100'
                    : 'bg-slate-900/75 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Icon
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      item.active ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold leading-tight">{item.label}</p>
                    <p className="text-[10px] opacity-75 leading-tight mt-0.5">{item.sublabel}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-800/70 w-full">
                  <span className="opacity-70">{item.active ? 'Aplicar' : 'Omitir'}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold ${
                      item.active ? 'bg-teal-400/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.active ? 'SI' : 'NO'}
                  </span>
                </div>
              </button>
            </SystemTooltip>
          )
        })}
      </div>
    </div>
  )
}
