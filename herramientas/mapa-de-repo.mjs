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
 *   L0 Compartido  src/shared y src/lib — la caja de herramientas
 *   L1 Rutas       src/app y el middleware — lo que el usuario visita
 *   L2 Módulos     los archivos de src/features/<función>
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

// --nivel codigo (por defecto): un nodo por archivo — el nivel 4 del modelo C4.
// --nivel funciones: un nodo por función del producto — el nivel 3, el que entiende un cliente.
const args = process.argv.slice(2);
let NIVEL = 'codigo';
const iNivel = args.findIndex((a) => a.startsWith('--nivel'));
if (iNivel >= 0) {
  const a = args[iNivel], conIgual = a.includes('=');
  NIVEL = conIgual ? a.split('=')[1] : args[iNivel + 1];
  args.splice(iNivel, conIgual ? 1 : 2);
}
const [repoArg, salidaArg] = args;
if (!repoArg || !salidaArg || !['codigo', 'funciones'].includes(NIVEL)) {
  console.error('Uso: node herramientas/mapa-de-repo.mjs <repo> <vault-de-salida> [--nivel codigo|funciones]');
  process.exit(1);
}
const REPO = resolve(repoArg), SALIDA = resolve(salidaArg);
const SRC = join(REPO, 'src');
if (!existsSync(SRC)) { console.error(`No encuentro ${SRC}: el piloto espera un proyecto con src/.`); process.exit(1); }

// El compilador del propio repo: lee su sintaxis exacta, sin adivinar con expresiones regulares.
let ts;
try { ts = createRequire(join(REPO, 'package.json'))('typescript'); }
catch { console.error('El repo no tiene typescript instalado (npm install en el repo).'); process.exit(1); }

// El orden sale de medir, no de gusto. Con «Rutas → Módulos → Compartido → Datos» la columna
// Compartido quedaba entre los módulos y las tablas sin un solo enlace hacia los datos: el código
// compartido no consulta tablas, y las 75 consultas saltaban por encima y se dibujaban tenues.
// Con lo compartido a la izquierda, el recorrido de una petición —ruta → módulo → tabla— queda
// contiguo, y pasan de 201 a 242 los enlaces entre columnas vecinas.
const [COMPARTIDO, RUTAS, MODULOS, DATOS, FUNCIONES] = [0, 1, 2, 3, 4];
const CAPAS = ['L0 Compartido', 'L1 Rutas', 'L2 Módulos', 'L3 Datos', 'L4 Funciones'];

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
    return { capa: RUTAS, nombre: limpio('ruta.' + resto.join('.')), titulo: `${ruta === '/' ? '/' : ruta} · ${tipo}`, funcion: null };
  }
  if (raiz === 'middleware') return { capa: RUTAS, nombre: 'middleware', titulo: 'middleware', funcion: null };
  if (raiz === 'features' && resto.length > 1) {
    const [funcion, ...camino] = resto;
    return { capa: MODULOS, nombre: limpio(`${funcion}.${camino.join('.')}`), titulo: `${funcion} · ${camino.join('/')}`, funcion };
  }
  if (raiz === 'shared' || raiz === 'lib') {
    return { capa: COMPARTIDO, nombre: limpio(`${raiz}.${resto.join('.')}`), titulo: `${raiz} · ${resto.join('/')}`, funcion: null };
  }
  return { capa: COMPARTIDO, nombre: limpio(partes.join('.')), titulo: partes.join('/'), funcion: null };
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
  const m = { ...describir(abs), ruta: relative(REPO, abs), exports: [], resumen: '', enlaces: new Map(), datos: new Map(), env: new Set(), dominios: new Set() };

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
    // Los servicios externos se reconocen por el NOMBRE de sus variables de entorno (FLOW_API_KEY)
    // y por los dominios que el código menciona. El valor de una variable nunca se lee: no está en
    // el código, y aunque estuviera no es asunto del mapa.
    if (ts.isPropertyAccessExpression(n) && n.expression.getText(sf) === 'process.env') m.env.add(n.name.text);
    else if (ts.isElementAccessExpression(n) && n.expression.getText(sf) === 'process.env' && ts.isStringLiteralLike(n.argumentExpression)) m.env.add(n.argumentExpression.text);
    if (n.kind === ts.SyntaxKind.StringLiteral || n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral || n.kind === ts.SyntaxKind.TemplateHead) {
      for (const x of String(n.text).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) m.dominios.add(x[1].toLowerCase());
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
  else if (m.capa === RUTAS) m.tema = masFrecuente([...m.enlaces.keys()].map((d) => modulos.get(d)?.funcion)) || 'sitio';
  else m.tema = 'compartido';
}
for (const d of datos.values()) {
  const quien = (set) => [...set].map((a) => modulos.get(a)?.tema).filter((t) => t && t !== 'compartido' && t !== 'sitio');
  d.tema = masFrecuente(quien(d.escritores)) || masFrecuente(quien(d.lectores)) || 'compartido';
}

// ── Utilidades de los dos niveles ───────────────────────────────────────────────────────────────
// Solo se borran las carpetas que este guion genera: nunca el vault entero, que puede tener la
// configuración de Obsidian que el usuario ya ajustó. Las carpetas «L<n> nombre» son todas de este
// guion, también las de corridas anteriores con otro orden: se borran para que no queden notas
// viejas dibujándose en la columna equivocada.
function prepararCarpetas(capas) {
  mkdirSync(SALIDA, { recursive: true });
  for (const c of readdirSync(SALIDA)) if (/^L\d /.test(c)) rmSync(join(SALIDA, c), { recursive: true, force: true });
  for (const c of capas) mkdirSync(join(SALIDA, c), { recursive: true });
}
const yaml = (s) => JSON.stringify(String(s));   // una cadena JSON es YAML válido y escapa todo
const COLORES = ['#F7931A', '#34D17A', '#1FC8B4', '#5B95FF', '#F5CF45', '#B79CFF', '#FF7EB6', '#8BE9FD', '#FFB86C', '#A3E635', '#E879F9', '#60A5FA'];
const temasBase = () => [
  ...funciones.map((f, i) => `${f} = ${f} = ${COLORES[i % COLORES.length]}`),
  'compartido = compartido = #8A93B8',
  'sitio = sitio = #E6EAFF',
];

// El plugin, instalado y configurado para el mapa. La configuración que el usuario haya cambiado a
// mano se conserva; solo se pisan las capas, las carpetas y los temas, que son del mapa.
function instalarObsidian(capas, capasTexto, temas, mostrarTodo) {
  const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');
  const destino = join(SALIDA, '.obsidian', 'plugins', 'mapa-neuronal');
  mkdirSync(destino, { recursive: true });
  for (const f of ['main.js', 'manifest.json', 'styles.css']) {
    if (!existsSync(join(PLUGIN, f))) { console.error(`Falta ${f}: corre npm run build en el repo del plugin.`); process.exit(1); }
    copyFileSync(join(PLUGIN, f), join(destino, f));
  }
  const previos = existsSync(join(destino, 'data.json')) ? JSON.parse(readFileSync(join(destino, 'data.json'), 'utf8')) : {};
  for (const vieja of ['rotularTodo', 'agruparMesesDesde']) delete previos[vieja];   // ajustes que ya no existen
  writeFileSync(join(destino, 'data.json'), JSON.stringify(Object.assign(previos, {
    capas: capasTexto,
    carpetas: capas.map((c, i) => `${c} = ${i}`).join('\n'),
    propiedadTema: 'tema',
    temas: temas.join('\n'),
    fuentes: false,
    seccionMotivos: 'Conexiones',
    propiedadEnlaces: '',
    propiedadFecha: '',
    configurado: true,
    // El mapa de funciones es chico (unos 50 nodos): ahí los nombres y las líneas entre columnas
    // lejanas SON la explicación. El de código tiene cientos: con todo encendido no se lee.
    mostrarTodo: !!mostrarTodo,
  }), null, 2) + '\n');
  writeFileSync(join(SALIDA, '.obsidian', 'community-plugins.json'), JSON.stringify(['mapa-neuronal'], null, 2) + '\n');
}

// Fontanería: piezas que casi todo usa y que no explican nada de la arquitectura. Un ícono que
// importan 48 archivos dibuja 48 líneas y no dice cómo funciona el sistema; los clientes de Supabase
// son la conexión a la base, no una decisión de diseño. Medido en el piloto: el 22 % de las líneas.
// Se sacan del DIBUJO, no del análisis: el informe las sigue contando.
// Excepción: si una de estas piezas toca una tabla, se queda. Un componente visual que escribe en la
// base de datos es justo lo que el mapa tiene que mostrar.
const FONTANERIA = [/^src\/shared\/(components|ui)\//, /^src\/(shared\/)?lib\/supabase\//];
const esFontaneria = (abs) => {
  const m = modulos.get(abs);
  return !!m && m.datos.size === 0 && FONTANERIA.some((r) => r.test(m.ruta));
};

// ── Nivel 3 (C4 · componentes): un nodo por función, no por archivo ────────────────────────────
// El mapa de archivos muestra la FORMA del código; no cuenta qué hace el sistema. Este cuenta eso:
// quién entra, qué funciones hay, qué datos tocan y con quién hablan afuera. Unos 50 nodos en vez
// de 190, y cada relación agrupa las de sus archivos con un ejemplo.
//
// Columnas: Entradas → Funciones → Datos → Servicios externos. Los servicios van al final por dos
// razones: en C4 los sistemas de afuera se dibujan en el borde, y Why Graph rotula la última
// columna con el nombre del tema — que aquí es el nombre del servicio.
if (NIVEL === 'funciones') {
  const CAPAS3 = ['L0 Entradas', 'L1 Funciones', 'L2 Datos', 'L3 Servicios externos'];
  prepararCarpetas(CAPAS3);

  // Next.js agrupa las rutas por quién entra: (admin), (auth), (main). Se usan esos grupos, y la
  // API se separa por dominio porque ahí viven los webhooks (api/pagos, api/auth…).
  const areaDe = (m) => {
    if (m.nombre === 'middleware') return 'middleware';
    const partes = relative(join(SRC, 'app'), join(REPO, m.ruta)).replace(/\.(tsx?)$/, '').split('/');
    if (partes.length === 1) return '/';
    if (/^\(.*\)$/.test(partes[0])) return partes[0];
    if (partes[0] === 'api') return partes.length > 2 ? `api/${partes[1]}` : 'api';
    return partes[0];
  };
  const idArea = (a) => 'entrada.' + (a === '/' ? 'raiz' : limpio(a.replace(/\//g, '.')));
  const idFuncion = (f) => 'funcion.' + limpio(f);
  const componenteDe = (abs) => {
    const m = modulos.get(abs);
    if (!m || esFontaneria(abs) || m.capa === RUTAS) return null;   // una ruta es una entrada, no un componente
    return m.funcion || 'compartido';
  };

  // Servicios externos por el prefijo del nombre de la variable: FLOW_API_KEY → flow.
  const SERVICIOS = {
    flow: 'Flow · pagos', transbank: 'Transbank · pagos', khipu: 'Khipu · pagos', mercadopago: 'Mercado Pago · pagos', stripe: 'Stripe · pagos',
    twilio: 'Twilio · SMS', whatsapp: 'WhatsApp', resend: 'Resend · correo', sendgrid: 'SendGrid · correo', postmark: 'Postmark · correo',
    mailgun: 'Mailgun · correo', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini', mapbox: 'Mapbox · mapas', google: 'Google',
    sii: 'SII', aws: 'AWS', sentry: 'Sentry · errores', posthog: 'PostHog · analítica', slack: 'Slack', cloudinary: 'Cloudinary · imágenes',
    upstash: 'Upstash', redis: 'Redis',
  };
  // Prefijos que no son un servicio de afuera: el framework, la plataforma y la propia base.
  const NO_SERVICIO = new Set(['next', 'node', 'vercel', 'supabase', 'site', 'app', 'base', 'port', 'public', 'database', 'ci', 'tz', 'log', 'debug', 'env', 'url', 'api', 'host']);
  const servicioDe = (variable) => {
    const p = variable.replace(/^NEXT_PUBLIC_/, '').split('_')[0].toLowerCase();
    return p && !NO_SERVICIO.has(p) ? p : null;
  };

  const areas = new Map();       // área → { titulos: [], funciones: [] }
  const usosServicio = new Map(); // servicio → { variables: Set, dominios: Set, quienes: Set }
  const aristas = new Map();     // origen → Map(destino → { nombres, fuentes, ops, variables })
  const unir = (o, d, extra) => {
    if (o === d) return;
    if (!aristas.has(o)) aristas.set(o, new Map());
    const mo = aristas.get(o);
    if (!mo.has(d)) mo.set(d, { nombres: new Set(), fuentes: new Set(), ops: new Set(), variables: new Set() });
    const e = mo.get(d);
    for (const k of ['nombres', 'fuentes', 'ops', 'variables']) for (const x of extra[k] || []) e[k].add(x);
  };

  for (const [abs, m] of modulos) {
    if (esFontaneria(abs)) continue;
    const esEntrada = m.capa === RUTAS;
    let origen;
    if (esEntrada) {
      const a = areaDe(m);
      if (!areas.has(a)) areas.set(a, { titulos: [], funciones: [] });
      areas.get(a).titulos.push(m.titulo);
      origen = idArea(a);
    } else origen = idFuncion(m.funcion || 'compartido');
    const fuente = esEntrada ? m.titulo : m.ruta;

    for (const [destino, k] of m.enlaces) {
      const c = componenteDe(destino);
      if (!c) continue;
      if (esEntrada && c !== 'compartido') areas.get(areaDe(m)).funciones.push(c);
      unir(origen, idFuncion(c), { nombres: [...k.nombres], fuentes: [fuente] });
    }
    for (const [id, ops] of m.datos) unir(origen, id, { ops: [...ops], fuentes: [fuente] });
    for (const v of m.env) {
      const sv = servicioDe(v);
      if (!sv) continue;
      if (!usosServicio.has(sv)) usosServicio.set(sv, { variables: new Set(), dominios: new Set(), quienes: new Set() });
      const u = usosServicio.get(sv);
      u.variables.add(v); u.quienes.add(origen);
      unir(origen, 'servicio.' + limpio(sv), { variables: [v], fuentes: [fuente] });
    }
  }
  // Un dominio cuenta como prueba de un servicio solo si lleva su nombre (www.flow.cl → flow). Así
  // un enlace a instagram.com en el pie de página no se confunde con una integración.
  for (const m of modulos.values()) for (const dom of m.dominios) for (const [sv, u] of usosServicio) if (dom.includes(sv)) u.dominios.add(dom);

  const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const motivo = (d, e) => {
    const en = ` · ${cuantos(e.fuentes.size, 'archivo', 'archivos')}`;
    if (d.startsWith('tabla.') || d.startsWith('bucket.')) {
      const ops = [...e.ops], escr = ops.filter((o) => ESCRITURA.has(o) || /upload|remove|move|copy/.test(o));
      return (escr.length ? `escribe (${escr.join(', ')})` : ops.some((o) => LECTURA.has(o)) ? 'lee' : 'usa') + en;
    }
    if (d.startsWith('servicio.')) return `usa ${[...e.variables].sort().join(', ')}` + en;
    const nombres = [...e.nombres];
    return (nombres.length ? `importa ${nombres.slice(0, 5).join(', ')}${nombres.length > 5 ? ` y ${nombres.length - 5} más` : ''}` : 'importa') + en;
  };
  const conexiones = (origen) => [...(aristas.get(origen) || new Map())].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, e]) => `- [[${d}]] — ${motivo(d, e)}`);
  const escribir = (capa, id, titulo, tema, cuerpo, lineas) => writeFileSync(join(SALIDA, CAPAS3[capa], id + '.md'), [
    '---', `title: ${yaml(titulo)}`, `tema: ${yaml(tema)}`, '---', '', ...cuerpo, '', '## Conexiones', '',
    ...(lineas.length ? lineas : ['_Sin conexiones._']), '',
  ].join('\n'));

  // Entradas
  for (const [a, info] of areas) {
    const tema = masFrecuente(info.funciones) || 'sitio';
    const ejemplos = [...new Set(info.titulos.map((t) => t.split(' · ')[0]))].sort();
    escribir(0, idArea(a), a === '/' ? '/ (raíz)' : a, tema,
      [`Entrada con ${cuantos(info.titulos.length, 'archivo de ruta', 'archivos de ruta')}. ${tema !== 'sitio' ? `Usa sobre todo la función «${tema}».` : 'No usa ninguna función del producto.'}`,
        '', `Rutas: ${ejemplos.slice(0, 12).map((x) => `\`${x}\``).join(', ')}${ejemplos.length > 12 ? '…' : ''}`],
      conexiones(idArea(a)));
  }
  // Funciones (y lo compartido, si quedó algo después de sacar la fontanería)
  const conCompartido = [...modulos.entries()].some(([k, m]) => m.capa === COMPARTIDO && !esFontaneria(k));
  for (const f of [...funciones, ...(conCompartido ? ['compartido'] : [])]) {
    const propios = [...modulos.entries()].filter(([k, m]) => (f === 'compartido' ? m.capa === COMPARTIDO : m.funcion === f) && !esFontaneria(k));
    let resumen = '';
    const leeme = join(SRC, 'features', f, 'README.md');
    if (f !== 'compartido' && existsSync(leeme)) {
      const parrafo = readFileSync(leeme, 'utf8').split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !x.startsWith('#'));
      if (parrafo && !PARECE_SECRETO.test(parrafo)) resumen = parrafo.replace(/\s+/g, ' ').slice(0, 280);
    }
    const quienEntra = [...areas.keys()].filter((a) => aristas.get(idArea(a))?.has(idFuncion(f)));
    if (!resumen) resumen = f === 'compartido'
      ? `La lógica que usan varias funciones: ${cuantos(propios.length, 'módulo', 'módulos')}.`
      : `La función «${f}»: ${cuantos(propios.length, 'módulo', 'módulos')}, y se entra por ${quienEntra.length ? quienEntra.join(', ') : 'ninguna ruta propia'}.`;
    escribir(1, idFuncion(f), f, f,
      [resumen, '', `**Archivos:** ${propios.map(([, m]) => `\`${m.ruta}\``).sort().join(', ') || '—'}`],
      conexiones(idFuncion(f)));
  }
  // Datos. El nombre va en el título y no en el primer párrafo: el resumen del plugin borra los «_».
  const legible = new Map([...areas.keys()].map((a) => [idArea(a), a === '/' ? '/ (raíz)' : a]));
  for (const f of [...funciones, 'compartido']) legible.set(idFuncion(f), f);
  const nombreDeId = (id) => legible.get(id) || id;
  const quienesTocan = (id) => [...aristas].filter(([, mo]) => mo.has(id)).map(([o]) => nombreDeId(o));
  for (const [id, d] of datos) {
    const quienes = quienesTocan(id);
    escribir(2, id, d.nombre, d.tema,
      [`${d.tipo === 'bucket' ? 'Bucket de Supabase Storage' : 'Tabla de Supabase'} de la función «${d.tema}». La tocan ${cuantos(quienes.length, 'componente', 'componentes')}: ${quienes.join(', ')}.`],
      []);
  }
  // Servicios externos
  const temasServicio = [];
  if (!usosServicio.size) {
    escribir(3, 'servicio.ninguno', 'sin servicios externos', 'sin-servicios', ['No se detectó ninguna integración externa por variables de entorno.'], []);
    temasServicio.push('sin-servicios = sin servicios externos = #8A93B8');
  }
  for (const [sv, u] of usosServicio) {
    const nombre = SERVICIOS[sv] || sv.charAt(0).toUpperCase() + sv.slice(1);
    const quienes = [...u.quienes].map(nombreDeId);
    escribir(3, 'servicio.' + limpio(sv), nombre, 'servicio-' + sv,
      [`Servicio externo que usa${quienes.length === 1 ? '' : 'n'} ${quienes.join(', ')}.`,
        '', `Detectado por el nombre de las variables ${[...u.variables].sort().map((v) => `\`${v}\``).join(', ')}` +
          (u.dominios.size ? ` y por ${u.dominios.size === 1 ? 'el dominio' : 'los dominios'} ${[...u.dominios].sort().map((x) => `\`${x}\``).join(', ')}` : '') +
          '. El valor de una variable nunca se lee.'],
      []);
    temasServicio.push(`servicio-${sv} = ${nombre} = #C9D1FF`);
  }

  instalarObsidian(CAPAS3,
    'Entradas | quién entra y por dónde\nFunciones | lo que hace el producto\nDatos | tablas y buckets de Supabase\nServicios externos | con quién habla afuera',
    [...temasBase(), ...temasServicio], true);

  const totalAristas = [...aristas.values()].reduce((n, mo) => n + mo.size, 0);
  console.log(`Mapa de funciones de ${relative(resolve(REPO, '..'), REPO)} — nivel 3 del modelo C4`);
  console.log(`  ${archivos.length} archivos leídos · sin IA · sin red`);
  console.log(`  L0 Entradas           ${areas.size} nodos: ${[...areas.keys()].sort().join(', ')}`);
  console.log(`  L1 Funciones          ${funciones.length + (conCompartido ? 1 : 0)} nodos`);
  console.log(`  L2 Datos              ${datos.size} nodos`);
  console.log(`  L3 Servicios externos ${usosServicio.size} nodos: ${[...usosServicio.keys()].map((sv) => SERVICIOS[sv] || sv).join(', ') || 'ninguno'}`);
  console.log(`  ${totalAristas} relaciones, cada una con su motivo y cuántos archivos la sostienen`);
  console.log(`  → ${SALIDA}`);
  process.exit(0);
}


// ── 5. Escribir el vault (nivel código) ─────────────────────────────────────────────────────────
prepararCarpetas(CAPAS);
const nombreDe = (abs) => modulos.get(abs).nombre;
let enlaces = 0, omitidos = 0;

for (const [abs, m] of modulos) {
  if (esFontaneria(abs)) continue;
  const lineas = [];
  for (const [destino, k] of [...m.enlaces].sort((a, b) => nombreDe(a[0]).localeCompare(nombreDe(b[0])))) {
    if (esFontaneria(destino)) { omitidos++; continue; }
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
  const resumen = m.resumen || `Módulo ${m.funcion ? `de la función «${m.funcion}»` : m.capa === RUTAS ? 'de entrada' : 'compartido'}` +
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
  writeFileSync(join(SALIDA, CAPAS[DATOS], id + '.md'), [
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
  const rutas = [...modulos.values()].filter((m) => m.capa === RUTAS && m.tema === f);
  let resumen = '';
  const leeme = join(SRC, 'features', f, 'README.md');
  if (existsSync(leeme)) {
    const parrafo = readFileSync(leeme, 'utf8').split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !x.startsWith('#'));
    if (parrafo && !PARECE_SECRETO.test(parrafo)) resumen = parrafo.replace(/\s+/g, ' ').slice(0, 280);
  }
  if (!resumen) resumen = `La función «${f}»: ${propios.length} módulo(s), ${tablas.length} tabla(s) propias y ${rutas.length} ruta(s) que la usan.`;
  writeFileSync(join(SALIDA, CAPAS[FUNCIONES], `funcion.${limpio(f)}.md`), [
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
    ...propios.filter(([k]) => !esFontaneria(k)).map(([, m]) => `- [[${m.nombre}]] — módulo de la función`).sort(),
    ...tablas.map(([id, d]) => `- [[${id}]] — ${d.tipo === 'bucket' ? 'bucket' : 'tabla'} que la función escribe o lee`).sort(),
    '',
  ].join('\n'));
}

// ── 6. Obsidian ────────────────────────────────────────────────────────────────────────────────
instalarObsidian(CAPAS,
  'Compartido | piezas que usan varias funciones\nRutas | lo que el usuario visita\nMódulos | el código de cada función\nDatos | tablas y buckets de Supabase\nFunciones | una síntesis por función',
  temasBase(), false);

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
  const huerfanos = [...modulos.entries()].filter(([k, m]) => m.capa !== RUTAS && entrantes.get(k) === 0).map(([, m]) => `\`${m.ruta}\``).sort();
  const masUsados = [...modulos.entries()].filter(([, m]) => m.capa !== RUTAS).sort((a, b) => entrantes.get(b[0]) - entrantes.get(a[0])).slice(0, 5)
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
    ...bloque('Lo que el mapa no dibuja', `Piezas que casi todo usa y que no explican la arquitectura: componentes visuales compartidos y los clientes de Supabase. Se sacaron del dibujo (${omitidos} líneas) para que el mapa se lea; siguen contadas en este informe.`,
      [...modulos.entries()].filter(([k]) => esFontaneria(k)).sort((a, b) => entrantes.get(b[0]) - entrantes.get(a[0]))
        .map(([k, m]) => `\`${m.ruta}\` — la usa${entrantes.get(k) === 1 ? "" : "n"} ${entrantes.get(k)} módulo${entrantes.get(k) === 1 ? "" : "s"}`)),
    dinamicas ? `_${dinamicas} acceso(s) a Supabase usan un nombre de tabla variable y no se pudieron ubicar sin ejecutar el código._\n` : '',
  ].join('\n'));
}

// ── 7. El resumen para quien lo corre ───────────────────────────────────────────────────────────
const porCapa = CAPAS.map((_, c) => c === DATOS ? datos.size : c === FUNCIONES ? funciones.length : [...modulos.entries()].filter(([k, m]) => m.capa === c && !esFontaneria(k)).length);
console.log(`Mapa de ${relative(resolve(REPO, '..'), REPO)}`);
console.log(`  ${archivos.length} archivos leídos · sin IA · sin red`);
CAPAS.forEach((c, i) => console.log(`  ${c.padEnd(14)} ${porCapa[i]} nodos`));
console.log(`  ${enlaces} enlaces dibujados, todos con su motivo · ${omitidos} de fontanería fuera del dibujo`);
console.log(`  ${funciones.length} funciones con color: ${funciones.join(', ')}`);
if (dinamicas) console.log(`  ${dinamicas} acceso(s) a Supabase con nombre variable: no se pueden ubicar sin ejecutar el código`);
console.log(`  → ${SALIDA}`);
console.log(`  → ${join(SALIDA, 'INFORME.md')}`);
