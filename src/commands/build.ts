/**
 * Build command - Issue-based workflow for working on projects
 */

import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OUTPUT_DIR } from '../config/constants.js';
import { printSeparator } from '../ui/display.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { logger } from '../utils/logger.js';
import { 
    getProjectIssues, 
    getIssuesByStatus, 
    getReadyIssues,
    getNextIssue,
    updateIssueStatus,
    addReviewFeedback,
    getIssueStatusCounts,
    type ParsedIssue 
} from '../services/issue-service.js';
import { generateIssuePrompt, generateProjectSummary } from '../services/prompt-generator.js';

const execAsync = promisify(exec);

interface ProjectInfo {
    id: string;
    title: string;
    description: string;
    path: string;
    issueCounts: {
        pending: number;
        inReview: number;
        approved: number;
        total: number;
    };
}

/**
 * Handle the build command
 * Complete workflow: project selection → review issues → work on next issue
 */
export const handleBuildCommand = async (): Promise<void> => {
    printSeparator();
    logger.debug(chalk.bold.cyanBright('🚀 START WORKING'));
    logger.debug("");
    
    // Phase 1: Project Selection
    const project = await selectProject();
    if (!project) {
        return;
    }
    
    logger.debug("");
    logger.debug(chalk.bold.green(`Working on: ${project.title}`));
    logger.debug(chalk.dim(`Project: ${project.id}`));
    logger.debug("");
    
    // Phase 2: Check for In-Review Issues
    const inReviewIssues = getIssuesByStatus(project.id, 'in-review');
    
    if (inReviewIssues.length > 0) {
        const shouldReview = await promptForReviewAction(inReviewIssues);
        
        if (shouldReview === 'review') {
            await reviewIssuesFlow(project.id, inReviewIssues);
            // After review, ask if they want to continue to next issue
            const { continueToNext } = await inquirer.prompt([{
                type: 'confirm',
                name: 'continueToNext',
                message: 'Start working on the next issue?',
                default: true
            }]);
            
            if (!continueToNext) {
                logger.debug("");
                printSeparator();
                return;
            }
            logger.debug("");
        } else if (shouldReview === 'view-all') {
            await viewAllIssues(project.id);
            logger.debug("");
            printSeparator();
            return;
        } else if (shouldReview === 'cancel') {
            logger.debug("");
            printSeparator();
            return;
        }
        // If 'skip', continue to next issue selection
    }
    
    // Phase 4: Next Issue Selection
    await selectAndStartIssue(project.id);
    
    printSeparator();
};

/**
 * Phase 1: Select a project to work on
 */
const selectProject = async (): Promise<ProjectInfo | null> => {
    const PROJECTS_DIR = path.join(OUTPUT_DIR, 'projects');
    
    if (!fs.existsSync(PROJECTS_DIR)) {
        logger.debug(chalk.yellow('No projects found.'));
        logger.debug(chalk.dim('Run ') + chalk.cyan('specwright scope') + chalk.dim(' to create a project first.'));
        logger.debug("");
        printSeparator();
        return null;
    }
    
    const projectDirs = fs.readdirSync(PROJECTS_DIR)
        .filter(name => /^\d{3}(-.*)?$/.test(name))
        .sort();
    
    if (projectDirs.length === 0) {
        logger.debug(chalk.yellow('No projects found.'));
        logger.debug(chalk.dim('Run ') + chalk.cyan('specwright scope') + chalk.dim(' to create a project first.'));
        logger.debug("");
        printSeparator();
        return null;
    }
    
    const projects: ProjectInfo[] = [];
    
    for (const dir of projectDirs) {
        const projectRequestFile = path.join(PROJECTS_DIR, dir, 'project_request.md');
        if (fs.existsSync(projectRequestFile)) {
            try {
                const content = fs.readFileSync(projectRequestFile, 'utf8');
                const lines = content.split('\n');
                const title = lines[0].replace(/^#\s*/, '');
                const description = lines.slice(2, 5).join(' ').trim().substring(0, 100);
                
                const issueCounts = getIssueStatusCounts(dir);
                
                projects.push({
                    id: dir,
                    title,
                    description,
                    path: path.join(PROJECTS_DIR, dir),
                    issueCounts
                });
            } catch (error) {
                // Skip projects that can't be read
            }
        }
    }
    
    if (projects.length === 0) {
        logger.debug(chalk.yellow('No valid projects found.'));
        logger.debug("");
        printSeparator();
        return null;
    }
    
    // If only one project, auto-select it
    if (projects.length === 1) {
        return projects[0];
    }
    
    // Multiple projects - show selection menu
    logger.debug(chalk.bold('Available Projects:'));
    logger.debug("");
    
    const choices = projects.map(project => {
        const { pending, inReview, approved, total } = project.issueCounts;
        const statusText = total > 0 
            ? `(${pending} pending, ${inReview} in-review, ${approved} approved)`
            : '(no issues yet)';
        
        return {
            name: `${project.title} ${chalk.dim(statusText)}`,
            value: project.id,
            short: project.title
        };
    });
    
    const { selectedId } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedId',
        message: 'Which project do you want to work on?',
        choices: choices,
        pageSize: 10
    }]);
    
    return projects.find(p => p.id === selectedId) || null;
};

/**
 * Phase 2: Prompt user what to do with in-review issues
 */
const promptForReviewAction = async (inReviewIssues: ParsedIssue[]): Promise<'review' | 'skip' | 'view-all' | 'cancel'> => {
    logger.debug(chalk.yellowBright(`⚠️  You have ${inReviewIssues.length} issue${inReviewIssues.length > 1 ? 's' : ''} awaiting review`));
    logger.debug("");
    
    for (const issue of inReviewIssues) {
        logger.debug(`  ${chalk.cyan('📋')} ${chalk.bold(issue.issueId)} - ${issue.title}`);
    }
    
    logger.debug("");
    
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
            { name: '✅ Review and approve issues', value: 'review' },
            { name: '🚀 Skip to next pending issue', value: 'skip' },
            { name: '📊 View all project issues', value: 'view-all' },
            { name: '❌ Cancel', value: 'cancel' }
        ]
    }]);
    
    return action;
};

/**
 * Phase 3: Review flow for in-review issues
 */
const reviewIssuesFlow = async (projectId: string, issues: ParsedIssue[]): Promise<void> => {
    for (const issue of issues) {
        logger.debug("");
        logger.debug(chalk.bold.cyanBright(`📋 Reviewing: ${issue.issueId} - ${issue.title}`));
        logger.debug("");
        logger.debug(chalk.dim(`Status: ${issue.status}`));
        logger.debug(chalk.dim(`Complexity: ${issue.complexityScore}/10 | Est: ${issue.estimatedHours}h`));
        
        if (issue.dependencies.length > 0) {
            logger.debug(chalk.dim(`Dependencies: ${issue.dependencies.join(', ')}`));
        }
        
        logger.debug("");
        
        // Show implementation notes if available
        if (issue.implementationNotes) {
            logger.debug(chalk.bold('Implementation Notes:'));
            logger.debug(chalk.dim(issue.implementationNotes.substring(0, 300)));
            if (issue.implementationNotes.length > 300) {
                logger.debug(chalk.dim('...'));
            }
            logger.debug("");
        }
        
        // Show acceptance criteria as checklist
        if (issue.acceptanceCriteria.length > 0) {
            logger.debug(chalk.bold('Acceptance Criteria (verify these):'));
            for (const criterion of issue.acceptanceCriteria) {
                logger.debug(chalk.dim(`  [ ] ${criterion}`));
            }
            logger.debug("");
        }
        
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: '✅ Approve (mark as approved)', value: 'approve' },
                { name: '🔙 Request changes (back to pending)', value: 'request-changes' },
                { name: '📄 Open issue file in editor', value: 'open-file' },
                { name: '⏭️  Skip (review later)', value: 'skip' },
                { name: '❌ Cancel review', value: 'cancel' }
            ]
        }]);
        
        if (action === 'approve') {
            const success = updateIssueStatus(projectId, issue.issueId, 'approved');
            if (success) {
                logger.debug("");
                logger.debug(chalk.green(`✅ ${issue.issueId} approved and marked complete!`));
            } else {
                logger.debug("");
                logger.debug(chalk.red(`❌ Failed to update ${issue.issueId}`));
            }
        } else if (action === 'request-changes') {
            logger.debug("");
            const { feedback } = await inquirer.prompt([{
                type: 'editor',
                name: 'feedback',
                message: 'What needs to be changed? (This will open your default editor)'
            }]);
            
            if (feedback && feedback.trim()) {
                const success = addReviewFeedback(issue.filePath, feedback.trim());
                if (success) {
                    logger.debug("");
                    logger.debug(chalk.green(`📝 Feedback saved and ${issue.issueId} returned to pending`));
                } else {
                    logger.debug("");
                    logger.debug(chalk.red(`❌ Failed to add feedback to ${issue.issueId}`));
                }
            }
        } else if (action === 'open-file') {
            try {
                if (process.platform === 'darwin') {
                    await execAsync(`open "${issue.filePath}"`);
                } else if (process.platform === 'linux') {
                    await execAsync(`xdg-open "${issue.filePath}"`);
                } else if (process.platform === 'win32') {
                    await execAsync(`start "" "${issue.filePath}"`);
                }
                logger.debug("");
                logger.debug(chalk.green(`📂 Opened ${issue.issueId}.md`));
                logger.debug("");
                
                // Ask again what to do with this issue
                const { nextAction } = await inquirer.prompt([{
                    type: 'list',
                    name: 'nextAction',
                    message: 'After reviewing the file:',
                    choices: [
                        { name: '✅ Approve', value: 'approve' },
                        { name: '🔙 Request changes', value: 'request-changes' },
                        { name: '⏭️  Skip', value: 'skip' }
                    ]
                }]);
                
                if (nextAction === 'approve') {
                    updateIssueStatus(projectId, issue.issueId, 'approved');
                    logger.debug("");
                    logger.debug(chalk.green(`✅ ${issue.issueId} approved!`));
                } else if (nextAction === 'request-changes') {
                    const { feedback } = await inquirer.prompt([{
                        type: 'editor',
                        name: 'feedback',
                        message: 'What needs to be changed?'
                    }]);
                    
                    if (feedback && feedback.trim()) {
                        addReviewFeedback(issue.filePath, feedback.trim());
                        logger.debug("");
                        logger.debug(chalk.green(`📝 Feedback saved and ${issue.issueId} returned to pending`));
                    }
                }
            } catch (error) {
                logger.debug("");
                logger.debug(chalk.yellow(`⚠️  Could not open file automatically`));
                logger.debug(chalk.dim(`File: ${issue.filePath}`));
            }
        } else if (action === 'cancel') {
            break;
        }
        // Skip continues to next issue
    }
};

/**
 * View all issues for a project
 */
const viewAllIssues = async (projectId: string): Promise<void> => {
    const allIssues = getProjectIssues(projectId);
    
    if (allIssues.length === 0) {
        logger.debug("");
        logger.debug(chalk.yellow('No issues found for this project.'));
        logger.debug(chalk.dim('Run ') + chalk.cyan('specwright break') + chalk.dim(' to create issues.'));
        return;
    }
    
    logger.debug("");
    logger.debug(chalk.bold('All Issues:'));
    logger.debug("");
    
    const approved = allIssues.filter(i => i.status === 'approved');
    const inReview = allIssues.filter(i => i.status === 'in-review');
    const pending = allIssues.filter(i => i.status === 'pending');
    
    const progress = Math.round((approved.length / allIssues.length) * 100);
    logger.debug(chalk.dim(`Progress: ${approved.length}/${allIssues.length} (${progress}%)`));
    logger.debug("");
    
    if (approved.length > 0) {
        logger.debug(chalk.green.bold('✓ Approved:'));
        for (const issue of approved) {
            logger.debug(chalk.green(`  ✓ ${issue.issueId} - ${issue.title}`));
        }
        logger.debug("");
    }
    
    if (inReview.length > 0) {
        logger.debug(chalk.cyan.bold('📋 In Review:'));
        for (const issue of inReview) {
            logger.debug(chalk.cyan(`  📋 ${issue.issueId} - ${issue.title}`));
        }
        logger.debug("");
    }
    
    if (pending.length > 0) {
        logger.debug(chalk.yellow.bold('⏸️  Pending:'));
        for (const issue of pending) {
            const readyIssues = getReadyIssues(projectId);
            const isReady = readyIssues.some(r => r.issueId === issue.issueId);
            const statusIndicator = isReady ? '→ Ready' : '⏸ Blocked';
            logger.debug(chalk.yellow(`  ${statusIndicator} ${issue.issueId} - ${issue.title}`));
            if (!isReady && issue.dependencies.length > 0) {
                logger.debug(chalk.dim(`       Dependencies: ${issue.dependencies.join(', ')}`));
            }
        }
    }
};

/**
 * Phase 4: Select and start working on next issue
 */
const selectAndStartIssue = async (projectId: string): Promise<void> => {
    const nextIssue = getNextIssue(projectId);
    
    if (!nextIssue) {
        logger.debug(chalk.yellow('No pending issues ready to work on.'));
        logger.debug("");
        
        // Check if all issues are done
        const counts = getIssueStatusCounts(projectId);
        if (counts.total === 0) {
            logger.debug(chalk.dim('Run ') + chalk.cyan('specwright break') + chalk.dim(' to create issues.'));
        } else if (counts.approved === counts.total) {
            logger.debug(chalk.green('🎉 All issues are complete! Great work!'));
        } else {
            logger.debug(chalk.dim('All remaining issues have unmet dependencies or are in review.'));
        }
        return;
    }
    
    // Display next issue details
    logger.debug(chalk.bold.green(`📋 Next Issue: ${nextIssue.issueId} - ${nextIssue.title}`));
    logger.debug("");
    logger.debug(chalk.dim(`Status: ${nextIssue.status}`));
    logger.debug(chalk.dim(`Complexity: ${nextIssue.complexityScore}/10`));
    logger.debug(chalk.dim(`Estimated: ${nextIssue.estimatedHours}h`));
    
    if (nextIssue.dependencies.length > 0) {
        logger.debug(chalk.dim(`Dependencies: ${nextIssue.dependencies.join(', ')} ✓`));
    } else {
        logger.debug(chalk.dim(`Dependencies: None`));
    }
    
    logger.debug("");
    logger.debug(chalk.bold('Description:'));
    logger.debug(chalk.dim(nextIssue.description.substring(0, 200)));
    if (nextIssue.description.length > 200) {
        logger.debug(chalk.dim('...'));
    }
    logger.debug("");
    
    if (nextIssue.acceptanceCriteria.length > 0) {
        logger.debug(chalk.bold('Acceptance Criteria:'));
        for (const criterion of nextIssue.acceptanceCriteria.slice(0, 3)) {
            logger.debug(chalk.dim(`  ✓ ${criterion}`));
        }
        if (nextIssue.acceptanceCriteria.length > 3) {
            logger.debug(chalk.dim(`  ... and ${nextIssue.acceptanceCriteria.length - 3} more`));
        }
        logger.debug("");
    }
    
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
            { name: '📝 Start working (copy prompt to clipboard)', value: 'start' },
            { name: '📄 View full issue details', value: 'view-details' },
            { name: '🔍 Show all issues', value: 'show-all' },
            { name: '❌ Cancel', value: 'cancel' }
        ]
    }]);
    
    if (action === 'start') {
        // Phase 5: Generate and copy prompt
        await generateAndCopyPrompt(nextIssue, projectId);
    } else if (action === 'view-details') {
        logger.debug("");
        logger.debug(generateProjectSummary(projectId, [nextIssue]));
        logger.debug("");
        
        const { startNow } = await inquirer.prompt([{
            type: 'confirm',
            name: 'startNow',
            message: 'Start working on this issue?',
            default: true
        }]);
        
        if (startNow) {
            await generateAndCopyPrompt(nextIssue, projectId);
        }
    } else if (action === 'show-all') {
        await viewAllIssues(projectId);
    }
};

/**
 * Phase 5: Generate prompt and copy to clipboard
 */
const generateAndCopyPrompt = async (issue: ParsedIssue, projectId: string): Promise<void> => {
    logger.debug("");
    logger.debug(chalk.cyan('📝 Generating contextual prompt...'));
    
    const prompt = generateIssuePrompt(issue, projectId);
    
    await copyToClipboard(prompt);
    
    logger.debug("");
    logger.debug(chalk.green('✅ Prompt copied to clipboard!'));
    logger.debug("");
    logger.debug(chalk.bold('Next steps:'));
    logger.debug(chalk.dim('  1. Paste into Cursor (auto-pasting if on macOS)'));
    logger.debug(chalk.dim('  2. AI will implement the feature'));
    logger.debug(chalk.dim('  3. AI will update status to "in-review"'));
    logger.debug(chalk.dim(`  4. Run ${chalk.cyan('specwright build')} to review and approve`));
    logger.debug("");
};
