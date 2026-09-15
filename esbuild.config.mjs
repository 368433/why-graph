/* Build del plugin: src/main.js (módulo ES) → main.js (CommonJS, lo que carga Obsidian).
 *
 * Existe por el linter oficial: un plugin de un solo archivo CommonJS da 2 errores y 7 avisos
 * (require() prohibido, `Plugin` redeclarado, funciones en el ámbito global). Con el bundle el
 * código vive en un módulo y esos avisos desaparecen sin cambiar una línea de lógica.
 *
 *   node esbuild.config.mjs            una vez
 *   node esbuild.config.mjs --watch    y se reconstruye al guardar
 */
import esbuild from 'esbuild';
import process from 'process';

const vigilar = process.argv.includes('--watch');
const opciones = {
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'main.js',
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  // Todo lo que Obsidian ya provee en tiempo de ejecución: no se empaqueta.
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  // Sin minificar a propósito: la licencia es de código visible y quien la audite
  // tiene que poder leer lo que corre, no solo lo que está en el repositorio.
  // Acentos y « » tal cual, sin escapar a \xE9: el archivo queda legible y más corto.
  charset: 'utf8',
  minify: false,
  sourcemap: vigilar ? 'inline' : false,
  logLevel: 'info',
  banner: { js: '/* Mapa neuronal — construido con esbuild desde src/. No editar a mano: edita src/main.js. */' },
};

if (vigilar) {
  const ctx = await esbuild.context(opciones);
  await ctx.watch();
  console.log('vigilando src/ …');
} else {
  await esbuild.build(opciones);
}
