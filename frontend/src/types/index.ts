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

export type MissingStrategy = 'median_mode' | 'mean_mode' | 'drop_rows' | 'zero'
export type OutlierStrategy = 'none' | 'iqr_clip' | 'iqr_drop'
export type ScalerStrategy = 'standard' | 'minmax' | 'robust' | 'none'
export type SplitRatioOption = '70/15/15' | '80/10/10' | '60/20/20'

export interface DatasetCleaningOptions {
  missing_strategy?: MissingStrategy
  drop_duplicates?: boolean
  outlier_strategy?: OutlierStrategy
  drop_columns?: string[]
  scaler_type?: ScalerStrategy
  split_ratio?: SplitRatioOption
  normalize_text?: boolean
  extract_dates?: boolean
  group_rare_categories?: boolean
  log_transform_skewed?: boolean
  stratify_split?: boolean
}

export interface AutoCleanDroppedDetail {
  column: string
  reason: string
}

export interface AutoCleanAlert {
  type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
}

export interface ClassBalanceInfo {
  distribution: Record<string, number>
  minority_class_pct: number
  is_imbalanced: boolean
}

export interface AutoCleanImpactPreview {
  rows_before: number
  estimated_rows_after: number
  columns_before: number
  estimated_columns_after: number
  estimated_input_shape: number
}

export interface AutoCleanExplanation {
  step: string
  decision: string
  reason: string
}

export interface AutoCleanPlanResponse {
  recommended: {
    target_column: string
    missing_strategy: MissingStrategy
    drop_duplicates: boolean
    outlier_strategy: OutlierStrategy
    drop_columns: string[]
    scaler_type: ScalerStrategy
    split_ratio: SplitRatioOption
    normalize_text?: boolean
    extract_dates?: boolean
    group_rare_categories?: boolean
    log_transform_skewed?: boolean
    stratify_split?: boolean
  }
  diagnostics: {
    total_rows: number
    total_columns: number
    estimated_rows_after: number
    null_cells: number
    null_rows: number
    null_rows_pct: number
    duplicate_rows: number
    duplicate_rows_pct: number
    outlier_rows: number
    outlier_rows_pct: number
    health_score_before: number
    health_score_after: number
    dropped_columns_detail: AutoCleanDroppedDetail[]
    critical_alerts?: AutoCleanAlert[]
    class_balance?: ClassBalanceInfo | null
    impact_preview?: AutoCleanImpactPreview
  }
  explanations: AutoCleanExplanation[]
}

export interface RawDatasetStats {
  raw_rows: number
  raw_columns: number
  raw_null_cells: number
  raw_null_rows: number
  raw_duplicate_rows: number
}

export interface CleaningReport {
  rows_before: number
  rows_after: number
  rows_removed: number
  target_null_rows_removed?: number
  null_cells_before: number
  null_cells_after: number
  duplicates_removed: number
  outliers_handled: number
  columns_dropped: string[]
  missing_strategy: string
  outlier_strategy: string
  scaler_applied: string
  split_ratio: string
  numeric_repaired?: string[]
  text_normalized?: string[]
  dates_extracted?: string[]
  rare_grouped_columns?: string[]
  log_transformed_columns?: string[]
  stratified_applied?: boolean
  normalize_text?: boolean
  extract_dates?: boolean
  group_rare_categories?: boolean
  log_transform_skewed?: boolean
}

export interface DatasetRowsResponse {
  dataset_id: string
  source: 'raw' | 'clean'
  has_raw_version: boolean
  columns: string[]
  target_column: string
  total_rows: number
  filtered_rows: number
  total_null_rows: number
  total_null_cells: number
  duplicate_rows: number
  page: number
  page_size: number
  rows: Record<string, any>[]
}

export interface ColumnSummary {
  name: string
  dtype: 'numeric' | 'categorical'
  missing: number
  missing_after?: number
  unique: number
  is_target: boolean
  mean?: number
  std?: number
  min?: number
  max?: number
  top_values?: Record<string, number>
  excluded_reason?: string
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
  target_classes?: string[]
  excluded_columns?: string[]
  scaler_applied: string
  feature_names: string[]
  output_activation: string
  suggested_loss: string
  suggested_metric: string
  splits: SplitsMeta
  columns_summary: ColumnSummary[]
  preview: Record<string, any>[]
  raw_stats?: RawDatasetStats
  cleaning_report?: CleaningReport
  log_transformed_columns?: string[]
  class_balance?: ClassBalanceInfo | null
  recommended_class_weights?: Record<string, number> | null
}

export interface FusionReport {
  mode: string
  strategy: string
  datasets_merged: number
  total_input_rows: number
  final_rows: number
  duplicates_removed: number
  jaccard_compatibility_pct: number
  aligned_feature_count: number
  shared_columns_count: number
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
  fusion_report?: FusionReport
  created_at: string
}

export interface AreaSelectionInput {
  project_id: string
  dataset_id?: string
}

export interface AreaContribution {
  project_id: string
  project_name: string
  area_code: string
  rows_contributed: number
  alert_rate_pct: number
  original_features: number
}

export interface CrossAreaFusionReport {
  mode: string
  areas_merged: number
  final_rows: number
  unified_input_shape: number
  target_column: string
  overall_alert_rate_pct: number
  area_contributions: AreaContribution[]
}

export interface CrossAreaFusionResponse {
  project: {
    id: string
    name: string
  }
  dataset_id: string
  dataset_name: string
  architecture_id: string
  job_id: string | null
  fusion_report: CrossAreaFusionReport
}

export interface LayerSpec {
  id: string
  type: 'Dense' | 'Dropout' | 'BatchNormalization' | 'Conv1D' | 'MaxPooling1D' | 'Flatten' | 'LSTM' | 'GRU'
  units?: number
  activation?: 'relu' | 'tanh' | 'sigmoid' | 'softmax' | 'linear'
  rate?: number
  use_bias?: boolean
  filters?: number
  kernel_size?: number
  padding?: 'same' | 'valid'
  pool_size?: number
  return_sequences?: boolean
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

export type JobStatus = 'QUEUED' | 'PREPARING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

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
  dataset_id?: string
  dataset_name?: string
  target_column?: string
  architecture_config?: ArchitectureConfig
  dataset_metadata?: EDAMetadata
  created_at: string
}

export interface AreaSourceSchema {
  project_id: string
  project_name: string
  dataset_name: string
  target_column: string
  columns_summary: ColumnSummary[]
  preview: Record<string, any>[]
}

export interface CatalogModelVersion extends ModelVersion {
  project_name: string
  project_description?: string
  area_source_schemas?: Record<string, AreaSourceSchema>
}

export interface CsvPredictionItem {
  row_index: number
  features: Record<string, any>
  prediction: string | number
  predicted_label: string
  probability: number | null
  risk_level: 'ALTO' | 'MEDIO' | 'BAJO'
}

export interface CsvPredictionResponse {
  model_id: string
  filename: string
  dataset_name: string
  target_column: string
  problem_type: 'binary_classification' | 'multiclass_classification' | 'regression'
  total_rows: number
  truncated: boolean
  matched_columns: string[]
  missing_columns: string[]
  high_risk_count: number
  medium_risk_count: number
  low_risk_count: number
  avg_prediction: number | null
  class_counts: Record<string, number>
  latency_ms: number
  items: CsvPredictionItem[]
  csv_content: string
}

export interface LayerTrace {
  name: string
  type: string
  units: number
  activation: string
  neurons: number[]
  neuron_names?: string[]
  mean_activation: number
  max_activation: number
  active_ratio: number
}

export interface FeatureContribution {
  name: string
  raw_value: string
  scaled_value: number
  impact: number
  importance_pct: number
  direction: 'positive' | 'negative'
}

export interface PredictionResponse {
  problem_type: string
  target_column: string
  prediction: string | number
  predicted_label: string
  probability: number | null
  probabilities: Record<string, number> | null
  latency_ms: number
  layer_traces?: LayerTrace[]
  feature_contributions?: FeatureContribution[]
}

export interface BatchPredictionItem {
  row_index: number
  features: Record<string, any>
  actual_target: string | null
  prediction: string | number
  predicted_label: string
  probability: number | null
  risk_level: 'ALTO' | 'MEDIO' | 'BAJO'
}

export interface BatchPredictionResponse {
  model_id: string
  dataset_name: string
  target_column: string
  problem_type: string
  total_scanned: number
  high_risk_count: number
  latency_ms: number
  items: BatchPredictionItem[]
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
  cancellation_reason?: string
  notes?: string
  random_seed?: number
  priority?: number
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

export interface ComputeTelemetry {
  cpu_pct: number
  cpu_avg_pct?: number
  cpu_cores: number
  ram_used_gb: number
  ram_total_gb: number
  ram_pct: number
  disk_used_gb: number
  disk_total_gb: number
  disk_pct: number
  datasets_storage_mb: number
  models_storage_mb: number
  runtime_device: string
  cpu_history: Array<{ t: string; cpu: number }>
}

export interface DashboardTrainedModel {
  id: string
  project_id: string
  version: string
  status: string
  target_column?: string
  project_name: string
  arch_name?: string
  dataset_name?: string
  test_metrics?: Record<string, any>
  created_at: string
}

export interface DashboardActivityItem {
  id: string
  actor_name: string
  project_id?: string
  action: string
  metadata: Record<string, any>
  created_at: string
}

export interface DashboardOverview {
  total_projects: number
  total_jobs: number
  active_jobs: number
  approved_models: number
  total_models?: number
  total_datasets?: number
  total_architectures?: number
  total_rows_corpus?: number
  system_health: {
    status: string
    uptime_pct: number
    engine: string
    gpu_acceleration: boolean
    queue_capacity: number
  }
  compute_telemetry?: ComputeTelemetry
  trained_models?: DashboardTrainedModel[]
  recent_activity?: DashboardActivityItem[]
  recent_jobs: any[]
}

