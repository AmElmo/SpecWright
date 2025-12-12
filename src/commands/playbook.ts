/**
 * Playbook Command - Redirects to web UI for playbook management
 * 
 * This module contains the playbook command handler that opens the web UI.
 */

import chalk from 'chalk';
import { ensureWebServerRunning } from '../utils/server-manager.js';
import { logger } from '../utils/logger.js';

/**
 * Handle the playbook command - opens web UI playbook page
 */
export const handlePlaybookCommand = async (options?: { update?: boolean; audit?: boolean }): Promise<void> => {
    logger.debug('');
    logger.debug(chalk.cyan('🌐 Opening playbook management in web UI...'));
    logger.debug('');
    
    // Open web UI directly to playbook page
    const playbookUrl = `/playbook`;
    
    try {
        await ensureWebServerRunning(playbookUrl);
        
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
        logger.debug(chalk.bold.cyan('📜 PLAYBOOK MANAGEMENT'));
        logger.debug('');
        logger.debug(chalk.white('From the web UI you can:'));
        logger.debug(chalk.dim('  • Generate a new playbook for your project'));
        logger.debug(chalk.dim('  • View your existing playbook'));
        logger.debug(chalk.dim('  • Update the playbook to sync with codebase changes'));
        logger.debug(chalk.dim('  • Audit codebase compliance with playbook principles'));
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

// Legacy exports for backward compatibility (these now just redirect to web UI)
export const handlePlaybookUpdate = handlePlaybookCommand;
export const handlePlaybookAudit = handlePlaybookCommand;
