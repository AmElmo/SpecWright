/**
 * CLI argument parsing utilities
 */

import chalk from 'chalk';
import { logger } from './logger.js';

/**
 * Command parameters interface
 */
export interface CommandParams {
    description?: string;
    projectId?: string;
}

/**
 * Parse command-line arguments into command and parameters
 */
export const parseCommand = (args: string[]): { command: string; params: CommandParams } => {
    const command = args[0];
    const params: CommandParams = {};
    
    switch (command) {
        case 'build':
            params.description = args.slice(1).join(' ');
            if (!params.description) {
                logger.debug(chalk.red('❌ Error: build command requires a description'));
                logger.debug(chalk.dim('Usage: node specwright.js build "your project description"'));
                process.exit(1);
            }
            break;
        case 'spec':
            params.projectId = args[1] || null;
            break;
        default:
            return { command: 'unknown', params: {} };
    }
    
    return { command, params };
};

