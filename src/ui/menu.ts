/**
 * Interactive command menu
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';

/**
 * Show interactive command menu (when no CLI args provided)
 */
export const showCommandMenu = async (): Promise<string> => {
    logger.debug("");
    logger.debug("");
    logger.debug(chalk.yellowBright('🚀 WHAT DO YOU WANT TO DO?'));
    logger.debug("");
    logger.debug("");
    
    const { command } = await inquirer.prompt([{
        type: 'list',
        name: 'command',
        message: 'Select a command:',
        choices: [
            new inquirer.Separator(' '),
            new inquirer.Separator(' '),
            { name: `✨  ${chalk.bold.cyan('new')} ${chalk.dim("- Create new feature (design + tasks)")}`, value: 'new' },
            new inquirer.Separator(' '),
            new inquirer.Separator(),
            new inquirer.Separator(' '),
            { name: `🚀  ${chalk.bold.cyan('ship')} ${chalk.dim('- Work on and ship tasks')}`, value: 'ship' },
            new inquirer.Separator(' '),
            new inquirer.Separator(),
            new inquirer.Separator(' '),
            { name: `👁️   ${chalk.bold.cyan('view')} ${chalk.dim('- Browse all projects and issues')}`, value: 'view' },
            new inquirer.Separator(' '),
            new inquirer.Separator(),
            new inquirer.Separator(' '),
            { name: `📜  ${chalk.bold.cyan('playbook')} ${chalk.dim('- Manage project standards')}`, value: 'playbook' },
            new inquirer.Separator(' ')
        ],
        pageSize: 20,
        loop: false
    }]);
    
    logger.debug("");
    logger.debug("");
    logger.debug("");
    return command;
};

/**
 * Prompt for project description
 */
export const promptForDescription = async (): Promise<string> => {
    const { projectDescription } = await inquirer.prompt([{
        type: 'input',
        name: 'projectDescription',
        message: chalk.bold.cyan('Describe what you want to build: '),
        prefix: '  ',
        validate: (input) => {
            if (!input.trim()) {
                return 'Please provide a description.';
            }
            return true;
        }
    }]);
    
    return projectDescription;
};
