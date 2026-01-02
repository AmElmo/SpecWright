/**
 * Trace Register for Backend (Node.js ESM)
 *
 * Automatic function tracing for AI-assisted debugging.
 *
 * SETUP (one-time):
 * 1. Import this at the TOP of your entry point (specwright.ts, web-server.ts):
 *    import './utils/trace-register.js';
 *
 * 2. For services you want traced, wrap imports:
 *    import * as _projectService from './services/project-service.js';
 *    const projectService = wrapModule(_projectService, 'project-service');
 *
 * USAGE:
 *    npm run dev:trace          # CLI with tracing
 *    npm run dev:server:trace   # Web server with tracing
 *    npm run dev:ui:trace       # Frontend with tracing
 *
 * Enable with: SPECWRIGHT_TRACE=true
 */

// Only activate if SPECWRIGHT_TRACE is set
const TRACE_ENABLED = process.env.SPECWRIGHT_TRACE === 'true';

if (TRACE_ENABLED) {
  console.log('\x1b[35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[35m🔍 TRACE MODE ENABLED\x1b[0m');
  console.log('\x1b[2mAll wrapped function calls will be logged with entry/exit tracing.\x1b[0m');
  console.log('\x1b[35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
}

// Track call depth for indentation
let callDepth = 0;

// ANSI colors for terminal
const colors = {
  entry: '\x1b[36m',   // Cyan
  exit: '\x1b[32m',    // Green
  error: '\x1b[31m',   // Red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

// Format data for display (truncate long values)
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
        const formatted = typeof v === 'object' && v !== null ? '{...}' : formatData(v);
        return `${k}: ${formatted}`;
      });
      return `{ ${preview.join(', ')}${keys.length > 3 ? ', ...' : ''} }`;
    }
    return typeof data;
  } catch {
    return '[unserializable]';
  }
}

/**
 * Trace a function call.
 * Use this to wrap functions you want to trace.
 *
 * @example
 * const result = trace('myFunction', () => doSomething(args), 'services/myService');
 */
export function trace<T>(
  name: string,
  fn: () => T,
  file?: string
): T {
  if (!TRACE_ENABLED) return fn();

  const indent = '  '.repeat(callDepth);
  const fileStr = file ? ` ${colors.dim}${file}${colors.reset}` : '';

  console.log(`${indent}${colors.entry}→${colors.reset} ${name}${fileStr}`);
  callDepth++;

  try {
    const result = fn();

    if (result instanceof Promise) {
      return result
        .then((r) => {
          callDepth = Math.max(0, callDepth - 1);
          console.log(
            `${indent}${colors.exit}←${colors.reset} ${name}${r !== undefined ? ` → ${formatData(r)}` : ' ✓'}`
          );
          return r;
        })
        .catch((e) => {
          callDepth = Math.max(0, callDepth - 1);
          console.log(
            `${indent}${colors.error}✗ ${name}: ${e instanceof Error ? e.message : String(e)}${colors.reset}`
          );
          throw e;
        }) as T;
    }

    callDepth = Math.max(0, callDepth - 1);
    console.log(
      `${indent}${colors.exit}←${colors.reset} ${name}${result !== undefined ? ` → ${formatData(result)}` : ' ✓'}`
    );
    return result;
  } catch (e) {
    callDepth = Math.max(0, callDepth - 1);
    console.log(
      `${indent}${colors.error}✗ ${name}: ${e instanceof Error ? e.message : String(e)}${colors.reset}`
    );
    throw e;
  }
}

/**
 * Wrap a function with tracing.
 * The wrapped function will automatically log entry/exit when called.
 *
 * @example
 * export const myFunction = wrapTrace('myFunction', (arg1, arg2) => {
 *   // implementation
 * }, 'services/myService');
 */
export function wrapTrace<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T,
  file?: string
): T {
  if (!TRACE_ENABLED) return fn;

  const wrapped = function (this: unknown, ...args: unknown[]) {
    const indent = '  '.repeat(callDepth);
    const argsStr = args.length > 0 ? `(${args.map(formatData).join(', ')})` : '()';
    const fileStr = file ? ` ${colors.dim}${file}${colors.reset}` : '';

    console.log(`${indent}${colors.entry}→${colors.reset} ${name}${argsStr}${fileStr}`);
    callDepth++;

    try {
      const result = fn.apply(this, args);

      if (result instanceof Promise) {
        return result
          .then((r) => {
            callDepth = Math.max(0, callDepth - 1);
            console.log(
              `${indent}${colors.exit}←${colors.reset} ${name}${r !== undefined ? ` → ${formatData(r)}` : ' ✓'}`
            );
            return r;
          })
          .catch((e) => {
            callDepth = Math.max(0, callDepth - 1);
            console.log(
              `${indent}${colors.error}✗ ${name}: ${e instanceof Error ? e.message : String(e)}${colors.reset}`
            );
            throw e;
          });
      }

      callDepth = Math.max(0, callDepth - 1);
      console.log(
        `${indent}${colors.exit}←${colors.reset} ${name}${result !== undefined ? ` → ${formatData(result)}` : ' ✓'}`
      );
      return result;
    } catch (e) {
      callDepth = Math.max(0, callDepth - 1);
      console.log(
        `${indent}${colors.error}✗ ${name}: ${e instanceof Error ? e.message : String(e)}${colors.reset}`
      );
      throw e;
    }
  } as T;

  // Preserve function name and length
  Object.defineProperty(wrapped, 'name', { value: name });
  Object.defineProperty(wrapped, 'length', { value: fn.length });

  return wrapped;
}

/**
 * Wrap all exports from a module with tracing.
 *
 * @example
 * import * as myService from './my-service.js';
 * export const TracedMyService = wrapModule(myService, 'my-service');
 */
export function wrapModule<T extends Record<string, unknown>>(
  module: T,
  moduleName: string
): T {
  if (!TRACE_ENABLED) return module;

  const wrapped = {} as T;

  for (const [key, value] of Object.entries(module)) {
    if (typeof value === 'function') {
      // Skip React components (PascalCase) and hooks (useXxx)
      if (/^[A-Z][a-zA-Z0-9]*$/.test(key) || /^use[A-Z]/.test(key)) {
        wrapped[key as keyof T] = value as T[keyof T];
      } else {
        wrapped[key as keyof T] = wrapTrace(
          key,
          value as (...args: unknown[]) => unknown,
          moduleName
        ) as T[keyof T];
      }
    } else {
      wrapped[key as keyof T] = value as T[keyof T];
    }
  }

  return wrapped;
}

// Export trace enabled flag for conditional logic
export { TRACE_ENABLED };
