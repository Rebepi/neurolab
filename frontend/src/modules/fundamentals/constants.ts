import type { ActivationTab } from './math'

export const NETWORK_FAMILIES = [
  {
    id: 'mlp',
    title: 'Feedforward / MLP (Multilayer Perceptron)',
    tag: 'Recomendado para datos tabulares',
    badge: 'Disponible en NeuroLab',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    flow: ['Vector N-D', 'Dense + ReLU', 'Dense + Dropout', 'Salida ŷ'],
    desc: 'Arquitectura canónica donde las señales fluyen estrictamente hacia adelante desde las características de entrada hasta las predicciones sin ciclos recurrentes.',
    useCases: [
      'Predicción de fuga de clientes (Churn)',
      'Evaluación de riesgo crediticio',
      'Detección de fraude en transacciones',
      'Modelado tabular predictivo',
    ],
    inputRule: 'Vectores numéricos 1D (input_shape = N características tras escalado y One-Hot).',
  },
  {
    id: 'cnn',
    title: 'CNN (Redes Convolucionales)',
    tag: 'Ideal para imágenes y patrones espaciales',
    badge: 'Mapeo habilitado',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    flow: ['Tensor H×W×C', 'Conv2D + Filtros', 'MaxPooling', 'Flatten + Dense'],
    desc: 'Utiliza filtros convolucionales y pooling para extraer características locales con invariancia espacial.',
    useCases: [
      'Diagnóstico por imágenes médicas (Rayos X, resonancias)',
      'Reconocimiento facial y control de acceso',
      'Inspección visual de calidad industrial',
    ],
    inputRule: 'Tensores multidimensionales (alto, ancho, canales de color).',
  },
  {
    id: 'rnn',
    title: 'RNN / LSTM (Redes Recurrentes)',
    tag: 'Ideal para secuencias y series temporales',
    badge: 'Mapeo habilitado',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    flow: ['Secuencia t₀..tₙ', 'Estado Oculto hₜ', 'Compuertas LSTM', 'Predicción'],
    desc: 'Introduce conexiones de retroalimentación interna y compuertas de memoria (LSTM / GRU) para retener dependencias históricas.',
    useCases: [
      'Pronóstico de demanda y series financieras',
      'Monitoreo de sensores IoT industriales',
      'Procesamiento de texto y telemetría',
    ],
    inputRule: 'Secuencias temporales (timesteps, características por paso).',
  },
  {
    id: 'gan',
    title: 'GAN (Redes Generativas Antagónicas)',
    tag: 'Generación y síntesis de datos',
    badge: 'Teoría disponible',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    flow: ['Ruido Latente z', 'Generador G(z)', 'Discriminador D(x)', 'Real vs Sintético'],
    desc: 'Dos redes (Generador y Discriminador) compiten en un juego de suma cero para generar muestras sintéticas indistinguibles de datos reales.',
    useCases: [
      'Aumento sintético de datasets desbalanceados',
      'Anonimización de datos sensibles para investigación',
      'Superresolución de imágenes',
    ],
    inputRule: 'Ruido latente como entrada al generador; muestras reales/falsas al discriminador.',
  },
] as const

export const LEARNING_PHASES = [
  {
    step: '01',
    title: 'Paso Hacia Adelante (Forward Pass)',
    badge: 'Propagación',
    formula: 'z = W·x + b  →  ŷ = σ(z)',
    desc: 'Los datos del dataset entran por la capa inicial. Cada capa realiza combinaciones lineales z = W·x + b y aplica activaciones no lineales hasta producir la predicción ŷ.',
  },
  {
    step: '02',
    title: 'Cálculo de la Pérdida (Loss)',
    badge: 'Error Cuantificado',
    formula: 'L = ½ · (y - ŷ)²',
    desc: 'La función de pérdida compara ŷ con el valor real y. Cuantifica exactamente cuánto erró el modelo en el lote actual.',
  },
  {
    step: '03',
    title: 'Retropropagación (Backprop)',
    badge: 'Regla de la Cadena',
    formula: '∂L/∂W = (ŷ - y) · σ\'(z) · x',
    desc: 'Mediante la regla de la cadena del cálculo diferencial, se computan los gradientes ∂L/∂W y ∂L/∂b desde la salida hacia cada peso de la red.',
  },
  {
    step: '04',
    title: 'Actualización (Gradiente Descendente)',
    badge: 'Optimización',
    formula: 'W_nuevo = W - α · (∂L/∂W)',
    desc: 'El optimizador (Adam / SGD) ajusta los pesos en dirección contraria al gradiente para reducir el error en el siguiente paso.',
  },
] as const

export interface ActivationSpec {
  id: ActivationTab
  color: string
  formula: string
  derivativeFormula: string
  range: string
  advantage: string
  limitation: string
  usage: string
}

export const ACTIVATION_SPECS: Record<ActivationTab, ActivationSpec> = {
  ReLU: {
    id: 'ReLU',
    color: '#6366f1',
    formula: 'f(x) = max(0, x)',
    derivativeFormula: "f'(x) = 1 si x > 0; 0 si x ≤ 0",
    range: '[0, +∞)',
    advantage: 'Cómputo ultra rápido y evita el desvanecimiento del gradiente para valores positivos. Estándar en capas ocultas.',
    limitation: 'Puede sufrir "Dying ReLU" si muchas neuronas quedan permanentemente en la región x ≤ 0 con gradiente nulo.',
    usage: 'Capas ocultas de redes MLP y CNN profundas.',
  },
  LeakyReLU: {
    id: 'LeakyReLU',
    color: '#06b6d4',
    formula: 'f(x) = x si x ≥ 0; 0.1·x si x < 0',
    derivativeFormula: "f'(x) = 1 si x ≥ 0; 0.1 si x < 0",
    range: '(-∞, +∞)',
    advantage: 'Resuelve el problema de "Dying ReLU" manteniendo un flujo pequeño de gradiente cuando la neurona recibe entradas negativas.',
    limitation: 'Introduce un hiperparámetro adicional (pendiente α negativa) que puede requerir ajuste fino.',
    usage: 'Capas ocultas cuando existen neuronas muertas o en redes generativas.',
  },
  Sigmoid: {
    id: 'Sigmoid',
    color: '#10b981',
    formula: 'f(x) = 1 / (1 + e⁻ˣ)',
    derivativeFormula: "f'(x) = f(x) · (1 - f(x))",
    range: '(0, 1)',
    advantage: 'Salida suave interpretable directamente como probabilidad entre 0% y 100%.',
    limitation: 'Se satura en extremos (|x| > 4), produciendo gradientes cercanos a 0 y convergencia lenta en capas ocultas.',
    usage: 'Capa de salida obligatoria en clasificación binaria (Churn, Fraude, Default).',
  },
  Tanh: {
    id: 'Tanh',
    color: '#f59e0b',
    formula: 'f(x) = (eˣ - e⁻ˣ) / (eˣ + e⁻ˣ)',
    derivativeFormula: "f'(x) = 1 - tanh²(x)",
    range: '(-1, 1)',
    advantage: 'Salida simétrica centrada en cero, facilitando optimizaciones más equilibradas que Sigmoid en capas intermedias.',
    limitation: 'Al igual que Sigmoid, presenta saturación de gradiente cuando la magnitud de x es grande.',
    usage: 'Celdas recurrentes (LSTM/GRU) y normalizaciones acotadas.',
  },
  Softmax: {
    id: 'Softmax',
    color: '#a855f7',
    formula: 'f(zᵢ) = e^(zᵢ / τ) / Σ e^(zⱼ / τ)',
    derivativeFormula: 'Jacobiano: f(zᵢ) · (δᵢⱼ - f(zⱼ))',
    range: '(0, 1) con Σ f(zᵢ) = 1.0',
    advantage: 'Convierte cualquier vector de puntuaciones crudas (logits) en una distribución de probabilidad multiclase coherente.',
    limitation: 'Sensible a logits extremos; requiere estabilidad numérica restando max(z) y ajuste de temperatura τ.',
    usage: 'Capa de salida en clasificación multiclase con Categorical Crossentropy.',
  },
}

export const GLOSSARY_ITEMS = [
  { id: 'neurona', term: 'Neurona Artificial (Perceptrón)', category: 'Componentes', desc: 'Unidad de cómputo fundamental que recibe múltiples entradas ponderadas, suma un término de sesgo (bias) y aplica una función de activación no lineal para producir una salida.' },
  { id: 'pesos', term: 'Pesos Sinápticos (Weights - W)', category: 'Parámetros', desc: 'Parámetros aprendibles que determinan la importancia e intensidad de la conexión entre dos neuronas. Se ajustan durante el entrenamiento mediante gradiente descendente.' },
  { id: 'sesgo', term: 'Sesgo (Bias - b)', category: 'Parámetros', desc: 'Valor constante que se suma a la combinación lineal de entradas. Permite desplazar la función de activación horizontalmente para que la red pueda ajustar patrones que no pasan por el origen.' },
  { id: 'activacion', term: 'Función de Activación', category: 'Matemática', desc: 'Transformación no lineal aplicada a la suma ponderada. Es indispensable para que la red neuronal aprenda fronteras de decisión complejas más allá de modelos puramente lineales.' },
  { id: 'backprop', term: 'Retropropagación (Backpropagation)', category: 'Optimización', desc: 'Algoritmo basado en la regla de la cadena del cálculo diferencial para propagar el error desde la salida hacia atrás, calculando las derivadas parciales respecto a cada peso y sesgo.' },
  { id: 'learning-rate', term: 'Tasa de Aprendizaje (Learning Rate - α)', category: 'Hiperparámetros', desc: 'Factor escalar que determina el tamaño del paso que da el optimizador en dirección opuesta al gradiente de la pérdida. Un valor alto causa divergencia; uno muy bajo provoca convergencia lenta.' },
  { id: 'epoca', term: 'Época (Epoch)', category: 'Entrenamiento', desc: 'Ciclo completo en el que la totalidad del conjunto de entrenamiento ha sido procesado por el modelo hacia adelante y hacia atrás.' },
  { id: 'batch-size', term: 'Tamaño del Lote (Batch Size)', category: 'Hiperparámetros', desc: 'Número de ejemplos procesados simultáneamente antes de actualizar los pesos de la red. Lotes típicos: 16, 32, 64 o 128.' },
  { id: 'overfitting', term: 'Sobreajuste (Overfitting)', category: 'Evaluación', desc: 'Fenómeno donde el modelo memoriza el ruido y particularidades del conjunto de entrenamiento perdiendo capacidad de generalización sobre el conjunto de Test.' },
  { id: 'dropout', term: 'Dropout', category: 'Regularización', desc: 'Técnica de regularización que desactiva aleatoriamente una fracción de neuronas durante cada paso de entrenamiento, evitando coadaptaciones complejas.' },
  { id: 'loss-function', term: 'Función de Pérdida (Loss Function)', category: 'Matemática', desc: 'Métrica matemática que cuantifica la discrepancia entre la predicción de la red y la etiqueta real (e.g., Binary Crossentropy para clasificación binaria, MSE para regresión).' },
  { id: 'gradient-vanishing', term: 'Desvanecimiento del Gradiente (Vanishing Gradient)', category: 'Problemas', desc: 'Pérdida exponencial de la magnitud del gradiente al propagarse hacia las capas iniciales en redes profundas, mitigado usando ReLU y normalización por lotes.' },
] as const
