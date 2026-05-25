import js from '@eslint/js' // ESLint's built-in JS rule set (e.g. no-undef, no-unused-vars, no-console)
import globals from 'globals' // provides named lists of global variables for different environments (browser, node, etc.)
import reactHooks from 'eslint-plugin-react-hooks' // plugin that enforces the Rules of Hooks (hooks must be at the top level, only inside components)
import reactRefresh from 'eslint-plugin-react-refresh' // plugin that warns when an export is not compatible with Vite's Hot Module Replacement fast-refresh
import { defineConfig, globalIgnores } from 'eslint/config' // defineConfig enables type-safe config autocompletion; globalIgnores marks directories to skip entirely

export default defineConfig([  // export the flat config array (ESLint v9+ format); each object in the array is a config block
  globalIgnores(['dist']),  // exclude the dist/ build output folder so linting never runs on compiled files
  {
    files: ['**/*.{js,jsx}'],  // apply the rules in this block to every .js and .jsx file found anywhere in the project
    extends: [  // merge in shared rule sets from installed plugins
      js.configs.recommended,  // activate ESLint's recommended core rules that catch common JavaScript mistakes
      reactHooks.configs.flat.recommended,  // activate React Hooks rules: hooks must be called at the top level, only inside function components
      reactRefresh.configs.vite,  // activate fast-refresh validation tailored for a Vite-based project
    ],
    languageOptions: {  // configure how ESLint parses and understands the source code
      ecmaVersion: 2020,  // allow ES2020 syntax features such as optional chaining and nullish coalescing
      globals: globals.browser,  // pre-declare browser globals (window, document, fetch, localStorage, etc.) so ESLint won't report them as undefined
      parserOptions: {  // fine-grained parser settings passed to the underlying Espree parser
        ecmaVersion: 'latest',  // allow the newest ECMAScript syntax the parser supports
        ecmaFeatures: { jsx: true },  // enable JSX parsing so React component syntax is understood
        sourceType: 'module',  // treat all files as ES modules, enabling import/export syntax
      },
    },
    rules: {  // project-specific overrides layered on top of the extended rule sets above
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],  // error on unused variables, but skip names that start with an uppercase letter or underscore (e.g. imported React, unused enum-style constants)
    },
  },
])
