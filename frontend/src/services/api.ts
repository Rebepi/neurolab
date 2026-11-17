import type {
  Project, Dataset, Architecture, TrainingJob,
  ModelVersion, AuditEvent, DashboardOverview,
  User, SystemQuotas, SystemPolicies, EpochMetric
} from '../types'

const BASE_URL = '/api/v1'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  const res = await fetch(url, { ...options, headers })
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
    actorId: string = 'usr-engineer'
  ): Promise<Dataset> => {
    const formData = new FormData()
    formData.append('file', file)
    if (name) formData.append('name', name)
    if (targetColumn) formData.append('target_column', targetColumn)
    formData.append('scaler_type', scalerType)
    formData.append('actor_id', actorId)

    const res = await fetch(`${BASE_URL}/projects/${projectId}/datasets/upload`, {
      method: 'POST',
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al subir dataset' }))
      throw new Error(err.detail || 'Error al procesar dataset')
    }
    return res.json()
  },

  seedSampleDataset: (projectId: string, sampleType: 'churn' | 'credit' = 'churn'): Promise<Dataset> =>
    request<Dataset>(`/projects/${projectId}/datasets/seed-sample?sample_type=${sampleType}`, { method: 'POST' }),

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

  cancelJob: (jobId: string, actorId: string = 'usr-engineer'): Promise<{ status: string }> =>
    request<{ status: string }>(`/training-jobs/${jobId}/cancel?actor_id=${actorId}`, { method: 'POST' }),

  retryJob: (jobId: string): Promise<{ job_id: string; status: string }> =>
    request<{ job_id: string; status: string }>(`/training-jobs/${jobId}/retry`, { method: 'POST' }),

  getProjectJobs: (projectId: string): Promise<TrainingJob[]> =>
    request<TrainingJob[]>(`/projects/${projectId}/training-jobs`),

  getProjectModels: (projectId: string): Promise<ModelVersion[]> =>
    request<ModelVersion[]>(`/projects/${projectId}/models`),

  updateModelStatus: (modelId: string, status: string, notes?: string, actorId: string = 'usr-reviewer') =>
    request(`/models/${modelId}/status`, { method: 'PUT', body: JSON.stringify({ status, notes, actor_id: actorId }) }),

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
    request<any>(`/projects/${projectId}/visualizer-state?max_neurons_per_layer=${maxNeurons}`)
}

