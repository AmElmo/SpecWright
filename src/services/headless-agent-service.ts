/**
 * Headless Agent Service
 *
 * Executes prompts via headless CLI for Claude Code and Cursor.
 * Falls back to keyboard automation when headless is not available.
 *
 * IMPORTANT: This service only changes HOW prompts are injected.
 * The AI still writes to files, and file watching still detects completion.
 */

import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';
import type { AITool } from './settings-service.js';

export interface HeadlessOptions {
    workingDir?: string;
    allowedTools?: string[];
    timeout?: number; // ms, default 5 minutes
    onProgress?: (message: string) => void; // Callback for streaming progress
}

export interface HeadlessResult {
    success: boolean;
    error?: string;
}

/**
 * Parse streaming JSON output from Claude CLI
 * Returns a human-readable status message for display
 */
function parseStreamMessage(line: string): string | null {
    try {
        const json = JSON.parse(line);

        // Log the message type for debugging
        logger.debug(chalk.dim(`  [Stream] type=${json.type}, subtype=${json.subtype || 'none'}`));

        // Handle system init message
        if (json.type === 'system' && json.subtype === 'init') {
            return `ℹ️ Claude initialized (model: ${json.model || 'unknown'})`;
        }

        // Handle assistant messages with content
        if (json.type === 'assistant' && json.message?.content) {
            const content = json.message.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    if (block.type === 'tool_use') {
                        const toolName = block.name || 'unknown';
                        // Provide friendly descriptions of tool usage
                        switch (toolName) {
                            case 'Read':
                                return `📖 Reading file...`;
                            case 'Edit':
                                return `✏️ Editing file...`;
                            case 'Write':
                                return `📝 Writing file...`;
                            case 'Bash':
                                return `💻 Running command...`;
                            case 'Glob':
                                return `🔍 Searching files...`;
                            case 'Grep':
                                return `🔎 Searching content...`;
                            default:
                                return `🔧 Using ${toolName}...`;
                        }
                    }
                    if (block.type === 'text' && block.text) {
                        const text = block.text.trim();
                        if (text.length > 0) {
                            return `💭 ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`;
                        }
                    }
                }
            }
        }

        // Handle result message
        if (json.type === 'result') {
            const duration = json.duration_ms ? ` (${(json.duration_ms / 1000).toFixed(1)}s)` : '';
            return json.subtype === 'success'
                ? `✅ Task completed${duration}`
                : `⚠️ ${json.subtype || 'Unknown result'}${duration}`;
        }

        // Handle other system messages
        if (json.type === 'system' && json.message) {
            return `ℹ️ ${json.message}`;
        }

        return null;
    } catch {
        // Not valid JSON, might be plain text output
        if (line.trim()) {
            return line.trim().substring(0, 100);
        }
        return null;
    }
}

/**
 * Execute a prompt using Claude Code CLI in headless mode
 *
 * The CLI runs with -p flag for non-interactive execution.
 * We use --allowedTools to auto-approve Read, Edit, and Bash operations.
 * Uses --output-format stream-json for real-time progress feedback.
 */
export async function executeClaudeHeadless(
    prompt: string,
    options: HeadlessOptions = {}
): Promise<HeadlessResult> {
    const {
        workingDir,
        allowedTools = ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
        timeout = 5 * 60 * 1000, // 5 minutes default
        onProgress
    } = options;

    logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
    logger.debug(chalk.magenta('🚀 STARTING Claude Code HEADLESS execution'));
    logger.debug(chalk.cyan('📋 Prompt length:'), prompt.length, 'characters');
    logger.debug(chalk.cyan('📁 Working directory:'), workingDir || process.cwd());
    logger.debug(chalk.cyan('🔧 Allowed tools:'), allowedTools.join(', '));
    logger.debug(chalk.cyan('📡 Streaming:'), 'enabled (stream-json)');
    logger.debug(chalk.magenta('═'.repeat(60)));

    return new Promise((resolve) => {
        const args = [
            '-p', prompt,
            '--allowedTools', allowedTools.join(','),
            '--output-format', 'stream-json',
            '--verbose'  // Required for stream-json to work
        ];

        logger.debug(chalk.yellow('\n[Headless] Spawning claude CLI with streaming...'));
        logger.debug(chalk.dim(`  → claude ${args.map(a => a.length > 50 ? a.substring(0, 50) + '...' : a).join(' ')}`));

        console.log('[DEBUG] About to spawn claude process...');
        const proc = spawn('claude', args, {
            cwd: workingDir || process.cwd(),
            env: process.env,
            // Use 'inherit' for stdin - Claude CLI needs a real stdin connection to start
            // Use 'pipe' for stdout/stderr so we can capture the output
            stdio: ['inherit', 'pipe', 'pipe']
        });

        console.log(`[DEBUG] spawn() returned, PID: ${proc.pid}`);
        logger.debug(chalk.green(`  [Process] spawn() returned, PID: ${proc.pid}`));

        let stderr = '';
        let buffer = '';
        let lastStatus = '';

        console.log('[DEBUG] Setting up stdout handler...');
        proc.stdout.on('data', (data) => {
            console.log('[DEBUG] stdout data received!');
            const chunk = data.toString();
            buffer += chunk;

            // Log raw data received (truncated)
            console.log(`[DEBUG] Raw stdout: ${chunk.substring(0, 100)}`);
            logger.debug(chalk.dim(`  [Raw stdout] ${chunk.length} bytes: ${chunk.substring(0, 100)}...`));

            // Process complete lines (stream-json outputs one JSON object per line)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            logger.debug(chalk.dim(`  [Lines] Processing ${lines.length} complete lines, ${buffer.length} bytes buffered`));

            for (const line of lines) {
                if (!line.trim()) continue;

                const status = parseStreamMessage(line);
                if (status && status !== lastStatus) {
                    lastStatus = status;
                    logger.debug(chalk.cyan(`  [Claude] ${status}`));

                    // Call progress callback if provided
                    if (onProgress) {
                        onProgress(status);
                    }
                }
            }
        });

        proc.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            logger.debug(chalk.yellow(`  [Raw stderr] ${chunk.length} bytes: ${chunk.substring(0, 200)}`));
        });

        // Log when process spawns successfully
        proc.on('spawn', () => {
            logger.debug(chalk.green('  [Process] Claude CLI process spawned successfully, PID:'), proc.pid);
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
            logger.debug(chalk.yellow('⚠️ Headless execution timed out, killing process...'));
            proc.kill('SIGTERM');
            resolve({
                success: false,
                error: `Headless execution timed out after ${timeout / 1000}s`
            });
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timeoutId);

            if (code === 0) {
                logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
                logger.debug(chalk.green('✅ Claude Code headless execution COMPLETED'));
                logger.debug(chalk.magenta('═'.repeat(60) + '\n'));

                if (onProgress) {
                    onProgress('✅ Claude Code completed');
                }
                resolve({ success: true });
            } else {
                logger.debug(chalk.red(`\n❌ Claude CLI exited with code ${code}`));
                if (stderr) {
                    logger.debug(chalk.red('stderr:'), stderr.substring(0, 500));
                }

                if (onProgress) {
                    onProgress(`❌ Failed (exit code ${code})`);
                }
                resolve({
                    success: false,
                    error: `Claude CLI exited with code ${code}: ${stderr.substring(0, 200)}`
                });
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            logger.debug(chalk.red('❌ Failed to spawn Claude CLI:'), err.message);

            if (onProgress) {
                onProgress(`❌ Failed: ${err.message}`);
            }
            resolve({
                success: false,
                error: `Failed to spawn Claude CLI: ${err.message}`
            });
        });
    });
}

/**
 * Execute a prompt using Cursor CLI in headless mode
 *
 * Requires CURSOR_API_KEY environment variable to be set.
 */
export async function executeCursorHeadless(
    prompt: string,
    options: HeadlessOptions = {}
): Promise<HeadlessResult> {
    const {
        workingDir,
        timeout = 5 * 60 * 1000 // 5 minutes default
    } = options;

    // Verify API key is available
    if (!process.env.CURSOR_API_KEY) {
        return {
            success: false,
            error: 'CURSOR_API_KEY environment variable not set'
        };
    }

    logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
    logger.debug(chalk.magenta('🚀 STARTING Cursor HEADLESS execution'));
    logger.debug(chalk.cyan('📋 Prompt length:'), prompt.length, 'characters');
    logger.debug(chalk.cyan('📁 Working directory:'), workingDir || process.cwd());
    logger.debug(chalk.magenta('═'.repeat(60)));

    return new Promise((resolve) => {
        const args = ['-p', prompt];

        logger.debug(chalk.yellow('\n[Headless] Spawning cursor-agent CLI...'));

        const proc = spawn('cursor-agent', args, {
            cwd: workingDir || process.cwd(),
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            if (text.trim()) {
                logger.debug(chalk.dim(`  [Cursor] ${text.trim().substring(0, 100)}`));
            }
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timeoutId = setTimeout(() => {
            logger.debug(chalk.yellow('⚠️ Headless execution timed out, killing process...'));
            proc.kill('SIGTERM');
            resolve({
                success: false,
                error: `Headless execution timed out after ${timeout / 1000}s`
            });
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timeoutId);

            if (code === 0) {
                logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
                logger.debug(chalk.green('✅ Cursor headless execution COMPLETED'));
                logger.debug(chalk.magenta('═'.repeat(60) + '\n'));
                resolve({ success: true });
            } else {
                logger.debug(chalk.red(`\n❌ Cursor CLI exited with code ${code}`));
                if (stderr) {
                    logger.debug(chalk.red('stderr:'), stderr.substring(0, 500));
                }
                resolve({
                    success: false,
                    error: `Cursor CLI exited with code ${code}: ${stderr.substring(0, 200)}`
                });
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            logger.debug(chalk.red('❌ Failed to spawn Cursor CLI:'), err.message);
            resolve({
                success: false,
                error: `Failed to spawn Cursor CLI: ${err.message}`
            });
        });
    });
}

/**
 * Execute a prompt using headless mode for the specified tool
 * Returns null if headless is not supported/available for the tool
 */
export async function executeHeadless(
    tool: AITool,
    prompt: string,
    options: HeadlessOptions = {}
): Promise<HeadlessResult | null> {
    switch (tool) {
        case 'claude-code':
            return executeClaudeHeadless(prompt, options);
        case 'cursor':
            return executeCursorHeadless(prompt, options);
        case 'windsurf':
        case 'github-copilot':
            // These tools don't support headless mode
            return null;
        default:
            return null;
    }
}
