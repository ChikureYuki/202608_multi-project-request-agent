import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AgentContext, ToolDefinition } from "../types.js";
import {
  loadProduct,
  loadProjects,
  loadRequests,
  loadScoringPolicy,
} from "../data/loaders.js";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "load_projects",
      description: "案件一覧 CSV (projects.csv) を読み込む",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "load_requests",
      description: "要望一覧 CSV (requests.csv) を読み込む",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "load_product",
      description: "プロダクト情報 CSV (product_features.csv, product_meta.csv) を読み込む",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_scoring_policy",
      description: "優先度スコア算出ルール (scoring.json) を取得する",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "save_report",
      description: "HTML レポートをファイルに保存する",
      parameters: {
        type: "object",
        properties: {
          html: { type: "string", description: "保存する HTML 全文" },
        },
        required: ["html"],
      },
    },
  },
];

export function executeTool(
  name: string,
  argsJson: string,
  ctx: AgentContext,
): string {
  switch (name) {
    case "load_projects": {
      ctx.projects = loadProjects(ctx.dataDir);
      return JSON.stringify({ count: ctx.projects.length, projects: ctx.projects });
    }
    case "load_requests": {
      ctx.requests = loadRequests(ctx.dataDir);
      return JSON.stringify({ count: ctx.requests.length, requests: ctx.requests });
    }
    case "load_product": {
      ctx.product = loadProduct(ctx.dataDir);
      return JSON.stringify(ctx.product);
    }
    case "get_scoring_policy": {
      ctx.policy = loadScoringPolicy(ctx.configPath);
      return JSON.stringify(ctx.policy);
    }
    case "save_report": {
      const args = JSON.parse(argsJson) as { html: string };
      mkdirSync(dirname(ctx.outputPath), { recursive: true });
      writeFileSync(ctx.outputPath, args.html, "utf-8");
      return JSON.stringify({ saved: ctx.outputPath });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
