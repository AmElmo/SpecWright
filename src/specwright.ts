/**
 * Specwright Main Application
 *
 * Note: Use cli.ts as the entry point for --trace support.
 * This file is imported by cli.ts after setting up the trace environment.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import commands
import { handleViewCommand } from './commands/view.js';
import { handleFinalizeScopeCommand } from './commands/finalize-scope.js';
import { handleBreakCommand } from './commands/break.js';
import { handlePlaybookCommand } from './commands/playbook.js';
import { handleScopeCommand, handleScopingWorkflow } from './commands/scope.js'; // LEGACY: redirects to web UI
import { handleSpecCommand, handleProjectCommand } from './commands/spec.js'; // LEGACY: redirects to web UI
import { handleBuildCommand } from './commands/build.js';
import { handleApproveCommand } from './commands/approve.js';
import { handleInitCommand } from './commands/init.js';
import { handleNewCommand } from './commands/new.js';
import { handleShipCommand } from './commands/ship.js';

// Import UI components
import { showLogo } from './ui/logo.js';
import { showCommandMenu, promptForDescription } from './ui/menu.js';
import { showUsage } from './ui/help.js';
import { showVersion, showWelcomeInfo, showFolderPreview, showRepoInfo } from './ui/welcome.js';

// Import utilities
import { parseCommand } from './utils/cli-parser.js';
import { logger } from './utils/logger.js';
import { DEFAULT_PORT } from './config/constants.js';

// Re-export functions needed by other modules (workflow-service.ts)
export { waitForCompletion } from './ui/prompts.js';
export { displayScreenSummaryAndWireframes } from './ui/summaries.js';
export { handleTechnologySelection } from './services/technology-service.js';

// Get current directory (equivalent to SQUAD_DIR in bash)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SQUAD_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(SQUAD_DIR, 'outputs');

// Create timestamp and session directories
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
const SESSION_DIR = path.join(OUTPUT_DIR, timestamp);

// Ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

/**
 * Main function with command-based routing
 */
const main = async () => {
    const args = process.argv.slice(2);

    // Handle --version flag first
    if (args.includes('--version') || args.includes('-v')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(SQUAD_DIR, 'package.json'), 'utf-8'));
        console.log(`specwright v${pkg.version}`);
        process.exit(0);
    }

    // Check for init command first (special case - shows logo internally)
    if (args.length > 0 && args[0] === 'init') {
        await handleInitCommand();
        return;
    }
    
    // Check if SpecWright is initialized (unless running init)
    const specwrightDir = path.join(process.cwd(), 'specwright');
    const isInitialized = fs.existsSync(specwrightDir);
    
    if (!isInitialized) {
        showLogo();
        showVersion();
        showRepoInfo();
        logger.print("📁 No SpecWright folder detected.");
        logger.print("");
        showWelcomeInfo();
        showFolderPreview();
        
        const inquirer = (await import('inquirer')).default;
        const { choice } = await inquirer.prompt([{
            type: 'list',
            name: 'choice',
            message: 'Would you like to initialize SpecWright in this repo?',
            choices: [
                { name: '🚀 Launch Web UI for guided onboarding', value: 'web' },
                { name: '📖 Learn more about SpecWright', value: 'docs' },
                { name: '❌ Exit', value: 'exit' }
            ]
        }]);
        
        if (choice === 'web') {
            logger.debug("");
            logger.debug("🌐 Launching web UI for onboarding...");
            logger.debug("");
            
            // Start web server and open browser
            const { startWebServer } = await import('./web-server.js');
            await startWebServer(DEFAULT_PORT);

            // Open browser
            const open = (await import('open')).default;
            await open(`http://localhost:${DEFAULT_PORT}/onboarding`);

            logger.debug(`✨ Web UI is running at http://localhost:${DEFAULT_PORT}/onboarding`);
            logger.debug("   Complete the onboarding to initialize SpecWright");
            logger.debug("");
            logger.debug("Press Ctrl+C to stop the server");
            
            // Keep process running
            await new Promise(() => {});
        } else if (choice === 'docs') {
            logger.debug("");
            logger.debug("📖 Opening SpecWright documentation...");
            logger.debug("");
            
            // Start web server and open how-it-works page
            const { startWebServer } = await import('./web-server.js');
            await startWebServer(DEFAULT_PORT);

            // Open browser to how-it-works page
            const open = (await import('open')).default;
            await open(`http://localhost:${DEFAULT_PORT}/how-it-works`);

            logger.debug(`✨ Documentation is open at http://localhost:${DEFAULT_PORT}/how-it-works`);
            logger.debug("");
            logger.debug("Press Ctrl+C to stop the server");
            
            // Keep process running
            await new Promise(() => {});
        } else {
            logger.debug("");
            logger.debug("You can initialize later by running: specwright init");
            logger.debug("");
            process.exit(0);
        }
        return;
    }
    
    // Handle interactive menu when no arguments provided
    if (args.length === 0) {
        showLogo();
        const command = await showCommandMenu();
        
        // Handle the selected command
        switch (command) {
            case 'new':
                await handleNewCommand();
                break;
            case 'ship':
                await handleShipCommand();
                break;
            case 'view':
                await handleViewCommand();
                break;
            case 'playbook':
                await handlePlaybookCommand();
                break;
            // Legacy commands (hidden from main menu)
            case 'scope':
                const projectDescription = await promptForDescription();
                await handleScopingWorkflow(projectDescription);
                break;
            case 'spec':
                await handleProjectCommand();
                break;
            case 'break':
                await handleBreakCommand();
                break;
            case 'build':
                await handleBuildCommand();
                break;
        }
        return;
    }
    
    // Handle help flags
    if (args[0] === '--help' || args[0] === '-h') {
        showUsage();
        return;
    }
    
    // Handle direct command names
    const commandName = args[0];
    
    switch (commandName) {
        case 'new':
            showLogo();
            await handleNewCommand();
            break;
        case 'ship':
            showLogo();
            await handleShipCommand();
            break;
        case 'playbook':
            showLogo();
            // Check for --update or --audit flags
            const hasUpdate = args.includes('--update');
            const hasAudit = args.includes('--audit');
            await handlePlaybookCommand({ update: hasUpdate, audit: hasAudit });
            break;
        case 'view':
            showLogo();
            await handleViewCommand();
            break;
        // Legacy commands (still accessible for backward compat, show deprecation notices)
        case 'scope':
            showLogo();
            logger.debug('\n⚠️  "scope" is deprecated. Use "specwright new" instead.\n');
            await handleScopeCommand();
            break;
        case 'spec':
            showLogo();
            logger.debug('\n⚠️  "spec" is deprecated. Use "specwright new" or "specwright view".\n');
            const projectId = args[1] || null;
            await handleProjectCommand(projectId);
            break;
        case 'break':
            showLogo();
            await handleBreakCommand();
            break;
        case 'build':
            showLogo();
            logger.debug('\n⚠️  "build" is deprecated. Use "specwright ship" instead.\n');
            await handleShipCommand(); // Redirect to ship
            break;
        case 'approve':
            showLogo();
            await handleApproveCommand(args.slice(1));
            break;
        case 'finalize-scope':
            showLogo();
            await handleFinalizeScopeCommand();
            break;
        default:
            // Try parsing as legacy command format
            const { command, params } = parseCommand(args);
            
            switch(command) {
                case 'build':
                    showLogo();
                    logger.debug('\n⚠️  "build" is deprecated. Use "specwright ship" instead.\n');
                    // Legacy format: if description provided, treat as scoping
                    if (params.description) {
                        await handleScopingWorkflow(params.description);
                    } else {
                        await handleBuildCommand();
                    }
                    break;
                case 'spec':
                    showLogo();
                    await handleProjectCommand(params.projectId);
                    break;
                case 'unknown':
                    logger.debug(`❌ Unknown command: ${args[0]}`);
                    logger.debug('Use --help for usage information.');
                    break;
            }
    }
};

// Run main function
main().catch(logger.error);

// Comment test