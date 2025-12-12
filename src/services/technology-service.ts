/**
 * Technology Selection Service
 * Handles technology decision workflows
 */

import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { printSeparator } from '../ui/display.js';
import { printPrompt, waitForCompletion, makeClickablePath } from '../ui/prompts.js';
import { getTechnologyChoicesPath, getTechnicalSpecPath } from '../utils/project-paths.js';
import type { TechnologyChoice } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Handle technology selection workflow (Phase 3 of spec process)
 */
export const handleTechnologySelection = async (projectDir: string): Promise<void> => {
    const projectId = path.basename(projectDir);
    const technologyChoicesFile = getTechnologyChoicesPath(projectId);
    const technicalSpecFile = getTechnicalSpecPath(projectId);
    
    // Read the technology choices file to see if there are decisions to make
    let technologyData;
    try {
        const technologyJson = fs.readFileSync(technologyChoicesFile, 'utf-8');
        technologyData = JSON.parse(technologyJson);
    } catch (error) {
        logger.debug(chalk.yellow('⚠️  Could not read technology choices file. Skipping technology selection.'));
        return;
    }
    
    // Check if there are any technology decisions to make
    if (!technologyData.technology_decisions || technologyData.technology_decisions.length === 0) {
        logger.debug("");
        logger.debug(chalk.greenBright('✅ No new technology decisions needed for this project.'));
        logger.debug(chalk.dim('All required technologies are already established in the project.'));
        logger.debug("");
        return;
    }
    
    // Filter decisions that actually need user input
    const decisionsNeeded = technologyData.technology_decisions.filter(decision => 
        decision.decision_needed && decision.options && decision.options.length > 1
    );
    
    if (decisionsNeeded.length === 0) {
        logger.debug("");
        logger.debug(chalk.greenBright('✅ All technology decisions have clear recommendations.'));
        logger.debug(chalk.dim('No user input needed for technology choices.'));
        logger.debug("");
        return;
    }
    
    // Present technology choices to user
    logger.debug("");
    logger.debug(chalk.yellowBright('🔧 PHASE 4: Technology Selection'));
    logger.debug("");
    logger.debug(chalk.dim(`Found ${decisionsNeeded.length} technology decision(s) that need your input...`));
    
    // Display summary of decisions needed
    logger.debug("");
    logger.debug(chalk.bold.cyanBright('📊 TECHNOLOGY DECISIONS SUMMARY:'));
    decisionsNeeded.forEach((decision, index) => {
        logger.debug(chalk.whiteBright(`  ${index + 1}. ${decision.category} (${decision.options.length} options)`));
    });
    logger.debug("");
    
    for (let i = 0; i < decisionsNeeded.length; i++) {
        const decision = decisionsNeeded[i];
        
        logger.debug("");
        printSeparator();
        logger.debug(chalk.bold.cyanBright(`DECISION ${i + 1}/${decisionsNeeded.length}: ${decision.category}`));
        logger.debug("");
        
        // Show options
        decision.options.forEach((option, index) => {
            const recommended = option.recommended ? chalk.green(' (RECOMMENDED)') : '';
            logger.debug(chalk.bold.whiteBright(`${index + 1}. ${option.name}${recommended}`));
            logger.debug(chalk.dim(`   ${option.description}`));
            logger.debug(chalk.green(`   Pros: ${option.pros.join(', ')}`));
            logger.debug(chalk.red(`   Cons: ${option.cons.join(', ')}`));
            if (option.trade_offs && option.trade_offs.length > 0) {
                logger.debug(chalk.yellow(`   Trade-offs: ${option.trade_offs.join(', ')}`));
            }
            if (option.recommended && option.recommendation_reason) {
                logger.debug(chalk.dim(`   Why recommended: ${option.recommendation_reason}`));
            }
            logger.debug("");
        });
        
        // Get user choice
        const choices = decision.options.map((option, index) => ({
            name: `${option.name}${option.recommended ? ' (RECOMMENDED)' : ''}`,
            value: index
        }));
        
        // Add "Enter your own" option
        choices.push({
            name: '✏️  Enter your own (custom choice)',
            value: -1
        });
        
        const { selectedOption } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedOption',
            message: `Which ${decision.category.toLowerCase()} would you like to use?`,
            choices: choices,
            prefix: '  '
        }]);
        
        let finalChoice: string;
        let finalDescription: string = '';
        let finalVersion: string = '';
        
        // Handle custom input
        if (selectedOption === -1) {
            const { customChoice } = await inquirer.prompt([{
                type: 'input',
                name: 'customChoice',
                message: 'Enter the name of your custom choice:',
                prefix: '  ',
                validate: (input: string) => input.trim().length > 0 || 'Please enter a valid choice'
            }]);
            
            const { customVersion } = await inquirer.prompt([{
                type: 'input',
                name: 'customVersion',
                message: 'Version (optional):',
                prefix: '  '
            }]);
            
            const { customDescription } = await inquirer.prompt([{
                type: 'input',
                name: 'customDescription',
                message: 'Brief description of what this is for (optional):',
                prefix: '  '
            }]);
            
            finalChoice = customChoice.trim();
            finalVersion = customVersion.trim();
            finalDescription = customDescription.trim();
        } else {
            finalChoice = decision.options[selectedOption].name;
            finalDescription = decision.options[selectedOption].description || '';
            finalVersion = decision.options[selectedOption].version || '';
        }
        
        const { reason } = await inquirer.prompt([{
            type: 'input',
            name: 'reason',
            message: 'Why did you choose this option? (optional)',
            prefix: '  '
        }]);
        
        // Update the decision with user choice
        decision.user_choice = finalChoice;
        decision.user_choice_description = finalDescription;
        decision.user_choice_version = finalVersion;
        decision.user_reason = reason.trim() || 'User preference';
        decision.final_decision = finalChoice;
        
        logger.debug("");
        logger.debug(chalk.greenBright(`✅ Selected: ${decision.user_choice}`));
    }
    
    // Save updated technology choices
    fs.writeFileSync(technologyChoicesFile, JSON.stringify(technologyData, null, 2));
    
    logger.debug("");
    logger.debug(chalk.greenBright('✅ Technology selections completed!'));
    logger.debug(chalk.dim('Choices saved to: ') + makeClickablePath(technologyChoicesFile));
    
    // Update Technical Specification with technology selections (heuristic, no AI needed)
    logger.debug("");
    logger.debug(chalk.yellowBright('📝 Updating technical specification with technology selections...'));
    
    if (fs.existsSync(technicalSpecFile)) {
        let techSpecContent = fs.readFileSync(technicalSpecFile, 'utf-8');
        
        // Build the Technology Choices section content
        let technologySection = '\n';
        
        // For each decision category
        technologyData.technology_decisions.forEach((decision) => {
            const selectedChoice = decision.user_choice || decision.final_decision;
            
            technologySection += `### ${decision.category}\n\n`;
            
            // Find the selected option details
            const selectedOption = decision.options.find(opt => opt.name === selectedChoice);
            
            if (selectedOption) {
                // Selected technology with full details
                technologySection += `**✅ Selected: ${selectedOption.name}**\n`;
                if (selectedOption.version) {
                    technologySection += `- **Version**: ${selectedOption.version}\n`;
                }
                if (selectedOption.documentation_url) {
                    technologySection += `- **Documentation**: ${selectedOption.documentation_url}\n`;
                }
                if (decision.user_choice_description || selectedOption.description) {
                    technologySection += `- **Purpose**: ${decision.user_choice_description || selectedOption.description}\n`;
                }
                if (selectedOption.pros && selectedOption.pros.length > 0) {
                    technologySection += `- **Pros**: ${selectedOption.pros.join(', ')}\n`;
                }
                if (selectedOption.trade_offs && selectedOption.trade_offs.length > 0) {
                    technologySection += `- **Trade-offs**: ${selectedOption.trade_offs.join(', ')}\n`;
                }
                if (decision.user_reason) {
                    technologySection += `- **Selection Reason**: ${decision.user_reason}\n`;
                }
            } else {
                // Custom choice entered by user
                technologySection += `**✅ Selected: ${selectedChoice}**\n`;
                if (decision.user_choice_version) {
                    technologySection += `- **Version**: ${decision.user_choice_version}\n`;
                }
                if (decision.user_choice_description) {
                    technologySection += `- **Purpose**: ${decision.user_choice_description}\n`;
                }
                if (decision.user_reason) {
                    technologySection += `- **Selection Reason**: ${decision.user_reason}\n`;
                }
            }
            
            // List alternatives considered (just names)
            const alternativesNotSelected = decision.options.filter(opt => opt.name !== selectedChoice);
            if (alternativesNotSelected.length > 0) {
                technologySection += `\n**Alternatives Considered**: ${alternativesNotSelected.map(opt => opt.name).join(', ')}\n`;
            }
            
            technologySection += '\n';
        });
        
        // Replace the placeholder in the technical specification
        if (techSpecContent.includes('[TECHNOLOGY_CHOICES_PLACEHOLDER')) {
            techSpecContent = techSpecContent.replace(
                /\[TECHNOLOGY_CHOICES_PLACEHOLDER[^\]]*\]/,
                technologySection.trim()
            );
            fs.writeFileSync(technicalSpecFile, techSpecContent);
            logger.debug(chalk.green('✅ Technical specification updated with technology selections'));
        } else {
            logger.debug(chalk.yellow('⚠️  Could not find placeholder in technical specification, skipping update'));
        }
    } else {
        logger.debug(chalk.yellow('⚠️  Technical specification file not found, skipping update'));
    }
    
    logger.debug("");
    logger.debug(chalk.greenBright('✅ Technology selection process completed!'));
    logger.debug("");
};

