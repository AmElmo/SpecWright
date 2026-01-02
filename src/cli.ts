#!/usr/bin/env node
/**
 * CLI Entry Point
 *
 * This file handles the --trace flag before loading the main app.
 * It sets process.env.SPECWRIGHT_TRACE so that trace code in other
 * modules will see it as enabled when they load.
 */

// Check for --trace or -t flag BEFORE loading any other modules
if (process.argv.includes('--trace') || process.argv.includes('-t')) {
  process.env.SPECWRIGHT_TRACE = 'true';
  // Remove the flag from argv so it doesn't interfere with other commands
  process.argv = process.argv.filter(arg => arg !== '--trace' && arg !== '-t');

  // Print trace banner
  console.log('\x1b[35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[35m🔍 TRACE MODE ENABLED\x1b[0m');
  console.log('\x1b[2mAll function calls will be logged with entry/exit tracing.\x1b[0m');
  console.log('\x1b[35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
}

// Now import the main app - trace code will see SPECWRIGHT_TRACE=true
import('./specwright.js');
