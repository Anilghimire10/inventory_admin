import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

// Flat config, which is what ESLint 10 and `@next/eslint-plugin-next` now
// expect -- the legacy `.eslintrc.json` this replaces would simply be ignored.
// `core-web-vitals` promotes the rules that affect real page performance from
// warnings to errors; `typescript` adds the typescript-eslint rules on top, so
// between them this is the same coverage the web app lints under.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Build artifact, and gitignored -- linting it reports on generated code.
    'tsconfig.tsbuildinfo',
  ]),
]);

export default eslintConfig;
