/**
 * Logger - Centralized logging with Consola (Browser/Web UI)
 * 
 * USAGE: Import this logger instead of using console.log directly.
 * 
 * TWO TYPES OF OUTPUT:
 * 
 * 1. DEBUG LOGS (hidden in production, visible in dev mode):
 *    - logger.debug()  → Development/debugging logs
 *    - logger.info()   → Informational dev logs
 *    - logger.warn()   → Dev warnings
 *    - logger.error()  → Dev errors
 *    - logger.success() → Dev success messages
 * 
 * 2. USER-FACING OUTPUT (always visible):
 *    - logger.print()  → User-facing output
 * 
 * AI AGENTS: 
 * - Use logger.debug() for debugging output
 * - Use logger.print() for user-facing output
 */
import { createConsola, type ConsolaInstance } from 'consola';

// Vite sets import.meta.env.DEV = true in development mode
// In production builds, this is false
const isDev = import.meta.env.DEV;

// Create base consola instance for dev logs
const consolaLogger = createConsola({
    // Level 4 = debug (shows all), Level 0 = silent (shows nothing)
    level: isDev ? 4 : 0,
});

// Extend with custom methods for user-facing output
interface ExtendedLogger extends ConsolaInstance {
    /** User-facing output - ALWAYS visible */
    print: (...args: unknown[]) => void;
}

export const logger = consolaLogger as ExtendedLogger;

// Add print method that always outputs (bypasses level check)
logger.print = (...args: unknown[]) => {
    console.log(...args);
};

// Re-export for convenience
export default logger;

