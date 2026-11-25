import type {
  Project, Dataset, Architecture, TrainingJob,
  ModelVersion, CatalogModelVersion, AuditEvent, DashboardOverview,
  User, SystemQuotas, SystemPolicies, EpochMetric,
  PredictionResponse, BatchPredictionResponse, CsvPredictionResponse,
  CrossAreaFusionResponse, AreaSelectionInput,
  DatasetCleaningOptions, DatasetRowsResponse, AutoCleanPlanResponse
} from '../types'

const BASE_URL = '/api/v1'
const TOKEN_STORAGE_KEY = 'neurolab_token'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {}
}

export function buildAuthorizedUrl(path: string): string {
  const token = getAuthToken()
  const full = `${BASE_URL}${path}`
  if (!token) return full
  const sep = full.includes('?') ? '&' : '?'
  return `${full}${sep}token=${encodeURIComponent(token)}`
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    setAuthToken(null)
    try {
      localStorage.removeItem('neurolab_user')
    } catch {}
    window.dispatchEvent(new Event('neurolab:unauthorized'))
  }
  if (!res.ok) {
    let errorMsg = 'Error en la solicitud'
    try {
      const err = await res.json()
      errorMsg = err.detail || errorMsg
    } catch {}
    throw new Error(errorMsg)
  }
  return res.json()
}

export const api = {
  getMe: (): Promise<User> =>
    request<User>('/auth/me'),

  getOverview: (): Promise<DashboardOverview> =>
    request<DashboardOverview>('/dashboard/overview'),

  getProjects: (q?: string, status?: string): Promise<Project[]> => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    return request<Project[]>(`/projects?${params.toString()}`)
  },

  getProject: (id: string): Promise<Project> =>
    request<Project>(`/projects/${id}`),

  createProject: (data: { name: string; description: string; owner_id: string; tags: string[] }): Promise<Project> =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  updateProject: (id: string, data: Partial<Project>): Promise<Project> =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProject: (id: string): Promise<{ status: string }> =>
    request<{ status: string }>(`/projects/${id}`, { method: 'DELETE' }),

  addProjectMember: (projectId: string, data: { user_id: string; role: string }) =>
    request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }),

  removeProjectMember: (projectId: string, userId: string) =>
    request(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),

  getProjectDatasets: (projectId: string): Promise<Dataset[]> =>
    request<Dataset[]>(`/projects/${projectId}/datasets`),

  uploadDataset: async (
    projectId: string,
    file: File,
    name?: string,
    targetColumn?: string,
    scalerType: string = 'standard',
    actorId: string = 'usr-engineer',
    cleaningOptions?: DatasetCleaningOptions
  ): Promise<Dataset> => {
    const formData = new FormData()
    formData.append('file', file)
    if (name) formData.append('name', name)
    if (targetColumn) formData.append('target_column', targetColumn)
    formData.append('scaler_type', cleaningOptions?.scaler_type ?? scalerType)
    formData.append('actor_id', actorId)
    if (cleaningOptions?.missing_strategy) {
      formData.append('missing_strategy', cleaningOptions.missing_strategy)
    }
    if (typeof cleaningOptions?.drop_duplicates === 'boolean') {
      formData.append('drop_duplicates', String(cleaningOptions.drop_duplicates))
    }
    if (cleaningOptions?.outlier_strategy) {
      formData.append('outlier_strategy', cleaningOptions.outlier_strategy)
    }
    if (cleaningOptions?.drop_columns && cleaningOptions.drop_columns.length > 0) {
      formData.append('drop_columns', JSON.stringify(cleaningOptions.drop_columns))
    }
    if (cleaningOptions?.split_ratio) {
      formData.append('split_ratio', cleaningOptions.split_ratio)
    }
    if (typeof cleaningOptions?.normalize_text === 'boolean') {
      formData.append('normalize_text', String(cleaningOptions.normalize_text))
    }
    if (typeof cleaningOptions?.extract_dates === 'boolean') {
      formData.append('extract_dates', String(cleaningOptions.extract_dates))
    }
    if (typeof cleaningOptions?.group_rare_categories === 'boolean') {
      formData.append('group_rare_categories', String(cleaningOptions.group_rare_categories))
    }
    if (typeof cleaningOptions?.log_transform_skewed === 'boolean') {
      formData.append('log_transform_skewed', String(cleaningOptions.log_transform_skewed))
    }
    if (typeof cleaningOptions?.stratify_split === 'boolean') {
      formData.append('stratify_split', String(cleaningOptions.stratify_split))
    }

    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(`${BASE_URL}/projects/${projectId}/datasets/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (res.status === 401) {
      setAuthToken(null)
      window.dispatchEvent(new Event('neurolab:unauthorized'))
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al subir dataset' }))
      throw new Error(err.detail || 'Error al procesar dataset')
    }
    return res.json()
  },

  getDatasetRows: (
    datasetId: string,
    params: {
      source?: 'raw' | 'clean'
      page?: number
      page_size?: number
      search?: string
      only_nulls?: boolean
      sort_by?: string
      sort_dir?: 'asc' | 'desc'
    } = {}
  ): Promise<DatasetRowsResponse> => {
    const qs = new URLSearchParams()
    if (params.source) qs.set('source', params.source)
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    if (params.search) qs.set('search', params.search)
    if (params.only_nulls) qs.set('only_nulls', 'true')
    if (params.sort_by) qs.set('sort_by', params.sort_by)
    if (params.sort_dir) qs.set('sort_dir', params.sort_dir)
    const queryStr = qs.toString()
    return request<DatasetRowsResponse>(`/datasets/${datasetId}/rows${queryStr ? `?${queryStr}` : ''}`)
  },

  cleanDataset: (
    datasetId: string,
    data: DatasetCleaningOptions & { name?: string; target_column?: string }
  ): Promise<Dataset> =>
    request<Dataset>(`/datasets/${datasetId}/clean`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDatasetDownloadUrl: (datasetId: string, source: 'raw' | 'clean' = 'raw'): string =>
    buildAuthorizedUrl(`/datasets/${datasetId}/download?source=${source}`),

  analyzeUploadDataset: async (
    projectId: string,
    file: File,
    targetColumn?: string
  ): Promise<AutoCleanPlanResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    if (targetColumn) formData.append('target_column', targetColumn)

    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(`${BASE_URL}/projects/${projectId}/datasets/analyze-upload`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (res.status === 401) {
      setAuthToken(null)
      window.dispatchEvent(new Event('neurolab:unauthorized'))
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al diagnosticar CSV' }))
      throw new Error(err.detail || 'Error al diagnosticar CSV')
    }
    return res.json()
  },

  getDatasetAutoCleanPlan: (
    datasetId: string,
    targetColumn?: string
  ): Promise<AutoCleanPlanResponse> => {
    const qs = targetColumn ? `?target_column=${encodeURIComponent(targetColumn)}` : ''
    return request<AutoCleanPlanResponse>(`/datasets/${datasetId}/auto-clean-plan${qs}`)
  },

  deleteDataset: (datasetId: string): Promise<{ status: string; id: string }> =>
    request<{ status: string; id: string }>(`/datasets/${datasetId}`, { method: 'DELETE' }),

  seedSampleDataset: (projectId: string, sampleType: 'retencion' | 'red_noc' | 'antifraude' | 'comercial_ltv' = 'retencion'): Promise<Dataset> =>
    request<Dataset>(`/projects/${projectId}/datasets/seed-sample?sample_type=${sampleType}`, { method: 'POST' }),

  fuseProjectDatasets: (
    projectId: string,
    data: {
      dataset_ids: string[]
      name?: string
      strategy?: 'union' | 'intersection'
      deduplicate?: boolean
      scaler_type?: 'standard' | 'minmax'
      actor_id?: string
    }
  ): Promise<Dataset> =>
    request<Dataset>(`/projects/${projectId}/datasets/fuse`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  fuseCrossAreas: (data: {
    areas: AreaSelectionInput[]
    name?: string
    max_rows_per_area?: number
    auto_train?: boolean
    epochs?: number
    actor_id?: string
  }): Promise<CrossAreaFusionResponse> =>
    request<CrossAreaFusionResponse>('/projects/fuse-areas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDataset: (id: string): Promise<Dataset> =>
    request<Dataset>(`/datasets/${id}`),

  getProjectArchitectures: (projectId: string): Promise<Architecture[]> =>
    request<Architecture[]>(`/projects/${projectId}/architectures`),

  createArchitecture: (projectId: string, data: any): Promise<Architecture> =>
    request<Architecture>(`/projects/${projectId}/architectures`, { method: 'POST', body: JSON.stringify(data) }),

  getArchitecture: (id: string): Promise<Architecture> =>
    request<Architecture>(`/architectures/${id}`),

  createTrainingJob: (projectId: string, data: any): Promise<{ job_id: string; status: string }> =>
    request<{ job_id: string; status: string }>(`/projects/${projectId}/training-jobs`, { method: 'POST', body: JSON.stringify(data) }),

  getJob: (jobId: string): Promise<TrainingJob> =>
    request<TrainingJob>(`/training-jobs/${jobId}`),

  getJobMetrics: (jobId: string): Promise<EpochMetric[]> =>
    request<EpochMetric[]>(`/training-jobs/${jobId}/metrics`),

  cancelJob: (jobId: string, reason?: string): Promise<{ status: string }> =>
    request<{ status: string }>(`/training-jobs/${jobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    }),

  pauseJob: (jobId: string): Promise<{ status: string }> =>
    request<{ status: string }>(`/training-jobs/${jobId}/pause`, { method: 'POST' }),

  resumeJob: (jobId: string): Promise<{ status: string }> =>
    request<{ status: string }>(`/training-jobs/${jobId}/resume`, { method: 'POST' }),

  updateJobNotes: (jobId: string, notes: string): Promise<{ job_id: string; notes: string }> =>
    request<{ job_id: string; notes: string }>(`/training-jobs/${jobId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

  retryJob: (jobId: string): Promise<{ job_id: string; status: string }> =>
    request<{ job_id: string; status: string }>(`/training-jobs/${jobId}/retry`, { method: 'POST' }),

  getProjectJobs: (projectId: string): Promise<TrainingJob[]> =>
    request<TrainingJob[]>(`/projects/${projectId}/training-jobs`),

  getProjectModels: (projectId: string): Promise<ModelVersion[]> =>
    request<ModelVersion[]>(`/projects/${projectId}/models`),

  getModelsCatalog: (): Promise<CatalogModelVersion[]> =>
    request<CatalogModelVersion[]>('/models/catalog'),

  updateModelStatus: (modelId: string, status: string, notes?: string, actorId: string = 'usr-reviewer') =>
    request(`/models/${modelId}/status`, { method: 'PUT', body: JSON.stringify({ status, notes, actor_id: actorId }) }),

  predictModel: (modelId: string, features: Record<string, any>): Promise<PredictionResponse> =>
    request<PredictionResponse>(`/models/${modelId}/predict`, { method: 'POST', body: JSON.stringify({ features }) }),

  predictModelBatch: (modelId: string, limit: number = 25, offset: number = 0): Promise<BatchPredictionResponse> =>
    request<BatchPredictionResponse>(`/models/${modelId}/predict-batch`, {
      method: 'POST',
      body: JSON.stringify({ limit, offset }),
    }),

  predictModelCsv: async (modelId: string, file: File): Promise<CsvPredictionResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(`${BASE_URL}/models/${modelId}/predict-csv`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (res.status === 401) {
      setAuthToken(null)
      window.dispatchEvent(new Event('neurolab:unauthorized'))
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al evaluar el archivo CSV' }))
      throw new Error(err.detail || 'Error al evaluar el archivo CSV')
    }
    return res.json()
  },

  getAuditEvents: (projectId?: string, limit: number = 50): Promise<AuditEvent[]> => {
    if (projectId) {
      return request<AuditEvent[]>(`/projects/${projectId}/audit-events`)
    }
    return request<AuditEvent[]>(`/audit-events?limit=${limit}`)
  },

  getUsers: (): Promise<User[]> =>
    request<User[]>('/admin/users'),

  createUser: (data: any): Promise<User> =>
    request<User>('/auth/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUserRole: (userId: string, role: string) =>
    request(`/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  updateUserStatus: (userId: string, status: string) =>
    request(`/admin/users/${userId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  getSystemQuotas: (): Promise<SystemQuotas> =>
    request<SystemQuotas>('/admin/system/quotas'),

  updateSystemQuotas: (data: SystemQuotas): Promise<SystemQuotas> =>
    request<SystemQuotas>('/admin/system/quotas', { method: 'PUT', body: JSON.stringify(data) }),

  getSystemPolicies: (): Promise<SystemPolicies> =>
    request<SystemPolicies>('/admin/system/policies'),

  updateSystemPolicies: (data: SystemPolicies): Promise<SystemPolicies> =>
    request<SystemPolicies>('/admin/system/policies', { method: 'PUT', body: JSON.stringify(data) }),

  getProjectVisualizerState: (projectId: string, maxNeurons: number = 14): Promise<any> =>
    request<any>(`/projects/${projectId}/visualizer-state?max_neurons_per_layer=${maxNeurons}`),
}
