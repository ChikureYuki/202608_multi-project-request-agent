import type { ScoredTheme } from "../types.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prioClass(label: string): string {
  if (label === "中") return "prio mid";
  if (label === "低") return "prio low";
  return "prio";
}

function changeTypeLabel(type: string): string {
  return type === "new" ? "新規追加" : "既存改善";
}

export function renderReportHtml(
  themes: ScoredTheme[],
  meta: { generatedAt: string; dataDir: string; requestCount: number; projectCount: number },
): string {
  const sorted = [...themes].sort((a, b) => b.score - a.score);

  const summaryRows = sorted
    .map(
      (theme) => `<tr>
        <td>${escapeHtml(theme.name)}</td>
        <td>${theme.score}</td>
        <td><span class="${prioClass(theme.priority_label)}">${escapeHtml(theme.priority_label)}</span></td>
        <td>${escapeHtml(theme.proposal?.proposal ?? "—")}</td>
      </tr>`,
    )
    .join("");

  const themeCards = sorted
    .map((theme) => {
      const proposal = theme.proposal;
      const changeType = proposal?.change_type ?? "new";
      const rows = theme.request_details
        .map(
          (d) =>
            `<tr><td>${escapeHtml(d.request_id)}</td><td>${escapeHtml(d.project_name)}</td><td>${escapeHtml(d.request_summary)}</td><td>${d.score}</td></tr>`,
        )
        .join("");

      return `
  <article class="theme-card">
    <div class="theme-head">
      <h3>${escapeHtml(theme.name)}</h3>
      <span class="${prioClass(theme.priority_label)}">優先度: ${escapeHtml(theme.priority_label)}</span>
      <span class="change-type">${escapeHtml(changeTypeLabel(changeType))}</span>
      <span class="chip">スコア: ${theme.score}</span>
    </div>
    <div class="theme-body">
      <dl class="report">
        <dt>提案</dt>
        <dd>${escapeHtml(proposal?.proposal ?? "（提案生成中）")}</dd>
        <dt>根拠</dt>
        <dd>${escapeHtml(proposal?.rationale ?? "")}</dd>
        <dt>影響案件</dt>
        <dd>${escapeHtml(theme.impacted_projects.join("、"))}</dd>
        <dt>参照要望</dt>
        <dd>${escapeHtml(theme.request_ids.join(", "))}</dd>
        <dt>参照プロダクト情報</dt>
        <dd>${escapeHtml(proposal?.referenced_product ?? "")}</dd>
      </dl>
      <div class="table-wrap">
        <table>
          <thead><tr><th>要望ID</th><th>案件</th><th>要望概要</th><th>1件スコア</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </article>`;
    })
    .join("\n");

  const topTheme = sorted[0]?.name ?? "—";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>開発提案レポート — 複数案件の要望から次の開発を提案するAIエージェント</title>
<style>
  :root {
    --emerald-dark:#3a9d94; --card-grad:linear-gradient(145deg,#f9fcfb 0%,#eef5f3 100%);
    --line:#d0e0dc; --line-soft:#ddeae7; --fg:#333; --muted:#666;
    --shadow:0 10px 30px rgba(0,0,0,.05);
    --pill-grad:linear-gradient(90deg,#8ed9d2 0%,#66c2b9 55%,#52b5ac 100%);
    --th-base:#ecf4f2; --th-fg:#555; --ok:#2d8a82; --warn:#a67c28;
  }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; color:var(--fg); font-size:15px;
    font-family:"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic UI",sans-serif;
    line-height:1.55; background:#f2f6f5; }
  .wrap { max-width:1080px; margin:0 auto; padding:28px 20px 48px; }
  .page-head h1 { font-size:26px; font-weight:700; margin:0 0 8px; color:var(--emerald-dark); }
  .sub { color:var(--muted); font-size:13px; }
  .meta-chips { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0 20px; }
  .chip { font-size:12px; padding:4px 12px; border-radius:50px;
    background:rgba(102,194,185,.15); border:1px solid var(--line); }
  .panel { background:var(--card-grad); border:1px solid var(--line); border-radius:20px;
    margin-bottom:18px; box-shadow:var(--shadow); overflow:hidden; }
  .panel-head { padding:14px 20px 12px; border-bottom:1px dashed var(--line); background:var(--pill-grad); }
  .panel-head h2 { font-size:17px; font-weight:600; margin:0; color:#fff; }
  .panel-body { padding:16px 20px 18px; }
  .theme-card { border:1px solid var(--line); border-radius:16px; margin-bottom:16px;
    background:rgba(255,255,255,.4); overflow:hidden; }
  .theme-head { padding:12px 16px; background:rgba(102,194,185,.12);
    border-bottom:1px dashed var(--line-soft); display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
  .theme-head h3 { margin:0; font-size:16px; color:var(--emerald-dark); flex:1; }
  .prio { font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px;
    background:rgba(45,138,130,.15); color:var(--ok); }
  .prio.mid { background:rgba(166,124,40,.12); color:var(--warn); }
  .prio.low { background:rgba(102,102,102,.12); color:#666; }
  .change-type { font-size:11px; padding:2px 8px; border-radius:999px;
    background:rgba(61,127,168,.12); color:#3d7fa8; }
  .theme-body { padding:14px 16px 16px; }
  dl.report { margin:0; display:grid; grid-template-columns:120px 1fr; gap:8px 12px; font-size:14px; }
  dl.report dt { font-weight:600; color:var(--emerald-dark); margin:0; }
  dl.report dd { margin:0; }
  .callout { padding:12px 14px; border-radius:12px; margin:16px 0 0;
    background:rgba(45,138,130,.08); border:1px dashed #9dcdc8; font-size:14px; }
  .table-wrap { border:1px solid var(--line); border-radius:12px; overflow:hidden; margin-top:12px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { border-bottom:1px dashed var(--line-soft); padding:8px 10px; text-align:left; vertical-align:top; }
  thead th { background:var(--th-base); color:var(--th-fg); font-weight:600; }
  .summary-table td:nth-child(2) { white-space:nowrap; font-weight:600; color:var(--emerald-dark); }
  .foot { font-size:12px; color:var(--muted); margin-top:24px; }
</style>
</head>
<body>
<div class="wrap">
  <header class="page-head">
    <h1>開発提案レポート</h1>
    <p class="sub">複数案件の要望から次の開発を提案する AI エージェント — 要件定義 §5.2 準拠</p>
    <div class="meta-chips">
      <span class="chip">生成日時: ${escapeHtml(meta.generatedAt)}</span>
      <span class="chip">データ: ${escapeHtml(meta.dataDir)}</span>
      <span class="chip">要望 ${meta.requestCount} 件 / 案件 ${meta.projectCount} 社</span>
    </div>
  </header>
  <section class="panel">
    <div class="panel-head"><h2>サマリー</h2></div>
    <div class="panel-body">
      <p>テーマ ${sorted.length} 件を<strong>スコアの高い順</strong>に整理。最優先候補: <strong>${escapeHtml(topTheme)}</strong></p>
      <div class="table-wrap">
        <table class="summary-table">
          <thead>
            <tr>
              <th>項目名（テーマ）</th>
              <th>スコア</th>
              <th>優先度</th>
              <th>提案内容</th>
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>
      </div>
      <div class="callout">本レポートは<strong>提案</strong>です。最終的な採否と実装計画への反映は人（PdM）が行います。</div>
    </div>
  </section>
${themeCards}
  <p class="foot">生成: dev-proposal-agent / 優先度閾値 高≥150 / 中≥80 / 低≥30</p>
</div>
</body>
</html>`;
}
