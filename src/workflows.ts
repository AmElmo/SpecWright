/**
 * SpecWright Workflow Definitions
 * 
 * This file defines all workflows available via CLI.
 * Each workflow specifies its agent, templates, inputs, outputs, and context files.
 */

import type {
    WorkflowCollection,
    Workflow,
    PromptBuildResult
} from './types/index.js';

export const WORKFLOWS: WorkflowCollection = {
    // Project scoping workflow
    scope: {
        name: 'Project Scoping',
        agent: {
            name: 'Product Manager',
            emoji: '🎯',
            role: 'Strategic Planning'
        },
        template: 'specwright/templates/scoping_prompt.md',
        inputs: ['user_request'],
        outputs: ['specwright/outputs/scoping_plan.json'],
        contextFiles: [],
        description: 'Analyze project scope and classify as issues or projects'
    },

    // Playbook generation workflow
    playbook: {
        name: 'Playbook Generation',
        agent: {
            name: 'Governance Architect',
            emoji: '📜',
            role: 'Project Standards'
        },
        template: 'specwright/agents/playbook/generation_prompt.md',
        inputs: ['codebase_structure', 'package.json', 'README.md'],
        outputs: ['PLAYBOOK.md'],
        contextFiles: [],
        description: 'Generate project playbook defining core principles and standards'
    },

    // Full specification workflow
    spec: {
        name: 'Specification',
        description: 'Complete AI squad specification process (PM → Designer → Engineer)',
        phases: ['pm_analysis', 'ux_analysis', 'engineer_analysis']
    },

    // Product Manager Analysis
    pm_analysis: {
        name: 'Product Manager Analysis',
        agent: {
            name: 'Product Manager',
            emoji: '📋',
            role: 'Requirements & Behavior'
        },
        template: 'specwright/agents/product_manager/analysis_prompt.md',
        inputs: [
            'project_request.md'
        ],
        outputs: [
            'documents/prd.md'
        ],
        contextFiles: [
            'specwright/outputs/scoping_plan.json',
            '{{PROJECT_DIR}}/project_request.md'
        ],
        outputTemplates: {
            'documents/prd.md': 'specwright/templates/prd_template.md'
        },
        description: 'Create PRD with Job Stories and acceptance criteria'
    },

    // Designer Analysis  
    ux_analysis: {
        name: 'Designer Analysis',
        agent: {
            name: 'Designer',
            emoji: '🎨',
            role: 'User Experience Design'
        },
        template: 'specwright/agents/ux_designer/analysis_prompt.md',
        inputs: [
            'project_request.md',
            'documents/prd.md',
            'questions/ux_questions.json'
        ],
        outputs: [
            'documents/design_brief.md',
            'documents/screens.json'
        ],
        contextFiles: [
            'specwright/outputs/scoping_plan.json',
            '{{PROJECT_DIR}}/project_request.md',
            '{{PROJECT_DIR}}/documents/prd.md',
            '{{PROJECT_DIR}}/questions/ux_questions.json'
        ],
        outputTemplates: {
            'documents/design_brief.md': 'specwright/templates/design_brief_template.md',
            'documents/screens.json': 'specwright/templates/screens_template.json'
        },
        description: 'Create design brief with screen inventory and wireframes'
    },

    // Engineer Analysis
    engineer_analysis: {
        name: 'Engineer Analysis',
        agent: {
            name: 'Engineer',
            emoji: '🔧',
            role: 'Technical Specification'
        },
        template: 'specwright/agents/engineer/analysis_prompt.md',
        inputs: [
            'project_request.md',
            'documents/prd.md',
            'documents/design_brief.md'
        ],
        outputs: [
            'documents/technical_specification.md',
            'documents/technology_choices.json'
        ],
        contextFiles: [
            'specwright/outputs/scoping_plan.json',
            '{{PROJECT_DIR}}/project_request.md',
            '{{PROJECT_DIR}}/documents/prd.md',
            '{{PROJECT_DIR}}/documents/design_brief.md'
        ],
        outputTemplates: {
            'documents/technical_specification.md': 'specwright/templates/technical_specification_template.md',
            'documents/technology_choices.json': 'specwright/templates/technology_choices_template.json'
        },
        description: 'Define technical specification and technology stack'
    },

    // Issue Breakdown
    breakdown: {
        name: 'Issue Breakdown',
        agent: {
            name: 'Issue Breakdown',
            emoji: '📊',
            role: 'Implementation Planning'
        },
        template: 'specwright/agents/breakdown/issue_breakdown_prompt.md',
        inputs: [
            'project_request.md',
            'documents/prd.md',
            'documents/design_brief.md',
            'documents/technical_specification.md'
        ],
        outputs: [
            'issues/issues.json'
        ],
        contextFiles: [
            'specwright/outputs/scoping_plan.json',
            '{{PROJECT_DIR}}/project_request.md',
            // Markdown documents
            '{{PROJECT_DIR}}/documents/prd.md',
            '{{PROJECT_DIR}}/documents/design_brief.md',
            '{{PROJECT_DIR}}/documents/technical_specification.md',
            // Structured JSON data (critical for issue breakdown)
            '{{PROJECT_DIR}}/documents/acceptance_criteria.json',
            '{{PROJECT_DIR}}/documents/screens.json',
            '{{PROJECT_DIR}}/documents/technology_choices.json'
        ],
        outputTemplates: {
            'issues/issues.json': 'specwright/templates/issues_template.json'
        },
        description: 'Break down project into implementation issues in a single JSON file'
    }
};

/**
 * Get workflow by name
 */
export function getWorkflow(workflowName: string): Workflow | undefined {
    return WORKFLOWS[workflowName];
}

/**
 * Build prompt from workflow definition
 * @param workflowName - Name of the workflow
 * @param projectDir - Path to project directory
 * @param userRequest - User's request text
 * @returns Prompt content, context files, and workflow config
 */
export function buildPrompt(
    workflowName: string,
    projectDir: string,
    userRequest: string
): PromptBuildResult {
    const workflow = WORKFLOWS[workflowName];
    if (!workflow) {
        throw new Error(`Unknown workflow: ${workflowName}`);
    }

    // Type guard check - only single phase workflows have contextFiles
    if (!('contextFiles' in workflow)) {
        throw new Error(`Workflow ${workflowName} is multi-phase and cannot build a direct prompt`);
    }

    // Build list of files to reference
    const contextFiles = workflow.contextFiles.map(file => 
        file.replace('{{PROJECT_DIR}}', projectDir)
    );

    // Build prompt content
    let promptContent = `@${workflow.template}\n`;
    
    // Add context file references
    contextFiles.forEach(file => {
        promptContent += `@${file}\n`;
    });

    promptContent += `\nUSER REQUEST:\n${userRequest}\n`;

    // Add output files info if specified
    if (workflow.outputs && workflow.outputs.length > 0) {
        promptContent += `\nFILES TO EDIT:\n`;
        workflow.outputs.forEach((output, index) => {
            const outputPath = output.startsWith('specwright/outputs/') ? output : `${projectDir}/${output}`;
            promptContent += `${index + 1}. ${outputPath}\n`;
        });
    }

    return {
        promptContent,
        contextFiles,
        workflow
    };
}
