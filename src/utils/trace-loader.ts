/**
 * Trace Loader for Backend (Node.js ESM)
 *
 * This module hooks into Node.js module loading to automatically
 * trace all function calls in the application.
 *
 * Usage: node --import ./src/utils/trace-loader.js dist/specwright.js
 * Or with tsx: tsx --import ./src/utils/trace-loader.ts src/specwright.ts
 */

const TRACE_ENABLED = process.env.SPECWRIGHT_TRACE === 'true';

// Track call depth for indentation
let callDepth = 0;

// Format data for display
function formatData(data: unknown): string {
  if (data === undefined) return '';
  if (data === null) return 'null';

  try {
    if (typeof data === 'string') {
      return data.length > 80 ? `"${data.slice(0, 80)}..."` : `"${data}"`;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }
    if (Array.isArray(data)) {
      if (data.length === 0) return '[]';
      if (data.length <= 3) {
        return `[${data.map(formatData).join(', ')}]`;
      }
      return `Array(${data.length})`;
    }
    if (data instanceof Error) {
      return data.message;
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '{}';
      const preview = keys.slice(0, 3).map((k) => {
        const v = (data as Record<string, unknown>)[k];
        const formatted =
          typeof v === 'object' && v !== null ? '{...}' : formatData(v);
        return `${k}: ${formatted}`;
      });
      return `{ ${preview.join(', ')}${keys.length > 3 ? ', ...' : ''} }`;
    }
    return typeof data;
  } catch {
    return '[unserializable]';
  }
}

// ANSI colors
const colors = {
  entry: '\x1b[36m', // Cyan
  exit: '\x1b[32m', // Green
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

// Trace function
function trace(
  type: 'entry' | 'exit' | 'error',
  name: string,
  file: string,
  data?: unknown
) {
  if (!TRACE_ENABLED) return;

  const indent = '  '.repeat(callDepth);
  const dataStr = data !== undefined ? formatData(data) : '';
  const symbol = type === 'entry' ? '→' : type === 'exit' ? '←' : '✗';
  const color = colors[type];

  if (type === 'entry') {
    console.log(
      `${indent}${color}${symbol}${colors.reset} ${name}(${dataStr}) ${colors.dim}${file}${colors.reset}`
    );
    callDepth++;
  } else if (type === 'exit') {
    callDepth = Math.max(0, callDepth - 1);
    console.log(
      `${indent}${color}${symbol}${colors.reset} ${name}${dataStr ? ` → ${dataStr}` : ' ✓'}`
    );
  } else {
    callDepth = Math.max(0, callDepth - 1);
    console.log(
      `${indent}${color}${symbol} ${name}: ${dataStr}${colors.reset}`
    );
  }
}

// Wrap a function with tracing
function wrapFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  name: string,
  file: string
): T {
  if (!TRACE_ENABLED) return fn;

  const wrapped = function (this: unknown, ...args: unknown[]) {
    trace('entry', name, file, args);
    try {
      const result = fn.apply(this, args);
      if (result instanceof Promise) {
        return result
          .then((r) => {
            trace('exit', name, file, r);
            return r;
          })
          .catch((e) => {
            trace('error', name, file, e instanceof Error ? e.message : String(e));
            throw e;
          });
      }
      trace('exit', name, file, result);
      return result;
    } catch (e) {
      trace('error', name, file, e instanceof Error ? e.message : String(e));
      throw e;
    }
  } as T;

  // Preserve function properties
  Object.defineProperty(wrapped, 'name', { value: name });
  Object.defineProperty(wrapped, 'length', { value: fn.length });

  return wrapped;
}

// Wrap all exports from a module
function wrapExports<T extends Record<string, unknown>>(
  exports: T,
  moduleName: string
): T {
  if (!TRACE_ENABLED) return exports;

  const wrapped = {} as T;

  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === 'function') {
      // Skip React components (PascalCase) and hooks (useXxx)
      if (/^[A-Z][a-zA-Z0-9]*$/.test(key) || /^use[A-Z]/.test(key)) {
        wrapped[key as keyof T] = value as T[keyof T];
      } else {
        wrapped[key as keyof T] = wrapFunction(
          value as (...args: unknown[]) => unknown,
          key,
          moduleName
        ) as T[keyof T];
      }
    } else {
      wrapped[key as keyof T] = value as T[keyof T];
    }
  }

  return wrapped;
}

// Export for manual use
export { trace, wrapFunction, wrapExports, TRACE_ENABLED };

// Print startup message if tracing is enabled
if (TRACE_ENABLED) {
  console.log('\x1b[35m🔍 TRACE MODE ENABLED\x1b[0m');
  console.log('\x1b[2mFunction calls will be logged with entry/exit tracing\x1b[0m\n');
}
