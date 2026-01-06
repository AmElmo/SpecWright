/**
 * CLI Detection Utility
 *
 * Detects whether headless CLI tools are available for AI coding agents.
 * Used to determine if we can use faster headless mode instead of keyboard automation.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';
import type { AITool } from '../services/settings-service.js';

const execAsync = promisify(exec);

/**
 * Check if a command exists on the system PATH
 */
export async function commandExists(command: string): Promise<boolean> {
    try {
        if (process.platform === 'win32') {
            await execAsync(`where ${command}`);
        } else {
            await execAsync(`which ${command}`);
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if Claude Code CLI is available for headless execution
 * Claude CLI uses existing authentication, so just checking for CLI is enough
 */
export async function canUseClaudeHeadless(): Promise<boolean> {
    const hasCLI = await commandExists('claude');
    if (hasCLI) {
        logger.debug('✅ Claude CLI detected - headless mode available');
    }
    return hasCLI;
}

/**
 * Check if Cursor CLI is available for headless execution
 * Cursor requires both the CLI and CURSOR_API_KEY environment variable
 */
export async function canUseCursorHeadless(): Promise<boolean> {
    const hasCLI = await commandExists('cursor-agent');
    const hasAPIKey = !!process.env.CURSOR_API_KEY;

    if (hasCLI && hasAPIKey) {
        logger.debug('✅ Cursor CLI + API key detected - headless mode available');
        return true;
    }

    if (hasCLI && !hasAPIKey) {
        logger.debug('⚠️ Cursor CLI detected but CURSOR_API_KEY not set - using keyboard automation');
    }

    return false;
}

/**
 * Check if headless mode is available for the specified AI tool
 */
export async function canUseHeadless(tool: AITool): Promise<boolean> {
    switch (tool) {
        case 'claude-code':
            return canUseClaudeHeadless();
        case 'cursor':
            return canUseCursorHeadless();
        case 'windsurf':
        case 'github-copilot':
            // These tools don't support headless mode
            return false;
        default:
            return false;
    }
}

/**
 * Get headless availability status for all tools (useful for UI display)
 */
export async function getHeadlessStatus(): Promise<Record<AITool, { available: boolean; reason?: string }>> {
    const claudeCLI = await commandExists('claude');
    const cursorCLI = await commandExists('cursor-agent');
    const cursorAPIKey = !!process.env.CURSOR_API_KEY;

    return {
        'claude-code': {
            available: claudeCLI,
            reason: claudeCLI ? undefined : 'Claude CLI not installed'
        },
        'cursor': {
            available: cursorCLI && cursorAPIKey,
            reason: !cursorCLI
                ? 'cursor-agent CLI not installed'
                : !cursorAPIKey
                    ? 'CURSOR_API_KEY environment variable not set'
                    : undefined
        },
        'windsurf': {
            available: false,
            reason: 'Windsurf does not support headless mode'
        },
        'github-copilot': {
            available: false,
            reason: 'GitHub Copilot does not support headless mode'
        }
    };
}
