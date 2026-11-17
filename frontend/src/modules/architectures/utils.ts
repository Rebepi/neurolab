import type { LayerSpec } from '../../types/index'

export interface LayerParamBreakdown {
  layerIndex: number
  type: string
  inShape: number
  outShape: number
  weights: number
  biases: number
  total: number
}

export function createLayerId(): string {
  return 'l-' + Math.random().toString(36).slice(2, 9)
}

export function computeArchitectureParams(
  layers: LayerSpec[],
  inputShape: number,
  outputDim: number
): {
  total: number
  breakdown: LayerParamBreakdown[]
} {
  let currentIn = inputShape
  let total = 0
  const breakdown: LayerParamBreakdown[] = []

  layers.forEach((layer, idx) => {
    if (layer.type === 'Dense' && layer.units) {
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
      const layerTotal = 4 * currentIn
      total += layerTotal
      breakdown.push({
        layerIndex: idx + 1,
        type: 'BatchNormalization',
        inShape: currentIn,
        outShape: currentIn,
        weights: 2 * currentIn,
        biases: 2 * currentIn,
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
  outputActivation: string
): string {
  const lossName = outputActivation === 'sigmoid'
    ? 'binary_crossentropy'
    : outputActivation === 'softmax'
      ? 'sparse_categorical_crossentropy'
      : 'mean_squared_error'

  const hiddenLines = layersList.map(l => {
    if (l.type === 'Dense') {
      return `        layers.Dense(${l.units}, activation='${l.activation}', use_bias=${l.use_bias !== false ? 'True' : 'False'}),`
    }
    if (l.type === 'Dropout') {
      return `        layers.Dropout(${l.rate}),`
    }
    return `        layers.BatchNormalization(),`
  }).join('\n')

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

