import { executeTool } from "../tools/handlers.js";
import type {
  AgentContext,
  ClassificationResult,
  CustomerRequest,
  ProductInfo,
  ScoredTheme,
  ThemeProposal,
} from "../types.js";

interface ThemeRule {
  name: string;
  keywords: string[];
  featureId?: string;
  changeType: "new" | "improve";
  proposalTemplate: string;
}

const THEME_RULES: ThemeRule[] = [
  {
    name: "データのエクスポート機能",
    keywords: ["csv", "excel", "エクスポート", "ダウンロード", "出力"],
    changeType: "new",
    proposalTemplate: "監査ログ・実行ログ・接続一覧に CSV エクスポートを追加する",
  },
  {
    name: "監査ログの性能・検索性改善",
    keywords: ["監査ログ", "検索", "レスポンス", "フィルタ", "インデックス"],
    featureId: "F003",
    changeType: "improve",
    proposalTemplate: "既存の監査ログ閲覧（F003）に期間指定・フィルタ保存・性能改善を追加する",
  },
  {
    name: "Slack 通知",
    keywords: ["slack", "通知"],
    featureId: "F005",
    changeType: "improve",
    proposalTemplate: "Slack 通知（F005 ベータ）の通知条件とメッセージ形式を改善する",
  },
  {
    name: "権限テンプレート",
    keywords: ["権限テンプレート", "プリセット", "テンプレート"],
    featureId: "F006",
    changeType: "improve",
    proposalTemplate: "権限テンプレート（F006）に部署別プリセットとサンプルを追加する",
  },
  {
    name: "UI / ラベル改善",
    keywords: ["日本語", "英語", "ラベル", "並び替え", "説明文"],
    changeType: "improve",
    proposalTemplate: "ダッシュボードおよび各画面のラベル・操作状態の一貫性を改善する",
  },
  {
    name: "PDF レポート出力",
    keywords: ["pdf"],
    changeType: "new",
    proposalTemplate: "来場者・利用状況レポートの PDF 出力機能を新規追加する",
  },
  {
    name: "MCP 一括操作",
    keywords: ["一括", "有効化", "ロールバック"],
    featureId: "F001",
    changeType: "improve",
    proposalTemplate: "MCP サーバー接続管理（F001）に一括有効化とロールバックを追加する",
  },
];

export function classifyOffline(requests: CustomerRequest[]): ClassificationResult {
  const themeMap = new Map<string, string[]>();
  const requestThemes: ClassificationResult["request_themes"] = [];

  for (const request of requests) {
    const theme = detectTheme(request.request_text);
    requestThemes.push({ request_id: request.request_id, main_theme: theme });
    const ids = themeMap.get(theme) ?? [];
    ids.push(request.request_id);
    themeMap.set(theme, ids);
  }

  const themes = [...themeMap.entries()].map(([name, request_ids]) => ({
    name,
    request_ids,
  }));

  return { themes, request_themes: requestThemes };
}

function detectTheme(text: string): string {
  const lower = text.toLowerCase();
  for (const rule of THEME_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return rule.name;
    }
  }
  return "その他の改善";
}

export function proposeOffline(
  scored: ScoredTheme[],
  product: ProductInfo,
  requests: CustomerRequest[],
): ScoredTheme[] {
  return scored.map((theme) => ({
    ...theme,
    proposal: buildProposal(theme, product, requests),
  }));
}

function buildProposal(
  theme: ScoredTheme,
  product: ProductInfo,
  requests: CustomerRequest[],
): ThemeProposal {
  const rule =
    THEME_RULES.find((r) => r.name === theme.name) ??
    ({
      name: theme.name,
      keywords: [],
      changeType: "improve" as const,
      proposalTemplate: `${theme.name}に対応する改修を行う`,
    } satisfies ThemeRule);

  const changeType = rule.featureId
    ? "improve"
    : rule.changeType;

  const featureRef = rule.featureId
    ? product.features.find((f) => f.feature_id === rule.featureId)
    : undefined;

  const requestSummary = theme.request_ids
    .map((id) => requests.find((r) => r.request_id === id)?.request_text.slice(0, 30))
    .filter(Boolean)
    .join(" / ");

  const changeLabel = changeType === "new" ? "新規追加" : "既存改善";
  const productNote = featureRef
    ? `${featureRef.feature_id} ${featureRef.feature_name}`
    : "現行機能一覧に該当機能なし";

  return {
    name: theme.name,
    proposal: `${rule.proposalTemplate}（${changeLabel}）`,
    change_type: changeType,
    rationale: [
      `${theme.request_ids.length} 件の要望（${theme.impacted_projects.join("・")}）。`,
      `優先度スコア ${theme.score}（${theme.priority_label}）。`,
      `要望例: ${requestSummary}。`,
      changeType === "new"
        ? `プロダクト情報上、${productNote} のため新規追加と判断。`
        : `プロダクト情報上、${productNote} を拡張する既存改善と判断。`,
    ].join(" "),
    referenced_product: productNote,
  };
}

export function loadDataViaTools(ctx: AgentContext): void {
  executeTool("load_projects", "{}", ctx);
  executeTool("load_requests", "{}", ctx);
  executeTool("load_product", "{}", ctx);
  executeTool("get_scoring_policy", "{}", ctx);
}
