/**
 * Navigation functions
 * 
 * This module contains functions for navigating through projects, issues,
 * and issue breakdowns.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import type { ProjectMetadata, IssueMetadata } from '../types/index.js';
import { printSeparator, getStatusBadge, getCategoryBadge } from './display.js';
import { OUTPUT_DIR } from '../config/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Get the project summary path
 */
const getProjectSummaryPath = (projectDir: string): string => {
    return path.join(projectDir, 'issues', 'issues.json');
};

/**
 * Shows a menu to select and view project details
 */
export const showProjectDetails = async (projects: ProjectMetadata[]): Promise<void> => {
    const choices: any[] = projects.map((project: ProjectMetadata) => ({
        name: `${chalk.cyan(project.id)} - ${project.name || project.description}`,
        value: project
    }));
    
    choices.push(new inquirer.Separator(), { name: 'Back', value: 'back' });
    
    const { selectedProject } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedProject',
        message: 'Select a project to view:',
        choices: choices,
        pageSize: 15,
        prefix: '  '
    }]);
    
    if (selectedProject === 'back') {
        return;
    }
    
    logger.debug("");
    printSeparator();
    logger.debug(chalk.bold.cyanBright(`📋 PROJECT ${selectedProject.id}`));
    logger.debug("");
    logger.debug(chalk.bold('Name: ') + chalk.greenBright(selectedProject.name || selectedProject.description));
    logger.debug(chalk.bold('Status: ') + getStatusBadge(selectedProject.status || 'ready_to_spec'));
    
    // Calculate progression from issues
    const _PROJECTS_DIR = path.join(OUTPUT_DIR, 'projects');
    const projectDir = selectedProject.path || path.join(_PROJECTS_DIR, selectedProject.folderName || selectedProject.fullId);
    const projectSummaryPath = getProjectSummaryPath(projectDir);
    
    if (fs.existsSync(projectSummaryPath)) {
        try {
            const summaryData = JSON.parse(fs.readFileSync(projectSummaryPath, 'utf-8'));
            // Handle both new (issues) and legacy (issues_list) field names
            const issuesList = summaryData.issues || summaryData.issues_list || [];
            const totalIssues = issuesList.length;
            const completedIssues = issuesList.filter((issue: any) => issue.status === 'done').length;
            const progressPercent = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
            
            const progressBar = '█'.repeat(Math.floor(progressPercent / 5)) + '░'.repeat(20 - Math.floor(progressPercent / 5));
            const progressColor = progressPercent === 100 ? chalk.green : 
                                 progressPercent >= 50 ? chalk.yellow : chalk.gray;
            
            logger.debug(chalk.bold('Progress: ') + progressColor(`${completedIssues}/${totalIssues} issues complete (${progressPercent}%)`));
            logger.debug(chalk.dim(`  ${progressBar}`));
        } catch (error) {
            // Silently skip if there's an error reading the file
        }
    }
    
    logger.debug("");
    
    if (selectedProject.description && selectedProject.description !== selectedProject.name) {
        logger.debug(chalk.bold('Description:'));
        logger.debug(chalk.dim(`  ${selectedProject.description}`));
        logger.debug("");
    }
    
    if (selectedProject.testable_outcome) {
        logger.debug(chalk.bold('Testable Outcome:'));
        logger.debug(chalk.dim(`  ${selectedProject.testable_outcome}`));
        logger.debug("");
    }
    
    logger.debug(chalk.bold('📄 Documents:'));
    const docs = [];
    if (fs.existsSync(path.join(projectDir, 'prd.md'))) docs.push('✅ PRD');
    if (fs.existsSync(path.join(projectDir, 'design_brief.md'))) docs.push('✅ Design Brief');
    if (fs.existsSync(path.join(projectDir, 'technical_specification.md'))) docs.push('✅ Technical Spec');
    if (fs.existsSync(getProjectSummaryPath(projectDir))) docs.push('✅ Issue Breakdown');
    
    if (docs.length > 0) {
        docs.forEach(doc => logger.debug(chalk.dim(`  ${doc}`)));
    } else {
        logger.debug(chalk.dim('  No spec documents yet'));
    }
    logger.debug("");
    
    printSeparator();
};

/**
 * Shows a menu to select and view issue details
 */
export const showIssueDetails = async (issues: IssueMetadata[]): Promise<void> => {
    const choices: any[] = issues.map(issue => ({
        name: `${chalk.cyan(issue.issueId)} - ${issue.title}`,
        value: issue
    }));
    
    choices.push(new inquirer.Separator(), { name: 'Back', value: 'back' });
    
    const { selectedIssue } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedIssue',
        message: 'Select an issue to view:',
        choices: choices,
        pageSize: 15,
        prefix: '  '
    }]);
    
    if (selectedIssue === 'back') {
        return;
    }
    
    logger.debug("");
    printSeparator();
    logger.debug(chalk.bold.cyanBright(`📋 ISSUE ${selectedIssue.issueId}`));
    logger.debug("");
    logger.debug(chalk.bold('Title: ') + chalk.greenBright(selectedIssue.title));
    logger.debug(chalk.bold('Category: ') + getCategoryBadge(selectedIssue.category));
    logger.debug(chalk.bold('Complexity: ') + chalk.cyan(`${selectedIssue.complexityScore}/10`));
    logger.debug(chalk.bold('Estimated Hours: ') + chalk.cyan(`${selectedIssue.estimatedHours}h`));
    logger.debug(chalk.bold('Status: ') + getStatusBadge(selectedIssue.status || 'pending'));
    logger.debug("");
    logger.debug(chalk.bold('Description:'));
    logger.debug(chalk.dim(`  ${selectedIssue.description}`));
    logger.debug("");
    printSeparator();
};

/**
 * Displays full project details without a selection menu
 */
export const displayFullProjectDetails = async (selectedProject: ProjectMetadata): Promise<void> => {
    printSeparator();
    logger.debug(chalk.bold.cyanBright(`📋 PROJECT ${selectedProject.id}`));
    logger.debug("");
    logger.debug(chalk.bold('Name: ') + chalk.greenBright(selectedProject.name || selectedProject.description));
    logger.debug(chalk.bold('Status: ') + getStatusBadge(selectedProject.status || 'ready_to_spec'));
    
    // Calculate progression from issues
    const _PROJECTS_DIR = path.join(OUTPUT_DIR, 'projects');
    const projectDir = selectedProject.path || path.join(_PROJECTS_DIR, selectedProject.folderName || selectedProject.fullId);
    const projectSummaryPath = getProjectSummaryPath(projectDir);
    
    if (fs.existsSync(projectSummaryPath)) {
        try {
            const summaryData = JSON.parse(fs.readFileSync(projectSummaryPath, 'utf-8'));
            // Handle both new (issues) and legacy (issues_list) field names
            const issuesList = summaryData.issues || summaryData.issues_list || [];
            const totalIssues = issuesList.length;
            const completedIssues = issuesList.filter((issue: any) => issue.status === 'done').length;
            const progressPercent = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
            
            const progressBar = '█'.repeat(Math.floor(progressPercent / 5)) + '░'.repeat(20 - Math.floor(progressPercent / 5));
            const progressColor = progressPercent === 100 ? chalk.green : 
                                 progressPercent >= 50 ? chalk.yellow : chalk.gray;
            
            logger.debug(chalk.bold('Progress: ') + progressColor(`${completedIssues}/${totalIssues} issues complete (${progressPercent}%)`));
            logger.debug(chalk.dim(`  ${progressBar}`));
        } catch (error) {
            // Silently skip if there's an error reading the file
        }
    }
    
    logger.debug("");
    
    if (selectedProject.description && selectedProject.description !== selectedProject.name) {
        logger.debug(chalk.bold('Description:'));
        logger.debug(chalk.dim(`  ${selectedProject.description}`));
        logger.debug("");
    }
    
    if (selectedProject.testable_outcome) {
        logger.debug(chalk.bold('Testable Outcome:'));
        logger.debug(chalk.dim(`  ${selectedProject.testable_outcome}`));
        logger.debug("");
    }
    
    logger.debug(chalk.bold('📄 Documents:'));
    const docs = [];
    if (fs.existsSync(path.join(projectDir, 'prd.md'))) docs.push('✅ PRD');
    if (fs.existsSync(path.join(projectDir, 'design_brief.md'))) docs.push('✅ Design Brief');
    if (fs.existsSync(path.join(projectDir, 'technical_specification.md'))) docs.push('✅ Technical Spec');
    if (fs.existsSync(getProjectSummaryPath(projectDir))) docs.push('✅ Issue Breakdown');
    
    if (docs.length > 0) {
        docs.forEach(doc => logger.debug(chalk.dim(`  ${doc}`)));
    } else {
        logger.debug(chalk.dim('  No spec documents yet'));
    }
    logger.debug("");
    
    printSeparator();
};

/**
 * Displays full issue details without a selection menu
 */
export const displayFullIssueDetails = async (selectedIssue: IssueMetadata): Promise<void> => {
    printSeparator();
    logger.debug(chalk.bold.cyanBright(`📋 ISSUE ${selectedIssue.issueId}`));
    logger.debug("");
    logger.debug(chalk.bold('Title: ') + chalk.greenBright(selectedIssue.title));
    logger.debug(chalk.bold('Estimated Hours: ') + chalk.cyan(`${selectedIssue.estimatedHours}h`));
    logger.debug(chalk.bold('Status: ') + getStatusBadge(selectedIssue.status || 'pending'));
    logger.debug("");
    logger.debug(chalk.bold('Description:'));
    logger.debug(chalk.dim(`  ${selectedIssue.description}`));
    logger.debug("");
    printSeparator();
};

/**
 * Navigates through issue breakdown with prev/next navigation
 * Reads issues from issues.json
 */
export const navigateIssueBreakdown = async (projectDir: string): Promise<void> => {
    const projectSummaryFile = path.join(projectDir, 'issues', 'issues.json');
    
    if (!fs.existsSync(projectSummaryFile)) {
        logger.debug(chalk.yellow('⚠️  No project summary found.'));
        return;
    }
    
    // Parse issues from issues.json
    let issues: any[] = [];
    try {
        const summaryContent = fs.readFileSync(projectSummaryFile, 'utf-8');
        const projectSummary = JSON.parse(summaryContent);
        issues = projectSummary.issues || projectSummary.issues_list || [];
    } catch (error) {
        logger.debug(chalk.yellow('⚠️  Failed to parse project summary.'));
        return;
    }
    
    if (issues.length === 0) {
        logger.debug(chalk.yellow('⚠️  No issues found in project summary.'));
        return;
    }
    
    let currentIssueIndex = 0;
    
    while (currentIssueIndex < issues.length) {
        const issue = issues[currentIssueIndex];
        
        const title = issue.title || '';
        const issueId = issue.issue_id || '';
        const status = issue.status || 'pending';
        const category = issue.category || 'fullstack';
        const complexity = issue.complexity || issue.complexity_score || 0;
        const hours = issue.estimated_hours || 0;
        
        logger.debug("");
        printSeparator();
        logger.debug(chalk.bold.cyanBright(`📋 ISSUE ${currentIssueIndex + 1}/${issues.length}`));
        logger.debug("");
        
        // Parse complexity score
        const complexityScore = typeof complexity === 'string' ? parseInt(complexity.split('/')[0]) || 0 : complexity;
        const complexityColor = complexityScore >= 7 ? chalk.red :
                               complexityScore >= 5 ? chalk.yellow : chalk.green;
        
        logger.debug(chalk.bold.whiteBright(`ID: ${issueId}`));
        logger.debug(chalk.bold.whiteBright(`Title: ${title}`));
        logger.debug(chalk.bold.whiteBright(`Category: ${category}`));
        logger.debug(chalk.bold.whiteBright(`Status: ${status}`));
        logger.debug(chalk.bold.whiteBright(`Complexity: ${complexityColor(`${complexityScore}/10`)}`));
        logger.debug(chalk.bold.whiteBright(`Estimated Hours: ${hours}h`));
        logger.debug("");
        
        // Show issue content in formatted way
        logger.debug(chalk.dim('─'.repeat(60)));
        
        // Description
        if (issue.description) {
            logger.debug(chalk.bold('Description:'));
            logger.debug(chalk.whiteBright(issue.description));
            logger.debug("");
        }
        
        // Key Decisions
        if (issue.key_decisions && issue.key_decisions.length > 0) {
            logger.debug(chalk.bold('Key Decisions:'));
            issue.key_decisions.forEach((decision: string) => {
                logger.debug(chalk.cyan(`  → ${decision}`));
            });
            logger.debug("");
        }
        
        // Acceptance Criteria
        if (issue.acceptance_criteria && issue.acceptance_criteria.length > 0) {
            logger.debug(chalk.bold('Acceptance Criteria:'));
            issue.acceptance_criteria.forEach((criterion: string) => {
                logger.debug(chalk.green(`  ✓ ${criterion}`));
            });
            logger.debug("");
        }
        
        // Human-in-the-Loop
        if (issue.human_in_the_loop && issue.human_in_the_loop.length > 0) {
            logger.debug(chalk.bold('Manual Verification:'));
            issue.human_in_the_loop.forEach((step: string, idx: number) => {
                logger.debug(chalk.yellow(`  ${idx + 1}. ${step}`));
            });
            logger.debug("");
        }
        
        // Dependencies
        if (issue.dependencies && issue.dependencies.length > 0) {
            logger.debug(chalk.bold('Dependencies:'));
            logger.debug(chalk.dim(`  ${issue.dependencies.join(', ')}`));
            logger.debug("");
        }
        
        logger.debug(chalk.dim('─'.repeat(60)));
        logger.debug("");
        
        // Navigation options
        const choices = [];
        if (currentIssueIndex > 0) choices.push({ name: '⬅️  Previous Issue', value: 'prev' });
        if (currentIssueIndex < issues.length - 1) choices.push({ name: '➡️  Next Issue', value: 'next' });
        choices.push({ name: '🚪 Exit Navigation', value: 'exit' });
        
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Navigate:',
            choices: choices,
            prefix: '  '
        }]);
        
        switch (action) {
            case 'prev':
                currentIssueIndex--;
                break;
            case 'next':
                currentIssueIndex++;
                break;
            case 'exit':
                logger.debug("");
                logger.debug(chalk.greenBright('✅ Finished exploring issue breakdown.'));
                return;
        }
    }
};
