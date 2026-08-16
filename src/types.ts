export interface Project {
  project_id: string;
  project_name: string;
  period_start: string;
  period_end: string;
  /** 年間利益（円） */
  annual_profit_yen: number;
  customer_rank: string;
  contract_status: string;
}

export interface CustomerRequest {
  request_id: string;
  project_id: string;
  request_text: string;
  source: string;
  created_at: string;
  urgency: string;
}

export interface ProductFeature {
  feature_id: string;
  feature_name: string;
  description: string;
}

export interface ProductMeta {
  meta_key: string;
  meta_value: string;
}

export interface ProductInfo {
  features: ProductFeature[];
  meta: ProductMeta[];
}

export interface MultiProjectBonus {
  enabled: boolean;
  multiplier_per_extra_project: number;
  min_projects: number;
}

export interface PriorityLabel {
  min_score: number;
  label: string;
}

export interface ProfitBaseScore {
  profit_yen_per_point: number;
  min_base_score: number;
  max_base_score: number;
}

export interface ScoringPolicy {
  description: string;
  profit_base_score: ProfitBaseScore;
  customer_rank_multiplier: Record<string, number>;
  unsigned_contract_multiplier: number;
  unsigned_contract_statuses: string[];
  multi_request_threshold: number;
  multi_request_bonus_multiplier: number;
  multi_project_bonus: MultiProjectBonus;
  priority_labels: PriorityLabel[];
  calculation_steps?: string[];
}

export interface ThemeGroup {
  name: string;
  request_ids: string[];
}

export interface RequestThemeMapping {
  request_id: string;
  main_theme: string;
}

export interface ClassificationResult {
  themes: ThemeGroup[];
  request_themes: RequestThemeMapping[];
}

export interface ThemeProposal {
  name: string;
  proposal: string;
  change_type: "new" | "improve";
  rationale: string;
  referenced_product: string;
}

export interface ProposalResult {
  themes: ThemeProposal[];
}

export interface RequestScoreDetail {
  request_id: string;
  project_name: string;
  request_summary: string;
  score: number;
}

export interface ScoredTheme {
  name: string;
  request_ids: string[];
  score: number;
  priority_label: string;
  impacted_projects: string[];
  request_details: RequestScoreDetail[];
  proposal?: ThemeProposal;
}

export interface AgentContext {
  dataDir: string;
  configPath: string;
  outputPath: string;
  projects: Project[];
  requests: CustomerRequest[];
  product: ProductInfo;
  policy: ScoringPolicy;
  classification?: ClassificationResult;
  scoredThemes?: ScoredTheme[];
}

export interface CliOptions {
  data: string;
  out: string;
  config: string;
  dryRun: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  thoughtSignature?: string;
}

export interface ChatResponse {
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
