# Claude Code 向け指示

本リポジトリのエージェント開発ルールは **[`AGENT.md`](AGENT.md)** に集約しています。

作業を始める前に **必ず AGENT.md を読み**、そこに書かれた方針・CSV 仕様・優先度ルール・完成基準に従ってください。

## クイックリファレンス

- **プロダクト:** 複数案件の要望から次の開発を提案する AI エージェント
- **入力:** `data/sample/*.csv`
- **出力:** HTML レポート
- **LLM:** Google Gemini `gemini-2.5-flash`（`.env` の `GOOGLE_API_KEY`）
- **要件:** [`docs/要件定義.html`](docs/要件定義.html)

詳細は AGENT.md を参照してください。
