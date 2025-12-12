/**
 * Help and usage display
 */

import chalk from 'chalk';
import { showLogo } from './logo.js';
import { printSeparator } from './display.js';
import { logger } from '../utils/logger.js';

/**
 * Show usage information and help
 */
export const showUsage = (): void => {
    showLogo();
    logger.print("");
    logger.print(chalk.bold('USAGE:'));
    logger.print('  ' + chalk.cyan('specwright') + ' ' + chalk.dim('[command] [options]'));
    logger.print("");
    logger.print(chalk.bold('COMMANDS:'));
    logger.print('  ' + chalk.cyan('init') + ' ' + chalk.dim('                  Initialize SpecWright in your project'));
    logger.print('  ' + chalk.cyan('new') + ' ' + chalk.dim('                   Create new feature (classify + design + tasks)'));
    logger.print('  ' + chalk.cyan('ship') + ' ' + chalk.dim('                  Work on and ship tasks'));
    logger.print('  ' + chalk.cyan('view') + ' ' + chalk.dim('                  Browse all projects and issues'));
    logger.print('  ' + chalk.cyan('playbook') + ' ' + chalk.dim('             Manage project standards (generate/update/audit)'));
    logger.print("");
    logger.print(chalk.bold('EXAMPLES:'));
    logger.print('  ' + chalk.cyan('specwright init') + ' ' + chalk.dim('               # Initialize SpecWright in your project'));
    logger.print('  ' + chalk.cyan('specwright new') + ' ' + chalk.dim('                # Create new feature (interactive)'));
    logger.print('  ' + chalk.cyan('specwright ship') + ' ' + chalk.dim('               # Work on next task'));
    logger.print('  ' + chalk.cyan('specwright view') + ' ' + chalk.dim('               # Browse all projects'));
    logger.print('  ' + chalk.cyan('specwright playbook') + ' ' + chalk.dim('        # Generate project playbook'));
    logger.print('  ' + chalk.cyan('specwright playbook --update') + ' ' + chalk.dim('# Update playbook'));
    logger.print('  ' + chalk.cyan('specwright playbook --audit') + ' ' + chalk.dim(' # Audit compliance'));
    logger.print('  ' + chalk.cyan('specwright') + ' ' + chalk.dim('                   # Interactive menu'));
    logger.print("");
    logger.print(chalk.bold('WORKFLOW:'));
    logger.print(chalk.dim('1. Install globally: ') + chalk.cyan('npm install -g specwright'));
    logger.print(chalk.dim('2. Initialize in your project: ') + chalk.cyan('specwright init'));
    logger.print(chalk.dim('3. Create new feature: ') + chalk.cyan('specwright new'));
    logger.print(chalk.dim('   → Classifies work (simple change vs full project)'));
    logger.print(chalk.dim('   → Runs AI squad: PM → Designer → Engineer'));
    logger.print(chalk.dim('   → Breaks down into implementation tasks'));
    logger.print(chalk.dim('4. Work on tasks: ') + chalk.cyan('specwright ship'));
    logger.print(chalk.dim('   → Review completed work'));
    logger.print(chalk.dim('   → Pick next task'));
    logger.print(chalk.dim('   → Implement and ship'));
    logger.print("");
    logger.print(chalk.dim('Simple workflow: ') + chalk.cyan('new') + chalk.dim(' → ') + chalk.cyan('ship') + chalk.dim(' → repeat'));
    printSeparator();
};

