#!/usr/bin/env python3
"""Genera el gráfico del ahorro de tokens, en español y en inglés.

Forma: tres medidores. La pista completa es lo que cuesta SIN la estructura; el tramo
lleno es lo que cuesta CON ella. La proporción es real, sin escala logarítmica y sin
mínimos inventados: el tramo lleno se ve diminuto porque de verdad lo es.
"""
import pathlib

SUP = '#0B1026'        # superficie (el azul del mapa)
ACENTO = '#1FC8B4'     # el tramo con estructura — contraste verificado sobre la superficie
PISTA = '#2A3566'      # lo que cuesta sin estructura
TINTA = '#E6EAFF'
TINTA2 = 'rgba(230,234,255,.62)'
TINTA3 = 'rgba(230,234,255,.40)'
MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"  # comillas simples: van dentro de un atributo XML

TEXTOS = {
    'es': {
        'titulo': 'Lo que ahorra un motivo escrito',
        'sub': 'Medido en un vault real de 254 notas y 916 enlaces',
        'filas': [
            ('¿Por qué se conectan estas dos notas?', 'leer el motivo', 25, 'leer las dos notas', 2832, '115×'),
            ('Dame el contexto de un tema', 'leer su síntesis', 460, 'leer todas sus notas', 20800, '45×'),
            ('Una consulta al segundo cerebro', 'índice y páginas concretas', 15600, 'volcar el wiki entero', 147800, '9×'),
        ],
        'leyenda_a': 'con la estructura escrita',
        'leyenda_b': 'sin ella',
        'unidad': 'tokens de entrada',
        'metodo': ('Método: caracteres ÷ 3,7 (español técnico), ±15 %. Las barras son proporcionales, sin escala logarítmica. '
                   'La última fila es una cota superior: nadie vuelca el wiki entero en cada pregunta.'),
    },
    'en': {
        'titulo': 'What a written reason saves',
        'sub': 'Measured on a real vault of 254 notes and 916 links',
        'filas': [
            ('Why are these two notes connected?', 'read the reason', 25, 'read both notes', 2832, '115×'),
            ('Give me the context of a topic', 'read its synthesis', 460, 'read all its notes', 20800, '45×'),
            ('One query against the vault', 'index plus the right pages', 15600, 'dump the whole wiki', 147800, '9×'),
        ],
        'leyenda_a': 'with the structure written down',
        'leyenda_b': 'without it',
        'unidad': 'input tokens',
        'metodo': ('Method: characters ÷ 3.7 (technical Spanish), ±15%. Bars are proportional — no log scale. '
                   'The last row is an upper bound: nobody dumps a whole wiki on every question.'),
    },
}

W, H = 920, 400
X0, PISTA_W = 300, 470          # dónde empieza la barra y cuánto mide la pista
FILA_Y = [150, 232, 314]
ALTO = 26
SEP = 2                          # el hueco de 2 px entre los dos tramos, del color de la superficie


def miles(n, idioma):
    s = f'{n:,}'
    return s.replace(',', '.') if idioma == 'es' else s


def svg(idioma):
    t = TEXTOS[idioma]
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
         f'role="img" aria-label="{t["titulo"]}">',
         f'<rect width="{W}" height="{H}" rx="14" fill="{SUP}"/>',
         f'<text x="40" y="52" fill="{TINTA}" font-family="{SANS}" font-size="22" font-weight="600">{t["titulo"]}</text>',
         f'<text x="40" y="76" fill="{TINTA2}" font-family="{SANS}" font-size="13.5">{t["sub"]}</text>']

    # leyenda: identidad nunca por color solo — cada tramo lleva además su etiqueta directa
    p.append(f'<rect x="40" y="103" width="22" height="9" rx="4" fill="{ACENTO}"/>')
    p.append(f'<text x="70" y="112" fill="{TINTA2}" font-family="{SANS}" font-size="12.5">{t["leyenda_a"]}</text>')
    lx = 70 + len(t['leyenda_a']) * 6.6 + 26
    p.append(f'<rect x="{lx}" y="103" width="22" height="9" rx="4" fill="{PISTA}"/>')
    p.append(f'<text x="{lx + 30}" y="112" fill="{TINTA2}" font-family="{SANS}" font-size="12.5">{t["leyenda_b"]}</text>')
    p.append(f'<text x="{W - 40}" y="112" fill="{TINTA3}" font-family="{MONO}" font-size="11.5" '
             f'text-anchor="end">{t["unidad"]}</text>')

    for (pregunta, etq_a, con, etq_b, sin, razon), y in zip(t['filas'], FILA_Y):
        ancho_con = max(3.0, PISTA_W * con / sin)
        p.append(f'<text x="40" y="{y - 12}" fill="{TINTA}" font-family="{SANS}" font-size="14">{pregunta}</text>')
        # la pista entera = el costo sin estructura
        p.append(f'<rect x="{X0}" y="{y}" width="{PISTA_W}" height="{ALTO}" rx="4" fill="{PISTA}"/>')
        # el tramo lleno = el costo con estructura, proporcional de verdad
        p.append(f'<rect x="{X0}" y="{y}" width="{ancho_con + SEP}" height="{ALTO}" rx="4" fill="{SUP}"/>')
        p.append(f'<rect x="{X0}" y="{y}" width="{ancho_con}" height="{ALTO}" rx="4" fill="{ACENTO}"/>')
        # etiquetas directas de los dos valores, en tinta y no en el color de la serie
        p.append(f'<text x="{X0 - 14}" y="{y + 17}" fill="{TINTA}" font-family="{MONO}" font-size="12.5" '
                 f'text-anchor="end">{miles(con, idioma)}</text>')
        p.append(f'<text x="{X0 - 14}" y="{y + 32}" fill="{TINTA3}" font-family="{SANS}" font-size="11" '
                 f'text-anchor="end">{etq_a}</text>')
        p.append(f'<text x="{X0 + PISTA_W - 10}" y="{y + 17}" fill="{TINTA}" font-family="{MONO}" font-size="12.5" '
                 f'text-anchor="end">{miles(sin, idioma)}</text>')
        p.append(f'<text x="{X0 + PISTA_W - 10}" y="{y + 32}" fill="{TINTA3}" font-family="{SANS}" font-size="11" '
                 f'text-anchor="end">{etq_b}</text>')
        # la razón, que es el titular de cada fila
        p.append(f'<text x="{W - 40}" y="{y + 20}" fill="{ACENTO}" font-family="{MONO}" font-size="21" '
                 f'font-weight="600" text-anchor="end">{razon}</text>')

    # el método, declarado en el propio gráfico
    metodo = t['metodo']
    corte = metodo.rfind(' ', 0, 118)
    p.append(f'<text x="40" y="372" fill="{TINTA3}" font-family="{SANS}" font-size="11">{metodo[:corte]}</text>')
    p.append(f'<text x="40" y="387" fill="{TINTA3}" font-family="{SANS}" font-size="11">{metodo[corte + 1:]}</text>')
    p.append('</svg>')
    return '\n'.join(p)


for idioma in ('es', 'en'):
    salida = pathlib.Path(__file__).parent / f'ahorro-{idioma}.svg'
    salida.write_text(svg(idioma))
    print(salida.name, salida.stat().st_size // 1024, 'KB')
