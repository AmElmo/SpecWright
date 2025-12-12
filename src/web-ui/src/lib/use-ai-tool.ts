import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

export type AITool = 'cursor' | 'windsurf' | 'github-copilot' | 'claude-code';

export interface AIToolPreferences {
  tool: AITool;
}

export const AI_TOOL_NAMES: Record<AITool, string> = {
  'cursor': 'Cursor',
  'claude-code': 'Claude Code',
  'github-copilot': 'GitHub Copilot',
  'windsurf': 'Windsurf'
};

/**
 * Hook to get the current AI tool name from settings
 * Returns 'your AI tool' as a fallback while loading or on error
 */
export function useAIToolName(): string {
  const [toolName, setToolName] = useState<string>('your AI tool');

  useEffect(() => {
    const fetchAITool = async () => {
      try {
        const response = await fetch('/api/settings/ai-tool');
        if (response.ok) {
          const data: AIToolPreferences = await response.json();
          setToolName(AI_TOOL_NAMES[data.tool] || 'your AI tool');
        }
      } catch (error) {
        logger.error('Failed to fetch AI tool preference:', error);
      }
    };

    fetchAITool();
  }, []);

  return toolName;
}

/**
 * Synchronous function to get AI tool name - useful for non-React contexts
 * Returns a promise that resolves to the tool name
 */
export async function getAIToolName(): Promise<string> {
  try {
    const response = await fetch('/api/settings/ai-tool');
    if (response.ok) {
      const data: AIToolPreferences = await response.json();
      return AI_TOOL_NAMES[data.tool] || 'your AI tool';
    }
  } catch (error) {
    logger.error('Failed to fetch AI tool preference:', error);
  }
  return 'your AI tool';
}

