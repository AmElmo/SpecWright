/**
 * Approve command - Quick approval workflow for issues
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { printSeparator } from '../ui/display.js';
import { 
    getIssuesByStatus,
    updateIssueStatus,
    findIssueById,
    getIssueStatusCounts,
    getProjectIssues,
    type ParsedIssue 
} from '../services/issue-service.js';
import { getExistingProjects } from '../services/project-service.js';
import { logger } from '../utils/logger.js';

/**
 * Handle the approve command
 * Supports multiple modes:
 * - No args: Interactive multi-select
 * - Issue IDs: Direct approval
 * - --all flag: Approve all in-review
 */
export const handleApproveCommand = async (args: string[] = []): Promise<void> => {
    printSeparator();
    logger.debug(chalk.bold.cyanBright('✅ APPROVE ISSUES'));
    logger.debug("");
    
    // Check for --all flag
    if (args.includes('--all')) {
        await approveAllInReview();
        printSeparator();
        return;
    }
    
    // If issue IDs provided, approve them directly
    if (args.length > 0) {
        await approveSpecificIssues(args);
        printSeparator();
        return;
    }
    
    // No args: Interactive multi-select
    await interactiveApproval();
    printSeparator();
};

/**
 * Interactive multi-select approval
 */
const interactiveApproval = async (): Promise<void> => {
    // Get all in-review issues from all projects
    const allInReviewIssues: Array<{ issue: ParsedIssue; projectId: string }> = [];
    
    const projects = getExistingProjects();
    for (const project of projects) {
        const inReviewIssues = getIssuesByStatus(project.id, 'in-review');
        for (const issue of inReviewIssues) {
            allInReviewIssues.push({ issue, projectId: project.id });
        }
    }
    
    if (allInReviewIssues.length === 0) {
        logger.debug(chalk.yellow('No issues in review.'));
        logger.debug(chalk.dim('Run ') + chalk.cyan('specwright build') + chalk.dim(' to work on pending issues.'));
        logger.debug("");
        return;
    }
    
    logger.debug(chalk.bold(`You have ${allInReviewIssues.length} issue${allInReviewIssues.length > 1 ? 's' : ''} in review:`));
    logger.debug("");
    
    // Create choices for multi-select
    const choices = allInReviewIssues.map(({ issue, projectId }) => ({
        name: `${chalk.cyan(issue.issueId)} - ${issue.title} ${chalk.dim(`(${projectId})`)}`,
        value: issue.issueId,
        checked: false
    }));
    
    const { selectedIssues } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedIssues',
        message: 'Select issues to approve (Space to select, Enter to confirm):',
        choices: choices,
        pageSize: 15
    }]);
    
    if (selectedIssues.length === 0) {
        logger.debug("");
        logger.debug(chalk.yellow('No issues selected.'));
        logger.debug("");
        return;
    }
    
    // Show confirmation
    logger.debug("");
    logger.debug(chalk.bold(`You selected ${selectedIssues.length} issue${selectedIssues.length > 1 ? 's' : ''}:`));
    for (const issueId of selectedIssues) {
        logger.debug(chalk.dim(`  ✓ ${issueId}`));
    }
    logger.debug("");
    
    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Approve these issues?',
        default: true
    }]);
    
    if (!confirm) {
        logger.debug("");
        logger.debug(chalk.yellow('Approval cancelled.'));
        logger.debug("");
        return;
    }
    
    // Approve all selected issues
    logger.debug("");
    let successCount = 0;
    
    for (const issueId of selectedIssues) {
        const result = findIssueById(issueId);
        if (result) {
            const success = updateIssueStatus(result.projectId, result.issue.issueId, 'approved');
            if (success) {
                logger.debug(chalk.green(`✓ ${issueId} approved`));
                successCount++;
            } else {
                logger.debug(chalk.red(`✗ ${issueId} failed to update`));
            }
        }
    }
    
    logger.debug("");
    logger.debug(chalk.bold.green(`✅ ${successCount}/${selectedIssues.length} issue${successCount !== 1 ? 's' : ''} approved!`));
    logger.debug("");
};

/**
 * Approve specific issues by ID
 */
const approveSpecificIssues = async (issueIds: string[]): Promise<void> => {
    const validIssues: Array<{ issue: ParsedIssue; projectId: string }> = [];
    const invalidIssues: string[] = [];
    const notInReview: string[] = [];
    
    // Validate all issue IDs
    for (const issueId of issueIds) {
        const result = findIssueById(issueId);
        
        if (!result) {
            invalidIssues.push(issueId);
        } else if (result.issue.status !== 'in-review') {
            notInReview.push(issueId);
        } else {
            validIssues.push(result);
        }
    }
    
    // Report validation errors
    if (invalidIssues.length > 0) {
        logger.debug(chalk.red(`Issue${invalidIssues.length > 1 ? 's' : ''} not found: ${invalidIssues.join(', ')}`));
        logger.debug("");
    }
    
    if (notInReview.length > 0) {
        logger.debug(chalk.yellow(`Issue${notInReview.length > 1 ? 's' : ''} not in review:`));
        for (const issueId of notInReview) {
            const result = findIssueById(issueId);
            if (result) {
                logger.debug(chalk.dim(`  ${issueId} - Status: ${result.issue.status}`));
            }
        }
        logger.debug("");
    }
    
    if (validIssues.length === 0) {
        logger.debug(chalk.yellow('No valid issues to approve.'));
        logger.debug("");
        return;
    }
    
    // Single issue - approve directly
    if (validIssues.length === 1) {
        const { issue, projectId } = validIssues[0];
        const success = updateIssueStatus(projectId, issue.issueId, 'approved');
        
        if (success) {
            logger.debug(chalk.green(`✅ ${issue.issueId} marked as approved`));
            logger.debug("");
            
            // Show progress
            const counts = getIssueStatusCounts(projectId);
            const progress = Math.round((counts.approved / counts.total) * 100);
            logger.debug(chalk.dim(`Project progress: ${counts.approved}/${counts.total} (${progress}%)`));
        } else {
            logger.debug(chalk.red(`❌ Failed to update ${issue.issueId}`));
        }
        logger.debug("");
        return;
    }
    
    // Multiple issues - show confirmation
    logger.debug(chalk.bold(`About to approve ${validIssues.length} issues:`));
    for (const { issue } of validIssues) {
        logger.debug(chalk.dim(`  ✓ ${issue.issueId} - ${issue.title}`));
    }
    logger.debug("");
    
    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Approve all these issues?',
        default: true
    }]);
    
    if (!confirm) {
        logger.debug("");
        logger.debug(chalk.yellow('Approval cancelled.'));
        logger.debug("");
        return;
    }
    
    // Approve all
    logger.debug("");
    let successCount = 0;
    
    for (const { issue, projectId } of validIssues) {
        const success = updateIssueStatus(projectId, issue.issueId, 'approved');
        if (success) {
            logger.debug(chalk.green(`✓ ${issue.issueId} approved`));
            successCount++;
        } else {
            logger.debug(chalk.red(`✗ ${issue.issueId} failed to update`));
        }
    }
    
    logger.debug("");
    logger.debug(chalk.bold.green(`✅ ${successCount}/${validIssues.length} issue${successCount !== 1 ? 's' : ''} approved!`));
    logger.debug("");
};

/**
 * Approve all in-review issues across all projects
 */
const approveAllInReview = async (): Promise<void> => {
    // Get all in-review issues from all projects
    const allInReviewIssues: Array<{ issue: ParsedIssue; projectId: string }> = [];
    
    const projects = getExistingProjects();
    for (const project of projects) {
        const inReviewIssues = getIssuesByStatus(project.id, 'in-review');
        for (const issue of inReviewIssues) {
            allInReviewIssues.push({ issue, projectId: project.id });
        }
    }
    
    if (allInReviewIssues.length === 0) {
        logger.debug(chalk.yellow('No issues in review.'));
        logger.debug("");
        return;
    }
    
    // Show all issues that will be approved
    logger.debug(chalk.bold(`About to approve ${allInReviewIssues.length} issue${allInReviewIssues.length > 1 ? 's' : ''}:`));
    logger.debug("");
    
    // Group by project
    const byProject = new Map<string, ParsedIssue[]>();
    for (const { issue, projectId } of allInReviewIssues) {
        if (!byProject.has(projectId)) {
            byProject.set(projectId, []);
        }
        byProject.get(projectId)!.push(issue);
    }
    
    for (const [projectId, issues] of byProject) {
        logger.debug(chalk.cyan(`Project: ${projectId}`));
        for (const issue of issues) {
            logger.debug(chalk.dim(`  - ${issue.issueId}: ${issue.title}`));
        }
        logger.debug("");
    }
    
    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Approve all these issues?',
        default: false // Default to false for safety
    }]);
    
    if (!confirm) {
        logger.debug("");
        logger.debug(chalk.yellow('Approval cancelled.'));
        logger.debug("");
        return;
    }
    
    // Approve all
    logger.debug("");
    let successCount = 0;
    
    for (const { issue, projectId } of allInReviewIssues) {
        const success = updateIssueStatus(projectId, issue.issueId, 'approved');
        if (success) {
            logger.debug(chalk.green(`✓ ${issue.issueId} approved`));
            successCount++;
        } else {
            logger.debug(chalk.red(`✗ ${issue.issueId} failed to update`));
        }
    }
    
    logger.debug("");
    logger.debug(chalk.bold.green(`✅ ${successCount}/${allInReviewIssues.length} issue${successCount !== 1 ? 's' : ''} approved!`));
    logger.debug("");
};




