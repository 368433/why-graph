#!/usr/bin/env node
/* Mapa de un repositorio: convierte un proyecto TypeScript en un vault que Why Graph dibuja.
 *
 *   node herramientas/mapa-de-repo.mjs <repo> <vault-de-salida>
 *
 * PILOTO. No es parte del plugin y no se publica con él.
 *
 * Todo ocurre en esta máquina: el código se lee con el compilador de TypeScript del propio repo,
 * sin IA y sin red. Esa es la razón de no usar Graphify para esto: Graphify manda los Markdown del
 * repo a un modelo y no tiene un modo para evitarlo, y el código de un cliente no puede salir.
 *
 * Qué produce:
 *   L0 Rutas       src/app y el middleware — lo que el usuario visita
 *   L1 Módulos     los archivos de src/features/<función>
 *   L2 Compartido  src/shared y src/lib
 *   L3 Datos       las tablas y buckets de Supabase que el código lee o escribe
 *   L4 Funciones   una síntesis por función del producto (pagos, cobros…)
 *
 * La última capa tiene que ser de síntesis: Why Graph la rotula con el nombre del tema, porque en
 * un LLM wiki ahí van las páginas de tema. Con las tablas al final se leían «auth, auth, auth…» en
 * vez de su nombre. La función es el equivalente exacto de una página de tema.
 *
 * El motivo de cada enlace es el código que lo crea («importa validarRut»), no una deducción.
 * El vault resultante es un mapa del código de un cliente: queda en esta máquina, fuera de git y
 * fuera de iCloud (carpeta .nosync).
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [repoArg, salidaArg] = process.argv.slice(2);
if (!repoArg || !salidaArg) {
  console.error('Uso: node herramientas/mapa-de-repo.mjs <repo> <vault-de-salida>');
  process.exit(1);
}
const REPO = resolve(repoArg), SALIDA = resolve(salidaArg);
const SRC = join(REPO, 'src');
if (!existsSync(SRC)) { console.error(`No encuentro ${SRC}: el piloto espera un proyecto con src/.`); process.exit(1); }

// El compilador del propio repo: lee su sintaxis exacta, sin adivinar con expresiones regulares.
let ts;
try { ts = createRequire(join(REPO, 'package.json'))('typescript'); }
catch { console.error('El repo no tiene typescript instalado (npm install en el repo).'); process.exit(1); }

const CAPAS = ['L0 Rutas', 'L1 Módulos', 'L2 Compartido', 'L3 Datos', 'L4 Funciones'];

// ── 1. Los archivos ─────────────────────────────────────────────────────────────────────────────
const archivos = [];
const recorrer = (dir) => {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n === '__tests__' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.(ts|tsx)$/.test(n) && !/\.(test|spec)\.tsx?$/.test(n) && !n.endsWith('.d.ts')) archivos.push(p);
  }
};
recorrer(SRC);
const existe = new Set(archivos);

// ── 2. Nombre, capa y título de cada módulo ─────────────────────────────────────────────────────
// Obsidian prohíbe * " \ / < > : | ? en los nombres, y los corchetes rompen un [[enlace]]. Next.js
// usa [id] y (grupo) en las carpetas: los corchetes pasan a llaves, los paréntesis se quedan.
const limpio = (s) => s.replace(/\[/g, '{').replace(/\]/g, '}').replace(/[*"\\<>:|?#^]/g, '_');

function describir(abs) {
  const partes = relative(SRC, abs).replace(/\.(tsx?)$/, '').split('/');
  const [raiz, ...resto] = partes;
  if (raiz === 'app') {
    const ruta = '/' + resto.filter((x) => !/^\(.*\)$/.test(x) && !['page', 'layout', 'route', 'loading', 'error', 'not-found', 'template'].includes(x)).join('/');
    const tipo = resto[resto.length - 1];
    return { capa: 0, nombre: limpio('ruta.' + resto.join('.')), titulo: `${ruta === '/' ? '/' : ruta} · ${tipo}`, funcion: null };
  }
  if (raiz === 'middleware') return { capa: 0, nombre: 'middleware', titulo: 'middleware', funcion: null };
  if (raiz === 'features' && resto.length > 1) {
    const [funcion, ...camino] = resto;
    return { capa: 1, nombre: limpio(`${funcion}.${camino.join('.')}`), titulo: `${funcion} · ${camino.join('/')}`, funcion };
  }
  if (raiz === 'shared' || raiz === 'lib') {
    return { capa: 2, nombre: limpio(`${raiz}.${resto.join('.')}`), titulo: `${raiz} · ${resto.join('/')}`, funcion: null };
  }
  return { capa: 2, nombre: limpio(partes.join('.')), titulo: partes.join('/'), funcion: null };
}

// ── 3. Leer cada archivo con el compilador ──────────────────────────────────────────────────────
const resolverImport = (desde, spec) => {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(desde), spec);
  else return null; // un paquete externo (react, next, @supabase/…) no es parte del mapa
  for (const c of [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]) if (existe.has(c)) return c;
  return null;
};
const LECTURA = new Set(['select']), ESCRITURA = new Set(['insert', 'update', 'upsert', 'delete']);
// Un resumen sale del primer comentario del archivo, si lo hay. Nunca se copia algo que parezca
// una credencial: un comentario viejo puede traer una llave pegada.
const PARECE_SECRETO = /(api[_-]?key|secret|token|password|passwd|sk_live|sk_test|eyJ[a-zA-Z0-9]{10,})/i;

const modulos = new Map();   // abs → { ...describir, exports, resumen, enlaces: Map(destino → Set(nombres)), datos }
const datos = new Map();     // 'tabla.x' | 'bucket.x' → { tipo, nombre, lectores: Set, escritores: Set }
let dinamicas = 0;

for (const abs of archivos) {
  const texto = readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, texto, ts.ScriptTarget.Latest, true, abs.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const m = { ...describir(abs), ruta: relative(REPO, abs), exports: [], resumen: '', enlaces: new Map(), datos: new Map() };

  const comentario = ts.getLeadingCommentRanges(texto, sf.statements[0]?.getFullStart() ?? 0)?.[0];
  if (comentario) {
    const t = texto.slice(comentario.pos, comentario.end).replace(/^\/\*\*?|\*\/$|^\s*\*\s?|^\s*\/\/\s?/gm, ' ').replace(/\s+/g, ' ').trim();
    const primera = t.split(/(?<=\.)\s/)[0].slice(0, 180);
    if (primera && !PARECE_SECRETO.test(primera) && !/^(use client|use server|eslint|@ts-|prettier)/i.test(primera)) m.resumen = primera;
  }

  const enlazar = (spec, nombres, verbo) => {
    const destino = resolverImport(abs, spec);
    if (!destino || destino === abs) return;
    const k = m.enlaces.get(destino) || { verbo, nombres: new Set() };
    if (verbo === 'importa') k.verbo = 'importa';
    nombres.forEach((x) => k.nombres.add(x));
    m.enlaces.set(destino, k);
  };

  const visitar = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause, nombres = [];
      if (c?.name) nombres.push(c.name.text);
      if (c?.namedBindings) {
        if (ts.isNamespaceImport(c.namedBindings)) nombres.push('* as ' + c.namedBindings.name.text);
        else c.namedBindings.elements.forEach((e) => nombres.push(e.name.text));
      }
      enlazar(n.moduleSpecifier.text, nombres, c?.isTypeOnly ? 'usa los tipos' : 'importa');
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      const nombres = n.exportClause && ts.isNamedExports(n.exportClause) ? n.exportClause.elements.map((e) => e.name.text) : ['todo'];
      enlazar(n.moduleSpecifier.text, nombres, 'reexporta');
    } else if (ts.isCallExpression(n)) {
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
        enlazar(n.arguments[0].text, [], 'carga bajo demanda');
      }
      if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'from' && n.arguments.length === 1) {
        const objeto = n.expression.expression.getText(sf);
        if (objeto !== 'Array' && objeto !== 'Buffer') {
          if (ts.isStringLiteralLike(n.arguments[0])) {
            const esBucket = /\.storage$/.test(objeto) || objeto === 'storage';
            const nombre = n.arguments[0].text;
            const id = (esBucket ? 'bucket.' : 'tabla.') + limpio(nombre);
            const op = ts.isPropertyAccessExpression(n.parent) ? n.parent.name.text : '';
            const d = datos.get(id) || { tipo: esBucket ? 'bucket' : 'tabla', nombre, lectores: new Set(), escritores: new Set() };
            const escribe = ESCRITURA.has(op) || (esBucket && /upload|remove|move|copy/.test(op));
            (escribe ? d.escritores : d.lectores).add(abs);
            datos.set(id, d);
            const ops = m.datos.get(id) || new Set();
            if (op) ops.add(op);
            m.datos.set(id, ops);
          } else dinamicas++;   // .from(CONSTANTE): no se sabe la tabla sin ejecutar el código
        }
      }
    }
    // Lo que el archivo ofrece hacia afuera, para el panel.
    if (n.parent === sf && ts.canHaveModifiers?.(n) && ts.getModifiers(n)?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)) {
      const esDefault = ts.getModifiers(n).some((x) => x.kind === ts.SyntaxKind.DefaultKeyword);
      if (esDefault) m.exports.push('default');
      else if (n.name?.text) m.exports.push(n.name.text);
      else if (ts.isVariableStatement(n)) n.declarationList.declarations.forEach((d) => d.name?.text && m.exports.push(d.name.text));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  modulos.set(abs, m);
}

// ── 4. El color: cada función del producto es un tema ───────────────────────────────────────────
// Una ruta toma el color de la función que más usa; una tabla, el de la función que más la
// escribe (y si nadie la escribe, la que más la lee). Lo compartido va en gris a propósito.
const funciones = [...new Set([...modulos.values()].map((m) => m.funcion).filter(Boolean))].sort();
const masFrecuente = (lista) => {
  const c = {}; for (const x of lista) if (x) c[x] = (c[x] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
};
for (const m of modulos.values()) {
  if (m.funcion) m.tema = m.funcion;
  else if (m.capa === 0) m.tema = masFrecuente([...m.enlaces.keys()].map((d) => modulos.get(d)?.funcion)) || 'sitio';
  else m.tema = 'compartido';
}
for (const d of datos.values()) {
  const quien = (set) => [...set].map((a) => modulos.get(a)?.tema).filter((t) => t && t !== 'compartido' && t !== 'sitio');
  d.tema = masFrecuente(quien(d.escritores)) || masFrecuente(quien(d.lectores)) || 'compartido';
}

// ── 5. Escribir el vault ────────────────────────────────────────────────────────────────────────
// Solo se borran las carpetas que este guion genera: nunca el vault entero, que puede tener la
// configuración de Obsidian que el usuario ya ajustó.
mkdirSync(SALIDA, { recursive: true });
for (const c of CAPAS) { rmSync(join(SALIDA, c), { recursive: true, force: true }); mkdirSync(join(SALIDA, c), { recursive: true }); }

const yaml = (s) => JSON.stringify(String(s));   // una cadena JSON es YAML válido y escapa todo
const nombreDe = (abs) => modulos.get(abs).nombre;
let enlaces = 0;

for (const [abs, m] of modulos) {
  const lineas = [];
  for (const [destino, k] of [...m.enlaces].sort((a, b) => nombreDe(a[0]).localeCompare(nombreDe(b[0])))) {
    const nombres = [...k.nombres].slice(0, 6);
    const mas = k.nombres.size > 6 ? ` y ${k.nombres.size - 6} más` : '';
    lineas.push(`- [[${nombreDe(destino)}]] — ${k.verbo}${nombres.length ? ' ' + nombres.join(', ') + mas : ''}`);
    enlaces++;
  }
  for (const [id, ops] of [...m.datos].sort()) {
    const d = datos.get(id), lista = [...ops];
    const escribe = lista.filter((o) => ESCRITURA.has(o) || /upload|remove|move|copy/.test(o));
    const verbo = escribe.length ? `escribe (${escribe.join(', ')})` : lista.some((o) => LECTURA.has(o)) ? 'lee' : 'usa';
    lineas.push(`- [[${id}]] — ${verbo} ${d.tipo === 'bucket' ? 'el bucket' : 'la tabla'} «${d.nombre}»`);
    enlaces++;
  }
  const resumen = m.resumen || `Módulo ${m.funcion ? `de la función «${m.funcion}»` : m.capa === 0 ? 'de entrada' : 'compartido'}` +
    (m.exports.length ? `. Ofrece ${m.exports.slice(0, 4).join(', ')}${m.exports.length > 4 ? '…' : ''}.` : '.');
  writeFileSync(join(SALIDA, CAPAS[m.capa], m.nombre + '.md'), [
    '---',
    `title: ${yaml(m.titulo)}`,
    `tema: ${yaml(m.tema)}`,
    `ruta: ${yaml(m.ruta)}`,
    '---',
    '',
    resumen,
    '',
    `\`${m.ruta}\`${m.exports.length ? ` · exporta ${m.exports.slice(0, 8).join(', ')}` : ''}`,
    '',
    '## Conexiones',
    '',
    ...(lineas.length ? lineas : ['_Este módulo no importa nada del proyecto._']),
    '',
  ].join('\n'));
}

for (const [id, d] of datos) {
  const lista = (set) => [...set].map((a) => `\`${modulos.get(a).ruta}\``).sort().join(', ') || '—';
  writeFileSync(join(SALIDA, CAPAS[3], id + '.md'), [
    '---',
    `title: ${yaml(d.nombre)}`,
    `tema: ${yaml(d.tema)}`,
    '---',
    '',
    // El nombre va en el título y NO se repite aquí: el resumen del plugin borra los «_» (los toma
    // por formato Markdown) y «user_id» se leía «userid». Pendiente para su próxima versión.
    `${d.tipo === 'bucket' ? 'Bucket de Supabase Storage' : 'Tabla de Supabase'} de la función «${d.tema}». ` +
      `La leen ${d.lectores.size} módulo(s) y la escriben ${d.escritores.size}.`,
    '',
    `**Escriben:** ${lista(d.escritores)}`,
    '',
    `**Leen:** ${lista(d.lectores)}`,
    '',
  ].join('\n'));
}

// ── 5b. Una síntesis por función: la capa final ───────────────────────────────────────────────
// Si la función trae su propio README, su primer párrafo es el resumen: se lee de un archivo local,
// no se manda a ninguna parte.
for (const f of funciones) {
  const propios = [...modulos.entries()].filter(([, m]) => m.funcion === f);
  const tablas = [...datos.entries()].filter(([, d]) => d.tema === f);
  const rutas = [...modulos.values()].filter((m) => m.capa === 0 && m.tema === f);
  let resumen = '';
  const leeme = join(SRC, 'features', f, 'README.md');
  if (existsSync(leeme)) {
    const parrafo = readFileSync(leeme, 'utf8').split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !x.startsWith('#'));
    if (parrafo && !PARECE_SECRETO.test(parrafo)) resumen = parrafo.replace(/\s+/g, ' ').slice(0, 280);
  }
  if (!resumen) resumen = `La función «${f}»: ${propios.length} módulo(s), ${tablas.length} tabla(s) propias y ${rutas.length} ruta(s) que la usan.`;
  writeFileSync(join(SALIDA, CAPAS[4], `funcion.${limpio(f)}.md`), [
    '---',
    `title: ${yaml(f)}`,
    `tema: ${yaml(f)}`,
    '---',
    '',
    resumen,
    '',
    `**Módulos:** ${propios.length} · **tablas propias:** ${tablas.map(([, d]) => d.nombre).join(', ') || '—'} · **rutas que la usan:** ${rutas.length}`,
    '',
    '## Conexiones',
    '',
    ...propios.map(([, m]) => `- [[${m.nombre}]] — módulo de la función`).sort(),
    ...tablas.map(([id, d]) => `- [[${id}]] — ${d.tipo === 'bucket' ? 'bucket' : 'tabla'} que la función escribe o lee`).sort(),
    '',
  ].join('\n'));
}

// ── 6. Obsidian: el plugin instalado y configurado para este mapa ───────────────────────────────
const AQUI = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(AQUI, '..');
const destinoPlugin = join(SALIDA, '.obsidian', 'plugins', 'mapa-neuronal');
mkdirSync(destinoPlugin, { recursive: true });
for (const f of ['main.js', 'manifest.json', 'styles.css']) {
  if (!existsSync(join(PLUGIN, f))) { console.error(`Falta ${f}: corre npm run build en el repo del plugin.`); process.exit(1); }
  copyFileSync(join(PLUGIN, f), join(destinoPlugin, f));
}
const COLORES = ['#F7931A', '#34D17A', '#1FC8B4', '#5B95FF', '#F5CF45', '#B79CFF', '#FF7EB6', '#8BE9FD', '#FFB86C', '#A3E635', '#E879F9', '#60A5FA'];
const temas = [
  ...funciones.map((f, i) => `${f} = ${f} = ${COLORES[i % COLORES.length]}`),
  'compartido = compartido = #8A93B8',
  'sitio = sitio = #E6EAFF',
].join('\n');
const ajustesPrevios = existsSync(join(destinoPlugin, 'data.json')) ? JSON.parse(readFileSync(join(destinoPlugin, 'data.json'), 'utf8')) : {};
writeFileSync(join(destinoPlugin, 'data.json'), JSON.stringify(Object.assign(ajustesPrevios, {
  capas: 'Rutas | lo que el usuario visita\nMódulos | el código de cada función\nCompartido | piezas que usan varias funciones\nDatos | tablas y buckets de Supabase\nFunciones | una síntesis por función',
  carpetas: CAPAS.map((c, i) => `${c} = ${i}`).join('\n'),
  propiedadTema: 'tema',
  temas,
  fuentes: false,
  seccionMotivos: 'Conexiones',
  propiedadEnlaces: '',
  propiedadFecha: '',
  configurado: true,
}), null, 2) + '\n');
writeFileSync(join(SALIDA, '.obsidian', 'community-plugins.json'), JSON.stringify(['mapa-neuronal'], null, 2) + '\n');

// ── 6b. El informe: lo que una auditoría diría, sacado del mapa y no de una IA ─────────────────
// Va en la raíz del vault, fuera de las capas, para que no se dibuje como un nodo más.
{
  const entrantes = new Map([...modulos.keys()].map((k) => [k, 0]));
  for (const m of modulos.values()) for (const d of m.enlaces.keys()) entrantes.set(d, (entrantes.get(d) || 0) + 1);

  // Una función que importa las entrañas de otra: en una arquitectura por funciones se comunican a
  // través de lo compartido, no directamente. Cada cruce es un acoplamiento que alguien va a pagar.
  const cruces = [];
  for (const m of modulos.values()) {
    if (!m.funcion) continue;
    for (const d of m.enlaces.keys()) {
      const o = modulos.get(d);
      if (o.funcion && o.funcion !== m.funcion) cruces.push(`\`${m.ruta}\` → \`${o.ruta}\``);
    }
  }
  // Nadie lo importa. Las rutas y el middleware quedan fuera: Next.js los llama sin importarlos.
  const huerfanos = [...modulos.entries()].filter(([k, m]) => m.capa > 0 && entrantes.get(k) === 0).map(([, m]) => `\`${m.ruta}\``).sort();
  const masUsados = [...modulos.entries()].filter(([, m]) => m.capa > 0).sort((a, b) => entrantes.get(b[0]) - entrantes.get(a[0])).slice(0, 5)
    .map(([k, m]) => `\`${m.ruta}\` — lo importan ${entrantes.get(k)} módulos`);
  const soloEscritas = [...datos.values()].filter((d) => d.escritores.size && !d.lectores.size).map((d) => `«${d.nombre}» — la escriben ${d.escritores.size}`);
  const soloLeidas = [...datos.values()].filter((d) => d.lectores.size && !d.escritores.size).map((d) => `«${d.nombre}» — la leen ${d.lectores.size}`);
  const compartidas = [...datos.values()].map((d) => ({ d, f: new Set([...d.escritores].map((a) => modulos.get(a).funcion).filter(Boolean)) }))
    .filter((x) => x.f.size > 1).map((x) => `«${x.d.nombre}» — la escriben ${x.f.size} funciones: ${[...x.f].join(', ')}`);
  const bloque = (titulo, porque, lista) => [`## ${titulo} · ${lista.length}`, '', porque, '', ...(lista.length ? lista.map((x) => `- ${x}`) : ['_Nada que reportar._']), ''];

  writeFileSync(join(SALIDA, 'INFORME.md'), [
    `# Informe del mapa — ${relative(resolve(REPO, '..'), REPO)}`,
    '',
    `Generado desde el código, en esta máquina, sin IA. ${archivos.length} archivos · ${modulos.size} módulos · ${datos.size} tablas y buckets · ${funciones.length} funciones.`,
    '',
    '> Estos son **candidatos**, no veredictos. Un módulo sin importadores puede ser código muerto o',
    '> un punto de entrada que el framework carga solo; una tabla que nadie lee puede ser un registro de',
    '> auditoría que se consulta a mano. Cada línea se verifica antes de actuar.',
    '',
    ...bloque('Funciones que se importan entre sí', 'En una arquitectura por funciones, una función habla con otra a través de lo compartido. Un import directo las acopla.', cruces),
    ...bloque('Tablas que varias funciones escriben', 'Dueño difuso: cuando una de ellas cambie el esquema, las otras se enteran en producción.', compartidas),
    ...bloque('Tablas que se escriben y nadie lee desde el código', 'Puede ser un registro que se consulta por fuera, o datos que ya nadie usa.', soloEscritas),
    ...bloque('Tablas que se leen y nadie escribe desde el código', 'Se llenan por otra vía: migraciones, el panel de Supabase, otro sistema. Conviene saber cuál.', soloLeidas),
    ...bloque('Módulos que nadie importa', 'Candidatos a código muerto. Los componentes que Next.js carga solos no están acá: solo módulos de funciones y compartidos.', huerfanos),
    ...bloque('Los módulos de los que más depende el resto', 'Donde un cambio pesa más. Merecen pruebas antes que nada.', masUsados),
    dinamicas ? `_${dinamicas} acceso(s) a Supabase usan un nombre de tabla variable y no se pudieron ubicar sin ejecutar el código._\n` : '',
  ].join('\n'));
}

// ── 7. El resumen para quien lo corre ───────────────────────────────────────────────────────────
const porCapa = [0, 1, 2].map((c) => [...modulos.values()].filter((m) => m.capa === c).length);
console.log(`Mapa de ${relative(resolve(REPO, '..'), REPO)}`);
console.log(`  ${archivos.length} archivos leídos · sin IA · sin red`);
CAPAS.forEach((c, i) => console.log(`  ${c.padEnd(14)} ${i < 3 ? porCapa[i] : i === 3 ? datos.size : funciones.length} nodos`));
console.log(`  ${enlaces} enlaces, todos con su motivo`);
console.log(`  ${funciones.length} funciones con color: ${funciones.join(', ')}`);
if (dinamicas) console.log(`  ${dinamicas} acceso(s) a Supabase con nombre variable: no se pueden ubicar sin ejecutar el código`);
console.log(`  → ${SALIDA}`);
console.log(`  → ${join(SALIDA, 'INFORME.md')}`);
