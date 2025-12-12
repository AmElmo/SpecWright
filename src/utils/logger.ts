/**
 * Logger - Centralized logging with Consola
 * 
 * USAGE: Import this logger instead of using console.log directly.
 * 
 * TWO TYPES OF OUTPUT:
 * 
 * 1. DEBUG LOGS (hidden in production, visible when SPECWRIGHT_DEBUG=true):
 *    - logger.debug()  → Development/debugging logs
 *    - logger.info()   → Informational dev logs
 *    - logger.warn()   → Dev warnings
 *    - logger.error()  → Dev errors
 *    - logger.success() → Dev success messages
 * 
 * 2. USER-FACING OUTPUT (always visible):
 *    - logger.print()  → User-facing output (logo, prompts, status)
 * 
 * AI AGENTS: 
 * - Use logger.debug() for debugging output
 * - Use logger.print() for user-facing CLI output (menus, status, logos)
 */
import { createConsola, type ConsolaInstance } from 'consola';

// Check for debug mode via environment variable
// Development: SPECWRIGHT_DEBUG=true (set in npm scripts)
// Production: Not set, so logs are silent
const isDev = process.env.SPECWRIGHT_DEBUG === 'true';

// Create base consola instance for dev logs
const consolaLogger = createConsola({
    // Level 4 = debug (shows all), Level 0 = silent (shows nothing)
    level: isDev ? 4 : 0,
});

// Extend with custom methods for user-facing output
interface ExtendedLogger extends ConsolaInstance {
    /** User-facing output - ALWAYS visible (logos, menus, prompts) */
    print: (...args: unknown[]) => void;
}

export const logger = consolaLogger as ExtendedLogger;

// Add print method that always outputs (bypasses level check)
logger.print = (...args: unknown[]) => {
    console.log(...args);
};

// Re-export for convenience
export default logger;

