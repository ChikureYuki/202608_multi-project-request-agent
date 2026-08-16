import { loadAllData } from "../data/loaders.js";
import { extractJsonBlock } from "../llm/extract.js";
import { GeminiClient, normalizeToolName } from "../llm/gemini.js";
import { renderReportHtml } from "../report/render.js";
import { scoreThemes } from "../scoring/calculate.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools/handlers.js";
import type {
  AgentContext,
  ChatMessage,
  ClassificationResult,
  ProposalResult,
  ScoredTheme,
} from "../types.js";

import { classifyOffline, loadDataViaTools, proposeOffline } from "./offline.js";

export interface RunOptions {
  dataDir: string;
  configPath: string;
  outputPath: string;
  apiKey?: string;
  model: string;
  dryRun?: boolean;
}

const MAX_TOOL_ITERATIONS = 12;

export async function runAgent(options: RunOptions): Promise<string> {
  if (options.dryRun) {
    return runAgentDryRun(options);
  }
  if (!options.apiKey) {
    throw new Error("GOOGLE_API_KEY が未設定です。無料実行は --dry-run を使ってください。");
  }

  return runAgentWithLlm(options);
}

async function runAgentDryRun(options: RunOptions): Promise<string> {
  const ctx: AgentContext = {
    dataDir: options.dataDir,
    configPath: options.configPath,
    outputPath: options.outputPath,
    projects: [],
    requests: [],
    product: { features: [], meta: [] },
    policy: loadAllData(options.dataDir, options.configPath).policy,
  };

  loadDataViaTools(ctx);

  ctx.classification = classifyOffline(ctx.requests);
  ctx.scoredThemes = scoreThemes(
    ctx.classification.themes,
    ctx.projects,
    ctx.requests,
    ctx.policy,
  );
  ctx.scoredThemes = proposeOffline(ctx.scoredThemes, ctx.product, ctx.requests);

  const html = renderReportHtml(ctx.scoredThemes, {
    generatedAt: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
    dataDir: options.dataDir,
    requestCount: ctx.requests.length,
    projectCount: ctx.projects.length,
  });

  executeTool("save_report", JSON.stringify({ html }), ctx);
  return options.outputPath;
}

async function runAgentWithLlm(options: RunOptions): Promise<string> {
  const ctx: AgentContext = {
    dataDir: options.dataDir,
    configPath: options.configPath,
    outputPath: options.outputPath,
    projects: [],
    requests: [],
    product: { features: [], meta: [] },
    policy: loadAllData(options.dataDir, options.configPath).policy,
  };

  const client = new GeminiClient(options.apiKey!, options.model);

  await runToolLoadingPhase(client, ctx);

  if (ctx.projects.length === 0 || ctx.requests.length === 0) {
    throw new Error("案件または要望データが読み込めませんでした");
  }

  ctx.classification = await classifyRequests(client, ctx);

  ctx.scoredThemes = scoreThemes(
    ctx.classification.themes,
    ctx.projects,
    ctx.requests,
    ctx.policy,
  );

  ctx.scoredThemes = await generateProposals(client, ctx, ctx.scoredThemes);

  const html = renderReportHtml(ctx.scoredThemes, {
    generatedAt: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
    dataDir: options.dataDir,
    requestCount: ctx.requests.length,
    projectCount: ctx.projects.length,
  });

  executeTool("save_report", JSON.stringify({ html }), ctx);

  return options.outputPath;
}

async function runToolLoadingPhase(client: GeminiClient, ctx: AgentContext): Promise<void> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "あなたは開発提案レポート作成エージェントです。まず load_projects, load_requests, load_product, get_scoring_policy の4ツールをすべて呼び出してデータを取得してください。取得が終わったら「データ読込完了」とだけ返してください。",
    },
    {
      role: "user",
      content: "レポート作成のため、案件・要望・プロダクト情報とスコアリングポリシーを読み込んでください。",
    },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const assistant = await client.chat(messages, TOOL_DEFINITIONS);
    messages.push({
      role: "assistant",
      content: assistant.content,
      toolCalls: assistant.toolCalls,
    });

    if (!assistant.toolCalls || assistant.toolCalls.length === 0) {
      return;
    }

    for (const call of assistant.toolCalls) {
      const result = executeTool(normalizeToolName(call.name), call.arguments, ctx);
      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: result,
      });
    }
  }
}

async function classifyRequests(
  client: GeminiClient,
  ctx: AgentContext,
): Promise<ClassificationResult> {
  const prompt = `以下の要望をテーマに分類してください。

ルール:
- 1要望につき主テーマ1つ
- 表現が違っても意味が同じ要望は同一テーマにまとめる
- テーマ名は簡潔な日本語

要望:
${JSON.stringify(ctx.requests, null, 2)}

JSON のみ返してください:
{
  "themes": [{ "name": "テーマ名", "request_ids": ["R001"] }],
  "request_themes": [{ "request_id": "R001", "main_theme": "テーマ名" }]
}`;

  const message = await client.chat([
    { role: "system", content: "You classify customer requests into themes. Respond with valid JSON only." },
    { role: "user", content: prompt },
  ]);

  const raw = extractJsonBlock(message.content ?? "");
  const parsed = JSON.parse(raw) as ClassificationResult;
  validateClassification(parsed, ctx.requests.length);
  return parsed;
}

async function generateProposals(
  client: GeminiClient,
  ctx: AgentContext,
  scored: ScoredTheme[],
): Promise<ScoredTheme[]> {
  const prompt = `各テーマについて提案文を作成してください。

プロダクト機能:
${JSON.stringify(ctx.product.features, null, 2)}

プロダクト方針・制約:
${JSON.stringify(ctx.product.meta, null, 2)}

テーマ（スコア付き）:
${JSON.stringify(
    scored.map((t) => ({
      name: t.name,
      score: t.score,
      priority: t.priority_label,
      request_ids: t.request_ids,
      impacted_projects: t.impacted_projects,
    })),
    null,
    2,
  )}

要望詳細:
${JSON.stringify(ctx.requests, null, 2)}

JSON のみ返してください:
{
  "themes": [{
    "name": "テーマ名（上記と一致）",
    "proposal": "何をどう変えるか",
    "change_type": "new または improve",
    "rationale": "根拠（要望・案件属性・プロダクト情報を含む）",
    "referenced_product": "参照した機能IDや方針"
  }]
}`;

  const message = await client.chat([
    {
      role: "system",
      content:
        "You write development proposals for a PdM. change_type is 'new' if not in product features, 'improve' if extending existing. Respond with valid JSON only.",
    },
    { role: "user", content: prompt },
  ]);

  const raw = extractJsonBlock(message.content ?? "");
  const parsed = JSON.parse(raw) as ProposalResult;
  const proposalMap = new Map(parsed.themes.map((t) => [t.name, t]));

  return scored.map((theme) => ({
    ...theme,
    proposal: proposalMap.get(theme.name),
  }));
}

function validateClassification(result: ClassificationResult, requestCount: number): void {
  if (!Array.isArray(result.themes) || !Array.isArray(result.request_themes)) {
    throw new Error("分類結果の形式が不正です");
  }
  if (result.request_themes.length < requestCount) {
    throw new Error("すべての要望に主テーマが付与されていません");
  }
}
