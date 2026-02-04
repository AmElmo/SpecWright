#!/usr/bin/env node
/**
 * CLI Debug Entry Point
 *
 * This is a debug version of the CLI with verbose logging enabled by default.
 * Use `specwright-debug` instead of `specwright` to run with extra logging.
 *
 * This helps debug issues like the Ship button white page problem.
 */

// Enable debug mode by default
process.env.SPECWRIGHT_DEBUG = 'true';

// Check for --trace or -t flag BEFORE loading any other modules
if (process.argv.includes('--trace') || process.argv.includes('-t')) {
  process.env.SPECWRIGHT_TRACE = 'true';
  // Remove the flag from argv so it doesn't interfere with other commands
  process.argv = process.argv.filter(arg => arg !== '--trace' && arg !== '-t');
}

// Print debug banner
console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
console.log('\x1b[33m🐛 DEBUG MODE ENABLED (specwright-debug)\x1b[0m');
console.log('\x1b[2mVerbose logging is active. Ship button and API calls will be logged.\x1b[0m');
if (process.env.SPECWRIGHT_TRACE === 'true') {
  console.log('\x1b[35m🔍 TRACE MODE also enabled\x1b[0m');
}
console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

// Now import the main app
import('./specwright.js');
