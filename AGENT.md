# AGENT.md — 共通エージェント開発指示

本ファイルは、Cursor / Claude Code / Codex など **どの AI 開発ツールでも参照する共通の開発ルール** です。  
リポジトリ内の作業を始める前に必ず読んでください。

---

## プロダクト

**名称:** 複数案件の要望から次の開発を提案する AI エージェント

**対象プロダクト（サンプル）:** MCP Manager（AI エージェント管理基盤）

**やること:** 複数案件の要望 CSV と案件属性・プロダクト情報を読み、テーマ分類・優先度付け・新規/改善提案を HTML レポートとして出力する TypeScript CLI エージェントを実装する。

**やらないこと:** バックログへの自動登録、本番プロダクト接続、作り込んだ Web UI。最終的な採否と実装計画への反映は人（PdM）が行う。

---

## 参照ドキュメント

| 優先 | ファイル | 用途 |
|---|---|---|
| 1 | [`docs/要件定義.html`](docs/要件定義.html) | ビジネス要件・完成基準（v1.1） |
| 2 | [`README.md`](README.md) | セットアップ・デモ・アーキテクチャ |
| 3 | [`config/scoring.json`](config/scoring.json) | 優先度スコアのルール |
| 4 | [`docs/design-tools-and-scoring.md`](docs/design-tools-and-scoring.md) | ツール分割・スコア計算の詳細 |
| 5 | [`docs/report-template.html`](docs/report-template.html) | HTML レポート形式 |
| 6 | [`data/sample/`](data/sample/) | サンプル CSV データ |

---

## 技術スタック

- **言語:** TypeScript（Node.js 20+）
- **起動:** CLI
- **実行時 LLM:** Google Gemini API（デフォルト `gemini-3.6-flash`、無料枠利用可）
- **入力:** CSV（`projects.csv`, `requests.csv`, `product_features.csv`, `product_meta.csv`）
- **出力:** HTML レポート（[`docs/report-template.html`](docs/report-template.html) 準拠）
- **ツール:** Function Calling 5 種（詳細は [`docs/design-tools-and-scoring.md`](docs/design-tools-and-scoring.md)）

---

## ディレクトリ構成（目標）

```
.
├── AGENT.md              # 本ファイル（共通ルール）
├── CLAUDE.md             # Claude Code 向け入口（AGENT.md 参照）
├── README.md
├── config/
│   └── scoring.json      # 優先度ルール
├── data/
│   └── sample/           # サンプル CSV（架空データ）
├── docs/
│   └── 要件定義.html
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── agent/runner.ts     # エージェント本体
│   ├── tools/handlers.ts   # Function Calling 5 種
│   ├── scoring/calculate.ts
│   ├── report/render.ts    # HTML 生成
│   └── ...
├── output/               # 生成レポート（gitignore 推奨）
└── .env.example
```

---

## 入力 CSV 仕様

### projects.csv

| 列 | 説明 |
|---|---|
| project_id | 案件識別子 |
| project_name | 案件名称（サンプルは株式会社A〜J） |
| period_start / period_end | 契約期間 |
| annual_profit_yen | 年間利益（円）。スコア計算は金額からベース点を導出 |
| customer_rank | 顧客ランク: `A` / `B` / `C` |
| contract_status | `契約中` または `契約未済` |

### requests.csv

| 列 | 説明 |
|---|---|
| request_id | 要望識別子 |
| project_id | 紐付く案件 ID |
| request_text | 要望本文 |
| source | 入手元（定例、問い合わせ等） |
| created_at | 記録日（YYYY-MM-DD） |
| urgency | 任意（高/空） |

### product_features.csv / product_meta.csv

- **features:** 現行機能一覧（新規/改善判断の参照）
- **meta:** プロダクト方針、今期重点、開発制約（`meta_key`, `meta_value`）

---

## 優先度スコア（ルール実装）

[`config/scoring.json`](config/scoring.json) と [`docs/design-tools-and-scoring.md`](docs/design-tools-and-scoring.md) に従う。**AI にはスコア自体を任せない。**

1. 要望 1 件: `profit_base × rank_multiplier × contract_multiplier`（profit_base は annual_profit_yen から算出）
2. テーマ合計: ① の合計
3. 要望 ≥ 3 件: ② × `multi_request_bonus_multiplier`（1.5）
4. 案件 ≥ 2 社: ③ × `(1 + 0.1 × (案件数 - 1))`

---

## 実行方法（セキュリティ）

npm は必須ではない。推奨:

```bash
npm ci --ignore-scripts
npm run build
node dist/cli.js --data ./data/sample --out ./output/report.html
```

**PdM 向けランチャー（ローカルサーバー不要）:**

| OS | ファイル |
|---|---|
| Windows | `scripts/report.bat` |
| Mac / Linux | `scripts/report.sh`（初回 `chmod +x`） |

`data/production/` に本番 CSV を置き、実行後 `output/report.html` をブラウザで開く。無料確認は `--dry-run` 引数。

`npm run report` は上記のラッパーとして定義してよい。

---

## LLM の役割分担

| 処理 | 担当 |
|---|---|
| データ読込・スコア計算・HTML 保存 | ルール / Tools |
| テーマ分類・同義要望のグルーピング | LLM |
| 新規追加 / 既存改善の判断・提案文・根拠 | LLM（プロダクト情報を参照） |
| 採否・実装計画反映 | 人 |

LLM 出力は JSON スキーマ（または zod）で検証し、不正時はリトライする。

---

## コーディング規約

- 既存ファイルのスタイルに合わせ、最小限の diff で変更する
- 型を明示し、`any` を避ける
- API キーは `.env` のみ。リポジトリに含めない
- ログに要望本文・顧客名をそのまま出さない（識別子で追跡）
- コメントは非自明な業務ロジックのみ
- テストは意味のあるものだけ（スコア計算、CSV パース等）

---

## 環境変数

```env
GOOGLE_API_KEY=...
LLM_MODEL=gemini-3.6-flash
LOG_LEVEL=info
```

未設定時は秘密情報を出力せず安全に失敗すること。

---

## 実装時のチェックリスト

- [x] CSV 4 種を読み込める Tools
- [x] Gemini Function Calling で tool call ループ（データ読込フェーズ）
- [x] 優先度が scoring.json どおりに計算される
- [x] レポートが HTML で出力される
- [x] `data/sample/` で実行可能（LLM 時は GOOGLE_API_KEY、または --dry-run）
- [x] README の手順と一致

---

## データの扱い

- **サンプル同梱:** `data/sample/` の CSV のみ（架空要望・架空会社名）
- **実務利用:** 顧客データとレポートは社内限定環境で管理。リポジトリに載せない

---

## ツール別入口

| ツール | 入口ファイル |
|---|---|
| Cursor | 本 `AGENT.md` + `.cursor/rules/`（必要に応じて） |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) → 本ファイル |
| Codex / その他 | 本 `AGENT.md` を直接参照 |
