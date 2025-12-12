import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import terminalLink from 'terminal-link';
import { countTokens } from '../utils/tokens.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { watchForFileUpdate } from '../utils/watcher.js';
import { printSeparator } from './display.js';
import { logger } from '../utils/logger.js';

/**
 * Interface for printPrompt function with stored content
 */
interface PrintPromptFunction {
    (promptContent: string): Promise<void>;
    _lastPromptContent?: string;
}

/**
 * Create a clickable terminal link for a file path
 * Falls back to plain text if terminal doesn't support links
 */
export const makeClickablePath = (filePath: string): string => {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    const fileUrl = `file://${absolutePath}`;
    return terminalLink(absolutePath, fileUrl, {
        fallback: (text) => text
    });
};

/**
 * Print prompt content and prepare for clipboard copy
 */
export const printPrompt: PrintPromptFunction = async (promptContent: string): Promise<void> => {
    // Count tokens in the prompt including referenced files
    const tokenInfo = countTokens(promptContent);
    
    logger.debug("");
    logger.debug(chalk.yellowBright('📋 Prompt ready'));
    logger.debug(chalk.dim(`   Total input tokens: ${tokenInfo.totalTokens.toLocaleString()}`));
    
    // Store the prompt content for later use
    printPrompt._lastPromptContent = promptContent;
};

/**
 * Wait for user readiness, then copy and monitor with optional file watching
 */
/**
 * Validate agent output with approval/revision/abort options
 */
export const validateAgentOutput = async (
    agentName: string,
    outputDescription: string,
    outputFile: string
): Promise<'approved' | 'revise' | 'abort'> => {
    // Create clickable link
    const clickableLink = makeClickablePath(outputFile);
    
    while (true) {
        logger.debug("");
        printSeparator();
        logger.debug(chalk.yellowBright(`📝 ${agentName.toUpperCase()} OUTPUT REVIEW`));
        logger.debug("");
        logger.debug(chalk.dim(`Review the ${outputDescription}:`));
        logger.debug(`   ${clickableLink}`);
        logger.debug("");
        
        const { decision } = await inquirer.prompt([{
            type: 'list',
            name: 'decision',
            message: chalk.bold.cyan(`Do you approve the ${outputDescription}?`),
            choices: [
                '✅ Approve - Continue to next agent',
                '✏️  Revise - Make changes and re-submit',
                '❌ Abort - Stop the workflow'
            ],
            default: '✅ Approve - Continue to next agent',
            prefix: '  '
        }]);
        
        if (decision.startsWith('✅')) {
            logger.debug("");
            logger.debug(chalk.greenBright('✅ OUTPUT APPROVED') + ' - Moving to next step...');
            logger.debug("");
            return 'approved';
        }
        
        if (decision.startsWith('❌')) {
            return 'abort';
        }
        
        // Revision mode
        logger.debug("");
        logger.debug(chalk.yellowBright('✏️  REVISION MODE'));
        logger.debug("");
        logger.debug(chalk.dim('Please make your changes in Cursor to:'));
        logger.debug(`   ${clickableLink}`);
        logger.debug("");
        logger.debug(chalk.dim('┌─────────────────────────────────────────┐'));
        logger.debug(chalk.dim('│ Edit the file directly                  │'));
        logger.debug(chalk.dim('│ Make any changes you need               │'));
        logger.debug(chalk.dim('│ Save the file when done                 │'));
        logger.debug(chalk.dim('└─────────────────────────────────────────┘'));
        logger.debug("");
        
        const { revised } = await inquirer.prompt([{
            type: 'list',
            name: 'revised',
            message: chalk.bold.cyan('Have you finished your revisions?'),
            choices: [
                '✓ Yes, re-validate now',
                '⏸  Cancel revisions'
            ],
            default: '✓ Yes, re-validate now',
            prefix: '  '
        }]);
        
        if (revised === '⏸  Cancel revisions') {
            // User wants to cancel, go back to validation
            continue;
        }
        
        // Revisions complete - automatically approve and move to next agent
        logger.debug("");
        logger.debug(chalk.greenBright('✅ REVISIONS COMPLETE') + ' - Moving to next agent...');
        logger.debug("");
        return 'approved';
    }
};

export const waitForCompletion = async (
    watchFile: string | null = null,
    agentName: string = 'Agent'
): Promise<string | void> => {
    logger.debug("");
    printSeparator();
    logger.debug(chalk.cyanBright('⏳ READY TO WORK IN CURSOR?'));
    logger.debug("");
    
    const { ready } = await inquirer.prompt([{
        type: 'list',
        name: 'ready',
        message: chalk.bold.cyan('Ready to switch to Cursor? (I\'ll copy prompt and auto-paste)'),
        choices: ['Yes', 'No'],
        default: 'Yes',
        prefix: '  '
    }]);
    
    if (ready === 'No') return;
    
    if (ready === 'Yes' && printPrompt._lastPromptContent) {
        // Now copy to clipboard and start monitoring
        await copyToClipboard(printPrompt._lastPromptContent);
    }
    
    // If a file to watch is provided, wait for it to be updated (auto-detect changes)
    if (watchFile) {
        logger.debug("");
        logger.debug(chalk.yellowBright(`⏳ Waiting for ${agentName} to complete work...`));
        logger.debug(chalk.dim('Monitoring for file changes - next step will begin automatically.'));
        logger.debug("");
        
        const fileUpdated = await watchForFileUpdate(watchFile, 300000); // 5 minute timeout
        
        if (!fileUpdated) {
            logger.debug(chalk.yellow('⚠️  Timeout waiting for file update.'));
            logger.debug(chalk.dim('Please ensure Cursor updated: ' + watchFile));
            
            // Fall back to manual confirmation
            const { completed: timeoutCompleted } = await inquirer.prompt([{
                type: 'list',
                name: 'completed',
                message: chalk.bold.cyan('Have you completed the work? Continue anyway?'),
                choices: ['Yes', 'No'],
                default: 'Yes',
                prefix: '  '
            }]);
            
            if (timeoutCompleted === 'No') return;
        } else {
            logger.debug("");
            logger.debug(chalk.greenBright('✅ File updated! Continuing...'));
            logger.debug("");
        }
    } else {
        // No file watching - use manual confirmation (fallback for commands that don't specify a file)
        logger.debug("");
        logger.debug(chalk.dim("Complete the work in Cursor, then return here."));
        logger.debug("");
        
        const { completed } = await inquirer.prompt([{
            type: 'list',
            name: 'completed',
            message: chalk.bold.cyan('Work completed - Continue to next step?'),
            choices: ['Yes', 'No'],
            default: 'Yes',
            prefix: '  '
        }]);
        
        if (completed === 'No') return;
        
        logger.debug("");
        logger.debug(chalk.greenBright('✅ WORK COMPLETED') + ' - Moving to next step...');
        logger.debug("");
    }
    
    return 'continue';
};

