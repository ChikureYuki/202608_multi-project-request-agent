# 本番用 CSV 置き場

このフォルダに以下 4 ファイルを配置して `scripts/report.bat` または `scripts/report.sh` を実行します。

- `projects.csv`
- `requests.csv`
- `product_features.csv`
- `product_meta.csv`

デモは `data/sample/` をコピーして動作確認できます。

```bash
# Mac / Linux
cp data/sample/*.csv data/production/

# Windows (PowerShell)
Copy-Item data\sample\*.csv data\production\
```

列仕様は [`AGENT.md`](../../AGENT.md) を参照してください。
