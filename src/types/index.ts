/**
 * TypeScript Type Definitions for SpecWright
 */

/**
 * Agent configuration defining who performs the workflow
 */
export interface AgentConfig {
    name: string;
    emoji: string;
    role: string;
}

/**
 * Base workflow configuration
 */
export interface BaseWorkflow {
    name: string;
    description: string;
}

/**
 * Multi-phase workflow that delegates to other workflows
 */
export interface MultiPhaseWorkflow extends BaseWorkflow {
    phases: string[];
    agent?: AgentConfig;
    template?: string;
    inputs?: string[];
    outputs?: string[];
    contextFiles?: string[];
    outputTemplates?: Record<string, string>;
}

/**
 * Single-phase workflow with execution details
 */
export interface SinglePhaseWorkflow extends BaseWorkflow {
    agent: AgentConfig;
    template: string;
    inputs: string[];
    outputs: string[];
    contextFiles: string[];
    outputTemplates?: Record<string, string>;
}

/**
 * Union type for all workflow configurations
 */
export type Workflow = SinglePhaseWorkflow | MultiPhaseWorkflow;

/**
 * Collection of all workflows
 */
export interface WorkflowCollection {
    [key: string]: Workflow;
}

/**
 * Result of building a prompt from a workflow
 */
export interface PromptBuildResult {
    promptContent: string;
    contextFiles: string[];
    workflow: Workflow;
}

/**
 * Progress data for project tracking
 */
export interface ProgressData {
    completed: number;
    total: number;
    percent: number;
}

/**
 * Project metadata structure
 */
export interface ProjectMetadata {
    id: string;
    name?: string;
    slug?: string;
    fullId?: string;
    path?: string;
    title?: string;
    description?: string;
    status?: 'ready_to_spec' | 'pm_complete' | 'ux_in_progress' | 'engineer_in_progress' | 'ready_to_break' | 
            'ready_to_ship' | 'implementing' | 'completed' |  // Post-breakdown statuses
            'pending' | 'in-progress' | 'specced_out' | 'in_review' | 'done' | 'todo' | 'planned' | 'blocked' | 'ready';
    testable_outcome?: string;
    folderName?: string;
    createdAt?: string;
    updatedAt?: string;
    progressData?: ProgressData;
    completed_agents?: Array<'pm' | 'ux' | 'architect'>;
    settings?: ProjectSettings;  // Project-level configuration
    icon?: ProjectIcon;  // Project icon/emoji for visual identification
}

/**
 * Project specification settings (depth and detail level)
 */
export interface ProjectSettings {
    question_depth: 'light' | 'standard' | 'thorough';  // How many questions per agent
    document_length: 'brief' | 'standard' | 'comprehensive';  // How detailed specs should be
}

/**
 * Project icon/emoji configuration for visual identification
 * Similar to Linear's project icon feature
 */
export interface ProjectIcon {
    type: 'icon' | 'emoji';
    value: string;  // Icon name (e.g., "cube", "rocket") or emoji character (e.g., "🚀")
    color?: string; // HSL color string for icons (e.g., "hsl(235 69% 61%)"), not used for emojis
}

/**
 * Scoping plan structure (used during scoping and approval)
 */
export interface ScopingPlan {
    type: 'direct' | 'project';
    scope_analysis?: string;
    
    // For type: 'direct' - work that doesn't need a project
    direct_work_suggestion?: string;
    
    // For type: 'project'
    project_name?: string;
    description?: string;
    recommendation?: 'single' | 'multiple';
    projects?: ProjectMetadata[];
    settings?: ProjectSettings;  // Project-level configuration
    
    // Common fields
    status?: string;
    created_at?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Acceptance criterion with ID and full description
 */
export interface AcceptanceCriterion {
    id: string;           // Reference to acceptance_criteria.json (e.g., "ac_001_01")
    description: string;  // Full acceptance criterion text
}

/**
 * Issue metadata structure
 * Issues exist within projects in the issues/ folder
 */
export interface IssueMetadata {
    // All fields in camelCase (TypeScript/JavaScript standard)
    // Backend transforms from snake_case JSON when reading files
    issueId: string;
    title: string;
    description: string;
    status: 'pending' | 'in-review' | 'approved';
    complexityScore: number; // Deprecated: no longer in JSON, defaults to 0
    estimatedHours: number;
    dependencies: string[];
    
    // Traceability fields (link back to Design)
    screensAffected?: string[];        // Screen IDs from screens.json
    
    // Issue content (all inline in issues.json)
    keyDecisions?: string[];           // Architectural decisions for AI implementation
    acceptanceCriteria: AcceptanceCriterion[];  // What defines "done" with ID and full description
    technicalDetails?: string;         // Optional schema hints, architecture notes
    testStrategy?: {
        automated_tests?: string;
        manual_verification?: string;
    };
    humanInTheLoop?: string[];         // Step-by-step human verification steps
    
    // Legacy fields (deprecated)
    implementationNotes?: string;      // Deprecated: use technicalDetails
    filePath?: string;                 // Deprecated: issues are inline in JSON now
    coversAcceptanceCriteria?: string[];  // Deprecated: use acceptanceCriteria with objects
    coversScreens?: string[];             // Deprecated: use screensAffected
    
    projectId: string;
    projectName: string;
}

/**
 * CLI menu choice structure
 */
export interface MenuChoice {
    name: string;
    value: string;
    description?: string;
}

/**
 * Screen specification structure
 */
export interface ScreenSpec {
    id: string;
    name: string;
    description?: string;
    components?: string[];
    interactions?: string[];
}

/**
 * Technology choice structure
 */
export interface TechnologyChoice {
    category: string;
    technology: string;
    reason: string;
    alternatives?: string[];
}

/**
 * Type guard to check if a workflow is multi-phase
 */
export function isMultiPhaseWorkflow(workflow: Workflow): workflow is MultiPhaseWorkflow {
    return 'phases' in workflow && Array.isArray(workflow.phases);
}

/**
 * Type guard to check if a workflow is single-phase
 */
export function isSinglePhaseWorkflow(workflow: Workflow): workflow is SinglePhaseWorkflow {
    return 'template' in workflow && typeof workflow.template === 'string';
}

/**
 * Question structure with optional multiple choice support
 */
export interface Question {
    question: string;
    answer: string;
    options?: string[]; // 2-3 suggested options, plus "Other (specify)" added automatically
}

/**
 * Re-export project status types
 */
export type {
    AgentType,
    PhaseStatus,
    PhaseHistoryEntry,
    AgentStatus,
    ProjectStatus
} from './project-status.js';
export { createInitialStatus, AGENT_PHASES, HUMAN_REQUIRED_PHASES } from './project-status.js';

