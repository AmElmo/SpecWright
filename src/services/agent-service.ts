/**
 * Agent Service - AI agent interaction logic
 * 
 * This module contains functions for handling agent questions and analysis.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { printSeparator, displayQuestionHeader } from '../ui/display.js';
import { printPrompt, makeClickablePath } from '../ui/prompts.js';
import { watchForFileUpdate } from '../utils/watcher.js';
import { transformQuestionsFormat } from '../utils/file.js';
import { Question } from '../types/index.js';
import { OUTPUT_DIR } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { 
    generatePMQuestionsPrompt, 
    generateUXQuestionsPrompt, 
    generateEngineerQuestionsPrompt,
    generateUXDesignBriefPrompt,
    generateEngineerSpecPrompt
} from './prompt-generator.js';
import {
    getPMQuestionsPath,
    getUXQuestionsPath,
    getEngineerQuestionsPath,
    getTechnologyChoicesPath,
    getTechnicalSpecPath,
    getDesignBriefPath,
    getWireframesPath,
    getScreensPath,
    toRelativePath
} from '../utils/project-paths.js';


/**
 * Prompt user with a question, showing multiple choice options if available
 * @param question - Question object with optional options array
 * @param promptColor - Chalk color function for the prompt
 * @param questionColor - Chalk color function for the question text
 * @returns The user's answer
 */
const promptQuestion = async (
    question: Question, 
    promptColor: any = chalk.bold.green, 
    questionColor: any = chalk.whiteBright
): Promise<string> => {
    // Check if question has options and they're valid (2-3 options)
    const hasOptions = question.options && Array.isArray(question.options) && question.options.length >= 2;
    
    if (hasOptions && question.options) {
        // Display question
        logger.debug(questionColor(question.question));
        logger.debug("");
        
        // Create choices: options + "Other (specify)"
        const choices = [
            ...question.options,
            new inquirer.Separator(),
            '✏️  Other (specify)'
        ];
        
        const { selection } = await inquirer.prompt([{
            type: 'list',
            name: 'selection',
            message: promptColor('Select an option:'),
            choices: choices,
            prefix: '  '
        }]);
        
        // If "Other" was selected, prompt for custom input
        if (selection === '✏️  Other (specify)') {
            logger.debug("");
            const { customAnswer } = await inquirer.prompt([{
                type: 'input',
                name: 'customAnswer',
                message: promptColor('Enter your answer:'),
                prefix: '  ',
                validate: (input) => {
                    if (!input.trim()) {
                        return 'Please provide an answer or type "skip" to skip this question.';
                    }
                    return true;
                }
            }]);
            return customAnswer.trim();
        }
        
        return selection;
    } else {
        // No options - use traditional text input
        logger.debug(questionColor(question.question));
        logger.debug("");
        
        const { answer } = await inquirer.prompt([{
            type: 'input',
            name: 'answer',
            message: promptColor('Your answer:'),
            prefix: '  ',
            validate: (input) => {
                if (!input.trim()) {
                    return 'Please provide an answer or type "skip" to skip this question.';
                }
                return true;
            }
        }]);
        
        return answer.trim();
    }
};

/**
 * Show agent progress overview with dynamic status
 * @param userRequest - The user's project request (optional, only shown if showRequest is true)
 * @param currentStep - Current step in the workflow (0-3, or -1 for all pending)
 * @param showRequest - Whether to show the project request at the top
 * @returns void
 */
export const showAgentProgress = (userRequest: string = '', currentStep: number = 0, showRequest: boolean = false): void => {
    logger.debug("");
    logger.debug(chalk.yellowBright('📊 SQUAD OVERVIEW'));
    printSeparator();
    
    if (showRequest && userRequest) {
        logger.debug("");
        logger.debug(chalk.bold.cyanBright('PROJECT REQUEST:') + ' ' + chalk.underline(userRequest));
    }
    
    logger.debug("");
    logger.debug(chalk.dim('Your AI development squad:'));
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
};

/**
 * Handle PM questioning phase
 * @param userRequest - The user's project request
 * @param projectDir - Directory path for the project
 * @returns Promise<string | null> - Path to questions file if successful, null otherwise
 */
export const handlePMQuestions = async (userRequest: string, projectDir: string): Promise<string | null> => {
    const projectId = path.basename(projectDir);
    const questionsFile = getPMQuestionsPath(projectId);
    
    // Import phase check functions
    const { isPMQuestionsGenerated, isPMQuestionsAnswered } = await import('./project-service.js');
    
    // Check if questions are already answered - if so, skip entirely
    if (isPMQuestionsAnswered(projectDir)) {
        logger.debug("");
        logger.debug(chalk.dim('⏭️  Skipping PM questions (already answered)'));
        logger.debug("");
        return questionsFile;
    }
    
    // Check if questions are already generated - if so, skip to Phase 2
    const questionsAlreadyGenerated = isPMQuestionsGenerated(projectDir);
    
    if (!questionsAlreadyGenerated) {
        // Phase 1: Create initial JSON file and generate questions
        logger.debug("");
        logger.debug(chalk.yellowBright('📋 PHASE 1: Generating Strategic Questions'));
        logger.debug("");
        logger.debug(chalk.dim('Creating questions file and prompting the Product Manager...'));
        logger.debug("");
        
        // Create initial JSON file with empty structure
        const initialJson = {
            project_request: userRequest,
            questions: [
                {
                    question: "Waiting for the Product Manager to generate questions....",
                    answer: ""
                }
            ]
        };
        
        fs.writeFileSync(questionsFile, JSON.stringify(initialJson, null, 2));
        
        logger.debug(chalk.greenBright('✅ PM questions file created: ') + chalk.dim(questionsFile));
        logger.debug("");
        
        const questioningPrompt = generatePMQuestionsPrompt(projectDir, questionsFile, userRequest);

        await printPrompt(questioningPrompt);
        
        // Ask user if ready, copy to clipboard, and auto-paste into Cursor
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
        
        if (ready === 'No') {
            logger.debug("");
            logger.debug(chalk.yellow('⏸️  Workflow paused.'));
            logger.debug("");
            return null;
        }
        
        if (ready === 'Yes' && printPrompt._lastPromptContent) {
            // Copy to clipboard and start monitoring for Cursor
            const { copyToClipboard } = await import('../utils/clipboard.js');
            await copyToClipboard(printPrompt._lastPromptContent);
        }
        
        // Wait for file to be updated
        logger.debug("");
        logger.debug(chalk.yellowBright('⏳ Waiting for Cursor to update the file...'));
        logger.debug(chalk.dim('The next step will begin automatically when ready.'));
        logger.debug("");
        
        const fileUpdated = await watchForFileUpdate(questionsFile, 300000, true); // 5 minute timeout, wait for change from initial state
        
        if (!fileUpdated) {
            logger.debug(chalk.yellow('⚠️  Timeout waiting for file update.'));
            logger.debug(chalk.dim('Please ensure Cursor updated: ' + questionsFile));
            return null;
        }
        
        logger.debug("");
        logger.debug(chalk.greenBright('✅ File updated! Continuing...'));
        logger.debug("");
    } else {
        logger.debug("");
        logger.debug(chalk.dim('⏭️  Skipping Phase 1 (questions already generated)'));
        logger.debug("");
    }
    
    // Phase 2: Read the updated questions and present to user
    logger.debug("");
    logger.debug(chalk.yellowBright('📋 PHASE 2: Answering Strategic Questions'));
    logger.debug("");
    logger.debug(chalk.dim('Reading the generated questions and collecting your answers...'));
    logger.debug("");
    
    // Read the updated JSON file
    let questionsData;
    try {
        const updatedJson = fs.readFileSync(questionsFile, 'utf-8');
        questionsData = JSON.parse(updatedJson);
    } catch (error) {
        logger.debug(chalk.red('❌ Could not read the updated questions file. Please make sure the AI updated the JSON file correctly.'));
        return null;
    }
    
    if (!questionsData.questions || questionsData.questions.length === 0) {
        logger.debug(chalk.red('❌ No questions found in the JSON file. Please make sure the AI generated questions.'));
        return null;
    }
    
    // Present questions to user one by one
    logger.debug("");
    printSeparator();
    logger.debug(chalk.cyanBright('🤔 STRATEGIC QUESTIONS'));
    logger.debug("");
    logger.debug(chalk.dim('Please answer each question thoughtfully. Your answers will guide the entire analysis.'));
    logger.debug("");
    
    for (let i = 0; i < questionsData.questions.length; i++) {
        const question = questionsData.questions[i];
        
        displayQuestionHeader(i + 1, questionsData.questions.length, chalk.bold.magentaBright);
        
        const answer = await promptQuestion(question, chalk.bold.green, chalk.whiteBright);
        questionsData.questions[i].answer = answer;
        
        logger.debug("");
        if (i < questionsData.questions.length - 1) {
            printSeparator();
        }
    }
    
    // Transform questions format to use "decision" and "rejected_alternatives"
    // This provides clarity for downstream agents about what was chosen vs rejected
    const transformedData = transformQuestionsFormat(questionsData);
    
    // Save updated questions with transformed format
    fs.writeFileSync(questionsFile, JSON.stringify(transformedData, null, 2));
    
    logger.debug("");
    logger.debug(chalk.greenBright('✅ All questions answered!'));
    logger.debug(chalk.dim('Responses saved to: ') + makeClickablePath(questionsFile));
    logger.debug("");
    
    return questionsFile;
};

/**
 * Handle architect technical questions phase
 * @param userRequest - The user's project request
 * @param projectDir - Directory path for the project
 * @returns Promise<string | null> - Path to questions file if successful, null otherwise
 */
export const handleArchitectQuestions = async (userRequest: string, projectDir: string): Promise<string | null> => {
    const projectId = path.basename(projectDir);
    const questionsFile = getEngineerQuestionsPath(projectId);
    
    // Import phase check function
    const { isArchitectQuestionsAnswered } = await import('./project-service.js');
    
    // Check if questions are already answered - if so, skip entirely
    if (isArchitectQuestionsAnswered(projectDir)) {
        logger.debug("");
        logger.debug(chalk.dim('⏭️  Skipping Architect questions (already answered)'));
        logger.debug("");
        return questionsFile;
    }
    
    // Phase 1: Create initial JSON file and generate technical questions
    logger.debug("");
    logger.debug(chalk.yellowBright('🏗️ PHASE 1: Technical Requirements Questions'));
    logger.debug("");
    logger.debug(chalk.dim('Generating questions about performance, security, and production requirements...'));
    logger.debug("");
    
    // Create initial JSON file with empty structure
    const initialJson = {
        project_request: userRequest,
        questions: [
            {
                question: "Waiting for the Engineer to generate questions....",
                answer: ""
            }
        ]
    };
    
    fs.writeFileSync(questionsFile, JSON.stringify(initialJson, null, 2));
    
    logger.debug(chalk.greenBright('✅ Architect questions file created: ') + chalk.dim(questionsFile));
    logger.debug("");
    
    const questioningPrompt = generateEngineerQuestionsPrompt(projectDir, questionsFile, userRequest);

    await printPrompt(questioningPrompt);
    
    // Ask user if ready, copy to clipboard, and auto-paste into Cursor
    logger.debug("");
    printSeparator();
    logger.debug(chalk.cyanBright('⏳ READY TO WORK IN CURSOR?'));
    logger.debug("");
    
    const { ready: architectReady } = await inquirer.prompt([{
        type: 'list',
        name: 'ready',
        message: chalk.bold.cyan('Ready to switch to Cursor? (I\'ll copy prompt and auto-paste)'),
        choices: ['Yes', 'No'],
        default: 'Yes',
        prefix: '  '
    }]);
    
    if (architectReady === 'No') {
        logger.debug("");
        logger.debug(chalk.yellow('⏸️  Workflow paused.'));
        logger.debug("");
        return null;
    }
    
    if (architectReady === 'Yes' && printPrompt._lastPromptContent) {
        // Copy to clipboard and start monitoring for Cursor
        const { copyToClipboard } = await import('../utils/clipboard.js');
        await copyToClipboard(printPrompt._lastPromptContent);
    }
    
    // Wait for file to be updated
    logger.debug("");
    logger.debug(chalk.yellowBright('⏳ Waiting for Cursor to update the file...'));
    logger.debug(chalk.dim('The next step will begin automatically when ready.'));
    logger.debug("");
    
    const fileUpdated = await watchForFileUpdate(questionsFile, 300000, true); // 5 minute timeout, wait for change from initial state
    
    if (!fileUpdated) {
        logger.debug(chalk.yellow('⚠️  Timeout waiting for file update.'));
        logger.debug(chalk.dim('Please ensure Cursor updated: ' + questionsFile));
        return null;
    }
    
    logger.debug("");
    logger.debug(chalk.greenBright('✅ File updated! Continuing...'));
    logger.debug("");
    
    // Phase 2: Read the updated questions and present to user
    logger.debug("");
    logger.debug(chalk.yellowBright('🔧 PHASE 2: Technical Requirements Answers'));
    logger.debug("");
    logger.debug(chalk.dim('Reading the generated technical questions and collecting your answers...'));
    logger.debug("");
    
    // Read the updated JSON file
    let questionsData;
    try {
        const updatedJson = fs.readFileSync(questionsFile, 'utf-8');
        questionsData = JSON.parse(updatedJson);
    } catch (error) {
        logger.debug(chalk.red('❌ Could not read the updated questions file. Please make sure the AI updated the JSON file correctly.'));
        return null;
    }
    
    if (!questionsData.questions || questionsData.questions.length === 0) {
        logger.debug(chalk.red('❌ No questions found in the JSON file. Please make sure the AI generated questions.'));
        return null;
    }
    
    // Present questions to user one by one
    logger.debug("");
    printSeparator();
    logger.debug(chalk.cyanBright('🏗️ TECHNICAL REQUIREMENTS'));
    logger.debug("");
    logger.debug(chalk.dim('Please answer each technical question. Your answers will guide architecture decisions.'));
    logger.debug("");
    
    for (let i = 0; i < questionsData.questions.length; i++) {
        const question = questionsData.questions[i];
        
        displayQuestionHeader(i + 1, questionsData.questions.length, chalk.bold.blueBright);
        
        const answer = await promptQuestion(question, chalk.bold.green, chalk.whiteBright);
        questionsData.questions[i].answer = answer;
        
        logger.debug("");
        if (i < questionsData.questions.length - 1) {
            printSeparator();
        }
    }
    
    // Transform questions format to use "decision" and "rejected_alternatives"
    // This provides clarity for downstream agents about what was chosen vs rejected
    const transformedData = transformQuestionsFormat(questionsData);
    
    // Save updated questions with transformed format
    fs.writeFileSync(questionsFile, JSON.stringify(transformedData, null, 2));
    
    logger.debug("");
    logger.debug(chalk.greenBright('✅ All technical questions answered!'));
    logger.debug(chalk.dim('Responses saved to: ') + makeClickablePath(questionsFile));
    logger.debug("");
    
    return questionsFile;
};

/**
 * Handle UX interaction questions (5-8 questions about user actions)
 * @param userRequest - The user's project request
 * @param projectDir - Directory path for the project
 * @returns Promise<string> - Path to questions file
 */
export const handleSimpleUXQuestions = async (userRequest: string, projectDir: string): Promise<string> => {
    const projectId = path.basename(projectDir);
    const uxQuestionsFile = getUXQuestionsPath(projectId);
    
    // Import phase check function
    const { isUXQuestionsAnswered } = await import('./project-service.js');
    
    // Check if questions are already answered - if so, skip entirely
    if (isUXQuestionsAnswered(projectDir)) {
        logger.debug("");
        logger.debug(chalk.dim('⏭️  Skipping UX questions (already answered)'));
        logger.debug("");
        return uxQuestionsFile;
    }
    
    // Step 1: Generate UX interaction questions
    logger.debug("");
    logger.debug(chalk.yellowBright('🎨 STEP 1: User Interaction Questions'));
    logger.debug("");
    logger.debug(chalk.dim('Generating questions about user actions and interactions...'));
    logger.debug("");
    
    // Create initial JSON file
    const initialJson = {
        project_request: userRequest,
        questions: [
            {
                question: "Waiting for the Designer to generate questions....",
                answer: ""
            }
        ]
    };
    
    fs.writeFileSync(uxQuestionsFile, JSON.stringify(initialJson, null, 2));
    
    const uxQuestioningPrompt = generateUXQuestionsPrompt(projectDir, uxQuestionsFile, userRequest);

    await printPrompt(uxQuestioningPrompt);
    
    // Ask user if ready, copy to clipboard, and auto-paste into Cursor
    logger.debug("");
    printSeparator();
    logger.debug(chalk.cyanBright('⏳ READY TO WORK IN CURSOR?'));
    logger.debug("");
    
    const { ready: uxReady } = await inquirer.prompt([{
        type: 'list',
        name: 'ready',
        message: chalk.bold.cyan('Ready to switch to Cursor? (I\'ll copy prompt and auto-paste)'),
        choices: ['Yes', 'No'],
        default: 'Yes',
        prefix: '  '
    }]);
    
    if (uxReady === 'No') {
        logger.debug("");
        logger.debug(chalk.yellow('⏸️  Workflow paused.'));
        logger.debug("");
        return null;
    }
    
    if (uxReady === 'Yes' && printPrompt._lastPromptContent) {
        // Copy to clipboard and start monitoring for Cursor
        const { copyToClipboard } = await import('../utils/clipboard.js');
        await copyToClipboard(printPrompt._lastPromptContent);
    }
    
    // Wait for file to be updated
    logger.debug("");
    logger.debug(chalk.yellowBright('⏳ Waiting for Cursor to update the file...'));
    logger.debug(chalk.dim('The next step will begin automatically when ready.'));
    logger.debug("");
    
    const fileUpdated = await watchForFileUpdate(uxQuestionsFile, 300000, true); // 5 minute timeout, wait for change from initial state
    
    if (!fileUpdated) {
        logger.debug(chalk.yellow('⚠️  Timeout waiting for file update.'));
        logger.debug(chalk.dim('Please ensure Cursor updated: ' + uxQuestionsFile));
        return null;
    }
    
    logger.debug("");
    logger.debug(chalk.greenBright('✅ File updated! Continuing...'));
    logger.debug("");
    
    // Step 2: Present questions to user
    logger.debug("");
    logger.debug(chalk.yellowBright('💭 User Interaction Questions'));
    logger.debug("");
    logger.debug(chalk.dim('Questions about what users can DO and how they interact...'));
    logger.debug("");
    
    // Read the updated questions
    let uxQuestionsData;
    try {
        const updatedJson = fs.readFileSync(uxQuestionsFile, 'utf-8');
        uxQuestionsData = JSON.parse(updatedJson);
    } catch (error) {
        logger.debug(chalk.red('❌ Could not read UX questions. Please make sure the AI updated the JSON file.'));
        return null;
    }
    
    if (!uxQuestionsData.questions || uxQuestionsData.questions.length === 0) {
        logger.debug(chalk.red('❌ No UX questions found. Please make sure the AI generated questions.'));
        return null;
    }
    
    // Ask the questions (quick and simple)
    for (let i = 0; i < uxQuestionsData.questions.length; i++) {
        const question = uxQuestionsData.questions[i];
        
        displayQuestionHeader(i + 1, uxQuestionsData.questions.length, chalk.bold.cyanBright);
        
        const answer = await promptQuestion(question, chalk.cyan, chalk.cyanBright);
        uxQuestionsData.questions[i].answer = answer;
        
        logger.debug("");
        if (i < uxQuestionsData.questions.length - 1) {
            printSeparator();
        }
    }
    
    // Transform questions format to use "decision" and "rejected_alternatives"
    // This provides clarity for downstream agents about what was chosen vs rejected
    const transformedData = transformQuestionsFormat(uxQuestionsData);
    
    // Save answers with transformed format
    fs.writeFileSync(uxQuestionsFile, JSON.stringify(transformedData, null, 2));
    
    logger.debug(chalk.greenBright('✅ UX context gathered!'));
    logger.debug("");
    
    return uxQuestionsFile;
};

/**
 * Handle design brief generation
 * @param projectDir - Directory path for the project
 * @param uxQuestionsFile - Path to UX questions file
 * @returns Promise<{designBriefFile: string, wireframesFile: string}> - Paths to generated files
 */
export const handleDesignBriefGeneration = async (projectDir: string, uxQuestionsFile: string): Promise<{designBriefFile: string, wireframesFile: string}> => {
    logger.debug("");
    logger.debug(chalk.yellowBright('📱 Generating Design Brief'));
    logger.debug("");
    logger.debug(chalk.dim('Creating design brief with screens and wireframes...'));
    logger.debug("");
    
    const { TEMPLATES_DIR } = await import('../config/constants.js');
    const projectId = path.basename(projectDir);
    const designBriefFile = path.join(projectDir, 'documents', 'design_brief.md');
    const uxDesignerOutputFile = path.join(projectDir, 'documents', 'ux_designer_wireframes.md');
    const screensFile = getScreensPath(projectId);
    
    // Pre-create design brief with template structure
    const templatePath = path.join(TEMPLATES_DIR, 'design_brief_template.md');
    const screensTemplatePath = path.join(TEMPLATES_DIR, 'screens_template.json');
    
    if (fs.existsSync(templatePath)) {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        fs.writeFileSync(designBriefFile, templateContent);
        logger.debug(chalk.green(`✅ Pre-created ${designBriefFile} with template structure`));
    }
    
    if (fs.existsSync(screensTemplatePath)) {
        const screensTemplateContent = fs.readFileSync(screensTemplatePath, 'utf8');
        fs.writeFileSync(screensFile, screensTemplateContent);
        logger.debug(chalk.green(`✅ Pre-created ${screensFile} with template structure`));
    }
    
    const designBriefPrompt = generateUXDesignBriefPrompt(projectDir, uxQuestionsFile, screensFile);

    await printPrompt(designBriefPrompt);
    
    // Import waitForCompletion for file watching
    const { waitForCompletion } = await import('../ui/prompts.js');
    
    // Wait for designer to complete work (auto-detect file changes)
    await waitForCompletion(uxDesignerOutputFile, 'Designer');
    
    return { designBriefFile, wireframesFile: uxDesignerOutputFile };
};

/**
 * Handle architecture analysis (Phase 2)
 * @param userRequest - The user's project request
 * @param projectDir - Directory path for the project
 * @param architectQuestionsFile - Path to architect questions file
 * @returns Promise<{architectureFile: string, technologyChoicesFile: string}> - Paths to generated files
 */
export const handleArchitectureAnalysis = async (userRequest: any, projectDir: string, architectQuestionsFile: string): Promise<{architectureFile: string, technologyChoicesFile: string}> => {
    logger.debug("");
    logger.debug(chalk.yellowBright('🏗️ PHASE 3: Technical Specification'));
    logger.debug("");
    logger.debug(chalk.dim('Creating technical specification and analyzing technology choices...'));
    logger.debug("");
    
    const { TEMPLATES_DIR } = await import('../config/constants.js');
    const projectId = path.basename(projectDir);
    const technicalSpecFile = getTechnicalSpecPath(projectId);
    const technologyChoicesFile = getTechnologyChoicesPath(projectId);
    
    // Pre-create technical specification and technology choices files with template structure
    const technicalSpecTemplatePath = path.join(TEMPLATES_DIR, 'technical_specification_template.md');
    const technologyChoicesTemplatePath = path.join(TEMPLATES_DIR, 'technology_choices_template.json');
    
    if (fs.existsSync(technicalSpecTemplatePath)) {
        const technicalSpecTemplateContent = fs.readFileSync(technicalSpecTemplatePath, 'utf8');
        fs.writeFileSync(technicalSpecFile, technicalSpecTemplateContent);
        logger.debug(chalk.green(`✅ Pre-created ${technicalSpecFile} with template structure`));
    }
    
    if (fs.existsSync(technologyChoicesTemplatePath)) {
        const technologyChoicesTemplateContent = fs.readFileSync(technologyChoicesTemplatePath, 'utf8');
        fs.writeFileSync(technologyChoicesFile, technologyChoicesTemplateContent);
        logger.debug(chalk.green(`✅ Pre-created ${technologyChoicesFile} with template structure`));
    }
    
    logger.debug("");
    
    const analysisPrompt = generateEngineerSpecPrompt(projectDir, architectQuestionsFile);

    await printPrompt(analysisPrompt);
    
    // Import waitForCompletion for file watching
    const { waitForCompletion } = await import('../ui/prompts.js');
    
    // Wait for engineer to complete work (auto-detect file changes)
    await waitForCompletion(technicalSpecFile, 'Engineer');
    
    return { architectureFile: technicalSpecFile, technologyChoicesFile };
};

/**
 * Generate design brief from UX artifacts (heuristic, no AI needed)
 * Note: This function is kept for backward compatibility but may be deprecated
 * as the designer now generates the design brief directly.
 * @param projectDir - Directory path for the project
 */
export const generateDesignBrief = async (projectDir: string): Promise<void> => {
    logger.debug("");
    logger.debug(chalk.yellowBright('📝 Generating design brief...'));
    
    const { TEMPLATES_DIR } = await import('../config/constants.js');
    const projectId = path.basename(projectDir);
    const designBriefFile = getDesignBriefPath(projectId);
    const uxDesignerOutputFile = getWireframesPath(projectId);
    
    // Read template
    const templatePath = path.join(TEMPLATES_DIR, 'design_brief_template.md');
    let designBriefContent = fs.readFileSync(templatePath, 'utf-8');
    
    // Get project name from project_request
    const projectRequestFile = path.join(projectDir, 'project_request.md');
    let projectName = 'Project';
    if (fs.existsSync(projectRequestFile)) {
        const projectRequestContent = fs.readFileSync(projectRequestFile, 'utf-8');
        const match = projectRequestContent.match(/# Project Request: (.+)/);
        if (match) {
            projectName = match[1].trim();
        }
    }
    designBriefContent = designBriefContent.replace('[PROJECT_NAME_PLACEHOLDER]', projectName);
    
    // Build Wireframes and Screens section from ux_designer_wireframes.md
    let screensSection = '';
    let wireframesSection = '';
    let userFlowsSection = '';
    if (fs.existsSync(uxDesignerOutputFile)) {
        const uxContent = fs.readFileSync(uxDesignerOutputFile, 'utf-8');
        
        // Extract screens section
        const screensMatch = uxContent.match(/## Screens?([\s\S]*?)(?=##|$)/i);
        if (screensMatch) {
            screensSection = screensMatch[1].trim();
        } else {
            screensSection = '*No screens documented*';
        }
        
        // Extract user flows section
        const userFlowsMatch = uxContent.match(/## User Flows?([\s\S]*?)(?=##|$)/i);
        if (userFlowsMatch) {
            userFlowsSection = userFlowsMatch[1].trim();
        } else {
            userFlowsSection = '*No user flows documented*';
        }
        
        // Extract wireframes section
        const wireframesMatch = uxContent.match(/## Wireframes?([\s\S]*?)$/i);
        if (wireframesMatch) {
            wireframesSection = wireframesMatch[1].trim();
        } else {
            wireframesSection = '*No wireframes documented*';
        }
    } else {
        screensSection = '*UX designer output not available*';
        userFlowsSection = '*UX designer output not available*';
        wireframesSection = '*UX designer output not available*';
    }
    
    // Replace placeholders
    designBriefContent = designBriefContent.replace('[SCREEN_INVENTORY_PLACEHOLDER - This section will be populated after Designer validation]', screensSection);
    designBriefContent = designBriefContent.replace('[SCREENS_PLACEHOLDER - This section will be populated from UX Designer analysis]', screensSection);
    designBriefContent = designBriefContent.replace('[USER_FLOWS_PLACEHOLDER - This section will be populated from UX Designer analysis]', userFlowsSection);
    designBriefContent = designBriefContent.replace('[WIREFRAMES_PLACEHOLDER - This section will be populated with all wireframes after Designer validation]', wireframesSection);
    
    // Write design brief
    fs.writeFileSync(designBriefFile, designBriefContent);
    
    logger.debug(chalk.green('✅ Design brief generated: ') + makeClickablePath(designBriefFile));
    logger.debug("");
};

