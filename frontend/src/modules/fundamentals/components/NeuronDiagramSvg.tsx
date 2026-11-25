import type { NeuronActivation } from '../math'

interface NeuronDiagramSvgProps {
  x1: number
  x2: number
  w1: number
  w2: number
  bias: number
  z: number
  activationOutput: number
  neuronActivation: NeuronActivation
  isFired: boolean
}

export function NeuronDiagramSvg({
  x1,
  x2,
  w1,
  w2,
  bias,
  z,
  activationOutput,
  neuronActivation,
  isFired,
}: NeuronDiagramSvgProps) {
  const c1Color = w1 >= 0 ? '#10b981' : '#f43f5e'
  const c2Color = w2 >= 0 ? '#10b981' : '#f43f5e'
  const w1Width = Math.min(5.5, Math.max(1.8, Math.abs(w1) * 1.9))
  const w2Width = Math.min(5.5, Math.max(1.8, Math.abs(w2) * 1.9))
  const outIntensity = Math.min(1, Math.max(0.15, Math.abs(activationOutput)))
  const outWidth = Math.min(6, Math.max(2, outIntensity * 5.2))

  const p1 = 'M 118 82 C 205 82, 235 148, 305 148'
  const p2 = 'M 118 216 C 205 216, 235 156, 305 156'
  const pOut = 'M 397 152 L 502 152'

  return (
    <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800/90 shadow-inner">
      <svg viewBox="0 0 640 280" className="w-full h-auto block">
        <defs>
          <pattern id="neuron-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.6" strokeOpacity="0.6" />
          </pattern>
          <radialGradient id="soma-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isFired ? '#6366f1' : '#334155'} stopOpacity={isFired ? 0.55 : 0.2} />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="640" height="280" rx="12" fill="url(#neuron-grid)" />

        <circle cx="350" cy="152" r="88" fill="url(#soma-glow)" />

        <path d={p1} fill="none" stroke={c1Color} strokeWidth={w1Width} strokeOpacity="0.82" strokeLinecap="round" />
        <path d={p2} fill="none" stroke={c2Color} strokeWidth={w2Width} strokeOpacity="0.82" strokeLinecap="round" />
        <path d={pOut} fill="none" stroke={isFired ? '#2dd4bf' : '#818cf8'} strokeWidth={outWidth} strokeOpacity="0.9" strokeLinecap="round" />

        <line x1="350" y1="54" x2="350" y2="104" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.85" />

        <circle r="4.5" fill={w1 >= 0 ? '#34d399' : '#fb7185'} opacity="0.95">
          <animateMotion dur="1.7s" repeatCount="indefinite" path={p1} />
        </circle>
        <circle r="4.5" fill={w2 >= 0 ? '#34d399' : '#fb7185'} opacity="0.95">
          <animateMotion dur="2.1s" repeatCount="indefinite" path={p2} />
        </circle>
        <circle r={isFired ? 5 : 3.5} fill={isFired ? '#2dd4bf' : '#818cf8'} opacity={isFired ? 0.98 : 0.6}>
          <animateMotion dur={isFired ? '1.0s' : '1.9s'} repeatCount="indefinite" path={pOut} />
        </circle>

        <g transform="translate(88, 82)">
          <circle r="30" fill="#0c172e" stroke="#38bdf8" strokeWidth="2.5" />
          <text y="-7" textAnchor="middle" fill="#94a3b8" fontSize="10.5" fontWeight="600">Entrada x₁</text>
          <text y="11" textAnchor="middle" fill="#f8fafc" fontWeight="700" fontSize="13" fontFamily="monospace">
            {x1.toFixed(2)}
          </text>
        </g>

        <g transform="translate(88, 216)">
          <circle r="30" fill="#0c172e" stroke="#38bdf8" strokeWidth="2.5" />
          <text y="-7" textAnchor="middle" fill="#94a3b8" fontSize="10.5" fontWeight="600">Entrada x₂</text>
          <text y="11" textAnchor="middle" fill="#f8fafc" fontWeight="700" fontSize="13" fontFamily="monospace">
            {x2.toFixed(2)}
          </text>
        </g>

        <g transform="translate(212, 92)">
          <rect x="-42" y="-12" width="84" height="24" rx="6" fill="#0c172e" stroke={c1Color} strokeWidth="1.2" strokeOpacity="0.65" />
          <text y="4" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600" fontFamily="monospace">
            w₁ = {w1.toFixed(2)}
          </text>
        </g>

        <g transform="translate(212, 206)">
          <rect x="-42" y="-12" width="84" height="24" rx="6" fill="#0c172e" stroke={c2Color} strokeWidth="1.2" strokeOpacity="0.65" />
          <text y="4" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600" fontFamily="monospace">
            w₂ = {w2.toFixed(2)}
          </text>
        </g>

        <g transform="translate(350, 36)">
          <rect x="-46" y="-16" width="92" height="32" rx="16" fill="#1e1b4b" stroke="#fbbf24" strokeWidth="1.5" />
          <text y="-2" textAnchor="middle" fill="#fde68a" fontSize="9" fontWeight="600">Sesgo (Bias b)</text>
          <text y="11" textAnchor="middle" fill="#fbbf24" fontWeight="700" fontSize="11.5" fontFamily="monospace">
            {bias >= 0 ? `+${bias.toFixed(2)}` : bias.toFixed(2)}
          </text>
        </g>

        <g transform="translate(350, 152)">
          <circle
            r="46"
            fill={isFired ? '#312e81' : '#1e1b4b'}
            stroke={isFired ? '#818cf8' : '#4f46e5'}
            strokeWidth="3"
          />
          <text y="-15" textAnchor="middle" fill="#a5b4fc" fontSize="9.5" fontWeight="600">
            Σ (wᵢ·xᵢ) + b
          </text>
          <text y="4" textAnchor="middle" fill="#ffffff" fontWeight="700" fontSize="14.5" fontFamily="monospace">
            z = {z.toFixed(2)}
          </text>
          <text y="22" textAnchor="middle" fill="#c4b5fd" fontSize="9.5" fontWeight="600">
            f: {neuronActivation.toUpperCase()}
          </text>
        </g>

        <g transform="translate(544, 152)">
          <circle
            r="38"
            fill="#0c172e"
            stroke={isFired ? '#2dd4bf' : '#a855f7'}
            strokeWidth="3"
          />
          <text y="-10" textAnchor="middle" fill="#d8b4fe" fontSize="10" fontWeight="600">Salida a</text>
          <text y="10" textAnchor="middle" fill="#ffffff" fontWeight="700" fontSize="15" fontFamily="monospace">
            {activationOutput.toFixed(3)}
          </text>
          <text y="25" textAnchor="middle" fill={isFired ? '#34d399' : '#94a3b8'} fontSize="8.5" fontWeight="600">
            {isFired ? 'ACTIVA' : 'REPOSO'}
          </text>
        </g>
      </svg>
    </div>
  )
}

