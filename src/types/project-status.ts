/**
 * Project Status Tracking Types
 * 
 * Explicit state machine for specification workflow
 */

import type { ProjectSettings, ProjectIcon } from './index.js';

export type AgentType = 'pm' | 'ux' | 'engineer';
export type PhaseStatus = 'not-started' | 'ai-working' | 'awaiting-user' | 'user-reviewing' | 'complete';

export interface PhaseHistoryEntry {
  phase: string;
  startedAt: string;
  completedAt?: string;
  status: PhaseStatus;
}

/**
 * Cost tracking for a single phase (legacy - kept for backwards compatibility)
 * @deprecated Use simplified CostTracking instead
 */
export interface PhaseCostEntry {
  phase: string;
  phaseName: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: string;
}

/**
 * Simplified cost tracking data stored in status.json
 * 
 * Input tokens: Running total, added when each prompt is generated
 * Output tokens: Calculated on-demand by scanning all output files, cached here
 */
export interface CostTracking {
  tier: 'budget' | 'standard' | 'premium';
  
  /** Running total of input tokens from all prompts */
  totalInputTokens: number;
  
  /** Cached output token count from scanning all files */
  cachedOutputTokens: number;
  
  /** When the output tokens were last calculated */
  outputCalculatedAt: string;
  
  /** Last time any cost data was updated */
  lastUpdated: string;
  
  /** @deprecated Legacy per-phase tracking - may be present in old projects */
  phases?: PhaseCostEntry[];
}

export interface AgentStatus {
  status: PhaseStatus;
  currentPhase: string | null;
  completedAt?: string;
  phases: {
    [phaseName: string]: {
      status: PhaseStatus;
      startedAt?: string;
      completedAt?: string;
    };
  };
}

export interface ProjectStatus {
  version: string;
  projectId: string;
  currentAgent: AgentType | 'complete';
  currentPhase: string;
  
  agents: {
    pm: AgentStatus;
    ux: AgentStatus;
    engineer: AgentStatus;
  };
  
  history: PhaseHistoryEntry[];
  
  // Project configuration settings (question depth, document length)
  settings?: ProjectSettings;
  
  // Project icon/emoji for visual identification
  icon?: ProjectIcon;
  
  // Cost tracking for token usage estimation
  costTracking?: CostTracking;
  
  createdAt: string;
  lastUpdatedAt: string;
}

/**
 * Phase definitions for each agent
 */
export const AGENT_PHASES = {
  pm: [
    'questions-generate',      // AI generates questions
    'questions-answer',        // User answers (awaiting-user)
    'prd-generate',           // AI writes PRD
    'prd-review'              // User reviews PRD (user-reviewing)
  ],
  ux: [
    'questions-generate',
    'questions-answer',
    'design-brief-generate',  // AI creates design brief with screens and wireframes
    'design-brief-review'     // User reviews design brief (user-reviewing)
  ],
  engineer: [
    'questions-generate',
    'questions-answer',
    'spec-generate',         // AI writes tech spec
    'spec-review'            // User reviews spec (user-reviewing)
  ]
} as const;

/**
 * Phases that require human interaction (cannot auto-advance)
 */
export const HUMAN_REQUIRED_PHASES = [
  'questions-answer',
  'prd-review',
  'design-brief-review',
  'spec-review'
];

/**
 * Initial status template
 */
export function createInitialStatus(projectId: string, settings?: ProjectSettings): ProjectStatus {
  return {
    version: '1.0.0',
    projectId,
    currentAgent: 'pm',
    currentPhase: 'pm-questions-generate',
    
    agents: {
      pm: {
        status: 'not-started',
        currentPhase: 'questions-generate',
        phases: {
          'questions-generate': { status: 'not-started' },
          'questions-answer': { status: 'not-started' },
          'prd-generate': { status: 'not-started' },
          'prd-review': { status: 'not-started' }
        }
      },
      ux: {
        status: 'not-started',
        currentPhase: null,
        phases: {
          'questions-generate': { status: 'not-started' },
          'questions-answer': { status: 'not-started' },
          'design-brief-generate': { status: 'not-started' },
          'design-brief-review': { status: 'not-started' }
        }
      },
      engineer: {
        status: 'not-started',
        currentPhase: null,
        phases: {
          'questions-generate': { status: 'not-started' },
          'questions-answer': { status: 'not-started' },
          'spec-generate': { status: 'not-started' },
          'spec-review': { status: 'not-started' }
        }
      }
    },
    
    history: [],
    
    // Include settings if provided, otherwise use defaults
    settings: settings || {
      question_depth: 'standard',
      document_length: 'standard'
    },
    
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  };
}

