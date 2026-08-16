import type {
  ClassificationResult,
  CustomerRequest,
  PriorityLabel,
  Project,
  RequestScoreDetail,
  ScoredTheme,
  ScoringPolicy,
  ThemeGroup,
} from "../types.js";

export function scoreThemes(
  themes: ThemeGroup[],
  projects: Project[],
  requests: CustomerRequest[],
  policy: ScoringPolicy,
): ScoredTheme[] {
  const projectMap = new Map(projects.map((p) => [p.project_id, p]));
  const requestMap = new Map(requests.map((r) => [r.request_id, r]));

  return themes
    .map((theme) => {
      const requestDetails: RequestScoreDetail[] = [];
      let baseSum = 0;
      const projectIds = new Set<string>();

      for (const requestId of theme.request_ids) {
        const request = requestMap.get(requestId);
        if (!request) continue;
        const project = projectMap.get(request.project_id);
        if (!project) continue;

        const perRequest = scoreSingleRequest(project, policy);
        baseSum += perRequest;
        projectIds.add(project.project_id);
        requestDetails.push({
          request_id: request.request_id,
          project_name: project.project_name,
          request_summary: truncate(request.request_text, 40),
          score: round(perRequest),
        });
      }

      let score = baseSum;
      if (theme.request_ids.length >= policy.multi_request_threshold) {
        score *= policy.multi_request_bonus_multiplier;
      }

      const projectCount = projectIds.size;
      if (
        policy.multi_project_bonus.enabled &&
        projectCount >= policy.multi_project_bonus.min_projects
      ) {
        const extra = projectCount - 1;
        score *= 1 + policy.multi_project_bonus.multiplier_per_extra_project * extra;
      }

      const impacted = [...projectIds]
        .map((id) => projectMap.get(id)?.project_name ?? id)
        .sort();

      return {
        name: theme.name,
        request_ids: theme.request_ids,
        score: round(score),
        priority_label: labelScore(score, policy.priority_labels),
        impacted_projects: impacted,
        request_details: requestDetails,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function scoreSingleRequest(project: Project, policy: ScoringPolicy): number {
  const base = profitBaseScore(project, policy);
  const rankMul = policy.customer_rank_multiplier[project.customer_rank] ?? 1;
  const isUnsigned = policy.unsigned_contract_statuses.includes(project.contract_status);
  const contractMul = isUnsigned ? policy.unsigned_contract_multiplier : 1;
  return base * rankMul * contractMul;
}

function profitBaseScore(project: Project, policy: ScoringPolicy): number {
  const { profit_yen_per_point, min_base_score, max_base_score } = policy.profit_base_score;
  const raw = Math.round(project.annual_profit_yen / profit_yen_per_point);
  return Math.min(max_base_score, Math.max(min_base_score, raw));
}

function labelScore(score: number, labels: PriorityLabel[]): string {
  const sorted = [...labels].sort((a, b) => b.min_score - a.min_score);
  for (const entry of sorted) {
    if (score >= entry.min_score) return entry.label;
  }
  return sorted[sorted.length - 1]?.label ?? "低";
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
