import { readFileSync } from "node:fs";
import type {
  CustomerRequest,
  ProductFeature,
  ProductInfo,
  ProductMeta,
  Project,
  ScoringPolicy,
} from "../types.js";
import { readCsvFromDir } from "../csv/reader.js";

export function loadProjects(dataDir: string): Project[] {
  const rows = readCsvFromDir(dataDir, "projects.csv");
  return rows.map((row) => ({
    project_id: row.project_id ?? "",
    project_name: row.project_name ?? "",
    period_start: row.period_start ?? "",
    period_end: row.period_end ?? "",
    annual_profit_yen: Number.parseInt(row.annual_profit_yen ?? "0", 10) || 0,
    customer_rank: row.customer_rank ?? "",
    contract_status: row.contract_status ?? "",
  }));
}

export function loadRequests(dataDir: string): CustomerRequest[] {
  return readCsvFromDir(dataDir, "requests.csv") as unknown as CustomerRequest[];
}

export function loadProduct(dataDir: string): ProductInfo {
  const features = readCsvFromDir(dataDir, "product_features.csv") as unknown as ProductFeature[];
  const meta = readCsvFromDir(dataDir, "product_meta.csv") as unknown as ProductMeta[];
  return { features, meta };
}

export function loadScoringPolicy(configPath: string): ScoringPolicy {
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as ScoringPolicy;
}

export function loadAllData(dataDir: string, configPath: string) {
  return {
    projects: loadProjects(dataDir),
    requests: loadRequests(dataDir),
    product: loadProduct(dataDir),
    policy: loadScoringPolicy(configPath),
  };
}
