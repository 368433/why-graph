#!/usr/bin/env bash
# Genera las capturas con las medidas EXACTAS que pide la ficha del directorio de Obsidian:
# escritorio 1200x800 (3:2) y celular 900x1600 (9:16). Se renderiza al doble y se baja de
# tamaño, para que el texto quede nítido.
#
#   ./ficha.sh [carpeta-de-salida]     por defecto: ~/Desktop/why-graph-ficha
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

DEST="${1:-$HOME/Desktop/why-graph-ficha}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "No encuentro Chrome. Exporta CHROME=/ruta/a/chrome"; exit 1; }
[ -f ../../main.js ] || { echo "Falta main.js: corre npm run build"; exit 1; }

mkdir -p "$DEST"
cp ../../main.js main.js
cp ../../styles.css styles.css
printf '\nwindow.__VistaMapa = VistaMapa; window.__AjustesMapa = AjustesMapa; window.__AJUSTES_BASE = AJUSTES_BASE;\n' >> main.js
node -e "const fs=require('fs');fs.writeFileSync('vault.js','window.__VAULT = '+fs.readFileSync('vault.json','utf8')+';')"

# $1 nombre · $2 ancho lógico · $3 alto lógico · $4 parámetros de la vista
tomar() {
  local nombre="$1" ancho="$2" alto="$3" params="${4:-}"
  local ventana_w=$(( ancho < 500 ? 540 : ancho + 40 ))
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size="$ventana_w,$((alto + 60))" --screenshot="/tmp/ficha-bruto.png" \
    --virtual-time-budget=7000 "file://$PWD/mirador.html?ancho=$ancho&alto=$alto&$params" >/dev/null 2>&1
  python3 - "$nombre" "$ancho" "$alto" "$DEST" <<'PY'
import sys
from PIL import Image
nombre, ancho, alto, dest = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
im = Image.open('/tmp/ficha-bruto.png').crop((0, 0, ancho * 2, alto * 2)).convert('RGB')
# El celular se entrega al doble (900x1600, que es lo que pide la ficha); el escritorio
# se baja a 1200x800 desde el doble, para que el texto quede nítido.
if ancho >= 500:
    im = im.resize((ancho, alto), Image.LANCZOS)
ruta = f'{dest}/{nombre}.png'
im.save(ruta, optimize=True)
print(f'  {nombre}.png  {im.size[0]}x{im.size[1]}  {round(__import__("os").path.getsize(ruta)/1024)} KB')
PY
}

echo "Escritorio (1200x800):"
tomar "1-el-mapa"        1200 800 ""
tomar "2-el-porque"      1200 800 "foco=Tostadora"
tomar "3-los-vacios"     1200 800 "vista=vacios"
tomar "4-el-camino"      1200 800 "vista=camino&de=Hotel&a=Mapa"
tomar "5-radial"         1200 800 "vista=radial&foco=Camila"

echo "Celular (900x1600):"
tomar "movil-1-el-mapa"   450 800 "movil=1"
tomar "movil-2-el-porque" 450 800 "movil=1&foco=Tostadora"
tomar "movil-3-radial"    450 800 "movil=1&vista=radial&foco=Camila"

rm -f main.js styles.css vault.js
echo "Listas en $DEST"
