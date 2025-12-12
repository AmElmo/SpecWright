/**
 * Finalize Scope Command - Finalize scoping plan
 * 
 * This command is primarily used in Cursor-based workflows where:
 * 1. User runs /specwright.scope in Cursor
 * 2. AI generates outputs/scoping_plan.json
 * 3. User reviews/edits the JSON
 * 4. User runs `specwright finalize-scope` to create folders/files
 * 
 * This keeps the AI from directly touching the file system (safer!).
 * In terminal-based interactive workflows, this is called automatically.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { printSeparator } from '../ui/display.js';
import { finalizeScopingPlan } from '../services/scoping-service.js';
import { OUTPUT_DIR } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import type { ProjectSettings } from '../types/index.js';

/**
 * Ask project configuration questions
 */
const askProjectConfiguration = async (): Promise<ProjectSettings> => {
    logger.debug("");
    logger.debug(chalk.yellowBright('⚙️  PROJECT CONFIGURATION'));
    logger.debug("");
    logger.debug(chalk.dim('These settings will apply to all agents (PM, Designer, Engineer)'));
    logger.debug("");
    
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'question_depth',
            message: 'How many questions should each agent ask you?',
            choices: [
                {
                    name: '⚡️ Light (3-5 questions) - Quick and focused',
                    value: 'light'
                },
                {
                    name: '⚖️  Standard (5-8 questions) - Good balance (recommended)',
                    value: 'standard'
                },
                {
                    name: '🔬 Thorough (8-12 questions) - Comprehensive analysis',
                    value: 'thorough'
                }
            ],
            default: 'standard'
        },
        {
            type: 'list',
            name: 'document_length',
            message: 'How detailed should specification documents be?',
            choices: [
                {
                    name: '⚡️ Brief (600-900 words, ~5 min read) - Essential points only',
                    value: 'brief'
                },
                {
                    name: '⚖️  Standard (1500-2100 words, ~10 min read) - Balanced detail (recommended)',
                    value: 'standard'
                },
                {
                    name: '🔬 Comprehensive (3600-4500 words, ~15 min read) - Thorough with edge cases',
                    value: 'comprehensive'
                }
            ],
            default: 'standard'
        }
    ]);
    
    return {
        question_depth: answers.question_depth,
        document_length: answers.document_length
    };
};

/**
 * Handle the finalize-scope command - creates projects/issues from scoping_plan.json
 */
export const handleFinalizeScopeCommand = async (): Promise<void> => {
    logger.debug("");
    printSeparator();
    logger.debug(chalk.yellowBright('🎯 FINALIZING SCOPE'));
    logger.debug("");
    
    const scopingPlanFile = path.join(OUTPUT_DIR, 'scoping_plan.json');
    
    // Check if scoping plan exists
    if (!fs.existsSync(scopingPlanFile)) {
        logger.debug(chalk.red('❌ No scoping plan found.'));
        logger.debug(chalk.dim(`Expected file: ${scopingPlanFile}`));
        logger.debug("");
        logger.debug(chalk.yellow('Run "specwright new" first to create a scoping plan.'));
        logger.debug("");
        printSeparator();
        return;
    }
    
    // Read and parse the scoping plan
    let scopingPlan;
    try {
        const planContent = fs.readFileSync(scopingPlanFile, 'utf-8');
        scopingPlan = JSON.parse(planContent);
    } catch (error) {
        logger.debug(chalk.red('❌ Could not read scoping plan.'));
        logger.debug(chalk.dim(`File: ${scopingPlanFile}`));
        logger.debug(chalk.red(`Error: ${error}`));
        logger.debug("");
        printSeparator();
        return;
    }
    
    logger.debug(chalk.green('✅ Scoping plan loaded'));
    logger.debug("");
    
    // Ask configuration questions if this is a project (not direct work)
    if (scopingPlan.type === 'project') {
        const settings = await askProjectConfiguration();
        
        // Store settings in the scoping plan
        scopingPlan.settings = settings;
        
        // Also add settings to each project
        if (scopingPlan.projects) {
            for (const project of scopingPlan.projects) {
                project.settings = settings;
            }
        }
        
        logger.debug("");
        logger.debug(chalk.green('✅ Configuration saved'));
        logger.debug(chalk.dim(`   Questions: ${settings.question_depth}`));
        logger.debug(chalk.dim(`   Documents: ${settings.document_length}`));
        logger.debug("");
    }
    
    // Finalize the scope
    await finalizeScopingPlan(scopingPlan);
};

