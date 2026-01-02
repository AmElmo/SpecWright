/**
 * Linear Sync Types
 *
 * Types for Linear integration and sync functionality
 */

/**
 * Linear API configuration stored in settings
 */
export interface LinearConfig {
  apiKey: string;
  defaultTeamId?: string;
  defaultTeamName?: string;
}

/**
 * Sync settings for a project
 */
export interface LinearSyncSettings {
  enabled: boolean;
  teamId: string;
  teamName: string;
}

/**
 * State of a synced project
 */
export interface LinearSyncState {
  syncedAt: string;                    // ISO timestamp of last sync
  linearProjectId: string;             // Linear project UUID
  linearProjectUrl: string;            // URL to open in browser
  linearTeamId: string;
  linearTeamName: string;
  issueIdMap: Record<string, string>;  // Specwright ID -> Linear ID (e.g., "ENG-001" -> "uuid")
  documentIdMap: Record<string, string>; // Document path -> Linear doc ID (e.g., "prd.md" -> "uuid")
  externalLinks: Array<{
    resource: string;                  // Resource type (e.g., "screens", "technology-choices")
    url: string;                       // Localhost URL
    linearLinkId?: string;             // Linear attachment ID if created
  }>;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  linearProjectId?: string;
  linearProjectUrl?: string;
  issuesSynced: number;
  documentsSynced: number;
  errors?: string[];
}

/**
 * Linear team info for selection
 */
export interface LinearTeamInfo {
  id: string;
  name: string;
  key: string;
  icon?: string;
}

/**
 * Input for creating a Linear project
 */
export interface CreateLinearProjectInput {
  name: string;
  description?: string;
  teamId: string;
  leadId?: string;
}

/**
 * Input for creating a Linear issue
 */
export interface CreateLinearIssueInput {
  title: string;
  description?: string;
  teamId: string;
  projectId?: string;
  priority?: number;        // 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
  estimate?: number;
  labelNames?: string[];
  parentId?: string;        // For sub-issues
}

/**
 * Input for creating a Linear document
 */
export interface CreateLinearDocumentInput {
  title: string;
  content: string;          // Markdown content
  projectId: string;
}

/**
 * External link to add to a Linear project
 */
export interface LinearExternalLink {
  url: string;
  title: string;
}

/**
 * Mapping of Specwright issue status to Linear status
 */
export type LinearIssueStatusMapping = {
  pending: string;       // Typically "Todo" or "Backlog"
  'in-review': string;   // Typically "In Review"
  approved: string;      // Typically "Done"
};

/**
 * Extended settings interface with Linear config
 */
export interface SettingsWithLinear {
  aiTool: string;
  git: {
    enabled: boolean;
    strategy: string;
  };
  costEstimation: {
    enabled: boolean;
    tier: string;
  };
  linear?: LinearConfig;
}
