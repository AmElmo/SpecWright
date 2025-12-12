/**
 * View Command - Browse all projects and issues in web UI
 */

import chalk from 'chalk';
import { printSeparator } from '../ui/display.js';
import { ensureWebServerRunning } from '../utils/server-manager.js';
import { logger } from '../utils/logger.js';

/**
 * Handle the view command - opens web UI dashboard
 */
export const handleViewCommand = async (): Promise<void> => {
    printSeparator();
    logger.debug(chalk.bold.cyanBright('👁️  PROJECTS & ISSUES OVERVIEW'));
    logger.debug('');
    logger.debug(chalk.cyan('🌐 Opening web UI...'));
    logger.debug('');
    
    try {
        await ensureWebServerRunning('/');
        
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
        printSeparator();
        logger.debug(chalk.bold.cyan('📋 WEB UI FEATURES:'));
        logger.debug('');
        logger.debug(chalk.white('  • View all projects with progress'));
        logger.debug(chalk.white('  • Browse issues and tasks'));
        logger.debug(chalk.white('  • Click any project for details'));
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
