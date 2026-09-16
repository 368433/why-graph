#!/usr/bin/env python3
"""El ícono de Why Graph: tres capas de notas y una línea que las cruza con su motivo.

Tiene que leerse a 32 px, así que solo hay tres elementos: las columnas, la curva y el
punto de origen encendido. Nada de texto ni degradados finos, que a ese tamaño desaparecen.
"""
import pathlib, subprocess

SUP = '#0B1026'      # el azul del mapa
TEAL = '#1FC8B4'     # la línea que explica, el acento
NARANJA = '#F7931A'  # el nodo de origen
TENUE = '#3A4780'    # las notas que no están en el camino

L = 512
R = 112              # radio de la esquina redondeada (misma proporción que un ícono de macOS)

# Tres columnas (capas), cinco notas cada una. Coordenadas a mano para que respire.
COLS = [130, 256, 382]
FILAS = [150, 256, 362]          # tres notas por columna: a 32 px, cinco se empastan
CAMINO = [(0, 2), (1, 0), (2, 1)]  # (columna, fila) del recorrido que se ilumina


def svg():
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L} {L}" width="{L}" height="{L}" '
         f'role="img" aria-label="Why Graph">',
         f'<rect width="{L}" height="{L}" rx="{R}" fill="{SUP}"/>']

    # las columnas, apenas insinuadas: dan la idea de capas sin robar atención
    for x in COLS:
        p.append(f'<rect x="{x - 19}" y="{FILAS[0] - 30}" width="38" height="{FILAS[-1] - FILAS[0] + 60}" '
                 f'rx="19" fill="none" stroke="{TENUE}" stroke-opacity=".45" stroke-width="4"/>')

    # todas las notas, tenues
    en_camino = set(CAMINO)
    for ci, x in enumerate(COLS):
        for fi, y in enumerate(FILAS):
            if (ci, fi) in en_camino:
                continue
            p.append(f'<circle cx="{x}" cy="{y}" r="12" fill="{TENUE}"/>')

    # la línea: de la primera capa a la última, pasando por el medio. Es el «por qué».
    (c0, f0), (c1, f1), (c2, f2) = CAMINO
    x0, y0 = COLS[c0], FILAS[f0]
    x1, y1 = COLS[c1], FILAS[f1]
    x2, y2 = COLS[c2], FILAS[f2]
    p.append(f'<path d="M {x0} {y0} C {(x0 + x1) / 2 + 40} {y0}, {(x0 + x1) / 2 - 40} {y1}, {x1} {y1} '
             f'S {(x1 + x2) / 2 + 40} {y2}, {x2} {y2}" fill="none" stroke="{TEAL}" stroke-width="17" '
             f'stroke-linecap="round"/>')

    # los nodos del camino: el de origen en naranja, los otros en el acento
    p.append(f'<circle cx="{x0}" cy="{y0}" r="24" fill="{NARANJA}"/>')
    p.append(f'<circle cx="{x1}" cy="{y1}" r="19" fill="{TEAL}"/>')
    p.append(f'<circle cx="{x2}" cy="{y2}" r="19" fill="{TEAL}"/>')
    p.append('</svg>')
    return '\n'.join(p)


aqui = pathlib.Path(__file__).parent
(aqui / 'icono.svg').write_text(svg())
print('icono.svg')

# PNG a los tamaños que piden las tiendas y para mirarlo a tamaño real
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
for lado in (512, 1024):
    escala = lado / L
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                    f'--force-device-scale-factor={escala}', f'--window-size={L},{L}',
                    f'--screenshot={aqui}/icono-{lado}.png', '--virtual-time-budget=2500',
                    f'file://{aqui}/icono.svg'], capture_output=True)
    print(f'icono-{lado}.png')
