#!/usr/bin/env bash
# Genera docs/imagenes/demo.webp: la animación del README.
#
# Cinco vistas reales del plugin sobre el vault de demo, dos segundos cada una. WebP animado y
# no GIF por dos razones medidas: el GIF pesa 908 KB contra 92 KB, y su paleta única para toda la
# animación deja los nodos GRISES — pierde justo lo que el mapa usa para distinguir temas.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "No encuentro Chrome. Exporta CHROME=/ruta/a/chrome"; exit 1; }
[ -f ../../main.js ] || { echo "Falta main.js: corre npm run build"; exit 1; }

cp ../../main.js main.js
cp ../../styles.css styles.css
printf '\nwindow.__VistaMapa = VistaMapa;\n' >> main.js
node -e "const fs=require('fs');fs.writeFileSync('vault.js','window.__VAULT = '+fs.readFileSync('vault.json','utf8')+';')"

VISTAS=("" "foco=Tostadora" "vista=vacios" "vista=camino&de=Hotel&a=Mapa" "vista=radial&foco=Camila")
i=0
for q in "${VISTAS[@]}"; do
  i=$((i + 1))
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1240,840 --screenshot="/tmp/demo-$i.png" --virtual-time-budget=7000 \
    "file://$PWD/mirador.html?ancho=1200&alto=800&$q" >/dev/null 2>&1
  echo "  cuadro $i"
done

python3 - "${#VISTAS[@]}" <<'PY'
import sys, os
from PIL import Image
n = int(sys.argv[1])
cuadros = [Image.open(f'/tmp/demo-{i}.png').convert('RGB').crop((0, 0, 1200, 800)).resize((900, 600), Image.LANCZOS)
           for i in range(1, n + 1)]
salida = '../../docs/imagenes/demo.webp'
cuadros[0].save(salida, save_all=True, append_images=cuadros[1:], duration=2000, loop=0, quality=72, method=5)
print(f'  demo.webp  {cuadros[0].size[0]}x{cuadros[0].size[1]}  {round(os.path.getsize(salida) / 1024)} KB')
PY

rm -f main.js styles.css vault.js /tmp/demo-*.png
