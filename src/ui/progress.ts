import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { printSeparator } from './display.js';
import { logger } from '../utils/logger.js';

/**
 * Show agent progress overview with dynamic status
 */
export const showAgentProgress = async (userRequest: string, currentStep: number = 0, showPrompt: boolean = true): Promise<boolean> => {
    logger.debug("");
    logger.debug(chalk.yellowBright('📊 SQUAD PROGRESS OVERVIEW'));
    printSeparator();
    logger.debug("");
    logger.debug(chalk.bold.cyanBright('PROJECT REQUEST:') + ' ' + chalk.underline(userRequest));
    logger.debug("");
    logger.debug(chalk.dim('Current status of your AI development squad:'));
    logger.debug("");
    
    // Define agents with their info
    const agents = [
        { num: '1', agent: chalk.magenta('🎯 Product Manager'), resp: 'Requirements & Behavior' },
        { num: '2', agent: chalk.cyan('🎨 Designer'), resp: 'User Experience & Wireframes' },
        { num: '3', agent: chalk.blue('🔧 Engineer'), resp: 'Technical Specification' }
    ];
    
    // Create table using cli-table3 which handles ANSI codes properly
    const table = new Table({
        head: [
            chalk.dim('#'),
            chalk.dim('Agent'), 
            chalk.dim('Responsibility'),
            chalk.dim('Status')
        ],
        style: {
            head: [],
            border: ['dim'],
            compact: false
        },
        chars: {
            'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
            'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
            'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
            'right': '│', 'right-mid': '┤', 'middle': '│'
        }
    });
    
    // Add table rows with dynamic status
    agents.forEach((agentInfo, index) => {
        let status;
        if (currentStep === -1) {
            // All pending initially
            status = chalk.red('⏳ Pending');
        } else if (index < currentStep) {
            status = chalk.green('✅ Completed');
        } else if (index === currentStep) {
            status = chalk.yellow('🔄 In Progress');
        } else {
            status = chalk.red('⏳ Pending');
        }
        
        table.push([
            chalk.bold(agentInfo.num),
            agentInfo.agent,
            chalk.dim(agentInfo.resp),
            status
        ]);
    });
    
    // Add indentation to each line of the table
    const tableString = table.toString();
    const indentedTable = tableString.split('\n').map(line => '  ' + line).join('\n');
    logger.debug(indentedTable);
    logger.debug("");
    printSeparator();
    
    if (showPrompt && currentStep === -1) {
        logger.debug("");
        logger.debug(chalk.yellowBright('🚀 READY TO START?'));
        logger.debug("");
        
        const { startWorkflow } = await inquirer.prompt([{
            type: 'list',
            name: 'startWorkflow',
            message: chalk.bold.cyan('Begin with the Product Manager analysis?'),
            choices: ['Yes', 'No'],
            default: 'Yes',
            prefix: '  '
        }]);
        
        if (startWorkflow === 'No') {
            logger.debug("");
            logger.debug(chalk.yellow('⏸️  Workflow paused. Run the command again when ready to continue.'));
            logger.debug("");
            return false;
        }
        
        return true;
    }
    
    return true;
};

