/**
 * Spec Command - Redirects to web UI (LEGACY)
 * 
 * This command is kept for backward compatibility but redirects to web UI
 */

import chalk from 'chalk';
import { ensureWebServerRunning } from '../utils/server-manager.js';
import { getExistingProjects } from '../services/project-service.js';
import { logger } from '../utils/logger.js';

/**
 * Handle the spec command - opens web UI dashboard
 * @deprecated Use 'specwright new' to create or resume projects
 */
export const handleSpecCommand = async (): Promise<void> => {
    logger.debug('');
    logger.debug(chalk.yellow('ℹ️  The "spec" command has been simplified.'));
    logger.debug(chalk.dim('   Recommended: Use ') + chalk.cyan('specwright new') + chalk.dim(' to create or resume projects.'));
    logger.debug('');
    logger.debug(chalk.cyan('🌐 Opening dashboard...'));
    logger.debug('');
    
    await ensureWebServerRunning('/');
};

/**
 * Handle the project command - opens specific project or dashboard
 * @deprecated Use 'specwright new' or 'specwright view' instead
 */
export const handleProjectCommand = async (projectId: string | null = null): Promise<void> => {
    if (projectId) {
        // Direct project ID provided - open that project
        const projects = getExistingProjects();
        const project = projects.find(p => p.id === projectId || p.fullId === projectId);
        
        if (!project) {
            logger.debug('');
            logger.debug(chalk.red(`❌ Project "${projectId}" not found.`));
            logger.debug('');
            logger.debug(chalk.dim('Available projects:'));
            projects.forEach(p => {
                logger.debug(chalk.dim(`  - ${p.id}: ${p.description}`));
            });
            logger.debug('');
            return;
        }
        
        logger.debug('');
        logger.debug(chalk.cyan(`🌐 Opening project ${project.id}...`));
        logger.debug('');
        
        await ensureWebServerRunning(`/specification/${project.id}`);
        
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
        logger.debug(chalk.dim('⏸️  Keep this terminal running'));
        logger.debug(chalk.dim('   Press Ctrl+C to stop the server'));
        logger.debug('');
    } else {
        // No ID - open dashboard to select
        await handleSpecCommand();
    }
};
