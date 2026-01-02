/**
 * Trace Configuration
 * Controls when and how traces are displayed.
 *
 * Server: Shows when SPECWRIGHT_TRACE=true
 * Client: Shows when SPECWRIGHT_TRACE=true (in dev mode only)
 */

type TraceEvent = {
  type: 'entry' | 'exit' | 'error';
  name: string;
  file: string;
  data?: unknown;
};

// Track call depth for indentation
let callDepth = 0;

// Determine if we should trace
function shouldTrace(): boolean {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    // Server: trace when explicitly enabled
    return process.env.SPECWRIGHT_TRACE === 'true';
  } else {
    // Client: only trace in dev mode when enabled
    return (
      process.env.NODE_ENV === 'development' &&
      process.env.SPECWRIGHT_TRACE === 'true'
    );
  }
}

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

// Create the trace function
export function createTracer(): (event: TraceEvent) => void {
  if (!shouldTrace()) {
    // Return no-op function when tracing is disabled
    return () => {};
  }

  const isServer = typeof window === 'undefined';

  return (event: TraceEvent) => {
    const indent = '  '.repeat(callDepth);
    const dataStr =
      event.data !== undefined
        ? Array.isArray(event.data)
          ? event.data.map(formatData).join(', ')
          : formatData(event.data)
        : '';

    if (isServer) {
      // ANSI colors for terminal
      const colors = {
        entry: '\x1b[36m', // Cyan
        exit: '\x1b[32m', // Green
        error: '\x1b[31m', // Red
        reset: '\x1b[0m',
        dim: '\x1b[2m',
      };

      const symbols = { entry: '→', exit: '←', error: '✗' };
      const symbol = symbols[event.type];
      const color = colors[event.type];

      if (event.type === 'entry') {
        console.log(
          `${indent}${color}${symbol}${colors.reset} ${event.name}(${dataStr}) ${colors.dim}${event.file}${colors.reset}`
        );
        callDepth++;
      } else if (event.type === 'exit') {
        callDepth = Math.max(0, callDepth - 1);
        console.log(
          `${indent}${color}${symbol}${colors.reset} ${event.name}${dataStr ? ` → ${dataStr}` : ' ✓'}`
        );
      } else {
        callDepth = Math.max(0, callDepth - 1);
        console.log(
          `${indent}${color}${symbol} ${event.name}: ${dataStr}${colors.reset}`
        );
      }
    } else {
      // Browser console with CSS
      const styles = {
        entry: 'color: #0ea5e9', // Cyan
        exit: 'color: #22c55e', // Green
        error: 'color: #ef4444', // Red
        dim: 'color: #6b7280', // Gray
      };

      const symbols = { entry: '→', exit: '←', error: '✗' };
      const symbol = symbols[event.type];

      if (event.type === 'entry') {
        console.log(
          `%c${indent}${symbol} %c${event.name}%c(${dataStr}) %c${event.file}`,
          styles.entry,
          'color: inherit; font-weight: bold',
          'color: inherit',
          styles.dim
        );
        callDepth++;
      } else if (event.type === 'exit') {
        callDepth = Math.max(0, callDepth - 1);
        console.log(
          `%c${indent}${symbol} %c${event.name}%c${dataStr ? ` → ${dataStr}` : ' ✓'}`,
          styles.exit,
          'color: inherit',
          'color: inherit'
        );
      } else {
        callDepth = Math.max(0, callDepth - 1);
        console.log(`%c${indent}${symbol} ${event.name}: ${dataStr}`, styles.error);
      }
    }
  };
}
