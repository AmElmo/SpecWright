/**
 * Prompt Generator Service - Centralized prompt generation for all workflow phases
 * 
 * This module is the single source of truth for all prompt generation in SpecWright.
 * Both CLI and Web UI should use these functions to ensure consistency.
 */

import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';
import type { ParsedIssue } from './issue-service.js';
import type { ProjectSettings } from '../types/index.js';
import {
    getPRDPath,
    getAcceptanceCriteriaPath,
    getTechnicalSpecPath,
    getTechnologyChoicesPath,
    getDesignBriefPath,
    getWireframesPath,
    getScreensPath,
    toRelativePath
} from '../utils/project-paths.js';
import {
    loadGitPreferences,
    generateGitInstructions
} from './settings-service.js';

/**
 * Convert absolute path to relative path from workspace root (process.cwd())
 * This ensures @ references work correctly in Cursor regardless of workspace location
 */
// NOTE: This function is now imported from project-paths.ts - keeping this comment for reference

/**
 * Get question count based on project settings
 */
const getQuestionCount = (depth: 'light' | 'standard' | 'thorough'): { min: number; max: number } => {
    switch (depth) {
        case 'light':
            return { min: 3, max: 5 };
        case 'standard':
            return { min: 5, max: 8 };
        case 'thorough':
            return { min: 8, max: 12 };
    }
};

/**
 * Get document length constraints based on project settings
 */
const getDocumentConstraints = (length: 'brief' | 'standard' | 'comprehensive'): { 
    description: string; 
    wordTarget: string; 
    readTime: string;
    maxWords: number;
        maxTokens: number;  // Approximate token limit for AI generation
} => {
    switch (length) {
        case 'brief':
            return {
                description: 'Brief and focused',
                wordTarget: '600-900 words',
                readTime: '3-5 minutes',
                maxWords: 900,
                maxTokens: 1200  // ~0.75 tokens per word + buffer
            };
        case 'standard':
            return {
                description: 'Balanced detail',
                wordTarget: '1500-2100 words',
                readTime: '7-10 minutes',
                maxWords: 2100,
                maxTokens: 2800  // ~0.75 tokens per word + buffer
            };
        case 'comprehensive':
            return {
                description: 'Comprehensive and thorough',
                wordTarget: '3600-4500 words',
                readTime: '15-20 minutes',
                maxWords: 4500,
                maxTokens: 6000  // ~0.75 tokens per word + buffer
            };
    }
};

/**
 * Load project settings from project_status.json (canonical source)
 * Falls back to legacy locations for backward compatibility
 */
const loadProjectSettings = (projectDir: string): ProjectSettings => {
    // Try to load from project_status.json first (canonical source)
    const statusPath = path.join(projectDir, 'project_status.json');
    if (fs.existsSync(statusPath)) {
        try {
            const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
            if (status.settings) {
                return status.settings;
            }
        } catch (err) {
            // Fall through to legacy sources
        }
    }
    
    // Legacy: Try to load from project_config.json (deprecated)
    const configPath = path.join(projectDir, 'project_config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.settings) {
                return config.settings;
            }
        } catch (err) {
            // Fall through to other sources
        }
    }
    
    // Try to load from project summary
    const summaryPath = path.join(projectDir, 'issues', 'issues.json');
    if (fs.existsSync(summaryPath)) {
        try {
            const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
            if (summary.settings) {
                return summary.settings;
            }
        } catch (err) {
            // Fall through to defaults
        }
    }
    
    // Default settings
    return {
        question_depth: 'standard',
        document_length: 'standard'
    };
};

// ==============================================================================
// WORKFLOW PHASE PROMPTS - Single Source of Truth
// ==============================================================================

/**
 * Generate PM Questions prompt
 */
export const generatePMQuestionsPrompt = (
    projectDir: string,
    questionsFile: string,
    userRequest: string
): string => {
    const relativeProjectDir = toRelativePath(projectDir);
    const relativeQuestionsFile = toRelativePath(questionsFile);
    
    // Load project settings
    const settings = loadProjectSettings(projectDir);
    const qCount = getQuestionCount(settings.question_depth);
    
    let prompt = `# YOUR ROLE

@specwright/agents/product_manager/system_prompt.md

# YOUR TASK

@specwright/agents/product_manager/questioning_prompt.md

# CONTEXT

- Project Request: @${relativeProjectDir}/project_request.md

USER REQUEST:
${userRequest}

Generate ${qCount.min}-${qCount.max} strategic questions based on project configuration (depth: ${settings.question_depth}).
`;

    prompt += `
JSON FILE TO UPDATE:
@${relativeQuestionsFile}`;

    return prompt;
};

/**
 * Generate PM PRD Analysis prompt
 */
export const generatePMPRDPrompt = (
    projectDir: string,
    questionsFile: string,
    prdFile: string,
    acceptanceCriteriaFile: string,
    userRequest: string,
    projectId?: string,
    projectName?: string,
    projectSlug?: string,
    detailLevel?: { description: string; wordTarget: string; readTime: string }
): string => {
    const relativeProjectDir = toRelativePath(projectDir);
    const relativeQuestionsFile = toRelativePath(questionsFile);
    const relativePrdFile = toRelativePath(prdFile);
    const relativeAcceptanceCriteriaFile = toRelativePath(acceptanceCriteriaFile);
    
    // Load project settings
    const settings = loadProjectSettings(projectDir);
    const constraints = getDocumentConstraints(settings.document_length);
    
    let prompt = `# YOUR ROLE

@specwright/agents/product_manager/system_prompt.md

# YOUR TASK

@specwright/agents/product_manager/analysis_prompt.md

# EXISTING SPECIFICATIONS

- Project Request: @${relativeProjectDir}/project_request.md
- PM Questions & Answers: @${relativeQuestionsFile}

USER REQUEST:
${userRequest}
`;

    // Add project details if provided (for CLI workflow)
    if (projectId && projectName && projectSlug) {
        prompt += `
PROJECT DETAILS:
- Project ID: ${projectId}
- Project Name: ${projectName}
- Project Slug: ${projectSlug}
`;
    }

    // Add document length constraints from project settings
    prompt += `
# DOCUMENT LENGTH CONSTRAINT

${constraints.description}
Target Length: ${constraints.wordTarget} (approximately ${constraints.readTime} reading time)

**CRITICAL**: Do NOT exceed ${constraints.maxWords} words. Write concisely and prioritize the most important information. Structure your document to fit within this budget.

**TOKEN BUDGET**: Limit your response to approximately ${constraints.maxTokens} tokens maximum. This is a hard limit - stop generating when you approach this limit.
`;

    prompt += `
FILES TO EDIT:
@${relativePrdFile}
@${relativeAcceptanceCriteriaFile}
`;

    return prompt;
};

/**
 * Generate UX Questions prompt
 */
export const generateUXQuestionsPrompt = (
    projectDir: string,
    uxQuestionsFile: string,
    userRequest: string
): string => {
    const relativeProjectDir = toRelativePath(projectDir);
    const relativeUxQuestionsFile = toRelativePath(uxQuestionsFile);
    
    // Load project settings
    const settings = loadProjectSettings(projectDir);
    const qCount = getQuestionCount(settings.question_depth);
    
    let prompt = `# YOUR ROLE

@specwright/agents/ux_designer/system_prompt.md

# YOUR TASK

@specwright/agents/ux_designer/questioning_prompt.md

# EXISTING SPECIFICATIONS

- Project Request: @${relativeProjectDir}/project_request.md
- Product Requirements Document: @${relativeProjectDir}/documents/prd.md

Generate ${qCount.min}-${qCount.max} user interaction questions based on project configuration (depth: ${settings.question_depth}).
`;

    prompt += `
JSON FILE TO UPDATE:
@${relativeUxQuestionsFile}`;

    return prompt;
};

/**
 * Generate UX Design Brief prompt (NEW STRUCTURED FORMAT)
 */
export const generateUXDesignBriefPrompt = (
    projectDir: string,
    uxQuestionsFile: string,
    screensFile: string,
    detailLevel?: { description: string; wordTarget: string; readTime: string }
): string => {
    const relativeProjectDir = toRelativePath(projectDir);
    const relativeUxQuestionsFile = toRelativePath(uxQuestionsFile);
    const relativeDesignBriefFile = toRelativePath(path.join(projectDir, 'documents', 'design_brief.md'));
    const relativeScreensFile = toRelativePath(screensFile);
    
    // Load project settings
    const settings = loadProjectSettings(projectDir);
    const constraints = getDocumentConstraints(settings.document_length);
    
    let prompt = `# YOUR ROLE

@specwright/agents/ux_designer/system_prompt.md

# YOUR TASK

@specwright/agents/ux_designer/analysis_prompt.md

# EXISTING SPECIFICATIONS

- Project Request: @${relativeProjectDir}/project_request.md
- Product Requirements Document: @${relativeProjectDir}/documents/prd.md
- UX Questions & Answers: @${relativeUxQuestionsFile}
`;

    // Add document length constraints from project settings
    prompt += `
# DOCUMENT LENGTH CONSTRAINT

${constraints.description}
Target Length: ${constraints.wordTarget} (approximately ${constraints.readTime} reading time)
Note: This applies to Design Brief text only, NOT wireframes.

**CRITICAL**: Do NOT exceed ${constraints.maxWords} words in the Design Brief. Write concisely and prioritize the most important information. Structure your document to fit within this budget.

**TOKEN BUDGET**: Limit your Design Brief to approximately ${constraints.maxTokens} tokens maximum. This is a hard limit for the prose content - stop generating text when you approach this limit. Wireframes and screens.json can be additional.
`;

    prompt += `
# FILES TO EDIT

@${relativeDesignBriefFile}
@${relativeScreensFile}

IMPORTANT: You must generate BOTH files:
1. **design_brief.md** - Overview of design approach, user flows, and design system notes
2. **screens.json** - Structured screen specifications with components marked as "reuse" (existing) or "create" (new)
`;

    return prompt;
};

/**
 * Generate Engineer Questions prompt
 */
export const generateEngineerQuestionsPrompt = (
    projectDir: string,
    engineerQuestionsFile: string,
    userRequest: string
): string => {
    const relativeProjectDir = toRelativePath(projectDir);
    const relativeEngineerQuestionsFile = toRelativePath(engineerQuestionsFile);
    
    // Load project settings
    const settings = loadProjectSettings(projectDir);
    const qCount = getQuestionCount(settings.question_depth);
    
    let prompt = `# YOUR ROLE

@specwright/agents/engineer/system_prompt.md

# YOUR TASK

@specwright/agents/engineer/questioning_prompt.md

# EXISTING SPECIFICATIONS

- Project Request: @${relativeProjectDir}/project_request.md
- Product Requirements Document: @${relativeProjectDir}/documents/prd.md
- Design Brief: @${relativeProjectDir}/documents/design_brief.md

Generate ${qCount.min}-${qCount.max} technical questions based on project configuration (depth: ${settings.question_depth}).
`;

    prompt += `
JSON FILE TO UPDATE:
@${relativeEngineerQuestionsFile}`;

    return prompt;
};

/**
 * Generate Engineer Technical Specification prompt (NEW STRUCTURED FORMAT)
 */
export const generateEngineerSpecPrompt = (
    projectDir: string,
    engineerQuestionsFile: string,
    detailLevel?: { description: string; wordTarget: string; readTime: string }
): string => {
    // Extract project ID from directory (e.g., "001-project-name" -> "001-project-name")
    const projectId = path.basename(projectDir);
    
    const relativeProjectDir = toRelativePath(projectDir);
    const relativeArchitectQuestionsFile = toRelativePath(engineerQuestionsFile);
    const relativeTechnicalSpecFile = toRelativePath(getTechnicalSpecPath(projectId));
    const relativeTechnologyChoicesFile = toRelativePath(getTechnologyChoicesPath(projectId));
    
    // Load project settings
    const settings = loadProjectSettings(projectDir);
    const constraints = getDocumentConstraints(settings.document_length);
    
    let prompt = `# YOUR ROLE

@specwright/agents/engineer/system_prompt.md

# YOUR TASK

@specwright/agents/engineer/analysis_prompt.md

# EXISTING SPECIFICATIONS

- Project Request: @${relativeProjectDir}/project_request.md
- Product Requirements Document: @${relativeProjectDir}/documents/prd.md
- Design Brief: @${relativeProjectDir}/documents/design_brief.md
- Engineer Questions & Answers: @${relativeArchitectQuestionsFile}
`;

    // Add document length constraints from project settings
    prompt += `
# DOCUMENT LENGTH CONSTRAINT

${constraints.description}
Target Length: ${constraints.wordTarget} (approximately ${constraints.readTime} reading time)
Note: This applies to Technical Specification only, NOT technology choices.

**CRITICAL**: Do NOT exceed ${constraints.maxWords} words in the Technical Specification. Write concisely and prioritize the most important information. Structure your document to fit within this budget.

**TOKEN BUDGET**: Limit your Technical Specification to approximately ${constraints.maxTokens} tokens maximum. This is a hard limit - stop generating when you approach this limit. The technology_choices.json can be additional.
`;

    prompt += `
# FILES TO EDIT

@${relativeTechnicalSpecFile}
@${relativeTechnologyChoicesFile}`;

    return prompt;
};

/**
 * Generate Tech Lead Issue Breakdown prompt
 */
export const generateTechLeadBreakdownPrompt = (
    projectDir: string,
    techLeadDir: string,
    projectSummaryFile: string,
    userRequest: string,
    includeCodebaseAnalysis: boolean = false,
    breakdownLevel?: 'few' | 'moderate' | 'detailed'
): string => {
    const projectSummaryTemplatePath = path.join(projectDir, '..', '..', '..', 'templates', 'issues_template.json');
    const projectRequestFile = path.join(projectDir, 'project_request.md');
    // Markdown documents
    const prdFile = path.join(projectDir, 'documents', 'prd.md');
    const designBriefFile = path.join(projectDir, 'documents', 'design_brief.md');
    const techSpecFile = path.join(projectDir, 'documents', 'technical_specification.md');
    // Structured JSON data
    const acceptanceCriteriaFile = path.join(projectDir, 'documents', 'acceptance_criteria.json');
    const screensFile = path.join(projectDir, 'documents', 'screens.json');
    const techChoicesFile = path.join(projectDir, 'documents', 'technology_choices.json');
    
    // Follow the same structured format as PM, Designer, and Engineer prompts
    let prompt = `# YOUR ROLE

@specwright/agents/breakdown/system_prompt.md

# YOUR TASK

@specwright/agents/breakdown/issue_breakdown_prompt.md

# OUTPUT TEMPLATE

@${toRelativePath(projectSummaryTemplatePath)}

# EXISTING SPECIFICATIONS

## Markdown Documents
- Project Request: @${toRelativePath(projectRequestFile)}
- Product Requirements Document: @${toRelativePath(prdFile)}
- Design Brief: @${toRelativePath(designBriefFile)}
- Technical Specification: @${toRelativePath(techSpecFile)}

## Structured Data (JSON)
- Acceptance Criteria: @${toRelativePath(acceptanceCriteriaFile)}
- Screen Definitions: @${toRelativePath(screensFile)}
- Technology Choices: @${toRelativePath(techChoicesFile)}

`;

    // Add breakdown level guidance if provided (for Web UI)
    if (breakdownLevel) {
        const levelGuidance = {
            few: {
                description: 'FEW ISSUES (2-3 issues)',
                guidance: 'Create high-level milestone issues. Each issue should cover a major feature area or significant functionality. These are broad, end-to-end implementations.'
            },
            moderate: {
                description: 'MODERATE BREAKDOWN (4-6 issues)',
                guidance: 'Create well-scoped issues with balanced detail. Each issue should be a meaningful unit of work that can be completed independently. This is the recommended approach for most projects.'
            },
            detailed: {
                description: 'DETAILED BREAKDOWN (6-10+ issues)',
                guidance: 'Create granular, focused issues. Break down the work into small, specific tasks. Each issue should be tightly scoped and represent a clear, discrete piece of functionality. Best for complex features or team collaboration.'
            }
        };
        
        const level = levelGuidance[breakdownLevel];
        prompt += `
# BREAKDOWN LEVEL: ${level.description}

${level.guidance}
`;
    }

    // Add codebase analysis section if requested (for CLI)
    if (includeCodebaseAnalysis) {
        prompt += `
# CODEBASE ANALYSIS

Before generating issues, analyze the existing codebase to understand:

**Project Context:**
- Structure and organization conventions
- Technology stack, frameworks, and dependencies  
- Existing features, modules, and components
- Architecture patterns and coding standards
- Testing framework and conventions

**Generate Issues That:**
- Build upon existing architecture (not against it)
- Follow established patterns and conventions
- Reference existing files/components in key_decisions
- Extend rather than duplicate existing implementations
- Integrate seamlessly with current codebase
`;
    }

    // Always include the FILE TO CREATE section at the end
    prompt += `
FILE TO CREATE:
${toRelativePath(projectSummaryFile)}`;

    return prompt;
};

// ==============================================================================
// ISSUE IMPLEMENTATION PROMPTS
// ==============================================================================

/**
 * Generate a contextual prompt for implementing an issue
 */
export const generateIssuePrompt = (issue: ParsedIssue, projectId: string): string => {
    const projectDir = path.join(OUTPUT_DIR, 'projects', projectId);
    
    const summaryPath = path.join(projectDir, 'issues', 'issues.json');
    const relativeSummaryFile = toRelativePath(summaryPath);
    
    // Build the issue details inline (since we no longer have separate .md files)
    let issueDetails = `### ${issue.issueId}: ${issue.title}

**Description:** ${issue.description}

`;
    
    // Add traceability info
    if (issue.screensAffected && issue.screensAffected.length > 0) {
        issueDetails += `**Screens Affected:** ${issue.screensAffected.join(', ')}

`;
    }
    
    if (issue.keyDecisions && issue.keyDecisions.length > 0) {
        issueDetails += `**Key Decisions:**
${issue.keyDecisions.map(d => `- ${d}`).join('\n')}

`;
    }
    
    if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
        issueDetails += `**Acceptance Criteria:**
${issue.acceptanceCriteria.map(ac => `- [${ac.id}] ${ac.description}`).join('\n')}

`;
    }
    
    if (issue.technicalDetails) {
        issueDetails += `**Technical Details:** ${issue.technicalDetails}

`;
    }
    
    if (issue.testStrategy) {
        issueDetails += `**Testing Strategy:**
- Automated Tests: ${issue.testStrategy.automated_tests || 'none'}
- Manual Verification: ${issue.testStrategy.manual_verification || 'See human-in-the-loop steps'}

`;
    }
    
    if (issue.humanInTheLoop && issue.humanInTheLoop.length > 0) {
        issueDetails += `**Human-in-the-Loop Verification:**
${issue.humanInTheLoop.map((s, i) => `${i + 1}. ${s}`).join('\n')}

`;
    }
    
    // Build clean, structured prompt
    let prompt = `# YOUR TASK

Implement **${issue.issueId}: ${issue.title}**

## Issue Details

${issueDetails}

## Relevant Specifications

`;
    
    // Check which specification files exist and add references
    const prdFile = getPRDPath(projectId);
    if (fs.existsSync(prdFile)) {
        prompt += `- Product Requirements: @${toRelativePath(prdFile)}\n`;
    }
    
    const technicalSpec = getTechnicalSpecPath(projectId);
    if (fs.existsSync(technicalSpec)) {
        prompt += `- Technical Specification: @${toRelativePath(technicalSpec)}\n`;
    }
    
    const techChoices = getTechnologyChoicesPath(projectId);
    if (fs.existsSync(techChoices)) {
        prompt += `- Technology Choices: @${toRelativePath(techChoices)}\n`;
    }
    
    const designBrief = getDesignBriefPath(projectId);
    if (fs.existsSync(designBrief)) {
        prompt += `- Design Brief: @${toRelativePath(designBrief)}\n`;
    }
    
    const wireframes = getWireframesPath(projectId);
    if (fs.existsSync(wireframes)) {
        prompt += `- Wireframes: @${toRelativePath(wireframes)}\n`;
    }
    
    // Add git workflow instructions if enabled
    const gitPreferences = loadGitPreferences();
    const gitInstructions = generateGitInstructions(gitPreferences, projectId, issue.issueId);
    if (gitInstructions) {
        prompt += gitInstructions;
    }
    
    prompt += `
## When Complete

**CRITICAL**: After implementing the task, you MUST update the status to signal completion.

Update the status in the project summary file:

@${relativeSummaryFile}

Find the issue object for "${issue.issueId}" in the "issues" array and change its "status" field from "pending" to "in-review".

This status change tells the team that your implementation is ready for human review and testing.
`;
    
    return prompt;
};

/**
 * Generate a summary view of all issues for a project
 */
export const generateProjectSummary = (projectId: string, issues: ParsedIssue[]): string => {
    let summary = '';
    
    summary += `# Project: ${projectId}\n\n`;
    summary += `## Issues Overview\n\n`;
    summary += `Total: ${issues.length} issues\n\n`;
    
    const pending = issues.filter(i => i.status === 'pending');
    const inReview = issues.filter(i => i.status === 'in-review');
    const approved = issues.filter(i => i.status === 'approved');
    
    summary += `- ✓ Approved: ${approved.length}\n`;
    summary += `- 📋 In Review: ${inReview.length}\n`;
    summary += `- ⏸️ Pending: ${pending.length}\n\n`;
    
    // Progress calculation
    const progress = issues.length > 0 ? Math.round((approved.length / issues.length) * 100) : 0;
    summary += `Progress: ${progress}%\n\n`;
    
    // List all issues
    summary += `## All Issues\n\n`;
    
    for (const issue of issues) {
        const statusEmoji = issue.status === 'approved' ? '✓' : issue.status === 'in-review' ? '📋' : '⏸️';
        summary += `${statusEmoji} **${issue.issueId}** - ${issue.title} (${issue.status})\n`;
        
        if (issue.dependencies.length > 0) {
            summary += `   Dependencies: ${issue.dependencies.join(', ')}\n`;
        }
        
        summary += `   Complexity: ${issue.complexityScore}/10 | Est: ${issue.estimatedHours}h\n\n`;
    }
    
    return summary;
};

