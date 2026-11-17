export type UserRole = 
  | 'Administrador'
  | 'Responsable de proyecto'
  | 'Ingeniero/analista de IA'
  | 'Revisor'
  | 'Lector'

export interface User {
  id: string
  email: string
  display_name: string
  role: UserRole
  status: string
  created_at?: string
}

export interface ProjectMember {
  id: string
  user_id: string
  display_name: string
  email: string
  role: UserRole
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string
  owner_id: string
  owner_name?: string
  status: string
  tags: string[]
  created_at: string
  updated_at: string
  jobs_count?: number
  models_count?: number
  datasets_count?: number
  architectures_count?: number
  members?: ProjectMember[]
}

export interface ColumnSummary {
  name: string
  dtype: 'numeric' | 'categorical'
  missing: number
  unique: number
  is_target: boolean
  mean?: number
  std?: number
  min?: number
  max?: number
  top_values?: Record<string, number>
}

export interface SplitsMeta {
  train_count: number
  val_count: number
  test_count: number
  train_ratio: number
  val_ratio: number
  test_ratio: number
}

export interface EDAMetadata {
  total_rows: number
  total_columns: number
  input_shape: number
  output_dim: number
  problem_type: 'binary_classification' | 'multiclass_classification' | 'regression'
  target_column: string
  scaler_applied: string
  feature_names: string[]
  output_activation: string
  suggested_loss: string
  suggested_metric: string
  splits: SplitsMeta
  columns_summary: ColumnSummary[]
  preview: Record<string, any>[]
}

export interface Dataset {
  id: string
  project_id: string
  name: string
  version: string
  input_shape: number
  target: string
  metadata: EDAMetadata
  splits: SplitsMeta
  created_at: string
}

export interface LayerSpec {
  id: string
  type: 'Dense' | 'Dropout' | 'BatchNormalization' | 'Conv1D' | 'LSTM'
  units?: number
  activation?: 'relu' | 'tanh' | 'sigmoid' | 'softmax' | 'linear'
  rate?: number
  use_bias?: boolean
}

export interface ArchitectureConfig {
  family: 'Feedforward' | 'RNN' | 'CNN' | 'GAN'
  input_shape: number
  output_dim: number
  output_activation: string
  layers: LayerSpec[]
}

export interface Architecture {
  id: string
  project_id: string
  name: string
  family: 'Feedforward' | 'RNN' | 'CNN' | 'GAN'
  version: string
  total_parameters: number
  justification: string
  config: ArchitectureConfig
  created_at: string
}

export type JobStatus = 'QUEUED' | 'PREPARING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface Hyperparams {
  epochs: number
  batch_size: number
  optimizer: string
  learning_rate: number
  loss_function?: string
}

export interface EpochMetric {
  epoch: number
  loss: number
  accuracy: number
  val_loss: number
  val_accuracy: number
  recorded_at: string
}

export interface TestMetrics {
  test_loss: number
  test_accuracy: number
  precision: number
  recall: number
  f1_score: number
  total_test_samples: number
}

export interface ModelVersion {
  id: string
  project_id: string
  job_id: string
  version: string
  storage_key: string
  status: 'Aprobado' | 'En Revisión' | 'Borrador' | 'Retirado' | 'APPROVED' | 'IN_REVIEW' | 'DRAFT' | 'RETIRED'
  checksum: string
  test_metrics: TestMetrics
  confusion_matrix: number[][]
  arch_name?: string
  arch_family?: string
  dataset_name?: string
  created_at: string
}

export interface TrainingJob {
  id: string
  project_id: string
  architecture_id: string
  dataset_id: string
  status: JobStatus
  progress: number
  current_epoch: number
  total_epochs: number
  loss?: number
  accuracy?: number
  val_loss?: number
  val_accuracy?: number
  hyperparams: Hyperparams
  logs: string[]
  error_message?: string
  started_at?: string
  ended_at?: string
  created_at: string
  arch_name?: string
  arch_family?: string
  dataset_name?: string
  model_version?: ModelVersion
}

export interface AuditEvent {
  id: string
  actor_id: string
  actor_name: string
  project_id?: string
  action: string
  metadata: Record<string, any>
  created_at: string
}

export interface SystemQuotas {
  max_concurrent_jobs: number
  max_epochs_per_job: number
  max_dataset_mb: number
  gpu_acceleration: boolean
  retention_days: number
  max_batch_size?: number
  mixed_precision?: boolean
  random_seed?: number
}

export interface SystemPolicies {
  dataset_split_ratio: string
  min_certification_accuracy: number
  auto_approve_models: boolean
  early_stopping_enabled: boolean
  early_stopping_patience: number
  session_timeout_minutes: number
  strict_inference_audit: boolean
  require_sha256_export: boolean
}

export interface DashboardOverview {
  total_projects: number
  total_jobs: number
  active_jobs: number
  approved_models: number
  system_health: {
    status: string
    uptime_pct: number
    engine: string
    gpu_acceleration: boolean
    queue_capacity: number
  }
  recent_jobs: any[]
}

