import type {
  AreaSourceSchema,
  CatalogModelVersion,
  ColumnSummary,
  PredictionResponse,
} from '../../types/index'

export interface FieldMeta {
  label: string
  unit?: string
  help?: string
  group: string
  isInteger?: boolean
  step?: number
  prefix?: string
}

export interface ModelBusinessProfile {
  key: string
  shortTitle: string
  question: string
  subtitle: string
  accent: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'indigo'
  positiveClassLabel?: string
  negativeClassLabel?: string
  unitPrefix?: string
  unitSuffix?: string
}

export interface AreaDisplayInfo {
  id: string
  badge: string
  shortName: string
  fullName: string
  accent: ModelBusinessProfile['accent']
  infoTitle: string
  infoText: string
  order: number
}

export interface InterpretedVerdict {
  headline: string
  subheadline: string
  tone: 'safe' | 'warn' | 'danger' | 'info'
  badgeText: string
  confidencePct: number | null
  recommendation: string
  formattedValue?: string
}

const VALUE_DISPLAY_MAP: Record<string, string> = {
  Si: 'Sí',
  No: 'No',
  'Mes a mes': 'Mes a mes',
  'Un anio': 'Contrato 1 año',
  'Dos anios': 'Contrato 2 años',
  'Fibra Optica': 'Fibra Óptica',
  'Inalambrico 5G': 'Inalámbrico 5G',
  ADSL: 'ADSL',
  'Tarjeta de Credito': 'Tarjeta de Crédito',
  'Transferencia Bancaria': 'Transferencia Bancaria',
  'Billetera Digital': 'Billetera Digital',
  'Pago en Efectivo': 'Pago en Efectivo',
  'Torre Macro 5G': 'Torre Macro 5G',
  'OLT Fibra Central': 'OLT Fibra Central',
  'Router Core MPLS': 'Router Core MPLS',
  'Costa Humeda': 'Costa Húmeda',
  'Sierra Seca': 'Sierra Seca',
  'Selva Tropical': 'Selva Tropical',
  'Urbano Controlado': 'Urbano Controlado',
  'UPS + Generador': 'UPS + Generador',
  'Solo Baterias': 'Solo Baterías',
  'Sin Respaldo': 'Sin Respaldo',
  Operativo: 'Operativo',
  Degradado: 'Degradado',
  'Falla Critica': 'Falla Crítica',
  Estable: 'Estable',
  Saturado: 'Saturado',
  Congestionado: 'Congestionado',
  Critico: 'Crítico',
  'App Movil': 'App Móvil',
  'Portal Web': 'Portal Web',
  'Call Center': 'Call Center',
  'Agente Externo': 'Agente Externo',
  Bajo: 'Riesgo Bajo',
  Medio: 'Riesgo Medio',
  Alto: 'Riesgo Alto',
  Residencial: 'Residencial',
  Profesional: 'Profesional',
  PYME: 'PYME',
  Corporativo: 'Corporativo',
  Basico: 'Plan Básico',
  'Avanzado 5G': 'Avanzado 5G',
  'Fibra Ultra': 'Fibra Ultra',
  'Empresarial Dedicado': 'Empresarial Dedicado',
  'Web Directa': 'Web Directa',
  'Tienda Fisica': 'Tienda Física',
  'Ejecutivo B2B': 'Ejecutivo B2B',
  Referido: 'Referido',
  'Debito Automatico': 'Débito Automático',
  'Pago Manual': 'Pago Manual',
  retencion: 'Área 01 · Retención',
  noc: 'Área 02 · Red NOC',
  antifraude: 'Área 03 · Antifraude',
  comercial: 'Área 04 · Comercial',
}

const KNOWN_FIELDS: Record<string, FieldMeta> = {
  // Retención
  meses_antiguedad: { label: 'Antigüedad del cliente', unit: 'meses', group: 'Perfil y contrato', isInteger: true, help: 'Meses continuos con servicio activo' },
  edad_cliente: { label: 'Edad del cliente', unit: 'años', group: 'Perfil y contrato', isInteger: true, help: 'Edad actual del titular' },
  cargo_mensual: { label: 'Cargo mensual', unit: 'USD', prefix: '$', group: 'Facturación y pagos', step: 1, help: 'Tarifa mensual del plan contratado' },
  cargos_totales: { label: 'Total facturado acumulado', unit: 'USD', prefix: '$', group: 'Facturación y pagos', step: 10, help: 'Suma histórica aproximada pagada por el cliente' },
  consumo_datos_gb: { label: 'Consumo mensual de datos', unit: 'GB', group: 'Uso y calidad de red', step: 1, help: 'Gigabytes consumidos al mes' },
  horas_streaming_semanal: { label: 'Horas de streaming semanal', unit: 'h/sem', group: 'Uso y calidad de red', step: 0.5, help: 'Uso estimado en video y streaming' },
  latencia_promedio_ms: { label: 'Latencia promedio', unit: 'ms', group: 'Uso y calidad de red', step: 1, help: 'Tiempo de respuesta del enlace de internet' },
  perdida_paquetes_pct: { label: 'Pérdida de paquetes', unit: '%', group: 'Uso y calidad de red', step: 0.1, help: 'Porcentaje de paquetes perdidos en la conexión' },
  llamadas_soporte: { label: 'Llamadas a soporte', unit: 'llamadas', group: 'Experiencia y soporte', isInteger: true, help: 'Reclamos o consultas recientes a soporte técnico' },
  atrasos_pago: { label: 'Atrasos de pago', unit: 'veces', group: 'Facturación y pagos', isInteger: true, help: 'Cantidad de facturas vencidas o pagadas tarde' },
  puntaje_satisfaccion: { label: 'Puntaje de satisfacción', unit: '/ 10', group: 'Experiencia y soporte', step: 0.5, help: 'Encuesta de satisfacción del cliente (1 a 10)' },
  dispositivos_conectados: { label: 'Dispositivos conectados', unit: 'equipos', group: 'Uso y calidad de red', isInteger: true, help: 'Equipos habituales en el hogar u oficina' },
  tipo_contrato: { label: 'Tipo de contrato', group: 'Perfil y contrato', help: 'Modalidad de permanencia del cliente' },
  servicio_internet: { label: 'Tecnología de internet', group: 'Perfil y contrato', help: 'Tipo de enlace instalado' },
  soporte_tecnico: { label: 'Soporte técnico prioritario', group: 'Experiencia y soporte', help: 'Indica si cuenta con asistencia técnica incluida' },
  metodo_pago: { label: 'Método de pago', group: 'Facturación y pagos', help: 'Forma habitual de pago de la factura' },
  facturacion_digital: { label: 'Facturación digital', group: 'Facturación y pagos', help: 'Recibe recibos electrónicos por correo/app' },

  // NOC Red
  temperatura_equipo_c: { label: 'Temperatura del equipo', unit: '°C', group: 'Telemetría térmica y carga', step: 0.5, help: 'Temperatura interna medida en el gabinete o torre' },
  uso_cpu_pct: { label: 'Uso de CPU', unit: '%', group: 'Telemetría térmica y carga', step: 1, help: 'Porcentaje de procesamiento ocupado' },
  uso_memoria_pct: { label: 'Uso de memoria', unit: '%', group: 'Telemetría térmica y carga', step: 1, help: 'Porcentaje de memoria RAM utilizada' },
  carga_trafico_gbps: { label: 'Carga de tráfico', unit: 'Gbps', group: 'Telemetría térmica y carga', step: 1, help: 'Ancho de banda cursado por el nodo' },
  potencia_optica_dbm: { label: 'Potencia óptica', unit: 'dBm', group: 'Calidad de señal y fallos', step: 0.5, help: 'Nivel de señal óptica recibida (más negativo = más débil)' },
  errores_crc_hora: { label: 'Errores CRC por hora', unit: 'err/h', group: 'Calidad de señal y fallos', isInteger: true, help: 'Errores de integridad de tramas por hora' },
  reinicios_ultimos_7d: { label: 'Reinicios últimos 7 días', unit: 'veces', group: 'Calidad de señal y fallos', isInteger: true, help: 'Caídas o reinicios del equipo en la última semana' },
  humedad_gabinete_pct: { label: 'Humedad del gabinete', unit: '%', group: 'Entorno e infraestructura', step: 1, help: 'Humedad relativa en el recinto' },
  voltaje_fuente_v: { label: 'Voltaje de fuente', unit: 'V', group: 'Entorno e infraestructura', step: 0.2, help: 'Tensión DC nominal (estándar 48 V)' },
  antiguedad_nodo_meses: { label: 'Antigüedad del nodo', unit: 'meses', group: 'Entorno e infraestructura', isInteger: true, help: 'Tiempo de operación desde la instalación' },
  tipo_nodo: { label: 'Tipo de nodo', group: 'Entorno e infraestructura', help: 'Categoría de equipo de red' },
  zona_climatica: { label: 'Zona climática', group: 'Entorno e infraestructura', help: 'Condición ambiental del sitio' },
  respaldo_energia: { label: 'Respaldo eléctrico', group: 'Entorno e infraestructura', help: 'Sistema de contingencia ante cortes de luz' },

  // NOC Series 5G
  latencia_t1_ms: { label: 'Latencia ventana T-3', unit: 'ms', group: 'Evolución de latencia 5G', step: 1, help: 'Latencia medida hace 3 intervalos en el enlace 5G' },
  latencia_t2_ms: { label: 'Latencia ventana T-2', unit: 'ms', group: 'Evolución de latencia 5G', step: 1, help: 'Latencia medida hace 2 intervalos en el enlace 5G' },
  latencia_t3_ms: { label: 'Latencia ventana T-1', unit: 'ms', group: 'Evolución de latencia 5G', step: 1, help: 'Latencia medida en el intervalo anterior' },
  latencia_t4_ms: { label: 'Latencia actual (T0)', unit: 'ms', group: 'Evolución de latencia 5G', step: 1, help: 'Latencia más reciente del enlace 5G' },
  carga_cpu_t1_pct: { label: 'Carga CPU ventana T-3', unit: '%', group: 'Evolución de CPU 5G', step: 1, help: 'Uso de CPU hace 3 intervalos' },
  carga_cpu_t2_pct: { label: 'Carga CPU ventana T-2', unit: '%', group: 'Evolución de CPU 5G', step: 1, help: 'Uso de CPU hace 2 intervalos' },
  carga_cpu_t3_pct: { label: 'Carga CPU ventana T-1', unit: '%', group: 'Evolución de CPU 5G', step: 1, help: 'Uso de CPU en el intervalo anterior' },
  carga_cpu_t4_pct: { label: 'Carga CPU actual (T0)', unit: '%', group: 'Evolución de CPU 5G', step: 1, help: 'Uso de CPU más reciente del equipo 5G' },
  temperatura_transceptor_c: { label: 'Temperatura transceptor', unit: '°C', group: 'Señal y hardware 5G', step: 0.5, help: 'Temperatura del módulo de radiofrecuencia 5G' },
  potencia_senal_dbm: { label: 'Potencia de señal 5G', unit: 'dBm', group: 'Señal y hardware 5G', step: 0.5, help: 'Intensidad de señal recibida (más cerca de 0 es mejor)' },
  banda_frecuencia: { label: 'Banda de frecuencia', group: 'Señal y hardware 5G', help: 'Espectro de radiofrecuencia asignado al enlace' },

  // Antifraude
  monto_operacion_usd: { label: 'Monto de la operación', unit: 'USD', prefix: '$', group: 'Detalles de la operación', step: 5, help: 'Valor monetario de la transacción' },
  hora_transaccion: { label: 'Hora de la transacción', unit: 'h (0-23)', group: 'Detalles de la operación', isInteger: true, help: 'Hora del día en formato 24 horas (madrugada suele elevar el riesgo)' },
  distancia_ult_ubicacion_km: { label: 'Distancia desde última ubicación', unit: 'km', group: 'Señales de riesgo', step: 10, help: 'Kilómetros respecto al último uso habitual' },
  cambios_sim_30d: { label: 'Cambios de SIM (30 días)', unit: 'veces', group: 'Señales de riesgo', isInteger: true, help: 'Cantidad de reemplazos de chip en el último mes' },
  intentos_fallidos_pin: { label: 'Intentos fallidos de PIN', unit: 'intentos', group: 'Señales de riesgo', isInteger: true, help: 'Fallos recientes de clave o PIN' },
  llamadas_internacionales_24h: { label: 'Llamadas internacionales (24h)', unit: 'llamadas', group: 'Señales de riesgo', isInteger: true, help: 'Cantidad de llamadas al extranjero en las últimas 24 horas' },
  edad_linea_meses: { label: 'Antigüedad de la línea', unit: 'meses', group: 'Detalles de la operación', isInteger: true, help: 'Meses desde la activación de la línea telefónica' },
  velocidad_consumo_ratio: { label: 'Ritmo de consumo vs habitual', unit: 'x', group: 'Señales de riesgo', step: 0.1, help: '1.0x es normal; valores altos indican gasto repentino' },
  canal_operacion: { label: 'Canal de operación', group: 'Detalles de la operación', help: 'Medio utilizado para realizar la transacción' },
  pais_destino_riesgo: { label: 'Nivel de riesgo del país destino', group: 'Seguridad y verificación', help: 'Clasificación de riesgo geográfico del destino' },
  dispositivo_nuevo: { label: '¿Dispositivo nuevo?', group: 'Seguridad y verificación', help: 'Primera vez que se opera desde este teléfono o equipo' },
  verificacion_biometrica: { label: '¿Verificación biométrica?', group: 'Seguridad y verificación', help: 'Confirmó con huella digital o reconocimiento facial' },

  // Comercial LTV
  antiguedad_meses: { label: 'Antigüedad del cliente', unit: 'meses', group: 'Perfil comercial', isInteger: true, help: 'Meses de relación comercial activa con la empresa' },
  gasto_mensual_usd: { label: 'Gasto mensual', unit: 'USD', prefix: '$', group: 'Facturación y consumo', step: 5, help: 'Facturación mensual promedio del cliente' },
  servicios_activos: { label: 'Servicios contratados', unit: 'servicios', group: 'Perfil comercial', isInteger: true, help: 'Cantidad de líneas o productos activos en su cuenta' },
  uso_roaming_anual_usd: { label: 'Consumo anual en roaming', unit: 'USD', prefix: '$', group: 'Facturación y consumo', step: 5, help: 'Gasto adicional acumulado en roaming internacional' },
  referidos_exitosos: { label: 'Clientes referidos', unit: 'personas', group: 'Fidelización y plan', isInteger: true, help: 'Nuevos clientes captados por recomendación de este titular' },
  puntaje_fidelidad: { label: 'Índice de fidelidad', unit: '/ 100', group: 'Fidelización y plan', step: 1, help: 'Puntuación interna de lealtad del cliente (0 a 100)' },
  upgrades_plan: { label: 'Mejoras de plan realizadas', unit: 'upgrades', group: 'Fidelización y plan', isInteger: true, help: 'Veces que el cliente subió a un plan superior' },
  segmento_cliente: { label: 'Segmento del cliente', group: 'Perfil comercial', help: 'Clasificación comercial de la cuenta' },
  tipo_plan: { label: 'Tipo de plan actual', group: 'Fidelización y plan', help: 'Categoría de plan contratado actualmente' },
  canal_adquisicion: { label: 'Canal de captación', group: 'Perfil comercial', help: 'Canal por el que se incorporó el cliente' },

  // Comercial Riesgo Crediticio
  puntaje_crediticio: { label: 'Puntaje crediticio (Score)', unit: 'pts', group: 'Perfil financiero', isInteger: true, help: 'Score crediticio del solicitante (mayor = mejor historial)' },
  ingreso_anual_usd: { label: 'Ingreso anual', unit: 'USD', prefix: '$', group: 'Perfil financiero', step: 500, help: 'Ingresos anuales declarados del solicitante' },
  ratio_deuda_ingreso: { label: 'Nivel de endeudamiento', unit: 'ratio', group: 'Perfil financiero', step: 0.02, help: 'Proporción de deuda frente al ingreso (ej. 0.35 = 35%)' },
  monto_financiamiento_usd: { label: 'Monto solicitado', unit: 'USD', prefix: '$', group: 'Crédito y comportamiento', step: 100, help: 'Importe de equipo o crédito solicitado' },
  lineas_activas: { label: 'Líneas activas', unit: 'líneas', group: 'Crédito y comportamiento', isInteger: true, help: 'Cantidad de líneas vigentes a nombre del cliente' },
  anios_historial_cliente: { label: 'Años de historial', unit: 'años', group: 'Perfil financiero', isInteger: true, help: 'Antigüedad registrada en el historial financiero' },
  atrasos_ultimos_12m: { label: 'Atrasos en los últimos 12 meses', unit: 'veces', group: 'Crédito y comportamiento', isInteger: true, help: 'Número de cuotas vencidas en el último año' },
  modalidad_pago: { label: 'Modalidad de pago', group: 'Crédito y comportamiento', help: 'Si el cliente tiene pago automático o manual' },
  segmento_cartera: { label: 'Segmento de cartera', group: 'Perfil financiero', help: 'Tipo de cartera crediticia del cliente' },
}

export function getFieldMeta(rawName: string): FieldMeta {
  const cleanName = rawName.includes('__') ? rawName.split('__').slice(1).join('__') : rawName
  if (KNOWN_FIELDS[cleanName]) {
    return KNOWN_FIELDS[cleanName]
  }
  const readable = cleanName
    .replace(/_pct$/i, ' (%)')
    .replace(/_usd$/i, ' (USD)')
    .replace(/_ms$/i, ' (ms)')
    .replace(/_gb$/i, ' (GB)')
    .replace(/_km$/i, ' (km)')
    .replace(/_c$/i, ' (°C)')
    .replace(/_/g, ' ')
    .trim()
  const label = readable.charAt(0).toUpperCase() + readable.slice(1)
  return {
    label,
    group: 'Datos de entrada',
    step: 0.1,
  }
}

export function formatCategoryLabel(rawVal: string): string {
  return VALUE_DISPLAY_MAP[rawVal] || rawVal
}

export function formatCleanNumber(val: number, col: ColumnSummary): number {
  const meta = getFieldMeta(col.name)
  if (meta.isInteger) {
    return Math.round(val)
  }
  const range = Math.abs((col.max ?? 100) - (col.min ?? 0))
  if (range >= 100) return Math.round(val)
  if (range >= 10) return Number(val.toFixed(1))
  return Number(val.toFixed(2))
}

export function getNumericStep(col: ColumnSummary): number {
  const meta = getFieldMeta(col.name)
  if (meta.isInteger) return 1
  if (meta.step) return meta.step
  const range = Math.abs((col.max ?? 100) - (col.min ?? 0))
  if (range >= 500) return 10
  if (range >= 50) return 1
  if (range >= 5) return 0.5
  return 0.05
}

export function getModelBusinessProfile(model: CatalogModelVersion): ModelBusinessProfile {
  const target = (model.target_column || model.dataset_metadata?.target_column || '').toLowerCase()
  const pid = (model.project_id || '').toLowerCase()

  if (target === 'alerta_corporativa' || pid.includes('general')) {
    return {
      key: 'general',
      shortTitle: 'Alerta Corporativa 360°',
      question: '¿Existe alerta operativa global?',
      subtitle: 'Evalúa cualquier área con datos reales usando el modelo unificado de toda la empresa.',
      accent: 'violet',
      positiveClassLabel: 'Alerta Corporativa',
      negativeClassLabel: 'Operación Normal',
    }
  }
  if (target === 'fuga' || pid.includes('retencion')) {
    return {
      key: 'retencion',
      shortTitle: 'Fuga de Clientes',
      question: '¿Este cliente se dará de baja?',
      subtitle: 'Estima la probabilidad de abandono según consumo, pagos, calidad de internet y soporte.',
      accent: 'cyan',
      positiveClassLabel: 'Riesgo de Fuga',
      negativeClassLabel: 'Cliente Estable',
    }
  }
  if (target === 'estado_enlace') {
    return {
      key: 'noc_5g',
      shortTitle: 'Salud Enlace 5G',
      question: '¿El enlace 5G presenta congestión o falla?',
      subtitle: 'Analiza la evolución reciente de latencia, CPU y señal del transceptor 5G.',
      accent: 'indigo',
    }
  }
  if (target === 'estado_nodo' || pid.includes('noc')) {
    return {
      key: 'noc',
      shortTitle: 'Diagnóstico Red NOC',
      question: '¿Esta torre o nodo puede fallar?',
      subtitle: 'Clasifica la infraestructura de red en Operativo, Degradado o Falla Crítica.',
      accent: 'indigo',
    }
  }
  if (target === 'fraude' || pid.includes('antifraude')) {
    return {
      key: 'antifraude',
      shortTitle: 'Detección Antifraude',
      question: '¿Esta operación es fraudulenta?',
      subtitle: 'Detecta suplantación SIM-Swap, roaming anómalo y operaciones sospechosas en milisegundos.',
      accent: 'rose',
      positiveClassLabel: 'Posible Fraude',
      negativeClassLabel: 'Operación Legítima',
    }
  }
  if (target === 'valor_anual_usd') {
    return {
      key: 'ltv',
      shortTitle: 'Valor Comercial (LTV)',
      question: '¿Cuánto generará este cliente al año?',
      subtitle: 'Calcula el ingreso anual proyectado en dólares según plan, antigüedad y fidelidad.',
      accent: 'emerald',
      unitPrefix: '$',
      unitSuffix: 'USD / año',
    }
  }
  if (target === 'riesgo_incumplimiento' || target === 'morosidad') {
    return {
      key: 'credito',
      shortTitle: 'Riesgo Crediticio',
      question: '¿Este cliente tiene riesgo de mora?',
      subtitle: 'Evalúa la probabilidad de incumplimiento financiero antes de aprobar un financiamiento.',
      accent: 'amber',
      positiveClassLabel: 'Riesgo de Incumplimiento',
      negativeClassLabel: 'Perfil Solvente',
    }
  }
  return {
    key: `${model.project_id}:${target}`,
    shortTitle: model.project_name || model.dataset_name || 'Modelo IA',
    question: `Predecir ${getFieldMeta(target).label}`,
    subtitle: model.dataset_name || 'Modelo neuronal listo para evaluación con datos reales.',
    accent: 'cyan',
  }
}

export function formatPredictionClassName(rawClass: string, profile: ModelBusinessProfile): string {
  const s = String(rawClass).trim()
  if (s === '1' && profile.positiveClassLabel) return profile.positiveClassLabel
  if (s === '0' && profile.negativeClassLabel) return profile.negativeClassLabel
  return formatCategoryLabel(s)
}

export function interpretPredictionVerdict(
  result: PredictionResponse,
  profile: ModelBusinessProfile
): InterpretedVerdict {
  if (result.problem_type === 'regression') {
    const numVal = Number(result.prediction)
    const formatted = Number.isFinite(numVal)
      ? `${profile.unitPrefix || ''}${numVal.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${profile.unitSuffix ? ` ${profile.unitSuffix}` : ''}`
      : String(result.prediction)

    if (profile.key === 'ltv') {
      const high = numVal >= 2500
      const mid = numVal >= 1200
      return {
        headline: formatted,
        subheadline: high
          ? 'Cliente de alto valor proyectado (segmento VIP / Corporativo).'
          : mid
            ? 'Cliente de valor comercial medio-alto con potencial de crecimiento.'
            : 'Cliente de valor base; oportunidad de venta cruzada o mejora de plan.',
        tone: high ? 'safe' : mid ? 'info' : 'warn',
        badgeText: high ? 'Alto Valor' : mid ? 'Valor Medio' : 'Valor Base',
        confidencePct: null,
        formattedValue: formatted,
        recommendation: high
          ? 'Priorizar atención ejecutiva dedicada y beneficios de retención preventiva.'
          : mid
            ? 'Ofrecer paquete combinado (Fibra + 5G) para incrementar el ingreso anual.'
            : 'Impulsar campaña de upgrade de plan y fidelización digital.',
      }
    }

    return {
      headline: formatted,
      subheadline: `Valor estimado para ${getFieldMeta(result.target_column).label}.`,
      tone: 'info',
      badgeText: 'Estimación Numérica',
      confidencePct: null,
      formattedValue: formatted,
      recommendation: 'Utiliza esta proyección como referencia cuantitativa junto con los factores de mayor peso.',
    }
  }

  if (result.problem_type === 'multiclass_classification') {
    const label = formatCategoryLabel(String(result.prediction))
    const lower = String(result.prediction).toLowerCase()
    const pct = result.probability !== null ? Math.round(result.probability * 100) : null
    const isDanger = lower.includes('falla') || lower.includes('crit') || lower.includes('alto')
    const isWarn =
      lower.includes('degrad') ||
      lower.includes('satur') ||
      lower.includes('congest') ||
      lower.includes('medio')
    return {
      headline: label,
      subheadline: isDanger
        ? 'Se detectan indicadores severos que requieren intervención técnica inmediata.'
        : isWarn
          ? 'El equipo presenta señales de sobrecarga o degradación progresiva.'
          : 'Los parámetros evaluados se encuentran dentro de rangos normales de operación.',
      tone: isDanger ? 'danger' : isWarn ? 'warn' : 'safe',
      badgeText: isDanger ? 'Atención Crítica' : isWarn ? 'Alerta Preventiva' : 'Estado Saludable',
      confidencePct: pct,
      recommendation: isDanger
        ? 'Despachar cuadrilla de mantenimiento NOC, revisar alimentación eléctrica y balancear tráfico a nodos vecinos.'
        : isWarn
          ? 'Programar revisión preventiva remota, monitorear temperatura/latencia y verificar respaldo eléctrico.'
          : 'Mantener monitoreo rutinario; no se requiere intervención correctiva.',
    }
  }

  // Binary classification
  const probPos = result.probability ?? 0
  const pctPos = Math.round(probPos * 100)
  const pctNeg = 100 - pctPos
  const isHigh = probPos >= 0.65
  const isMed = probPos >= 0.40

  const posLabel = profile.positiveClassLabel || 'Evento Positivo'
  const negLabel = profile.negativeClassLabel || 'Sin Alerta'

  let recommendation = 'Continuar con seguimiento normal.'
  if (profile.key === 'retencion') {
    recommendation = isHigh
      ? 'Activar contacto prioritario de retención: ofrecer mejora de plan, descuento temporal o soporte técnico proactivo.'
      : isMed
        ? 'Enviar encuesta de seguimiento y revisar calidad de conexión/latencia del servicio.'
        : 'Cliente estable; candidato ideal para programa de referidos o venta de servicios adicionales.'
  } else if (profile.key === 'antifraude') {
    recommendation = isHigh
      ? 'Retener preventivamente la operación y exigir validación biométrica o confirmación directa con el titular.'
      : isMed
        ? 'Solicitar segundo factor de autenticación (OTP/biometría) antes de completar la operación.'
        : 'Aprobar la transacción bajo el flujo normal de baja fricción.'
  } else if (profile.key === 'credito') {
    recommendation = isHigh
      ? 'Solicitar garantía adicional, reducir el monto financiado o derivar a comité de riesgo.'
      : isMed
        ? 'Aprobar de forma condicionada con débito automático y seguimiento en los primeros 3 meses.'
        : 'Perfil crediticio saludable; apto para aprobación estándar.'
  } else if (profile.key === 'general') {
    recommendation = isHigh
      ? 'Escalar alerta corporativa al responsable del área evaluada para acción inmediata.'
      : isMed
        ? 'Mantener en vigilancia preventiva dentro del tablero operativo del área.'
        : 'Indicadores corporativos en rango saludable; sin alertas activas.'
  }

  return {
    headline: isHigh ? posLabel : isMed ? `Riesgo Moderado · ${posLabel}` : negLabel,
    subheadline: isHigh
      ? `El modelo estima una probabilidad alta (${pctPos}%) de ${posLabel.toLowerCase()}.`
      : isMed
        ? `Existen señales mixtas (${pctPos}% de probabilidad); conviene aplicar medidas preventivas.`
        : `Probabilidad baja de riesgo (${pctPos}%); confianza de ${pctNeg}% en ${negLabel.toLowerCase()}.`,
    tone: isHigh ? 'danger' : isMed ? 'warn' : 'safe',
    badgeText: isHigh ? 'Riesgo Alto' : isMed ? 'Riesgo Medio' : 'Riesgo Bajo',
    confidencePct: isHigh || isMed ? pctPos : pctNeg,
    recommendation,
  }
}

export function buildDefaultHumanValues(columns: ColumnSummary[]): Record<string, any> {
  const values: Record<string, any> = {}
  for (const col of columns) {
    if (col.dtype === 'numeric') {
      values[col.name] = formatCleanNumber(col.mean ?? 0, col)
    } else {
      const cats = Object.keys(col.top_values || {})
      values[col.name] = cats[0] || ''
    }
  }
  return values
}

export function buildHumanPreset(
  profileKey: string,
  columns: ColumnSummary[],
  slot: 'safe' | 'risk',
  previewRows: Record<string, any>[] = []
): Record<string, any> {
  const next = buildDefaultHumanValues(columns)
  const setIfPresent = (k: string, v: any) => {
    if (columns.some(c => c.name === k)) {
      next[k] = v
    }
  }

  if (profileKey === 'retencion') {
    if (slot === 'safe') {
      setIfPresent('meses_antiguedad', 60)
      setIfPresent('edad_cliente', 42)
      setIfPresent('cargo_mensual', 55)
      setIfPresent('cargos_totales', 3300)
      setIfPresent('consumo_datos_gb', 68)
      setIfPresent('horas_streaming_semanal', 16)
      setIfPresent('latencia_promedio_ms', 15)
      setIfPresent('perdida_paquetes_pct', 0.1)
      setIfPresent('llamadas_soporte', 0)
      setIfPresent('atrasos_pago', 0)
      setIfPresent('puntaje_satisfaccion', 9)
      setIfPresent('dispositivos_conectados', 5)
      setIfPresent('tipo_contrato', 'Dos anios')
      setIfPresent('servicio_internet', 'Fibra Optica')
      setIfPresent('soporte_tecnico', 'Si')
      setIfPresent('metodo_pago', 'Tarjeta de Credito')
      setIfPresent('facturacion_digital', 'Si')
    } else {
      setIfPresent('meses_antiguedad', 3)
      setIfPresent('edad_cliente', 26)
      setIfPresent('cargo_mensual', 135)
      setIfPresent('cargos_totales', 405)
      setIfPresent('consumo_datos_gb', 42)
      setIfPresent('horas_streaming_semanal', 24)
      setIfPresent('latencia_promedio_ms', 74)
      setIfPresent('perdida_paquetes_pct', 4.2)
      setIfPresent('llamadas_soporte', 6)
      setIfPresent('atrasos_pago', 3)
      setIfPresent('puntaje_satisfaccion', 2.5)
      setIfPresent('dispositivos_conectados', 3)
      setIfPresent('tipo_contrato', 'Mes a mes')
      setIfPresent('servicio_internet', 'ADSL')
      setIfPresent('soporte_tecnico', 'No')
      setIfPresent('metodo_pago', 'Pago en Efectivo')
      setIfPresent('facturacion_digital', 'No')
    }
    return next
  }

  if (profileKey === 'noc') {
    if (slot === 'safe') {
      setIfPresent('temperatura_equipo_c', 36)
      setIfPresent('uso_cpu_pct', 32)
      setIfPresent('uso_memoria_pct', 40)
      setIfPresent('carga_trafico_gbps', 35)
      setIfPresent('potencia_optica_dbm', -12.5)
      setIfPresent('errores_crc_hora', 0)
      setIfPresent('reinicios_ultimos_7d', 0)
      setIfPresent('humedad_gabinete_pct', 42)
      setIfPresent('voltaje_fuente_v', 48)
      setIfPresent('antiguedad_nodo_meses', 18)
      setIfPresent('respaldo_energia', 'UPS + Generador')
    } else {
      setIfPresent('temperatura_equipo_c', 84)
      setIfPresent('uso_cpu_pct', 95)
      setIfPresent('uso_memoria_pct', 92)
      setIfPresent('carga_trafico_gbps', 145)
      setIfPresent('potencia_optica_dbm', -29.5)
      setIfPresent('errores_crc_hora', 14)
      setIfPresent('reinicios_ultimos_7d', 4)
      setIfPresent('humedad_gabinete_pct', 86)
      setIfPresent('voltaje_fuente_v', 42.5)
      setIfPresent('antiguedad_nodo_meses', 78)
      setIfPresent('respaldo_energia', 'Sin Respaldo')
    }
    return next
  }

  if (profileKey === 'noc_5g') {
    if (slot === 'safe') {
      setIfPresent('latencia_t1_ms', 14)
      setIfPresent('latencia_t2_ms', 15)
      setIfPresent('latencia_t3_ms', 14)
      setIfPresent('latencia_t4_ms', 13)
      setIfPresent('carga_cpu_t1_pct', 32)
      setIfPresent('carga_cpu_t2_pct', 34)
      setIfPresent('carga_cpu_t3_pct', 33)
      setIfPresent('carga_cpu_t4_pct', 31)
      setIfPresent('perdida_paquetes_pct', 0.1)
      setIfPresent('temperatura_transceptor_c', 36)
      setIfPresent('potencia_senal_dbm', -12.5)
      setIfPresent('banda_frecuencia', '3.5 GHz')
    } else {
      setIfPresent('latencia_t1_ms', 42)
      setIfPresent('latencia_t2_ms', 52)
      setIfPresent('latencia_t3_ms', 62)
      setIfPresent('latencia_t4_ms', 70)
      setIfPresent('carga_cpu_t1_pct', 72)
      setIfPresent('carga_cpu_t2_pct', 82)
      setIfPresent('carga_cpu_t3_pct', 90)
      setIfPresent('carga_cpu_t4_pct', 96)
      setIfPresent('perdida_paquetes_pct', 4.8)
      setIfPresent('temperatura_transceptor_c', 82)
      setIfPresent('potencia_senal_dbm', -30.5)
      setIfPresent('banda_frecuencia', '2.6 GHz')
    }
    return next
  }

  if (profileKey === 'antifraude') {
    if (slot === 'safe') {
      setIfPresent('monto_operacion_usd', 45)
      setIfPresent('hora_transaccion', 14)
      setIfPresent('distancia_ult_ubicacion_km', 5)
      setIfPresent('cambios_sim_30d', 0)
      setIfPresent('intentos_fallidos_pin', 0)
      setIfPresent('llamadas_internacionales_24h', 0)
      setIfPresent('edad_linea_meses', 54)
      setIfPresent('velocidad_consumo_ratio', 1.0)
      setIfPresent('canal_operacion', 'App Movil')
      setIfPresent('pais_destino_riesgo', 'Bajo')
      setIfPresent('dispositivo_nuevo', 'No')
      setIfPresent('verificacion_biometrica', 'Si')
    } else {
      setIfPresent('monto_operacion_usd', 1650)
      setIfPresent('hora_transaccion', 3)
      setIfPresent('distancia_ult_ubicacion_km', 2200)
      setIfPresent('cambios_sim_30d', 3)
      setIfPresent('intentos_fallidos_pin', 4)
      setIfPresent('llamadas_internacionales_24h', 8)
      setIfPresent('edad_linea_meses', 2)
      setIfPresent('velocidad_consumo_ratio', 5.5)
      setIfPresent('canal_operacion', 'Agente Externo')
      setIfPresent('pais_destino_riesgo', 'Alto')
      setIfPresent('dispositivo_nuevo', 'Si')
      setIfPresent('verificacion_biometrica', 'No')
    }
    return next
  }

  if (profileKey === 'ltv') {
    if (slot === 'safe') {
      setIfPresent('antiguedad_meses', 72)
      setIfPresent('gasto_mensual_usd', 220)
      setIfPresent('servicios_activos', 5)
      setIfPresent('consumo_datos_gb', 180)
      setIfPresent('uso_roaming_anual_usd', 320)
      setIfPresent('referidos_exitosos', 3)
      setIfPresent('puntaje_fidelidad', 95)
      setIfPresent('upgrades_plan', 3)
      setIfPresent('segmento_cliente', 'Corporativo')
      setIfPresent('tipo_plan', 'Empresarial Dedicado')
      setIfPresent('canal_adquisicion', 'Ejecutivo B2B')
    } else {
      setIfPresent('antiguedad_meses', 4)
      setIfPresent('gasto_mensual_usd', 30)
      setIfPresent('servicios_activos', 1)
      setIfPresent('consumo_datos_gb', 22)
      setIfPresent('uso_roaming_anual_usd', 0)
      setIfPresent('referidos_exitosos', 0)
      setIfPresent('puntaje_fidelidad', 35)
      setIfPresent('upgrades_plan', 0)
      setIfPresent('segmento_cliente', 'Residencial')
      setIfPresent('tipo_plan', 'Basico')
      setIfPresent('canal_adquisicion', 'Web Directa')
    }
    return next
  }

  if (profileKey === 'credito') {
    if (slot === 'safe') {
      setIfPresent('puntaje_crediticio', 790)
      setIfPresent('ingreso_anual_usd', 68000)
      setIfPresent('ratio_deuda_ingreso', 0.18)
      setIfPresent('monto_financiamiento_usd', 800)
      setIfPresent('lineas_activas', 3)
      setIfPresent('anios_historial_cliente', 8)
      setIfPresent('atrasos_ultimos_12m', 0)
      setIfPresent('modalidad_pago', 'Debito Automatico')
    } else {
      setIfPresent('puntaje_crediticio', 460)
      setIfPresent('ingreso_anual_usd', 14000)
      setIfPresent('ratio_deuda_ingreso', 0.72)
      setIfPresent('monto_financiamiento_usd', 4500)
      setIfPresent('lineas_activas', 1)
      setIfPresent('anios_historial_cliente', 1)
      setIfPresent('atrasos_ultimos_12m', 5)
      setIfPresent('modalidad_pago', 'Pago Manual')
    }
    return next
  }

  // Fallback for any custom CSV model
  const row = previewRows[slot === 'safe' ? 0 : Math.min(1, previewRows.length - 1)]
  if (row) {
    for (const col of columns) {
      if (row[col.name] !== undefined && row[col.name] !== null) {
        next[col.name] =
          col.dtype === 'numeric' ? formatCleanNumber(Number(row[col.name]), col) : String(row[col.name])
      }
    }
  }
  return next
}

export function encodeCorporate360Payload(
  areaCode: string,
  humanValues: Record<string, any>,
  areaSchema: AreaSourceSchema,
  allModelColumns: ColumnSummary[]
): Record<string, any> {
  const payload: Record<string, any> = {}

  // Initialize all columns of the unified dataset cleanly
  for (const col of allModelColumns) {
    if (col.name === 'area_corporativa') {
      payload[col.name] = areaCode
    } else if (col.dtype === 'numeric') {
      payload[col.name] = 0
    } else {
      payload[col.name] = 'No_Aplica'
    }
  }

  const zValues: number[] = []
  for (const srcCol of areaSchema.columns_summary) {
    const targetColName = `${areaCode}__${srcCol.name}`
    const rawVal = humanValues[srcCol.name]
    if (srcCol.dtype === 'numeric') {
      const num = Number(rawVal ?? srcCol.mean ?? 0)
      const mu = srcCol.mean ?? 0
      const sd = srcCol.std && srcCol.std > 0 ? srcCol.std : 1
      const z = Math.max(-4, Math.min(4, (num - mu) / sd))
      const roundedZ = Number(z.toFixed(4))
      payload[targetColName] = roundedZ
      zValues.push(roundedZ)
    } else {
      payload[targetColName] = String(rawVal ?? Object.keys(srcCol.top_values || {})[0] ?? 'Otro')
    }
  }

  if (zValues.length > 0) {
    const meanZ = zValues.reduce((acc, v) => acc + v, 0) / zValues.length
    const variance = zValues.reduce((acc, v) => acc + (v - meanZ) ** 2, 0) / zValues.length
    const maxAbs = Math.max(...zValues.map(v => Math.abs(v)))
    payload.indice_magnitud_area = Number(meanZ.toFixed(4))
    payload.indice_volatilidad_area = Number(Math.sqrt(variance).toFixed(4))
    payload.indice_pico_maximo_area = Number(maxAbs.toFixed(4))
  }

  return payload
}

export function getAreaDisplayInfo(model: CatalogModelVersion): AreaDisplayInfo {
  const pid = (model.project_id || '').toLowerCase()
  const pname = model.project_name || model.project_id

  if (pid === 'prj-area-retencion' || pid.includes('retencion')) {
    return {
      id: model.project_id,
      badge: 'Área 01',
      shortName: 'Retención',
      fullName: pname,
      accent: 'cyan',
      infoTitle: 'Área 01 · Retención de Clientes',
      infoText:
        'Predice la probabilidad de fuga voluntaria de un cliente según su facturación, antigüedad, calidad de internet y reclamos a soporte.',
      order: 1,
    }
  }
  if (pid === 'prj-area-noc' || pid.includes('noc')) {
    return {
      id: model.project_id,
      badge: 'Área 02',
      shortName: 'Red NOC 5G',
      fullName: pname,
      accent: 'indigo',
      infoTitle: 'Área 02 · Operaciones de Red (2 consultas)',
      infoText:
        'Esta área incluye 2 consultas distintas: Diagnóstico general de torres/nodos NOC (Operativo, Degradado o Falla Crítica) y Salud de Enlace 5G con series de latencia y CPU.',
      order: 2,
    }
  }
  if (pid === 'prj-area-antifraude' || pid.includes('antifraude')) {
    return {
      id: model.project_id,
      badge: 'Área 03',
      shortName: 'Antifraude',
      fullName: pname,
      accent: 'rose',
      infoTitle: 'Área 03 · Seguridad Antifraude',
      infoText:
        'Detecta transacciones sospechosas, suplantación de SIM y roaming anómalo en tiempo real. Permite elegir entre 3 arquitecturas entrenadas (GAN, MLP o RNN).',
      order: 3,
    }
  }
  if (pid === 'prj-area-comercial' || pid.includes('comercial')) {
    return {
      id: model.project_id,
      badge: 'Área 04',
      shortName: 'Comercial',
      fullName: pname,
      accent: 'emerald',
      infoTitle: 'Área 04 · Crecimiento Comercial (2 consultas)',
      infoText:
        'Esta área incluye 2 modelos con objetivos distintos: proyección de Valor Comercial Anual (LTV en USD) y evaluación de Riesgo Crediticio (probabilidad de mora).',
      order: 4,
    }
  }
  if (pid === 'prj-modelo-general' || pid.includes('general')) {
    return {
      id: model.project_id,
      badge: 'General 360°',
      shortName: 'Corporativo 360°',
      fullName: pname,
      accent: 'violet',
      infoTitle: 'Modelo General Corporativo 360°',
      infoText:
        'Consolida las 4 áreas operativas en un único modelo de alerta global. Puedes ingresar valores reales normales del área que elijas y el sistema los transforma internamente.',
      order: 5,
    }
  }

  return {
    id: model.project_id,
    badge: 'Proyecto',
    shortName: pname.length > 22 ? `${pname.slice(0, 22)}…` : pname,
    fullName: pname,
    accent: 'amber',
    infoTitle: pname,
    infoText:
      model.project_description ||
      'Proyecto personalizado con modelos neuronales listos para evaluar datos nuevos.',
    order: 50,
  }
}

export function buildCopyableSummary(params: {
  areaName: string
  goalTitle: string
  modelLabel: string
  verdict: InterpretedVerdict
  topFactors: Array<{ label: string; value: string; pct: number }>
}): string {
  const lines = [
    `Predicción IA — ${params.areaName} (${params.goalTitle})`,
    `Modelo: ${params.modelLabel}`,
    `Resultado: ${params.verdict.headline} [${params.verdict.badgeText}]${params.verdict.confidencePct !== null ? ` · Confianza: ${params.verdict.confidencePct}%` : ''
    }`,
    `Resumen: ${params.verdict.subheadline}`,
  ]
  if (params.topFactors.length > 0) {
    lines.push('Factores clave:')
    for (const f of params.topFactors) {
      lines.push(`  - ${f.label}: ${f.value} (${f.pct}%)`)
    }
  }
  lines.push(`Acción recomendada: ${params.verdict.recommendation}`)
  return lines.join('\n')
}

export function buildCsvTemplateText(columns: ColumnSummary[], previewRows: Record<string, any>[]): string {
  const headers = columns.map(c => c.name)
  const lines = [headers.join(',')]
  const sampleCount = Math.min(3, Math.max(1, previewRows.length))

  for (let i = 0; i < sampleCount; i++) {
    const row = previewRows[i] || {}
    const vals = columns.map(col => {
      let val = row[col.name]
      if (val === undefined || val === null || val === '') {
        val =
          col.dtype === 'numeric'
            ? formatCleanNumber(col.mean ?? 0, col)
            : Object.keys(col.top_values || {})[0] || ''
      }
      const str = String(val)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    })
    lines.push(vals.join(','))
  }
  return lines.join('\n')
}
