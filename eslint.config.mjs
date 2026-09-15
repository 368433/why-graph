// Linter oficial del directorio de Obsidian (eslint-plugin-obsidianmd).
// Se corre sobre src/, que es el código fuente; main.js es el resultado del build.
import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['main.js', 'node_modules/', 'pruebas/']),
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.*', 'src/*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
