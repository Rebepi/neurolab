import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type StudioHeroVariant =
  | 'constellation'
  | 'datastream'
  | 'neuralmesh'
  | 'convergence'
  | 'radar'
  | 'vault'
  | 'twin5g'
  | 'synapse'
  | 'executive'
  | 'shield'
  | 'hashchain'
  | 'oscilloscope'

export interface StudioHeroMetric {
  label: string
  value: string | number
  tone?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'teal'
}

export interface ModuleStudioHeroProps {
  variant: StudioHeroVariant
  eyebrow: string
  title: string
  highlight?: string
  subtitle: string
  icon: LucideIcon
  liveBadge?: string
  tipTitle?: string
  tipText?: string
  metrics?: StudioHeroMetric[]
  center?: ReactNode
  actions?: ReactNode
  className?: string
}

const METRIC_TONE: Record<NonNullable<StudioHeroMetric['tone']>, string> = {
  cyan: 'border-cyan-500/35 bg-cyan-500/12 text-cyan-300',
  emerald: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300',
  violet: 'border-violet-500/35 bg-violet-500/12 text-violet-300',
  amber: 'border-amber-500/35 bg-amber-500/12 text-amber-300',
  rose: 'border-rose-500/35 bg-rose-500/12 text-rose-300',
  teal: 'border-teal-500/35 bg-teal-500/12 text-teal-300',
}

export function ModuleStudioHero({
  liveBadge,
  metrics,
  center,
  actions,
  className = '',
}: ModuleStudioHeroProps) {
  if (!liveBadge && (!metrics || metrics.length === 0) && !center && !actions) {
    return null
  }

  return (
    <div
      className={`nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-2.5 flex flex-wrap ${
        center ? 'xl:flex-nowrap' : ''
      } items-center justify-between gap-3 ${className}`}
    >
      {(liveBadge || (metrics && metrics.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 min-w-0 shrink-0">
          {liveBadge && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {liveBadge}
            </span>
          )}

          {metrics && metrics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {metrics.map(m => (
                <span
                  key={m.label}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
                    METRIC_TONE[m.tone || 'cyan']
                  }`}
                >
                  <span className="opacity-80">{m.label}:</span>
                  <strong className="font-extrabold">{m.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {center && (
        <div className="flex-1 min-w-[220px] w-full xl:w-auto">
          {center}
        </div>
      )}

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
