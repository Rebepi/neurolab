import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { useCountUp } from '../hooks/useCountUp'

interface SparklineStatCardProps {
  icon: LucideIcon
  label: string
  value: number
  sublabel: string
  trendPoints: string
  strokeColor: string
  delay?: number
  info?: string
  onClick?: () => void
}

export function SparklineStatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  trendPoints,
  strokeColor,
  delay = 0,
  info,
  onClick,
}: SparklineStatCardProps) {
  const display = useCountUp(value)
  const pts = trendPoints.trim().split(/\s+/)
  const lastPair = (pts[pts.length - 1] || '78,10').split(',')
  const tipX = Number(lastPair[0]) || 78
  const tipY = Number(lastPair[1]) || 10

  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className="nl-surface nl-card-interactive animate-card-reveal rounded-2xl p-5 flex flex-col justify-between gap-3 cursor-pointer group overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span>{label}</span>
            {info && <InfoTip title={label} text={info} size="xs" />}
          </p>
          <p className="text-white text-3xl font-extrabold leading-tight mt-1 font-mono transition-transform duration-200 group-hover:translate-x-0.5">
            {display}
          </p>
        </div>
        <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-200">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 pt-1">
        <p className="text-slate-400 text-xs group-hover:text-indigo-400 transition-colors flex items-center gap-1 font-medium">
          <span>{sublabel}</span>
          <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </p>

        <svg className="w-20 h-7 overflow-visible shrink-0" viewBox="0 0 80 28">
          <polygon
            fill={strokeColor}
            fillOpacity={0.14}
            points={`2,28 ${trendPoints} ${tipX},28`}
          />
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={trendPoints}
            className="animate-spark-draw"
          />
          <circle cx={tipX} cy={tipY} r="4.5" fill={strokeColor} opacity={0.28}>
            <animate attributeName="r" values="3;6.5;3" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={tipX} cy={tipY} r="2.4" fill={strokeColor} />
        </svg>
      </div>
    </div>
  )
}

