import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

export type AITool = 'cursor' | 'windsurf' | 'github-copilot' | 'claude-code' | 'codex' | 'gemini';

export interface AIToolPreferences {
  tool: AITool;
}

export const AI_TOOL_ORDER: AITool[] = ['cursor', 'claude-code', 'codex', 'gemini', 'github-copilot', 'windsurf'];

export const AI_TOOL_NAMES: Record<AITool, string> = {
  'cursor': 'Cursor',
  'claude-code': 'Claude Code',
  'codex': 'Codex CLI',
  'gemini': 'Gemini CLI',
  'github-copilot': 'GitHub Copilot',
  'windsurf': 'Windsurf'
};

let cachedAITool: AITool | null = null;
let hasLoadedCachedAITool = false;
let pendingAIToolRequest: Promise<AITool | null> | null = null;

export function invalidateAIToolPreferenceCache(): void {
  cachedAITool = null;
  hasLoadedCachedAITool = false;
  pendingAIToolRequest = null;
}

async function fetchCurrentAIToolPreference(): Promise<AITool | null> {
  if (hasLoadedCachedAITool) {
    return cachedAITool;
  }

  if (pendingAIToolRequest) {
    return pendingAIToolRequest;
  }

  pendingAIToolRequest = (async () => {
    try {
      const response = await fetch('/api/settings/ai-tool');
      if (response.ok) {
        const data: AIToolPreferences = await response.json();
        cachedAITool = data.tool;
      }
    } catch (error) {
      logger.error('Failed to fetch AI tool preference:', error);
    } finally {
      hasLoadedCachedAITool = true;
      pendingAIToolRequest = null;
    }

    return cachedAITool;
  })();

  return pendingAIToolRequest;
}

export function getAIToolNameById(tool?: AITool | null): string {
  if (!tool) return 'your AI tool';
  return AI_TOOL_NAMES[tool] || 'your AI tool';
}

/**
 * Hook to get the current AI tool name from settings
 * Returns 'your AI tool' as a fallback while loading or on error
 */
export function useAIToolName(): string {
  const [toolName, setToolName] = useState<string>(getAIToolNameById(hasLoadedCachedAITool ? cachedAITool : null));

  useEffect(() => {
    const fetchAITool = async () => {
      const tool = await fetchCurrentAIToolPreference();
      setToolName(getAIToolNameById(tool));
    };

    fetchAITool();
  }, []);

  return toolName;
}

/**
 * Hook to get the current AI tool id and display name
 */
export function useAIToolPreference(): { tool: AITool | null; toolName: string } {
  const [tool, setTool] = useState<AITool | null>(hasLoadedCachedAITool ? cachedAITool : null);

  useEffect(() => {
    const fetchAITool = async () => {
      const currentTool = await fetchCurrentAIToolPreference();
      setTool(currentTool);
    };

    fetchAITool();
  }, []);

  return {
    tool,
    toolName: getAIToolNameById(tool)
  };
}

/**
 * Synchronous function to get AI tool name - useful for non-React contexts
 * Returns a promise that resolves to the tool name
 */
export async function getAIToolName(): Promise<string> {
  const tool = await fetchCurrentAIToolPreference();
  return getAIToolNameById(tool);
}
