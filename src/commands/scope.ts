/**
 * Scope Command - Redirects to 'new' command (LEGACY)
 * 
 * This command is kept for backward compatibility but redirects users to 'specwright new'
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { ensureWebServerRunning } from '../utils/server-manager.js';
import { logger } from '../utils/logger.js';

/**
 * Handle the scope command - opens web UI project creation page
 * @deprecated Use 'specwright new' instead
 */
export const handleScopeCommand = async (): Promise<void> => {
    logger.debug('');
    logger.debug(chalk.yellow('⚠️  The "scope" command is deprecated.'));
    logger.debug(chalk.yellow('    Please use "specwright new" instead.'));
    logger.debug('');
    logger.debug(chalk.cyan('🌐 Opening project creation in web UI...'));
    logger.debug('');
    
    // Open web UI directly to create project page
    const createProjectUrl = `/create-project`;
    
    try {
        await ensureWebServerRunning(createProjectUrl);
        
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
        logger.debug(chalk.bold.cyan('📋 NEXT STEPS:'));
        logger.debug('');
        logger.debug(chalk.white('1. Choose Manual or AI-Assisted mode in the web UI'));
        logger.debug(chalk.white('2. Enter your project details'));
        logger.debug(chalk.white('3. Create and start working on your project'));
        logger.debug('');
        logger.debug(chalk.dim('⏸️  Keep this terminal running'));
        logger.debug(chalk.dim('   Press Ctrl+C to stop the server'));
        logger.debug('');
        
    } catch (error: any) {
        logger.error('');
        logger.error(chalk.red('❌ Failed to start web server'));
        logger.error('');
        logger.error(chalk.dim(error.message));
        logger.error('');
        process.exit(1);
    }
};

/**
 * Handle the scoping workflow - opens web UI with user request
 * @deprecated Use 'specwright new' instead
 */
export const handleScopingWorkflow = async (userRequest: string): Promise<void> => {
    logger.debug('');
    logger.debug(chalk.yellow('⚠️  This workflow is deprecated.'));
    logger.debug(chalk.yellow('    Please use "specwright new" instead.'));
    logger.debug('');
    logger.debug(chalk.cyan('🌐 Opening project creation in web UI...'));
    logger.debug('');
    
    // Redirect to create-project page (user can toggle to AI mode)
    const createProjectUrl = `/create-project`;
    
    try {
        await ensureWebServerRunning(createProjectUrl);
        
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
        logger.debug(chalk.bold.cyan('📋 NEXT STEPS:'));
        logger.debug('');
        logger.debug(chalk.white('1. Switch to AI-Assisted mode to scope your request'));
        logger.debug(chalk.white('2. Or create the project manually'));
        logger.debug('');
        logger.debug(chalk.dim('⏸️  Keep this terminal running'));
        logger.debug(chalk.dim('   Press Ctrl+C to stop the server'));
        logger.debug('');
        
    } catch (error: any) {
        logger.error('');
        logger.error(chalk.red('❌ Failed to start web server'));
        logger.error('');
        logger.error(chalk.dim(error.message));
        logger.error('');
        process.exit(1);
    }
};
