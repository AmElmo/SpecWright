/**
 * Break Command - Break down project into issues (via Specification Phase 4)
 * 
 * This command redirects to the specification page where breakdown happens as Phase 4
 */

import chalk from 'chalk';
import { printSeparator } from '../ui/display.js';
import { ensureWebServerRunning } from '../utils/server-manager.js';
import { getExistingProjects } from '../services/project-service.js';
import { logger } from '../utils/logger.js';

/**
 * Handle the break command - opens specification page or dashboard
 * @deprecated Issue breakdown is now Phase 4 of the specification flow
 */
export const handleBreakCommand = async (): Promise<void> => {
    logger.debug('');
    printSeparator();
    logger.debug(chalk.bold.cyanBright('📊 BREAK DOWN INTO ISSUES'));
    logger.debug('');
    logger.debug(chalk.yellow('ℹ️  Issue breakdown is now Phase 4 of the specification.'));
    logger.debug('');
    
    // Check if there are completed projects
    const projects = getExistingProjects();
    const completedProjects = projects.filter(p => {
        // Simple check - if project has PRD, design, and tech spec, it's ready
        // More sophisticated check would use isProjectSpecced from project-service
        return true; // For now, show all projects
    });
    
    if (completedProjects.length === 1) {
        // Single project - go directly to it
        logger.debug(chalk.cyan(`🌐 Opening project: ${completedProjects[0].name || completedProjects[0].description}...`));
        logger.debug('');
        
        await ensureWebServerRunning(`/specification/${completedProjects[0].id}`);
    } else {
        // Multiple or no projects - go to dashboard
        logger.debug(chalk.cyan('🌐 Opening dashboard to select project...'));
        logger.debug('');
        
        await ensureWebServerRunning('/');
    }
    
    logger.debug(chalk.green('✅ Browser opened!'));
    logger.debug('');
    logger.debug(chalk.bold.cyan('📋 NEXT STEPS:'));
    logger.debug('');
    logger.debug(chalk.white('  1. Navigate to your completed project'));
    logger.debug(chalk.white('  2. Complete Phase 4: Issue Breakdown'));
    logger.debug(chalk.white('  3. View tasks in the task board'));
    logger.debug('');
    logger.debug(chalk.dim('⏸️  Keep this terminal running'));
    logger.debug(chalk.dim('   Press Ctrl+C to stop the server'));
    logger.debug('');
    printSeparator();
};
