/**
 * Ship command - Work on and ship issues via web UI
 */

import chalk from 'chalk';
import { printSeparator } from '../ui/display.js';
import { ensureWebServerRunning } from '../utils/server-manager.js';
import { logger } from '../utils/logger.js';

/**
 * Handle the ship command - opens issues board in web UI
 */
export const handleShipCommand = async (): Promise<void> => {
    logger.debug('');
    printSeparator();
    logger.debug(chalk.bold.cyanBright('🚀 SHIP FEATURES'));
    logger.debug('');
    logger.debug(chalk.cyan('🌐 Opening issues board...'));
    logger.debug('');
    
    try {
        await ensureWebServerRunning('/issues');
        
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
        printSeparator();
        logger.debug(chalk.bold.cyan('📋 ISSUES BOARD FEATURES:'));
        logger.debug('');
        logger.debug(chalk.white('  • Kanban board with 4 columns'));
        logger.debug(chalk.white('  • Review and approve completed work'));
        logger.debug(chalk.white('  • Start next ready issue'));
        logger.debug(chalk.white('  • Track progress visually'));
        logger.debug('');
        logger.debug(chalk.dim('⏸️  Keep this terminal running'));
        logger.debug(chalk.dim('   Press Ctrl+C to stop the server'));
        logger.debug('');
        printSeparator();
        
    } catch (error: any) {
        logger.error('');
        logger.error(chalk.red('❌ Failed to start web server'));
        logger.error('');
        logger.error(chalk.dim(error.message));
        logger.error('');
        process.exit(1);
    }
};

// Export for backward compatibility
export const handleBuildCommand = handleShipCommand;
