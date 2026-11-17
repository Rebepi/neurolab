import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { EpochMetric } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'

interface LearningCurvesPanelProps {
  metrics: EpochMetric[]
  glassPanelClass: string
}

export function LearningCurvesPanel({ metrics, glassPanelClass }: LearningCurvesPanelProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <span>Curvas de Aprendizaje</span>
        <InfoTip
          title="Curvas Train vs Validación"
          text="Compara la evolución por época sobre entrenamiento (70%) y validación (15%) para detectar subajuste o sobreajuste (overfitting)."
          size="xs"
        />
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${glassPanelClass} p-4`}>
          <p className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-1.5">
            <span>Pérdida (Loss)</span>
            <InfoTip text="Error de predicción minimizado durante el entrenamiento; debe descender de forma convergente." size="xs" />
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="epoch" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="loss" name="Entrenamiento" stroke="#6366f1" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="val_loss" name="Validación" stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={`${glassPanelClass} p-4`}>
          <p className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-1.5">
            <span>Exactitud (Accuracy)</span>
            <InfoTip text="Proporción de aciertos sobre el total de muestras en cada época." size="xs" />
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="epoch" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="accuracy" name="Entrenamiento" stroke="#6366f1" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="val_accuracy" name="Validación" stroke="#10b981" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

