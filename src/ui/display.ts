import chalk from 'chalk';
import { logger } from '../utils/logger.js';

/**
 * Print separator line
 */
export const printSeparator = (): void => {
    logger.print(chalk.dim("────────────────────────────────────────────────────────────────────────"));
};

/**
 * Print agent information with emoji and role
 */
export const printAgent = (agentName: string, agentRole: string, agentEmoji: string): void => {
    printSeparator();
    logger.print("");
    logger.print(chalk.bold.magentaBright(`${agentEmoji} ${agentName} - ${agentRole}`));
    logger.print("");
    printSeparator();
};

/**
 * Get colored category badge with emoji
 */
export const getCategoryBadge = (category: string): string => {
    switch (category) {
        case 'bug':
            return chalk.red('🐛 bug');
        case 'improvement':
            return chalk.blue('📋 improvement');
        case 'chore':
            return chalk.gray('🔧 chore');
        case 'project':
            return chalk.green('✨ project');
        default:
            return chalk.white(category);
    }
};

/**
 * Get status badge with color and emoji
 */
export const getStatusBadge = (status: any): string => {
    switch (status) {
        // Granular spec statuses
        case 'ready_to_spec':
            return chalk.gray('📋 ready to spec');
        case 'pm_complete':
            return chalk.yellow('📝 PM complete');
        case 'ux_in_progress':
            return chalk.yellow('🎨 UX in progress');
        case 'architect_in_progress':
            return chalk.yellow('🔧 Architect in progress');
        case 'ready_to_break':
            return chalk.cyan('✅ ready to break down');
        case 'ready_to_ship':
            return chalk.blue('🚀 ready to ship');
        case 'implementing':
            return chalk.magenta('🔧 implementing');
        case 'completed':
            return chalk.green('✅ completed');
        
        // Issue statuses (for the 6-option system)
        case 'pending':
            return chalk.gray('⏳ pending');
        case 'in-progress':
            return chalk.yellow('⚙️  in progress');
        case 'review':
            return chalk.blue('👀 review');
        case 'done':
            return chalk.green('✅ done');
        case 'deferred':
            return chalk.dim('⏸️  deferred');
        case 'cancelled':
            return chalk.red('❌ cancelled');
        
        // Legacy/backwards compatibility statuses
        case 'specced_out':
            return chalk.cyan('📝 specced out');
        case 'in_progress':
            return chalk.yellow('⚙️  in progress');
        case 'in_review':
            return chalk.blue('👀 in review');
        case 'todo':
            return chalk.gray('⏳ todo');
        case 'planned':
            return chalk.gray('📋 planned');
        case 'completed':
            return chalk.green('✅ completed');
        case 'blocked':
            return chalk.red('🚫 blocked');
        case 'ready':
            return chalk.gray('⏳ ready');
        default:
            return chalk.white(status);
    }
};

/**
 * Generate a visual progress bar
 * @param current - Current question number (1-based)
 * @param total - Total number of questions
 * @param width - Width of the progress bar (default: 30)
 * @returns Formatted progress bar string
 */
export const generateProgressBar = (current: number, total: number, width: number = 30): string => {
    const percentage = current / total;
    const filled = Math.round(percentage * width);
    const empty = width - filled;
    
    const filledBar = '━'.repeat(filled);
    const emptyBar = '─'.repeat(empty);
    
    return chalk.cyan('  [') + chalk.cyanBright(filledBar) + chalk.dim(emptyBar) + chalk.cyan(']') + 
           chalk.dim(` ${Math.round(percentage * 100)}%`);
};

/**
 * Display question header with progress bar
 * @param currentQuestion - Current question number (1-based)
 * @param totalQuestions - Total number of questions
 * @param agentColor - Chalk color function for agent-specific styling
 */
export const displayQuestionHeader = (
    currentQuestion: number, 
    totalQuestions: number,
    agentColor: any = chalk.cyanBright
): void => {
    logger.print("");
    logger.print(generateProgressBar(currentQuestion, totalQuestions));
    logger.print("");
    logger.print(agentColor(`Question ${currentQuestion}/${totalQuestions}:`));
    logger.print("");
};

