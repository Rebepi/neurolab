import type { Dataset, LayerSpec } from '../../types/index'

export interface LayerParamBreakdown {
  layerIndex: number
  type: string
  inShape: number
  outShape: number
  weights: number
  biases: number
  total: number
}

export interface LayerDecisionReason {
  id: string
  layerIndex: number | null
  role: 'input' | 'hidden' | 'output'
  title: string
  specBadge: string
  reason: string
}

export interface DatasetAnalysisSignals {
  features: number
  trainRows: number
  totalRows: number
  numericCols: number
  categoricalCols: number
  missingCells: number
  oneHotExpansion: number
  minorityPct: number | null
  problemLabel: string
  scalerApplied: string
  lossName: string
  candidatesEvaluated: number
  chosenParams: number
  samplesPerParam: number | null
}

export interface RecommendedArchitecture {
  name: string
  family: 'Feedforward'
  justification: string
  layers: LayerSpec[]
  tierLabel: string
  summary: string
  signals: DatasetAnalysisSignals
  layerReasons: LayerDecisionReason[]
}

export interface ArchitectureHealth {
  status: 'optimal' | 'acceptable' | 'improvable'
  label: string
  samplesPerParam: number | null
  hasRegularization: boolean
  notes: string[]
}

export function createLayerId(): string {
  return 'l-' + Math.random().toString(36).slice(2, 9)
}

export function areLayersEquivalent(a: LayerSpec[], b: LayerSpec[]): boolean {
  if (a.length !== b.length) return false
  return a.every((la, idx) => {
    const lb = b[idx]
    if (!lb || la.type !== lb.type) return false
    if (la.type === 'Dense') {
      return (
        (la.units ?? 32) === (lb.units ?? 32) &&
        (la.activation ?? 'relu') === (lb.activation ?? 'relu') &&
        (la.use_bias !== false) === (lb.use_bias !== false)
      )
    }
    if (la.type === 'Conv1D') {
      return (
        (la.filters ?? 32) === (lb.filters ?? 32) &&
        (la.kernel_size ?? 3) === (lb.kernel_size ?? 3) &&
        (la.padding ?? 'same') === (lb.padding ?? 'same')
      )
    }
    if (la.type === 'MaxPooling1D') {
      return (la.pool_size ?? 2) === (lb.pool_size ?? 2)
    }
    if (la.type === 'LSTM' || la.type === 'GRU') {
      return (la.units ?? 32) === (lb.units ?? 32)
    }
    if (la.type === 'Dropout') {
      return Math.abs((la.rate ?? 0.2) - (lb.rate ?? 0.2)) < 0.001
    }
    return true
  })
}

export function computeArchitectureParams(
  layers: LayerSpec[],
  inputShape: number,
  outputDim: number,
  family: 'Feedforward' | 'RNN' | 'CNN' | 'GAN' = 'Feedforward'
): {
  total: number
  breakdown: LayerParamBreakdown[]
} {
  let isSeq = family === 'CNN' || family === 'RNN'
  let seqLen = inputShape
  let channels = 1
  let currentIn = inputShape
  let total = 0
  const breakdown: LayerParamBreakdown[] = []

  layers.forEach((layer, idx) => {
    if (layer.type === 'Conv1D') {
      const filters = layer.filters ?? layer.units ?? 32
      const kernel = Math.max(1, Math.min(layer.kernel_size ?? 3, seqLen))
      const w = kernel * channels * filters
      const b = layer.use_bias !== false ? filters : 0
      const layerTotal = w + b
      const inFlat = seqLen * channels
      channels = filters
      if ((layer.padding ?? 'same') === 'valid') {
        seqLen = Math.max(1, seqLen - kernel + 1)
      }
      isSeq = true
      currentIn = seqLen * channels
      total += layerTotal
      breakdown.push({
        layerIndex: idx + 1,
        type: 'Conv1D',
        inShape: inFlat,
        outShape: currentIn,
        weights: w,
        biases: b,
        total: layerTotal,
      })
    } else if (layer.type === 'MaxPooling1D') {
      const inFlat = seqLen * channels
      const pool = Math.max(1, layer.pool_size ?? 2)
      seqLen = Math.max(1, Math.floor(seqLen / pool))
      currentIn = seqLen * channels
      breakdown.push({
        layerIndex: idx + 1,
        type: 'MaxPooling1D',
        inShape: inFlat,
        outShape: currentIn,
        weights: 0,
        biases: 0,
        total: 0,
      })
    } else if (layer.type === 'Flatten') {
      const flatDim = seqLen * channels
      isSeq = false
      currentIn = flatDim
      breakdown.push({
        layerIndex: idx + 1,
        type: 'Flatten',
        inShape: flatDim,
        outShape: flatDim,
        weights: 0,
        biases: 0,
        total: 0,
      })
    } else if (layer.type === 'LSTM' || layer.type === 'GRU') {
      const units = layer.units ?? 32
      const gates = layer.type === 'LSTM' ? 4 : 3
      const w = gates * (channels + units) * units
      const b = gates * units
      const layerTotal = w + b
      const inFlat = isSeq ? seqLen * channels : currentIn
      const hasNextRnn = layers.slice(idx + 1).some(n => n.type === 'LSTM' || n.type === 'GRU')
      if (hasNextRnn) {
        channels = units
        isSeq = true
        currentIn = seqLen * channels
      } else {
        isSeq = false
        currentIn = units
      }
      total += layerTotal
      breakdown.push({
        layerIndex: idx + 1,
        type: layer.type,
        inShape: inFlat,
        outShape: currentIn,
        weights: w,
        biases: b,
        total: layerTotal,
      })
    } else if (layer.type === 'Dense' && layer.units) {
      if (isSeq) {
        currentIn = seqLen * channels
        isSeq = false
      }
      const w = currentIn * layer.units
      const b = layer.use_bias !== false ? layer.units : 0
      const layerTotal = w + b
      total += layerTotal
      breakdown.push({
        layerIndex: idx + 1,
        type: 'Dense',
        inShape: currentIn,
        outShape: layer.units,
        weights: w,
        biases: b,
        total: layerTotal,
      })
      currentIn = layer.units
    } else if (layer.type === 'BatchNormalization') {
      const dimRef = isSeq ? channels : currentIn
      const layerTotal = 4 * dimRef
      total += layerTotal
      breakdown.push({
        layerIndex: idx + 1,
        type: 'BatchNormalization',
        inShape: currentIn,
        outShape: currentIn,
        weights: 2 * dimRef,
        biases: 2 * dimRef,
        total: layerTotal,
      })
    } else if (layer.type === 'Dropout') {
      breakdown.push({
        layerIndex: idx + 1,
        type: 'Dropout',
        inShape: currentIn,
        outShape: currentIn,
        weights: 0,
        biases: 0,
        total: 0,
      })
    }
  })

  if (isSeq) {
    currentIn = seqLen * channels
  }
  const outW = currentIn * outputDim
  const outB = outputDim
  const outTotal = outW + outB
  total += outTotal
  breakdown.push({
    layerIndex: layers.length + 1,
    type: 'Salida (Dense)',
    inShape: currentIn,
    outShape: outputDim,
    weights: outW,
    biases: outB,
    total: outTotal,
  })

  return { total, breakdown }
}

export function buildKerasPythonCode(
  inputShape: number,
  layersList: LayerSpec[],
  outputDim: number,
  outputActivation: string,
  family: 'Feedforward' | 'RNN' | 'CNN' | 'GAN' = 'Feedforward'
): string {
  const lossName = outputActivation === 'sigmoid'
    ? 'binary_crossentropy'
    : outputActivation === 'softmax'
      ? 'sparse_categorical_crossentropy'
      : 'mean_squared_error'

  const needsSeqReshape =
    (family === 'CNN' || family === 'RNN') &&
    layersList.some(l => ['Conv1D', 'MaxPooling1D', 'LSTM', 'GRU'].includes(l.type))

  let isSeq = needsSeqReshape
  const lines: string[] = []
  if (needsSeqReshape) {
    lines.push(`        layers.Reshape((${inputShape}, 1)),`)
  }

  layersList.forEach((l, idx) => {
    if (l.type === 'Conv1D') {
      if (!isSeq) {
        lines.push(`        layers.Reshape((${inputShape}, 1)),`)
        isSeq = true
      }
      lines.push(
        `        layers.Conv1D(filters=${l.filters ?? 32}, kernel_size=${l.kernel_size ?? 3}, padding='${l.padding ?? 'same'}', activation='${l.activation ?? 'relu'}'),`
      )
    } else if (l.type === 'MaxPooling1D') {
      lines.push(`        layers.MaxPooling1D(pool_size=${l.pool_size ?? 2}),`)
    } else if (l.type === 'Flatten') {
      lines.push(`        layers.Flatten(),`)
      isSeq = false
    } else if (l.type === 'LSTM' || l.type === 'GRU') {
      if (!isSeq) {
        lines.push(`        layers.Reshape((${inputShape}, 1)),`)
        isSeq = true
      }
      const hasNextRnn = layersList.slice(idx + 1).some(n => n.type === 'LSTM' || n.type === 'GRU')
      lines.push(
        `        layers.${l.type}(${l.units ?? 32}, return_sequences=${hasNextRnn ? 'True' : 'False'}),`
      )
      isSeq = hasNextRnn
    } else if (l.type === 'Dense') {
      if (isSeq) {
        lines.push(`        layers.Flatten(),`)
        isSeq = false
      }
      if (family === 'GAN' && (l.activation ?? 'relu') === 'relu') {
        lines.push(`        layers.Dense(${l.units}, use_bias=${l.use_bias !== false ? 'True' : 'False'}),`)
        lines.push(`        layers.LeakyReLU(negative_slope=0.2),`)
      } else {
        lines.push(`        layers.Dense(${l.units}, activation='${l.activation}', use_bias=${l.use_bias !== false ? 'True' : 'False'}),`)
      }
    } else if (l.type === 'Dropout') {
      lines.push(`        layers.Dropout(${l.rate}),`)
    } else {
      lines.push(`        layers.BatchNormalization(),`)
    }
  })

  if (isSeq) {
    lines.push(`        layers.Flatten(),`)
  }

  const hiddenLines = lines.join('\n')

  return `import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

def create_model():
    model = keras.Sequential([
        keras.Input(shape=(${inputShape},)),
${hiddenLines}
        layers.Dense(${outputDim}, activation='${outputActivation}')
    ])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='${lossName}',
        metrics=['accuracy']
    )
    return model

if __name__ == '__main__':
    model = create_model()
    model.summary()
`
}

export function recommendOptimalArchitecture(
  dataset: Dataset | null,
  fallbackInput: number,
  fallbackOutput: number,
  fallbackActivation: string
): RecommendedArchitecture {
  const features = dataset?.input_shape ?? fallbackInput
  const outDim = dataset?.metadata?.output_dim ?? fallbackOutput
  const outAct = dataset?.metadata?.output_activation ?? fallbackActivation
  const problemType =
    dataset?.metadata?.problem_type ??
    (outAct === 'softmax'
      ? 'multiclass_classification'
      : outAct === 'linear'
        ? 'regression'
        : 'binary_classification')
  const problemLabel =
    problemType === 'regression'
      ? 'Regresión continua'
      : problemType === 'multiclass_classification'
        ? 'Clasificación multiclase'
        : 'Clasificación binaria'
  const totalRows = dataset?.metadata?.total_rows ?? 0
  const trainRows =
    dataset?.splits?.train_count ??
    dataset?.metadata?.splits?.train_count ??
    Math.round(totalRows * 0.7)
  const targetColumn = dataset?.target ?? dataset?.metadata?.target_column ?? 'objetivo'
  const scalerApplied = dataset?.metadata?.scaler_applied ?? 'StandardScaler'
  const lossName =
    dataset?.metadata?.suggested_loss ??
    (outAct === 'sigmoid'
      ? 'binary_crossentropy'
      : outAct === 'softmax'
        ? 'sparse_categorical_crossentropy'
        : 'mean_squared_error')

  const summaryCols = dataset?.metadata?.columns_summary ?? []
  const activeFeatureCols = summaryCols.filter(c => !c.is_target && !c.excluded_reason)
  const numericCols = activeFeatureCols.filter(c => c.dtype === 'numeric').length
  const categoricalCols = activeFeatureCols.filter(c => c.dtype === 'categorical').length
  const missingCells = activeFeatureCols.reduce((acc, c) => acc + (c.missing || 0), 0)
  const oneHotExpansion = Math.max(0, features - (numericCols + categoricalCols))

  const positiveStds = activeFeatureCols
    .filter(c => c.dtype === 'numeric' && typeof c.std === 'number' && c.std > 0.0001)
    .map(c => c.std as number)
  const scaleSpread =
    positiveStds.length >= 2
      ? Math.max(...positiveStds) / Math.max(0.0001, Math.min(...positiveStds))
      : 1

  let minorityPct: number | null = null
  const targetColMeta = summaryCols.find(c => c.is_target || c.name === targetColumn)
  if (problemType !== 'regression' && targetColMeta?.top_values) {
    const counts = Object.values(targetColMeta.top_values).filter(v => v > 0)
    const sumCounts = counts.reduce((s, v) => s + v, 0)
    if (counts.length >= 2 && sumCounts > 0) {
      minorityPct = Number(((Math.min(...counts) / sumCounts) * 100).toFixed(1))
    }
  }

  const isImbalanced = minorityPct !== null && minorityPct < 30
  const useBatchNorm =
    features >= 10 || categoricalCols >= 2 || scaleSpread >= 10 || oneHotExpansion >= 3

  const dropPrimary =
    problemType === 'regression'
      ? trainRows > 0 && trainRows < 2500
        ? 0.15
        : 0.1
      : isImbalanced || (trainRows > 0 && trainRows < 2500)
        ? 0.25
        : trainRows >= 12000
          ? 0.15
          : 0.2
  const dropSecondary = Math.max(0.1, Number((dropPrimary - 0.05).toFixed(2)))

  const candidates: number[][] = [
    [24, 12],
    [32, 16],
    [48, 24],
    [48, 24, 12],
    [64, 32],
    [64, 32, 16],
    [96, 48, 24],
    [128, 64, 32],
  ]

  const buildCandidateLayers = (widths: number[]): LayerSpec[] => {
    const built: LayerSpec[] = []
    widths.forEach((w, wi) => {
      const attachBn =
        (wi === 0 && useBatchNorm) ||
        (wi === 1 && widths.length === 3 && useBatchNorm && trainRows >= 8000)

      built.push({
        id: createLayerId(),
        type: 'Dense',
        units: w,
        activation: 'relu',
        use_bias: !attachBn,
      })

      if (attachBn) {
        built.push({ id: createLayerId(), type: 'BatchNormalization' })
      }
      if (wi === 0) {
        built.push({ id: createLayerId(), type: 'Dropout', rate: dropPrimary })
      } else if (wi === 1 && widths.length === 3) {
        built.push({ id: createLayerId(), type: 'Dropout', rate: dropSecondary })
      }
    })
    return built
  }

  const minOutFloor = Math.max(8, outDim * 2)
  const evaluated = candidates.map(widths => {
    const layers = buildCandidateLayers(widths)
    const params = computeArchitectureParams(layers, features, outDim).total
    const ratio = trainRows > 0 ? trainRows / Math.max(1, params) : 2.0
    const lastW = widths[widths.length - 1]
    const validCapacity = lastW >= minOutFloor
    return { widths, layers, params, ratio, validCapacity }
  })

  const healthyPool = evaluated.filter(
    c => c.validCapacity && (trainRows === 0 || c.ratio >= 1.25)
  )

  let chosen = evaluated[0]
  if (healthyPool.length > 0) {
    if (trainRows === 0) {
      chosen = healthyPool.find(c => c.widths.join(',') === '64,32,16') ?? healthyPool[healthyPool.length - 1]
    } else if (trainRows < 7500) {
      const balancedPool = healthyPool.filter(c => c.widths.length <= 3 && c.widths[0] <= 64)
      const source = balancedPool.length > 0 ? balancedPool : healthyPool
      chosen = source[source.length - 1]
    } else {
      const deepPool = healthyPool.filter(c => c.widths.length === 3)
      const source = deepPool.length > 0 ? deepPool : healthyPool
      chosen = source[source.length - 1]
    }
  } else {
    const validSmallest = evaluated.filter(c => c.validCapacity)
    chosen = validSmallest[0] ?? evaluated[0]
  }

  const tierLabel =
    chosen.widths.length === 2 && chosen.widths[0] <= 48
      ? 'Compacta'
      : trainRows >= 7500 && chosen.widths.length === 3
        ? 'Profunda'
        : 'Equilibrada'

  const samplesPerParam =
    trainRows > 0 && chosen.params > 0 ? Number((trainRows / chosen.params).toFixed(2)) : null

  const { breakdown: chosenBreakdown } = computeArchitectureParams(chosen.layers, features, outDim)
  const denseUnitsSeen: number[] = []
  const layerReasons: LayerDecisionReason[] = []

  const schemaSummary =
    activeFeatureCols.length > 0
      ? `${numericCols} numéricas y ${categoricalCols} categóricas (${oneHotExpansion > 0 ? `+${oneHotExpansion} columnas One-Hot = ` : ''}${features} entradas)`
      : `${features} características numéricas normalizadas`

  layerReasons.push({
    id: 'reason-input',
    layerIndex: null,
    role: 'input',
    title: 'Input Layer',
    specBadge: `(${features},)`,
    reason: `Adapta exactamente ${schemaSummary} con ${scalerApplied}${missingCells > 0 ? ` tras imputar ${missingCells} celdas faltantes` : ''}.`,
  })

  chosen.layers.forEach((layer, idx) => {
    const rowMeta = chosenBreakdown[idx]
    if (layer.type === 'Dense') {
      const units = layer.units || 32
      const prevDense = denseUnitsSeen[denseUnitsSeen.length - 1]
      denseUnitsSeen.push(units)

      if (denseUnitsSeen.length === 1) {
        const biasNote =
          layer.use_bias === false
            ? ` Se desactiva el sesgo b (use_bias=False) porque BatchNorm ya aplica desplazamiento β, ahorrando ${units} parámetros redundantes.`
            : ''
        const ratioText =
          samplesPerParam !== null
            ? ` Mantiene ${samplesPerParam}x filas por parámetro sobre ${trainRows.toLocaleString()} muestras train.`
            : ''
        layerReasons.push({
          id: `reason-layer-${idx}`,
          layerIndex: idx,
          role: 'hidden',
          title: `#${idx + 1} Dense (${units}u)`,
          specBadge: `${units} · ${layer.activation}`,
          reason: `Proyecta ${features}→${units} neuronas con ReLU para modelar interacciones no lineales sin desvanecimiento de gradiente.${biasNote}${ratioText}`,
        })
      } else {
        const compFactor = prevDense ? (prevDense / units).toFixed(1) : '2.0'
        layerReasons.push({
          id: `reason-layer-${idx}`,
          layerIndex: idx,
          role: 'hidden',
          title: `#${idx + 1} Dense (${units}u)`,
          specBadge: `${units} · ${layer.activation}`,
          reason: `Comprime en relación ${compFactor}:1 (${prevDense}→${units} nodos) para destilar los patrones predictivos antes de ${denseUnitsSeen.length === chosen.widths.length ? 'la capa de salida' : 'la siguiente etapa'}.`,
        })
      }
    } else if (layer.type === 'BatchNormalization') {
      const inDim = rowMeta?.inShape ?? features
      const reasonParts: string[] = []
      if (categoricalCols > 0 || oneHotExpansion > 0) reasonParts.push('variables One-Hot dispersas')
      if (scaleSpread >= 10) reasonParts.push(`magnitudes mixtas (${scaleSpread.toFixed(0)}x rango)`)
      if (reasonParts.length === 0) reasonParts.push(`${features} variables de entrada`)
      layerReasons.push({
        id: `reason-layer-${idx}`,
        layerIndex: idx,
        role: 'hidden',
        title: `#${idx + 1} BatchNorm`,
        specBadge: `(${inDim},) · μ=0,σ=1`,
        reason: `Estabiliza gradientes y normaliza medias/varianzas internas frente a ${reasonParts.join(' y ')} durante el entrenamiento.`,
      })
    } else if (layer.type === 'Dropout') {
      const pct = Math.round((layer.rate || 0.2) * 100)
      const imbalanceNote = isImbalanced
        ? ` y desbalance de clase (${minorityPct}% minoritaria)`
        : ''
      layerReasons.push({
        id: `reason-layer-${idx}`,
        layerIndex: idx,
        role: 'hidden',
        title: `#${idx + 1} Dropout (${pct}%)`,
        specBadge: `rate = ${layer.rate}`,
        reason: `Desactiva ${pct}% de conexiones en cada lote según ${trainRows > 0 ? `${trainRows.toLocaleString()} filas train` : 'la escala tabular'}${imbalanceNote} para impedir memorización (${problemLabel}).`,
      })
    }
  })

  layerReasons.push({
    id: 'reason-output',
    layerIndex: null,
    role: 'output',
    title: 'Output Layer',
    specBadge: `(${outDim},) · ${outAct}`,
    reason: `Predice '${targetColumn}' (${problemLabel}) usando activación ${outAct} y función de pérdida ${lossName}.`,
  })

  const name = `Auto-Óptima ${chosen.widths.join('→')}`
  const summary = `${tierLabel} (${chosen.widths.join('→')}) · ${chosen.params.toLocaleString()} parámetros${samplesPerParam !== null ? ` · ${samplesPerParam}x filas/parámetro` : ''}.`
  const justification = `Arquitectura ${tierLabel.toLowerCase()} (${chosen.widths.join('→')}, ${chosen.params.toLocaleString()} parámetros) seleccionada automáticamente entre ${evaluated.length} topologías candidatas para ${trainRows > 0 ? `${trainRows.toLocaleString()} muestras de entrenamiento` : 'datos tabulares'} y ${features} entradas en ${problemLabel}.`

  return {
    name,
    family: 'Feedforward',
    tierLabel,
    summary,
    justification,
    layers: chosen.layers,
    signals: {
      features,
      trainRows,
      totalRows,
      numericCols,
      categoricalCols,
      missingCells,
      oneHotExpansion,
      minorityPct,
      problemLabel,
      scalerApplied,
      lossName,
      candidatesEvaluated: evaluated.length,
      chosenParams: chosen.params,
      samplesPerParam,
    },
    layerReasons,
  }
}

export function evaluateArchitectureHealth(
  layers: LayerSpec[],
  inputShape: number,
  outputDim: number,
  totalParams: number,
  trainRows: number
): ArchitectureHealth {
  const denseLayers = layers.filter(l => l.type === 'Dense')
  const coreLayers = layers.filter(l => ['Dense', 'Conv1D', 'LSTM', 'GRU'].includes(l.type))
  const hasDropout = layers.some(l => l.type === 'Dropout')
  const hasBatchNorm = layers.some(l => l.type === 'BatchNormalization')
  const hasRegularization = hasDropout || hasBatchNorm
  const samplesPerParam = trainRows > 0 && totalParams > 0 ? Number((trainRows / totalParams).toFixed(2)) : null

  if (layers.length === 0 || coreLayers.length === 0) {
    return {
      status: 'improvable',
      label: 'Mejorable',
      samplesPerParam,
      hasRegularization,
      notes: ['Añade al menos una capa de procesamiento (Dense, Conv1D, LSTM o GRU) o ejecuta Auto-Diseño Óptimo.'],
    }
  }

  const criticalNotes: string[] = []
  const minorNotes: string[] = []

  const hasLinearHidden = denseLayers.some(l => l.activation === 'linear')
  if (hasLinearHidden) {
    criticalNotes.push('Activación lineal en capa oculta limita la no-linealidad (usa ReLU).')
  }

  if (denseLayers.length >= 2) {
    const firstUnits = denseLayers[0].units || 32
    const lastUnits = denseLayers[denseLayers.length - 1].units || 32
    if (lastUnits > firstUnits && lastUnits > outputDim * 4) {
      criticalNotes.push('Topología invertida: conviene reducir neuronas progresivamente hacia la salida.')
    }
  }

  if (totalParams > Math.max(4000, trainRows * 2) && !hasDropout) {
    criticalNotes.push('Alto número de parámetros sin Dropout: riesgo de sobreajuste.')
  }

  if (inputShape >= 10 && layers.length >= 2 && !hasBatchNorm) {
    minorNotes.push(`Considera BatchNorm para estabilizar ${inputShape} variables de entrada.`)
  }

  if (samplesPerParam !== null && samplesPerParam < 1.1 && totalParams > 2500) {
    minorNotes.push(`Ratio ${samplesPerParam}x filas/parámetro: topología muy ancha respecto al dataset.`)
  }

  if (criticalNotes.length > 0) {
    return {
      status: 'improvable',
      label: 'Mejorable',
      samplesPerParam,
      hasRegularization,
      notes: criticalNotes,
    }
  }

  if (minorNotes.length > 0 || !hasRegularization) {
    return {
      status: 'acceptable',
      label: 'Aceptable',
      samplesPerParam,
      hasRegularization,
      notes: minorNotes.length > 0 ? minorNotes : ['Topología funcional; incorporar Dropout refuerza la generalización.'],
    }
  }

  return {
    status: 'optimal',
    label: 'Óptima',
    samplesPerParam,
    hasRegularization,
    notes: [
      samplesPerParam !== null
        ? `Equilibrio piramidal con regularización y ${samplesPerParam}x muestras por parámetro.`
        : 'Topología piramidal equilibrada con normalización y regularización.',
    ],
  }
}
