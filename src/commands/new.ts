/**
 * New Command - Create new features (consolidates scope + spec + break)
 * 
 * This is the main entry point for creating new work in SpecWright.
 * It handles: classification, project creation, specification, and issue breakdown.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OUTPUT_DIR } from '../config/constants.js';
import { printSeparator } from '../ui/display.js';
import { ensureWebServerRunning } from '../utils/server-manager.js';
import { getExistingProjects, isProjectSpecced, isPMPRDComplete, isUXWireframesComplete, isArchitectComplete } from '../services/project-service.js';
import { logger } from '../utils/logger.js';
import type { ProjectMetadata } from '../types/index.js';

/**
 * Detect incomplete projects (projects that started spec but didn't finish)
 */
function detectIncompleteProjects(): Array<ProjectMetadata & { phase: string }> {
    const projects = getExistingProjects();
    const incomplete: Array<ProjectMetadata & { phase: string }> = [];
    
    for (const project of projects) {
        const projectDir = project.path;
        
        // Skip if already fully specced
        if (isProjectSpecced(projectDir)) {
            continue;
        }
        
        // Determine which phase is incomplete
        const hasPM = isPMPRDComplete(projectDir);
        const hasUX = isUXWireframesComplete(projectDir);
        const hasArch = isArchitectComplete(projectDir);
        
        // If any work has been done, it's incomplete
        if (hasPM || hasUX || hasArch) {
            let phase = 'Unknown';
            if (!hasPM) {
                phase = 'Product Manager';
            } else if (!hasUX) {
                phase = 'Designer';
            } else if (!hasArch) {
                phase = 'Engineer';
            }
            
            incomplete.push({
                ...project,
                phase
            });
        }
    }
    
    return incomplete;
}

/**
 * Handle the new command
 */
export const handleNewCommand = async (): Promise<void> => {
    logger.debug('');
    printSeparator();
    logger.debug(chalk.yellowBright('🚀 CREATE NEW FEATURE'));
    logger.debug('');
    
    // Launch web-based project creation flow
    logger.debug('');
    logger.debug(chalk.cyan('🌐 Opening project creation in web UI...'));
    logger.debug('');
    
    const createProjectUrl = `/create-project`;
    
    try {
        await ensureWebServerRunning(createProjectUrl);
        
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
        printSeparator();
        logger.debug(chalk.bold.cyan('📋 NEXT STEPS:'));
        logger.debug('');
        logger.debug(chalk.white('1. Choose Manual or AI-Assisted mode'));
        logger.debug(chalk.white('2. Enter your project details'));
        logger.debug(chalk.white('3. Create your project and start speccing'));
        logger.debug('');
        logger.debug(chalk.dim('⏸️  Keep this terminal running'));
        logger.debug(chalk.dim('   Press Ctrl+C to stop the server when done'));
        logger.debug('');
        printSeparator();
        
        // Server will stay running (handled in ensureWebServerRunning)
        
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
 * Helper function to create tasks for a specific project
 * This wraps the break command logic for programmatic use
 */
async function createTasksForProject(project: ProjectMetadata): Promise<void> {
    // Import modules needed for this function
    const { generateTechLeadBreakdownPrompt } = await import('../services/prompt-generator.js');
    const { printAgent } = await import('../ui/display.js');
    const { printPrompt, waitForCompletion } = await import('../ui/prompts.js');
    const { displayIssueBreakdownSummary } = await import('../ui/summaries.js');
    const { TEMPLATES_DIR } = await import('../config/constants.js');
    
    const projectDir = project.path;
    const projectRequestFile = path.join(projectDir, 'project_request.md');
    
    // Extract description from project_request.md
    let userRequest = '';
    if (fs.existsSync(projectRequestFile)) {
        const content = fs.readFileSync(projectRequestFile, 'utf-8');
        const lines = content.split('\n');
        let inDescription = false;
        
        for (const line of lines) {
            if (line.startsWith('## Description')) {
                inDescription = true;
                continue;
            }
            if (inDescription && line.startsWith('##')) {
                break;
            }
            if (inDescription && line.trim()) {
                userRequest = line.trim();
                break;
            }
        }
    }
    
    if (!userRequest) {
        userRequest = project.description;
    }
    
    // Run the issue breakdown
    printAgent("TECH LEAD", "Issue Breakdown & Implementation Planning", "📋");
    
    const issuesDir = path.join(projectDir, 'issues');
    
    // Create issues directory
    if (!fs.existsSync(issuesDir)) {
        fs.mkdirSync(issuesDir, { recursive: true });
    }
    
    // Create project summary template
    const projectSummaryFile = path.join(issuesDir, 'issues.json');
    const projectSummaryTemplatePath = path.join(TEMPLATES_DIR, 'issues_template.json');
    
    if (fs.existsSync(projectSummaryTemplatePath)) {
        const projectSummaryTemplateContent = fs.readFileSync(projectSummaryTemplatePath, 'utf8');
        fs.writeFileSync(projectSummaryFile, projectSummaryTemplateContent);
        logger.debug(chalk.green(`✅ Pre-created ${projectSummaryFile}`));
    }
    
    logger.debug(chalk.dim(`   Issue files will be created in: ${issuesDir}`));
    logger.debug('');
    
    const breakPrompt = generateTechLeadBreakdownPrompt(
        projectDir,
        issuesDir,
        projectSummaryFile,
        userRequest,
        true  // Include codebase analysis for CLI
    );

    await printPrompt(breakPrompt);
    await waitForCompletion(projectSummaryFile, 'Tech Lead');
    
    // Display summary
    await displayIssueBreakdownSummary(projectDir);
}

