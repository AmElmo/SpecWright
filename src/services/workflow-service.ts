/**
 * Workflow Service - Workflow orchestration
 * 
 * This module contains functions for orchestrating the full cursor workflow.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR, TEMPLATES_DIR, SESSION_DIR } from '../config/constants.js';
import { printSeparator, printAgent } from '../ui/display.js';
import { showSquadReady } from '../ui/logo.js';
import { printPrompt } from '../ui/prompts.js';
import { generateNextProjectId } from '../utils/id-generator.js';
import { showAgentProgress, handlePMQuestions, handleArchitectQuestions, handleSimpleUXQuestions, handleArchitectureAnalysis, handleDesignBriefGeneration } from './agent-service.js';
import { handleTechnologySelection } from './technology-service.js';
import { createProjectFolder } from './project-service.js';
import { validateAgentOutput, makeClickablePath } from '../ui/prompts.js';
import type { ProjectMetadata } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { generatePMPRDPrompt } from './prompt-generator.js';
import { 
    getQuestionsDir, 
    getDocumentsDir, 
    getPRDPath,
    getAcceptanceCriteriaPath,
    getUXQuestionsPath, 
    toRelativePath 
} from '../utils/project-paths.js';

// Forward declarations for functions that will be imported from workflows
declare function waitForCompletion(): Promise<void>;
declare function displayScreenSummaryAndWireframes(projectDir: string): Promise<void>;

/**
 * Convert absolute path to relative path from workspace root (process.cwd())
 * This ensures @ references work correctly in Cursor regardless of workspace location
 */
// NOTE: This function is now imported from project-paths.ts - keeping this comment for reference

/**
 * Ask user to call in their squad
 * @returns Promise<boolean> - true if user wants to continue, false otherwise
 */
const askToCallInSquad = async (): Promise<boolean> => {
    logger.debug("");
    const { callSquad } = await inquirer.prompt([{
        type: 'list',
        name: 'callSquad',
        message: chalk.bold.cyan('🚀 Call in my squad'),
        choices: ['Yes, let\'s go!', 'Not right now'],
        default: 'Yes, let\'s go!',
        prefix: '  '
    }]);
    
    if (callSquad === 'Not right now') {
        logger.debug("");
        logger.debug(chalk.yellow('⏸️  Squad on standby. Run the command again when ready!'));
        logger.debug("");
        return false;
    }
    
    return true;
};

/**
 * Create a new project interactively
 */
export const createNewProject = async (): Promise<void> => {
    logger.debug(chalk.yellowBright('✨ CREATE NEW PROJECT'));
    logger.debug("");
    
    const { projectName } = await inquirer.prompt([{
        type: 'input',
        name: 'projectName',
        message: chalk.bold.cyan('Enter a short name for this project (2-4 words max): '),
        prefix: '  ',
        validate: (input) => {
            if (!input.trim()) {
                return 'Please enter a project name.';
            }
            if (input.trim().split(' ').length > 4) {
                return 'Please keep it to 4 words maximum.';
            }
            return true;
        }
    }]);
    
    const { projectDescription } = await inquirer.prompt([{
        type: 'input',
        name: 'projectDescription',
        message: chalk.bold.cyan('Describe in detail what you want to build: '),
        prefix: '  ',
        validate: (input) => {
            if (!input.trim()) {
                return 'Please provide a detailed description of the project.';
            }
            return true;
        }
    }]);
    
    await runCursorWorkflow(projectDescription, projectName);
};

/**
 * Load and build an existing project
 */
export const loadAndBuildProject = async (project: ProjectMetadata): Promise<void> => {
    logger.debug(chalk.yellowBright(`🔨 BUILDING PROJECT ${project.id}`));
    logger.debug("");
    
    // Read the project request file (try both new and old names for backward compatibility)
    let projectRequestFile = path.join(project.path, 'project_request.md');
    if (!fs.existsSync(projectRequestFile)) {
        projectRequestFile = path.join(project.path, 'project_request.md'); // fallback to old name for backward compatibility
    }
    
    if (!fs.existsSync(projectRequestFile)) {
        logger.debug(chalk.red('❌ Project request file not found.'));
        return;
    }
    
    const projectRequestContent = fs.readFileSync(projectRequestFile, 'utf-8');
    
    // Extract description from the file
    const lines = projectRequestContent.split('\n');
    let description = '';
    let inDescription = false;
    
    for (const line of lines) {
        if (line.startsWith('## Description')) {
            inDescription = true;
            continue;
        }
        if (inDescription && line.startsWith('##')) {
            break;
        }
        if (inDescription && line.trim()) {
            description = line.trim();
            break;
        }
    }
    
    if (!description) {
        // Fallback to project description
        description = project.description;
    }
    
    const projectName = project.name || project.description.substring(0, 30);
    
    logger.debug(chalk.dim(`Project: ${projectName}`));
    logger.debug(chalk.dim(`Description: ${description}`));
    logger.debug("");
    
    // Since the project folder already exists, we need to pass the existing path
    await runCursorWorkflowExisting(description, projectName, project.path, project.fullId);
};

/**
 * Run cursor workflow for an existing project
 */
export const runCursorWorkflowExisting = async (
    userRequest: any, 
    projectName: string, 
    existingProjectDir: string, 
    projectFolderName: string
): Promise<void> => {
    // These functions are still in specwright.ts - need to import them dynamically
    const { waitForCompletion, displayScreenSummaryAndWireframes } = 
        await import('../specwright.js');
    
    const PROJECT_DIR = existingProjectDir;
    const projectId = projectFolderName.split('-')[0]; // Extract ID from folder name
    
    // Convert to relative paths once for use throughout the function
    const relativeProjectDir = toRelativePath(PROJECT_DIR);
    
    // Check if agent subdirectories exist, create if they don't
    // Note: createProjectFolder() already creates questions/ and documents/ folders
    const QUESTIONS_DIR = getQuestionsDir(projectId);
    const DOCUMENTS_DIR = getDocumentsDir(projectId);
    
    [QUESTIONS_DIR, DOCUMENTS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    
    // **Check project progress to determine where to resume (file-based heuristics)**
    const { isProjectSpecced, isPMPRDComplete, isUXDesignBriefComplete, isArchitectComplete } = await import('./project-service.js');
    
    // Determine which agents need to be run based on file existence/content
    const needsPM = !isPMPRDComplete(PROJECT_DIR);
    const needsUX = !isUXDesignBriefComplete(PROJECT_DIR);
    const needsArchitect = !isArchitectComplete(PROJECT_DIR);
    
    // Check if project is already fully specced
    if (isProjectSpecced(PROJECT_DIR)) {
        logger.debug("");
        logger.debug(chalk.greenBright('✅ PROJECT ALREADY FULLY SPECCED'));
        logger.debug("");
        logger.debug(chalk.dim(`Project ID: ${chalk.bold(projectId)}`));
        logger.debug(chalk.dim(`Project: ${projectName}`));
        logger.debug("");
        logger.debug(chalk.dim('📋 All agents have completed:'));
        logger.debug(chalk.dim('   ✅ Product Manager - Requirements analysis'));
        logger.debug(chalk.dim('   ✅ Designer - Wireframes & screen design'));
        logger.debug(chalk.dim('   ✅ Engineer - Technical specification'));
        logger.debug("");
        logger.debug(chalk.bold('📋 Next Step: Break Down Into Issues'));
        logger.debug(chalk.dim('Run ') + chalk.cyan('specwright break') + chalk.dim(' to break this project down into implementable issues.'));
        logger.debug("");
        return;
    }
    
    // Step 1: Show "Squad Ready" with project info
    showSquadReady(projectName, projectId);
    
    // Show resume status if any agents are already complete
    const hasProgress = !needsPM || !needsUX || !needsArchitect;
    if (hasProgress && (needsPM || needsUX || needsArchitect)) {
        logger.debug("");
        logger.debug(chalk.yellowBright('🔄 RESUMING PROJECT'));
        logger.debug("");
        logger.debug(chalk.dim('Progress so far:'));
        if (!needsPM) {
            logger.debug(chalk.dim('   ✅ Product Manager - Requirements analysis'));
        }
        if (!needsUX) {
            logger.debug(chalk.dim('   ✅ Designer - Wireframes & screen design'));
        }
        if (!needsArchitect) {
            logger.debug(chalk.dim('   ✅ Engineer - Technical specification'));
        }
        logger.debug("");
        
        // Show what's next
        if (needsPM) {
            logger.debug(chalk.dim('Next up: ') + chalk.magenta('🎯 Product Manager'));
        } else if (needsUX) {
            logger.debug(chalk.dim('Next up: ') + chalk.cyan('🎨 Designer'));
        } else if (needsArchitect) {
            logger.debug(chalk.dim('Next up: ') + chalk.blue('🔧 Engineer'));
        }
        logger.debug("");
    }
    
    // Step 2: Ask to call in squad
    const shouldContinue = await askToCallInSquad();
    if (!shouldContinue) {
        return;
    }
    
    // Step 3: Show workflow pipeline
    logger.debug("");
    logger.debug(chalk.yellowBright('🔄 WORKFLOW PIPELINE'));
    logger.debug("");
    logger.debug(chalk.dim('Your AI squad will work through these stages:'));
    logger.debug(chalk.magenta('  1. 🎯 Product Manager') + ' ' + chalk.dim('→ Questions & Requirements Analysis') + (needsPM ? '' : chalk.green(' ✓')));
    logger.debug(chalk.cyan('  2. 🎨 Designer') + ' ' + chalk.dim('→ User Experience & Wireframes') + (needsUX ? '' : chalk.green(' ✓')));
    logger.debug(chalk.blue('  3. 🔧  Engineer') + ' ' + chalk.dim('→ Technical Specification') + (needsArchitect ? '' : chalk.green(' ✓')));
    logger.debug("");
    logger.debug(chalk.dim('After specification is complete, run ') + chalk.cyan('specwright break') + chalk.dim(' to break down into issues.'));
    logger.debug("");
    printSeparator();

    // Continue with the workflow - skip completed agents
    
    // ============================================================
    // STEP 1: PRODUCT MANAGER
    // ============================================================
    if (needsPM) {
        await showAgentProgress(userRequest, 0, false);
        printAgent("PRODUCT MANAGER", "Strategic Questions & Requirements Analysis", "🎯");
        
        const questionsFile = await handlePMQuestions(userRequest, PROJECT_DIR);
        if (!questionsFile) {
            logger.debug(chalk.red('❌ Failed to process questions. Aborting workflow.'));
            return;
        }
        
        // Phase 3: Requirements Analysis
        logger.debug("");
        logger.debug(chalk.yellowBright('📋 PHASE 3: Requirements Analysis'));
        logger.debug("");
        logger.debug(chalk.dim('Now the Product Manager will analyze your answers and create comprehensive requirements...'));
        logger.debug("");
        
        const prdFile = getPRDPath(projectId);
        
        const prdTemplatePath = path.join(TEMPLATES_DIR, 'prd_template.md');
        
        if (fs.existsSync(prdTemplatePath)) {
            const prdTemplateContent = fs.readFileSync(prdTemplatePath, 'utf8');
            fs.writeFileSync(prdFile, prdTemplateContent);
            logger.debug(chalk.green(`✅ Pre-created ${prdFile} with template structure`));
        }
        
        logger.debug("");
        
        const projectSlug = projectName.trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        const relativeQuestionsFile = toRelativePath(questionsFile);
        const pmAnalysisPrompt = `@specwright/agents/product_manager/analysis_prompt.md
@${relativeQuestionsFile}
@${relativeProjectDir}/project_request.md

USER REQUEST:
${userRequest}

PROJECT DETAILS:
- Project ID: ${projectId}
- Project Name: ${projectName}
- Project Slug: ${projectSlug}

FILES TO EDIT:
1. ${prdFile}`;

        await printPrompt(pmAnalysisPrompt);
        await waitForCompletion(prdFile, 'Product Manager');
        
        // Validation checkpoint for PRD
        const prdValidation = await validateAgentOutput(
            'Product Manager',
            'Product Requirements Document (PRD)',
            prdFile
        );
        
        if (prdValidation === 'abort') {
            logger.debug("");
            logger.debug(chalk.yellow('⏸️  WORKFLOW PAUSED'));
            logger.debug("");
            logger.debug(chalk.dim('Your progress has been saved:'));
            logger.debug(chalk.dim(`   Project ID: ${projectId}`));
            logger.debug(chalk.dim('   Location: ') + makeClickablePath(PROJECT_DIR));
            logger.debug("");
            logger.debug(chalk.dim('📋 What\'s been completed:'));
            logger.debug(chalk.dim('   ⏸️  Product Manager - In progress (not approved)'));
            logger.debug(chalk.dim('   ⏸️  Designer - Not started'));
            logger.debug(chalk.dim('   ⏸️  Engineer - Not started'));
            logger.debug("");
            logger.debug(chalk.dim('To resume this project later:'));
            logger.debug(chalk.cyan(`   Run: specwright spec ${projectId}`));
            logger.debug("");
            return;
        }
    } else {
        logger.debug("");
        logger.debug(chalk.dim('⏭️  Skipping Product Manager (already complete)'));
        logger.debug("");
    }
    
    await showAgentProgress(userRequest, 1, false);

    // ============================================================
    // STEP 2: UX DESIGNER
    // ============================================================
    if (needsUX) {
        printAgent("UX DESIGNER", "Design Brief with Screens & Wireframes", "🎨");
        
        const uxQuestionsFile = getUXQuestionsPath(projectId);
        
        // Handle UX questions if they don't exist yet
        if (!fs.existsSync(uxQuestionsFile)) {
            const newUxQuestionsFile = await handleSimpleUXQuestions(userRequest, PROJECT_DIR);
            if (!newUxQuestionsFile) {
                logger.debug(chalk.red('❌ Failed to process user interaction questions. Aborting workflow.'));
                return;
            }
        }
        
        // ============================================================
        // Generate Design Brief (screens + wireframes)
        // ============================================================
        const { designBriefFile } = await handleDesignBriefGeneration(PROJECT_DIR, uxQuestionsFile);
        
        await displayScreenSummaryAndWireframes(PROJECT_DIR);
        
        // Validation checkpoint for design brief
        const designBriefValidation = await validateAgentOutput(
            'Designer',
            'Design Brief',
            designBriefFile
        );
        
        if (designBriefValidation === 'abort') {
            logger.debug("");
            logger.debug(chalk.yellow('⏸️  WORKFLOW PAUSED'));
            logger.debug("");
            logger.debug(chalk.dim('Your progress has been saved:'));
            logger.debug(chalk.dim(`   Project ID: ${projectId}`));
            logger.debug(chalk.dim('   Location: ') + makeClickablePath(PROJECT_DIR));
            logger.debug("");
            logger.debug(chalk.dim('📋 What\'s been completed:'));
            logger.debug(chalk.dim('   ✅ Product Manager - Requirements analysis'));
            logger.debug(chalk.dim('   ⏸️  Designer - Design brief (not approved)'));
            logger.debug(chalk.dim('   ⏸️  Engineer - Not started'));
            logger.debug("");
            logger.debug(chalk.dim('To resume this project later:'));
            logger.debug(chalk.cyan(`   Run: specwright spec ${projectId}`));
            logger.debug("");
            return;
        }
    } else {
        logger.debug("");
        logger.debug(chalk.dim('⏭️  Skipping Designer (already complete)'));
        logger.debug("");
    }
    
    await showAgentProgress(userRequest, 2, false);

    // ============================================================
    // STEP 3: SOFTWARE ARCHITECT
    // ============================================================
    if (needsArchitect) {
        printAgent("SOFTWARE ARCHITECT", "Technical Specification & System Design", "🔧");
        
        const architectQuestionsFile = await handleArchitectQuestions(userRequest, PROJECT_DIR);
        if (!architectQuestionsFile) {
            logger.debug(chalk.red('❌ Failed to process architect questions. Aborting workflow.'));
            return;
        }
        
        await handleArchitectureAnalysis(userRequest, PROJECT_DIR, architectQuestionsFile);
        await handleTechnologySelection(PROJECT_DIR);
        
        // Validation checkpoint for technical specification
        const architectValidation = await validateAgentOutput(
            'Engineer',
            'Technical Specification',
            path.join(PROJECT_DIR, 'documents', 'technical_specification.md')
        );
        
        if (architectValidation === 'abort') {
            logger.debug("");
            logger.debug(chalk.yellow('⏸️  WORKFLOW PAUSED'));
            logger.debug("");
            logger.debug(chalk.dim('Your progress has been saved:'));
            logger.debug(chalk.dim(`   Project ID: ${projectId}`));
            logger.debug(chalk.dim('   Location: ') + makeClickablePath(PROJECT_DIR));
            logger.debug("");
            logger.debug(chalk.dim('📋 What\'s been completed:'));
            logger.debug(chalk.dim('   ✅ Product Manager - Requirements analysis'));
            logger.debug(chalk.dim('   ✅ Designer - Wireframes & screen design'));
            logger.debug(chalk.dim('   ⏸️  Engineer - In progress (not approved)'));
            logger.debug("");
            logger.debug(chalk.dim('To resume this project later:'));
            logger.debug(chalk.cyan(`   Run: specwright spec ${projectId}`));
            logger.debug("");
            return;
        }
    } else {
        logger.debug("");
        logger.debug(chalk.dim('⏭️  Skipping Engineer (already complete)'));
        logger.debug("");
    }
    
    await showAgentProgress(userRequest, 3, false);

    logger.debug("");
    printSeparator();
    logger.debug(chalk.greenBright('🎉 SPECIFICATION COMPLETE!'));
    logger.debug("");
    logger.debug(chalk.dim(`Project ID: ${chalk.bold(projectId)}`));
    logger.debug(chalk.dim('All outputs saved to: ') + makeClickablePath(PROJECT_DIR));
    logger.debug("");
    logger.debug(chalk.bold('📋 Next Step: Break Down Into Issues'));
    logger.debug(chalk.dim('Run ') + chalk.cyan('specwright break') + chalk.dim(' to break this project down into implementable issues.'));
    logger.debug("");
    logger.debug(chalk.yellowBright('Or start building right away! 🚀'));
    printSeparator();
};

/**
 * Run the main cursor workflow for a new project
 */
export const runCursorWorkflow = async (userRequest: any, projectName: string): Promise<void> => {
    // These functions are still in specwright.ts - need to import them dynamically
    const { waitForCompletion, displayScreenSummaryAndWireframes } = 
        await import('../specwright.js');
    
    // Create project-based directory structure with sequential ID and name
    const projectId = generateNextProjectId();
    
    // Create a slug version of the project name for folder naming
    const projectSlug = projectName.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '-')        // Replace spaces with hyphens
        .replace(/^-+|-+$/g, '');    // Remove leading/trailing hyphens
    
    // Use centralized project folder creation
    const PROJECT_DIR = createProjectFolder(
        projectId,
        projectName,
        userRequest
    );
    
    // Convert to relative path once for use throughout the function
    const relativeProjectDir = toRelativePath(PROJECT_DIR);
    
    // Note: For backward compatibility with existing code that expects project_request.md
    // We also create that file (in addition to project_request.md)
    const projectRequestContent = `# Project Request #${projectId}\n\n${userRequest}\n\n---\n*Submitted: ${new Date().toISOString()}*\n*Project ID: ${projectId}*`;
    fs.writeFileSync(path.join(PROJECT_DIR, 'project_request.md'), projectRequestContent);
    
    // Step 1: Show "Squad Ready" with project info
    showSquadReady(projectName, projectId);
    
    // Step 2: Ask to call in squad
    const shouldContinue = await askToCallInSquad();
    if (!shouldContinue) {
        return;
    }
    
    // Step 3: Show workflow pipeline
    logger.debug("");
    logger.debug(chalk.yellowBright('🔄 WORKFLOW PIPELINE'));
    logger.debug("");
    logger.debug(chalk.dim('Your AI squad will work through these stages:'));
    logger.debug(chalk.magenta('  1. 🎯 Product Manager') + ' ' + chalk.dim('→ Questions & Requirements Analysis'));
    logger.debug(chalk.cyan('  2. 🎨 Designer') + ' ' + chalk.dim('→ User Experience & Wireframes'));
    logger.debug(chalk.blue('  3. 🔧  Engineer') + ' ' + chalk.dim('→ Technical Specification'));
    logger.debug("");
    logger.debug(chalk.dim('After specification is complete, run ') + chalk.cyan('specwright break') + chalk.dim(' to break down into issues.'));
    logger.debug("");
    printSeparator();

    // Step 1: Product Manager (Two-Phase)
    await showAgentProgress(userRequest, 0, false); // Show PM as "In Progress"
    printAgent("PRODUCT MANAGER", "Strategic Questions & Requirements Analysis", "🎯");
    
    // Phase 1 & 2: Handle questions
    const questionsFile = await handlePMQuestions(userRequest, PROJECT_DIR);
    if (!questionsFile) {
        logger.debug(chalk.red('❌ Failed to process questions. Aborting workflow.'));
        return;
    }
    
    // Phase 3: Requirements Analysis
    logger.debug("");
    logger.debug(chalk.yellowBright('📋 PHASE 3: Requirements Analysis'));
    logger.debug("");
    logger.debug(chalk.dim('Now the Product Manager will analyze your answers and create comprehensive requirements...'));
    logger.debug("");
    
    // Pre-create PRD file with template structure
    const prdFile = getPRDPath(projectId);
    const acceptanceCriteriaFile = getAcceptanceCriteriaPath(projectId);
    
    const prdTemplatePath = path.join(TEMPLATES_DIR, 'prd_template.md');
    const acTemplatePath = path.join(TEMPLATES_DIR, 'acceptance_criteria_template.json');
    
    if (fs.existsSync(prdTemplatePath)) {
        const prdTemplateContent = fs.readFileSync(prdTemplatePath, 'utf8');
        fs.writeFileSync(prdFile, prdTemplateContent);
        logger.debug(chalk.green(`✅ Pre-created ${prdFile} with template structure`));
    }
    
    if (fs.existsSync(acTemplatePath)) {
        const acTemplateContent = fs.readFileSync(acTemplatePath, 'utf8');
        fs.writeFileSync(acceptanceCriteriaFile, acTemplateContent);
        logger.debug(chalk.green(`✅ Pre-created ${acceptanceCriteriaFile} with template structure`));
    }
    
    logger.debug("");
    
    const pmAnalysisPrompt = generatePMPRDPrompt(
        PROJECT_DIR,
        questionsFile,
        prdFile,
        acceptanceCriteriaFile,
        userRequest,
        projectId,
        projectName,
        projectSlug
    );

    await printPrompt(pmAnalysisPrompt);
    await waitForCompletion(prdFile, 'Product Manager');
    
    // Validation checkpoint for PRD
    const prdValidation = await validateAgentOutput(
        'Product Manager',
        'Product Requirements Document (PRD)',
        prdFile
    );
    
    if (prdValidation === 'abort') {
        logger.debug("");
        logger.debug(chalk.yellow('⏸️  WORKFLOW PAUSED'));
        logger.debug("");
        logger.debug(chalk.dim('Your progress has been saved:'));
        logger.debug(chalk.dim(`   Project ID: ${projectId}`));
        logger.debug(chalk.dim('   Location: ') + makeClickablePath(PROJECT_DIR));
        logger.debug("");
        logger.debug(chalk.dim('📋 What\'s been completed:'));
        logger.debug(chalk.dim('   ⏸️  Product Manager - In progress (not approved)'));
        logger.debug(chalk.dim('   ⏸️  Designer - Not started'));
        logger.debug(chalk.dim('   ⏸️  Engineer - Not started'));
        logger.debug("");
        logger.debug(chalk.dim('To resume this project later:'));
        logger.debug(chalk.cyan(`   Run: specwright spec ${projectId}`));
        logger.debug("");
        return;
    }
    
    // Show progress after PM completion
    await showAgentProgress(userRequest, 1, false); // Show PM as "Completed", UX as "In Progress"

    // Step 2: Designer
    printAgent("UX DESIGNER", "Design Brief with Screens & Wireframes", "🎨");
    
    // Step 1: User Interaction Questions
    const uxQuestionsFile = await handleSimpleUXQuestions(userRequest, PROJECT_DIR);
    if (!uxQuestionsFile) {
        logger.debug(chalk.red('❌ Failed to process user interaction questions. Aborting workflow.'));
        return;
    }
    
    // ============================================================
    // Generate Design Brief (screens + wireframes)
    // ============================================================
    const { designBriefFile } = await handleDesignBriefGeneration(PROJECT_DIR, uxQuestionsFile);
    
    // Display screen summary and wireframe location
    await displayScreenSummaryAndWireframes(PROJECT_DIR);
    
    // Validation checkpoint for design brief
    const designBriefValidation = await validateAgentOutput(
        'Designer',
        'Design Brief',
        designBriefFile
    );
    
    if (designBriefValidation === 'abort') {
        logger.debug("");
        logger.debug(chalk.yellow('⏸️  WORKFLOW PAUSED'));
        logger.debug("");
        logger.debug(chalk.dim('Your progress has been saved:'));
        logger.debug(chalk.dim(`   Project ID: ${projectId}`));
        logger.debug(chalk.dim('   Location: ') + makeClickablePath(PROJECT_DIR));
        logger.debug("");
        logger.debug(chalk.dim('📋 What\'s been completed:'));
        logger.debug(chalk.dim('   ✅ Product Manager - Requirements analysis'));
        logger.debug(chalk.dim('   ⏸️  Designer - Design brief (not approved)'));
        logger.debug(chalk.dim('   ⏸️  Engineer - Not started'));
        logger.debug("");
        logger.debug(chalk.dim('To resume this project later:'));
        logger.debug(chalk.cyan(`   Run: specwright spec ${projectId}`));
        logger.debug("");
        return;
    }
    
    // Show progress after UX completion
    await showAgentProgress(userRequest, 2, false); // Show UX as "Completed", Architect as "In Progress"

    // Step 3: Engineer (3-Phase Process)
    printAgent("SOFTWARE ARCHITECT", "Technical Specification & System Design", "🔧");
    
    // Phase 1: Technical Questions
    const architectQuestionsFile = await handleArchitectQuestions(userRequest, PROJECT_DIR);
    if (!architectQuestionsFile) {
        logger.debug(chalk.red('❌ Failed to process architect questions. Aborting workflow.'));
        return;
    }
    
    // Phase 2: Technical Specification
    await handleArchitectureAnalysis(userRequest, PROJECT_DIR, architectQuestionsFile);
    
    // Phase 3: Technology Selection (if choices were presented)
    await handleTechnologySelection(PROJECT_DIR);
    
    // Validation checkpoint for technical specification
    const architectValidation = await validateAgentOutput(
        'Engineer',
        'Technical Specification',
        path.join(PROJECT_DIR, 'documents', 'technical_specification.md')
    );
    
    if (architectValidation === 'abort') {
        logger.debug("");
        logger.debug(chalk.yellow('⏸️  WORKFLOW PAUSED'));
        logger.debug("");
        logger.debug(chalk.dim('Your progress has been saved:'));
        logger.debug(chalk.dim(`   Project ID: ${projectId}`));
        logger.debug(chalk.dim('   Location: ') + makeClickablePath(PROJECT_DIR));
        logger.debug("");
        logger.debug(chalk.dim('📋 What\'s been completed:'));
        logger.debug(chalk.dim('   ✅ Product Manager - Requirements analysis'));
        logger.debug(chalk.dim('   ✅ Designer - Wireframes & screen design'));
        logger.debug(chalk.dim('   ⏸️  Engineer - In progress (not approved)'));
        logger.debug("");
        logger.debug(chalk.dim('To resume this project later:'));
        logger.debug(chalk.cyan(`   Run: specwright spec ${projectId}`));
        logger.debug("");
        return;
    }
    
    // Show progress after Architect completion
    await showAgentProgress(userRequest, 3, false); // Show Architect as "Completed"

    // Create session backup and symlink to latest
    try {
        // Copy all project files to session directory for backup (recursive for subdirectories)
        const copyRecursiveSync = (src: string, dest: string) => {
            const stats = fs.statSync(src);
            if (stats.isDirectory()) {
                fs.mkdirSync(dest, { recursive: true });
                const files = fs.readdirSync(src);
                files.forEach(file => {
                    copyRecursiveSync(path.join(src, file), path.join(dest, file));
                });
            } else {
                fs.copyFileSync(src, dest);
            }
        };
        
        const projectFiles = fs.readdirSync(PROJECT_DIR);
        projectFiles.forEach(file => {
            const srcPath = path.join(PROJECT_DIR, file);
            const destPath = path.join(SESSION_DIR, file);
            copyRecursiveSync(srcPath, destPath);
        });
    } catch (error) {
        logger.debug(chalk.yellow('⚠️  Could not create session backup'));
    }

    logger.debug("");
    printSeparator();
    logger.debug(chalk.greenBright('🎉 SPECIFICATION COMPLETE!'));
    logger.debug("");
    logger.debug(chalk.dim(`Project ID: ${chalk.bold(projectId)}`));
    logger.debug(chalk.dim('All outputs saved to: ') + makeClickablePath(PROJECT_DIR));
    logger.debug(chalk.dim(`Session backup: ${chalk.bold(SESSION_DIR)}`));
    logger.debug("");
    logger.debug(chalk.bold('📋 Next Step: Break Down Into Issues'));
    logger.debug(chalk.dim('Run ') + chalk.cyan('specwright break') + chalk.dim(' to break this project down into implementable issues.'));
    logger.debug("");
    logger.debug(chalk.yellowBright('Or start building right away! 🚀'));
    printSeparator();
};
