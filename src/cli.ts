import { resolve } from "node:path";
import { runAgent } from "./agent/runner.js";
import type { CliOptions } from "./types.js";

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    data: "./data/sample",
    out: "./output/report.html",
    config: "./config/scoring.json",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data" && argv[i + 1]) opts.data = argv[++i];
    else if (arg === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (arg === "--config" && argv[i + 1]) opts.config = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: node dist/cli.js [options]

Options:
  --data <dir>     CSV データディレクトリ (default: ./data/sample)
  --out <path>     HTML 出力パス (default: ./output/report.html)
  --config <path>  スコア設定 JSON (default: ./config/scoring.json)
  --dry-run        LLM を使わず無料で実行（キーワード分類・ルール提案）
  --help, -h       ヘルプ表示

Environment (LLM モード):
  GOOGLE_API_KEY   Google Gemini API キー（Google AI Studio で取得）
  LLM_MODEL        モデル名 (default: gemini-2.5-flash)

Cost notes:
  --dry-run        無料（API 呼び出しなし）
  LLM モード       Gemini 無料枠内なら無料（Flash 系・日次上限あり）
`);
}

function getApiKey(): string | undefined {
  return (
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.LLM_API_KEY
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const model = process.env.LLM_MODEL ?? "gemini-3.6-flash";
  const apiKey = getApiKey();

  console.log(`データ: ${opts.data}`);
  console.log(`出力:   ${opts.out}`);
  console.log(`モード: ${opts.dryRun ? "dry-run（無料）" : "LLM（Gemini API）"}`);
  if (!opts.dryRun) console.log(`モデル: ${model}`);

  if (!opts.dryRun && !apiKey) {
    console.error(
      "Error: GOOGLE_API_KEY が未設定です。\n" +
        "  無料で試す: node dist/cli.js --dry-run\n" +
        "  LLM 実行:  Google AI Studio でキー取得 → .env に GOOGLE_API_KEY を設定\n" +
        "  https://aistudio.google.com/apikey",
    );
    process.exit(1);
  }

  try {
    const outPath = await runAgent({
      dataDir: resolve(opts.data),
      configPath: resolve(opts.config),
      outputPath: resolve(opts.out),
      apiKey,
      model,
      dryRun: opts.dryRun,
    });
    console.log(`レポートを保存しました: ${outPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
