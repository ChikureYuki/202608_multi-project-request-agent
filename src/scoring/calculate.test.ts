import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadAllData } from "../data/loaders.js";
import { scoreThemes } from "../scoring/calculate.js";
import { resolve } from "node:path";

describe("scoreThemes", () => {
  it("calculates export theme with multi-request and multi-project bonus", () => {
    const dataDir = resolve("data/sample");
    const configPath = resolve("config/scoring.json");
    const { projects, requests, policy } = loadAllData(dataDir, configPath);

    const exportTheme = {
      name: "データのエクスポート機能",
      request_ids: ["R001", "R002", "R003", "R004", "R005", "R006", "R007", "R008"],
    };

    const scored = scoreThemes([exportTheme], projects, requests, policy);
    assert.equal(scored.length, 1);
    assert.ok(scored[0].score >= 150, `expected 高 (>=150), got ${scored[0].score}`);
    assert.equal(scored[0].priority_label, "高");
    assert.equal(scored[0].impacted_projects.length, 6);
  });

  it("uses priority thresholds 150/80/30", () => {
    const dataDir = resolve("data/sample");
    const configPath = resolve("config/scoring.json");
    const { projects, requests, policy } = loadAllData(dataDir, configPath);

    const mediumTheme = { name: "CSVエクスポート（A社）", request_ids: ["R001", "R002"] };
    const scored = scoreThemes([mediumTheme], projects, requests, policy);
    assert.equal(scored[0].priority_label, "中");
    assert.ok(scored[0].score >= 80 && scored[0].score < 150);

    const lowTheme = { name: "単一要望", request_ids: ["R003"] };
    const low = scoreThemes([lowTheme], projects, requests, policy);
    assert.equal(low[0].priority_label, "低");
    assert.ok(low[0].score >= 30 && low[0].score < 80);
  });
});
