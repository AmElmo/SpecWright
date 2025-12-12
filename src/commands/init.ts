/**
 * Initialize SpecWright in a project
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showLogo } from '../ui/logo.js';
import { printSeparator } from '../ui/display.js';
import { copyRecursiveSync } from '../utils/file.js';
import { handlePlaybookCommand } from './playbook.js';
import { logger } from '../utils/logger.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Handle init command - Initialize SpecWright in a project
 */
export const handleInitCommand = async (): Promise<void> => {
    showLogo();
    logger.debug("");
    logger.debug(chalk.bold.cyan('Initialize SpecWright in your project'));
    logger.debug("");
    printSeparator();
    logger.debug("");
    
    // Step 1: Confirmation prompt
    const { confirmed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: 'Are you currently in the root of your project?',
            default: true
        }
    ]);
    
    if (!confirmed) {
        logger.debug("");
        logger.debug(chalk.yellow('⚠️  Please run this command from the root of your project'));
        logger.debug("");
        process.exit(0);
    }
    
    // Get current working directory (where user ran the command)
    const targetDir = process.cwd();
    const specwrightDir = path.join(targetDir, 'specwright');
    
    // Check if already initialized
    const isInitialized = fs.existsSync(specwrightDir) ||
                          fs.existsSync(path.join(targetDir, '.cursor', 'commands'));
    
    if (isInitialized) {
        logger.debug("");
        logger.debug(chalk.yellow('⚠️  SpecWright appears to be already initialized in this directory.'));
        logger.debug(chalk.dim('   This will overwrite existing files (outputs will be preserved).'));
        logger.debug("");
        
        const { overwrite } = await inquirer.prompt([{
            type: 'confirm',
            name: 'overwrite',
            message: 'Continue and overwrite existing files?',
            default: false
        }]);
        
        if (!overwrite) {
            logger.debug("");
            logger.debug(chalk.dim('Initialization cancelled.'));
            logger.debug("");
            process.exit(0);
        }
        
        logger.debug("");
        logger.debug(chalk.cyan('🔄 Re-initializing SpecWright...'));
        logger.debug("");
    } else {
        logger.debug("");
        logger.debug(chalk.cyan('🚀 Initializing SpecWright...'));
        logger.debug("");
    }
    
    // Create specwright/ directory
    if (!fs.existsSync(specwrightDir)) {
        fs.mkdirSync(specwrightDir, { recursive: true });
    }
    
    // Source directories from the installed package
    const packageDir = path.resolve(__dirname, '../..');
    
    try {
        // Step 2: Copy .cursor/commands/ directory (stays at root)
        const cursorCommandsSrc = path.join(packageDir, '.cursor', 'commands');
        const cursorCommandsDest = path.join(targetDir, '.cursor', 'commands');
        if (fs.existsSync(cursorCommandsSrc)) {
            copyRecursiveSync(cursorCommandsSrc, cursorCommandsDest);
            logger.debug(chalk.green('  ✓ Created .cursor/commands/ (Cursor commands)'));
        }
        
        // Step 3: Copy templates/ directory (into specwright/)
        const templatesSrc = path.join(packageDir, 'templates');
        const templatesDest = path.join(specwrightDir, 'templates');
        if (fs.existsSync(templatesSrc)) {
            copyRecursiveSync(templatesSrc, templatesDest);
            const templateCount = fs.readdirSync(templatesSrc).length;
            logger.debug(chalk.green(`  ✓ Created specwright/templates/ (${templateCount} specification templates)`));
        }
        
        // Step 4: Copy agents/ directory (into specwright/)
        const agentsSrc = path.join(packageDir, 'agents');
        const agentsDest = path.join(specwrightDir, 'agents');
        if (fs.existsSync(agentsSrc)) {
            copyRecursiveSync(agentsSrc, agentsDest);
            logger.debug(chalk.green('  ✓ Created specwright/agents/ (AI agent prompts)'));
        }
        
        // Step 5: Create outputs/ directories with .gitkeep files (into specwright/)
        const outputsDir = path.join(specwrightDir, 'outputs');
        const projectsDir = path.join(outputsDir, 'projects');
        const issuesDir = path.join(outputsDir, 'issues');
        
        if (!fs.existsSync(outputsDir)) {
            fs.mkdirSync(outputsDir, { recursive: true });
        }
        if (!fs.existsSync(projectsDir)) {
            fs.mkdirSync(projectsDir, { recursive: true });
            fs.writeFileSync(path.join(projectsDir, '.gitkeep'), '');
        }
        if (!fs.existsSync(issuesDir)) {
            fs.mkdirSync(issuesDir, { recursive: true });
            fs.writeFileSync(path.join(issuesDir, '.gitkeep'), '');
        }
        logger.debug(chalk.green('  ✓ Created specwright/outputs/ (Generated specs will go here)'));
        
        // Step 6: Show success message
        logger.debug("");
        printSeparator();
        logger.debug(chalk.green.bold('✅ SpecWright initialized successfully!'));
        logger.debug("");
        
        logger.debug(chalk.bold('📁 Created:'));
        logger.debug(chalk.dim('   ├── .cursor/'));
        logger.debug(chalk.dim('   │   └── commands/         (Cursor commands)'));
        logger.debug(chalk.dim('   └── specwright/           (All SpecWright files)'));
        logger.debug(chalk.dim('       ├── agents/           (AI agent prompts)'));
        logger.debug(chalk.dim('       ├── templates/        (Specification templates)'));
        logger.debug(chalk.dim('       └── outputs/          (Generated specs)'));
        logger.debug("");
        
        logger.debug(chalk.bold('🚀 Available Commands:'));
        logger.debug(chalk.cyan('   • specwright scope       ') + chalk.dim(' - Analyze and scope work'));
        logger.debug(chalk.cyan('   • specwright spec        ') + chalk.dim(' - Create full specifications'));
        logger.debug(chalk.cyan('   • specwright view        ') + chalk.dim(' - Browse all projects and issues'));
        logger.debug(chalk.cyan('   • specwright break       ') + chalk.dim(' - Break down project into issues'));
        logger.debug(chalk.cyan('   • specwright build       ') + chalk.dim(' - Begin working on projects and issues'));
        logger.debug("");
        printSeparator();
        logger.debug("");
        
        // Step 7: Optionally generate playbook
        const { generatePlaybook } = await inquirer.prompt([{
            type: 'confirm',
            name: 'generatePlaybook',
            message: 'Generate project playbook now? (Recommended)',
            default: true
        }]);

        if (generatePlaybook) {
            logger.debug("");
            await handlePlaybookCommand();
        } else {
            logger.debug("");
            logger.debug(chalk.dim('💡 You can generate the playbook later with: ') + chalk.cyan('specwright playbook'));
            logger.debug("");
        }
        
    } catch (error) {
        logger.debug("");
        logger.debug(chalk.red('❌ Error during initialization:'));
        logger.debug(chalk.red(error.message));
        logger.debug("");
        process.exit(1);
    }
};
