/**
 * Babel Configuration for Specwright
 *
 * The auto-trace plugin is ALWAYS included in the build.
 * Trace output is controlled at RUNTIME by the --trace flag or SPECWRIGHT_TRACE env var.
 *
 * This means:
 * - `specwright` runs normally (no trace output)
 * - `specwright --trace` shows all function traces
 * - `SPECWRIGHT_TRACE=true specwright` also shows traces
 */

module.exports = {
  presets: [
    ['@babel/preset-typescript', {
      allowDeclareFields: true,
    }],
  ],
  // Always include the trace plugin - runtime check controls output
  plugins: ['./babel-plugin-auto-trace.cjs'],
  // Ignore files that shouldn't have trace code injected
  ignore: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
  ],
  // Don't add trace to cli.ts (entry point that sets trace env)
  overrides: [
    {
      test: '**/cli.ts',
      plugins: [], // No trace plugin for cli.ts
    },
  ],
};
