/**
 * Settings Service - Unified settings management for SpecWright
 * 
 * All user preferences are stored in a single settings.json file
 */

import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type AITool = 'cursor' | 'windsurf' | 'github-copilot' | 'claude-code';

export type GitStrategy = 'none' | 'branch-per-issue' | 'branch-per-project';

export type ModelTier = 'budget' | 'standard' | 'premium';

export interface CostEstimationSettings {
  enabled: boolean;
  tier: ModelTier;
}

export interface LinearSettings {
  apiKey?: string;
  defaultTeamId?: string;
  defaultTeamName?: string;
}

export interface Settings {
  aiTool: AITool;
  git: {
    enabled: boolean;
    strategy: GitStrategy;
  };
  costEstimation: CostEstimationSettings;
  linear?: LinearSettings;
}

// ============================================================================
// AI Tool Configurations (for keyboard automation)
// ============================================================================

export type AppType = 'standalone' | 'vscode-extension';

export interface AIToolConfig {
  id: AITool;
  name: string;
  appType: AppType;
  appName: string;           // Process name for detection
  cliCommand: string;        // CLI to open/activate
  
  macShortcuts: {
    openChat: string;        // AppleScript keystroke command
    focusChat?: string;      // Optional separate focus command
  };
  
  windowsShortcuts: {
    openChat: string;        // PowerShell SendKeys format
    focusChat?: string;
  };
  
  initWaitTime: number;      // ms to wait after opening chat
  requiresCommandPalette?: boolean;  // For VS Code extensions that need command palette
  commandPaletteCommand?: string;    // Command to type in palette
}

/**
 * Configuration for each supported AI coding tool
 */
export const AI_TOOL_CONFIGS: Record<AITool, AIToolConfig> = {
  
  'cursor': {
    id: 'cursor',
    name: 'Cursor',
    appType: 'standalone',
    appName: 'Cursor',
    cliCommand: 'cursor',
    macShortcuts: {
      openChat: 'keystroke "i" using {command down, shift down}',  // Cmd+Shift+I
      focusChat: 'keystroke "i" using command down'                 // Cmd+I
    },
    windowsShortcuts: {
      openChat: '^+i',   // Ctrl+Shift+I
      focusChat: '^i'    // Ctrl+I
    },
    initWaitTime: 400
  },
  
  'windsurf': {
    id: 'windsurf',
    name: 'Windsurf',
    appType: 'standalone',
    appName: 'Windsurf',
    cliCommand: 'windsurf',
    macShortcuts: {
      openChat: 'keystroke "l" using {command down, shift down}',  // Cmd+Shift+L
      focusChat: 'keystroke "l" using {command down, shift down}'  // Same toggle
    },
    windowsShortcuts: {
      openChat: '^+l',   // Ctrl+Shift+L
      focusChat: '^+l'
    },
    initWaitTime: 400
  },
  
  'github-copilot': {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    appType: 'vscode-extension',
    appName: 'Code',
    cliCommand: 'code',
    macShortcuts: {
      openChat: 'keystroke "i" using {command down, shift down}',  // Cmd+Shift+I
    },
    windowsShortcuts: {
      openChat: '^+i',   // Ctrl+Shift+I
    },
    initWaitTime: 400
  },
  
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    appType: 'vscode-extension',
    appName: 'Code',
    cliCommand: 'code',
    macShortcuts: {
      openChat: 'keystroke "p" using {command down, shift down}',  // Opens command palette
    },
    windowsShortcuts: {
      openChat: '^+p',   // Opens command palette
    },
    initWaitTime: 500,  // Wait for command palette flow
    requiresCommandPalette: true,
    commandPaletteCommand: 'Claude Code: Open in New Tab'
  }
  
};

// ============================================================================
// Settings File Management
// ============================================================================

const SETTINGS_FILE = path.join(OUTPUT_DIR, 'settings.json');

/**
 * Get default settings
 */
export function getDefaultSettings(): Settings {
  return {
    aiTool: 'cursor',
    git: {
      enabled: false,
      strategy: 'none'
    },
    costEstimation: {
      enabled: true,  // Enabled by default
      tier: 'standard'
    },
    linear: undefined  // Not configured by default
  };
}

/**
 * Load settings from file
 */
export function loadSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const saved = JSON.parse(content);
      // Merge with defaults to handle any missing fields
      return {
        ...getDefaultSettings(),
        ...saved,
        git: {
          ...getDefaultSettings().git,
          ...saved.git
        },
        costEstimation: {
          ...getDefaultSettings().costEstimation,
          ...saved.costEstimation
        },
        linear: saved.linear  // Optional, may be undefined
      };
    }
  } catch (error) {
    logger.error('Error loading settings:', error);
  }

  return getDefaultSettings();
}

/**
 * Save settings to file
 */
export function saveSettings(settings: Settings): void {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    logger.error('Error saving settings:', error);
    throw error;
  }
}

/**
 * Update specific settings (partial update)
 */
export function updateSettings(updates: Partial<Settings>): Settings {
  const current = loadSettings();
  const updated: Settings = {
    ...current,
    ...updates,
    git: {
      ...current.git,
      ...(updates.git || {})
    },
    costEstimation: {
      ...current.costEstimation,
      ...(updates.costEstimation || {})
    },
    linear: updates.linear !== undefined
      ? (updates.linear === null ? undefined : { ...current.linear, ...updates.linear })
      : current.linear
  };
  saveSettings(updated);
  return updated;
}

// ============================================================================
// AI Tool Helpers
// ============================================================================

/**
 * Get the configuration for a specific AI tool
 */
export function getAIToolConfig(tool: AITool): AIToolConfig {
  return AI_TOOL_CONFIGS[tool];
}

/**
 * Get all available AI tool configurations
 */
export function getAllAIToolConfigs(): AIToolConfig[] {
  return Object.values(AI_TOOL_CONFIGS);
}

/**
 * Check if a tool ID is valid
 */
export function isValidAITool(tool: string): tool is AITool {
  return tool in AI_TOOL_CONFIGS;
}

/**
 * Get current AI tool from settings
 */
export function getCurrentAITool(): AITool {
  return loadSettings().aiTool;
}

/**
 * Get current AI tool config from settings
 */
export function getCurrentAIToolConfig(): AIToolConfig {
  return getAIToolConfig(getCurrentAITool());
}

// ============================================================================
// Git Preferences Helpers (backward compatibility)
// ============================================================================

export interface GitPreferences {
  enabled: boolean;
  strategy: GitStrategy;
}

/**
 * Load git preferences (for backward compatibility)
 */
export function loadGitPreferences(): GitPreferences {
  const settings = loadSettings();
  return settings.git;
}

/**
 * Save git preferences (for backward compatibility)
 */
export function saveGitPreferences(preferences: GitPreferences): void {
  updateSettings({ git: preferences });
}

/**
 * Generate git instructions based on preferences
 */
export function generateGitInstructions(preferences: GitPreferences, projectId?: string, issueId?: string): string {
  if (!preferences.enabled || preferences.strategy === 'none') {
    return '';
  }

  let instructions = '\n\n## Git Workflow\n\n';

  if (preferences.strategy === 'branch-per-issue') {
    instructions += `**Branch Strategy**: Create one feature branch for this issue.\n\n`;
    
    if (issueId) {
      const branchName = issueId.toLowerCase().replace(/[^a-z0-9]/g, '-');
      instructions += `**Branch Name**: \`feature/${branchName}-<short-description>\`\n`;
      instructions += `Example: \`feature/${branchName}-add-authentication\`\n\n`;
    } else {
      instructions += `**Branch Name**: \`feature/ENG-XXX-<short-description>\`\n`;
      instructions += `Example: \`feature/eng-001-add-authentication\`\n\n`;
    }
    
    instructions += `**Commits**: Make multiple atomic commits for different sub-tasks within this issue.\n`;
    instructions += `Commit message format: \`${issueId || 'ENG-XXX'}: <description of change>\`\n\n`;
    instructions += `Example commits:\n`;
    instructions += `\`\`\`\n`;
    instructions += `${issueId || 'ENG-001'}: Add authentication form component\n`;
    instructions += `${issueId || 'ENG-001'}: Implement validation logic\n`;
    instructions += `${issueId || 'ENG-001'}: Add error handling and tests\n`;
    instructions += `\`\`\`\n\n`;
    instructions += `**Merging**: When complete, create a pull request to merge this branch into main/master.\n`;

  } else if (preferences.strategy === 'branch-per-project') {
    instructions += `**Branch Strategy**: This issue is part of a larger project. Use the project-level branch.\n\n`;
    
    if (projectId) {
      const branchName = projectId.toLowerCase().replace(/[^a-z0-9]/g, '-');
      instructions += `**Branch Name**: \`feature/${branchName}\`\n\n`;
    } else {
      instructions += `**Branch Name**: \`feature/<project-name>\`\n\n`;
    }
    
    instructions += `**Commits**: Make one commit for this entire issue when complete.\n`;
    instructions += `Commit message format: \`${issueId || 'ENG-XXX'}: <description of what this issue implements>\`\n\n`;
    instructions += `Example commit:\n`;
    instructions += `\`\`\`\n`;
    instructions += `${issueId || 'ENG-001'}: Add OAuth configuration and Google Sign-in button\n`;
    instructions += `\`\`\`\n\n`;
    instructions += `**Merging**: When all project issues are complete, create a pull request to merge the project branch into main/master.\n`;
  }

  return instructions;
}

