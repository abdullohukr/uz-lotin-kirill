#!/bin/bash
# Builds the publishable add-in into dist/.
#   tools/build.sh https://<user>.github.io/<repo>
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${1:?usage: tools/build.sh https://<host>/<path>   (no trailing slash)}"
BASE="${BASE%/}"
ORIGIN="$(echo "$BASE" | sed -E 's#^(https?://[^/]+).*#\1#')"

rm -rf dist && mkdir -p dist/assets
python3 tools/make_icons.py >/dev/null
python3 tools/build_brands.py >/dev/null
cp addin/*.html addin/*.js addin/*.css dist/
cp addin/assets/*.png dist/assets/
cp addin/install/* dist/          # mac.sh, win.txt (+ uninstall): one-line installers
cp src/engine.js dist/engine.js
python3 - <<'PY'
import json
ex = json.load(open("data/exceptions.json"))
ex["foreign"] = json.load(open("data/foreign.json"))
ex["acronyms"] = json.load(open("data/acronyms.json"))
ex["brands"] = json.load(open("data/brands.json"))
open("dist/exceptions.js", "w").write("window.UZ_EXCEPTIONS = " + json.dumps(ex, ensure_ascii=False, separators=(",", ":")) + ";\n")
PY
# cache busting: the pages load their scripts with ?v=<version from version.json>
VER="$(date +%Y%m%d%H%M%S)"
printf '{"v":"%s"}\n' "$VER" > dist/version.json
sed -e "s#__BASE__#${BASE}#g" -e "s#__ORIGIN__#${ORIGIN}#g" addin/manifest.template.xml > dist/manifest.xml
touch dist/.nojekyll
cp dist/manifest.xml manifest.xml
# GitHub Pages serves the docs/ folder of the main branch
rm -rf docs && cp -R dist docs
echo "Built dist/ for ${BASE}"
echo "manifest: $(pwd)/manifest.xml"
