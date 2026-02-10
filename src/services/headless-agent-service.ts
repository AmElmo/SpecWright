/**
 * Headless Agent Service
 *
 * Executes prompts via headless CLI for Claude Code, Cursor, Codex, and Gemini.
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
    onSessionId?: (sessionId: string) => void; // Callback when session ID is captured (early)
    resumeSessionId?: string; // Session ID to resume (for refinement/continuation)
}

export interface HeadlessResult {
    success: boolean;
    error?: string;
    sessionId?: string; // Claude CLI session ID for --resume support
}

/**
 * Parsed result from a stream message
 */
interface ParsedStreamMessage {
    status: string | null;
    sessionId?: string;
}

/**
 * Parse streaming JSON output from Claude CLI
 * Returns a human-readable status message and optionally extracts session ID
 */
function parseClaudeStreamMessage(line: string): ParsedStreamMessage {
    try {
        const json = JSON.parse(line);

        // Log the message type for debugging
        logger.debug(chalk.dim(`  [Stream] type=${json.type}, subtype=${json.subtype || 'none'}`));

        // Extract session ID if present (appears in user/assistant messages)
        // Claude CLI uses snake_case: session_id
        const sessionId = json.session_id;

        // Handle system init message
        if (json.type === 'system' && json.subtype === 'init') {
            return { status: `ℹ️ Claude initialized (model: ${json.model || 'unknown'})`, sessionId };
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
                                return { status: `📖 Reading file...`, sessionId };
                            case 'Edit':
                                return { status: `✏️ Editing file...`, sessionId };
                            case 'Write':
                                return { status: `📝 Writing file...`, sessionId };
                            case 'Bash':
                                return { status: `💻 Running command...`, sessionId };
                            case 'Glob':
                                return { status: `🔍 Searching files...`, sessionId };
                            case 'Grep':
                                return { status: `🔎 Searching content...`, sessionId };
                            default:
                                return { status: `🔧 Using ${toolName}...`, sessionId };
                        }
                    }
                    if (block.type === 'text' && block.text) {
                        const text = block.text.trim();
                        if (text.length > 0) {
                            return { status: `💭 ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`, sessionId };
                        }
                    }
                }
            }
        }

        // Handle result message
        if (json.type === 'result') {
            const duration = json.duration_ms ? ` (${(json.duration_ms / 1000).toFixed(1)}s)` : '';
            const status = json.subtype === 'success'
                ? `✅ Task completed${duration}`
                : `⚠️ ${json.subtype || 'Unknown result'}${duration}`;
            return { status, sessionId };
        }

        // Handle other system messages
        if (json.type === 'system' && json.message) {
            return { status: `ℹ️ ${json.message}`, sessionId };
        }

        return { status: null, sessionId };
    } catch {
        // Not valid JSON, might be plain text output
        if (line.trim()) {
            return { status: line.trim().substring(0, 100) };
        }
        return { status: null };
    }
}

/**
 * Parse generic JSON stream events from third-party CLIs.
 */
function parseGenericJsonStatus(json: any): string | null {
    const type = typeof json?.type === 'string' ? json.type : '';
    const subtype = typeof json?.subtype === 'string' ? json.subtype : '';

    if (type === 'error') {
        const message = json?.error?.message || json?.message || 'Execution failed';
        return `❌ ${String(message).substring(0, 120)}`;
    }

    if (type === 'result') {
        return json?.subtype === 'success' ? '✅ Task completed' : `⚠️ ${subtype || 'Task update'}`;
    }

    const textCandidates = [
        json?.status,
        json?.message,
        json?.delta,
        json?.content,
        json?.text,
        json?.output_text
    ];

    for (const candidate of textCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return `💭 ${candidate.trim().substring(0, 100)}`;
        }
    }

    if (type) {
        return `ℹ️ ${type}${subtype ? ` (${subtype})` : ''}`;
    }

    return null;
}

function parseGenericStreamMessage(line: string): string | null {
    try {
        return parseGenericJsonStatus(JSON.parse(line));
    } catch {
        const trimmed = line.trim();
        return trimmed ? trimmed.substring(0, 100) : null;
    }
}

function getFirstString(values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

function mapCodexToolAction(item: any): string | null {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const action = getFirstString([
        item.type,
        item.kind,
        item.name,
        item.tool_name,
        item.toolName,
        item.action,
        item.op
    ]);

    if (!action) {
        return null;
    }

    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('read')) return '📖 Reading file...';
    if (lowerAction.includes('write') || lowerAction.includes('edit') || lowerAction.includes('patch')) return '✏️ Editing file...';
    if (lowerAction.includes('glob') || lowerAction.includes('grep') || lowerAction.includes('search') || lowerAction.includes('find')) return '🔍 Searching files...';
    if (lowerAction.includes('bash') || lowerAction.includes('shell') || lowerAction.includes('command') || lowerAction.includes('exec') || lowerAction.includes('run')) return '💻 Running command...';
    if (lowerAction.includes('think') || lowerAction.includes('reason') || lowerAction.includes('plan')) return '🧠 Analyzing task...';

    const trimmed = action.length > 50 ? `${action.substring(0, 50)}...` : action;
    return `🔧 Using ${trimmed}`;
}

/**
 * Parse JSON stream events from Codex CLI.
 * Codex emits low-level event types like "item.started"/"item.completed" that
 * are too raw for UI display, so we map them to user-friendly progress messages.
 */
function parseCodexJsonStatus(json: any): string | null {
    const type = typeof json?.type === 'string' ? json.type : '';
    const subtype = typeof json?.subtype === 'string' ? json.subtype : '';

    if (type === 'error' || type.endsWith('.error')) {
        const message = getFirstString([
            json?.error?.message,
            json?.message,
            json?.details?.message
        ]) || 'Execution failed';
        return `❌ ${message.substring(0, 120)}`;
    }

    if (type === 'result') {
        return subtype === 'success' ? '✅ Task completed' : `⚠️ ${subtype || 'Task update'}`;
    }

    if (type === 'item.started') {
        return mapCodexToolAction(json?.item) || '⚙️ Working on next step...';
    }

    if (type === 'item.completed') {
        return '✅ Step completed';
    }

    if (type === 'item.failed') {
        return '❌ Step failed';
    }

    const textCandidates = [
        json?.status,
        json?.message,
        json?.delta,
        json?.content,
        json?.text,
        json?.output_text
    ];

    for (const candidate of textCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return `💭 ${candidate.trim().substring(0, 100)}`;
        }
    }

    return null;
}

function parseCodexStreamMessage(line: string): string | null {
    try {
        return parseCodexJsonStatus(JSON.parse(line));
    } catch {
        const trimmed = line.trim();
        return trimmed ? trimmed.substring(0, 100) : null;
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
        onProgress,
        onSessionId,
        resumeSessionId
    } = options;

    const isResume = !!resumeSessionId;

    logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
    logger.debug(chalk.magenta(isResume ? '🔄 RESUMING Claude Code session' : '🚀 STARTING Claude Code HEADLESS execution'));
    if (isResume) {
        logger.debug(chalk.cyan('🔗 Session ID:'), resumeSessionId);
    }
    logger.debug(chalk.cyan('📋 Prompt length:'), prompt.length, 'characters');
    logger.debug(chalk.cyan('📁 Working directory:'), workingDir || process.cwd());
    logger.debug(chalk.cyan('🔧 Allowed tools:'), allowedTools.join(','));
    logger.debug(chalk.cyan('📡 Streaming:'), 'enabled (stream-json)');
    logger.debug(chalk.magenta('═'.repeat(60)));

    return new Promise((resolve) => {
        // Build args - use --resume if we have a session ID
        const args: string[] = [];

        if (isResume) {
            args.push('--resume', resumeSessionId as string);
        }

        args.push(
            '-p', prompt,
            '--allowedTools', allowedTools.join(','),
            '--output-format', 'stream-json',
            '--verbose'  // Required for stream-json to work
        );

        logger.debug(chalk.yellow('\n[Headless] Spawning claude CLI with streaming...'));

        const proc = spawn('claude', args, {
            cwd: workingDir || process.cwd(),
            env: process.env,
            // Use 'inherit' for stdin - Claude CLI needs a real stdin connection to start
            // Use 'pipe' for stdout/stderr so we can capture the output
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let stderr = '';
        let buffer = '';
        let lastStatus = '';
        let capturedSessionId: string | undefined;

        proc.stdout.on('data', (data) => {
            const chunk = data.toString();
            buffer += chunk;

            // Process complete lines (stream-json outputs one JSON object per line)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) continue;

                const parsed = parseClaudeStreamMessage(line);

                // Capture session ID if we haven't yet - broadcast immediately.
                if (parsed.sessionId && !capturedSessionId) {
                    capturedSessionId = parsed.sessionId;
                    if (onSessionId) {
                        onSessionId(capturedSessionId);
                    }
                }

                if (parsed.status && parsed.status !== lastStatus) {
                    lastStatus = parsed.status;
                    logger.debug(chalk.cyan(`  [Claude] ${parsed.status}`));

                    if (onProgress) {
                        onProgress(parsed.status);
                    }
                }
            }
        });

        proc.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            logger.debug(chalk.yellow(`  [Raw stderr] ${chunk.length} bytes: ${chunk.substring(0, 200)}`));
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
                if (capturedSessionId) {
                    logger.debug(chalk.green('📌 Session ID:'), capturedSessionId);
                }
                logger.debug(chalk.magenta('═'.repeat(60) + '\n'));

                if (onProgress) {
                    onProgress('✅ Claude Code completed');
                }
                resolve({ success: true, sessionId: capturedSessionId });
            } else {
                logger.debug(chalk.red(`\n❌ Claude CLI exited with code ${code}`));

                if (onProgress) {
                    onProgress(`❌ Failed (exit code ${code})`);
                }
                resolve({
                    success: false,
                    error: `Claude CLI exited with code ${code}: ${stderr.substring(0, 200)}`,
                    sessionId: capturedSessionId
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

        let stderr = '';

        proc.stdout.on('data', (data) => {
            const text = data.toString().trim();
            if (text) {
                logger.debug(chalk.dim(`  [Cursor] ${text.substring(0, 100)}`));
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
 * Execute a prompt using Codex CLI in headless mode.
 * Uses JSON event streaming for live progress updates.
 */
export async function executeCodexHeadless(
    prompt: string,
    options: HeadlessOptions = {}
): Promise<HeadlessResult> {
    const {
        workingDir,
        timeout = 5 * 60 * 1000,
        onProgress
    } = options;

    logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
    logger.debug(chalk.magenta('🚀 STARTING Codex HEADLESS execution'));
    logger.debug(chalk.cyan('📋 Prompt length:'), prompt.length, 'characters');
    logger.debug(chalk.cyan('📁 Working directory:'), workingDir || process.cwd());
    logger.debug(chalk.magenta('═'.repeat(60)));

    return new Promise((resolve) => {
        const args = ['exec', '--json', '--full-auto', prompt];

        logger.debug(chalk.yellow('\n[Headless] Spawning codex CLI...'));

        const proc = spawn('codex', args, {
            cwd: workingDir || process.cwd(),
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stderr = '';
        let buffer = '';
        let lastStatus = '';

        proc.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                const status = parseCodexStreamMessage(line);
                if (status && status !== lastStatus) {
                    lastStatus = status;
                    logger.debug(chalk.cyan(`  [Codex] ${status}`));
                    onProgress?.(status);
                }
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
                logger.debug(chalk.green('✅ Codex headless execution COMPLETED'));
                logger.debug(chalk.magenta('═'.repeat(60) + '\n'));
                onProgress?.('✅ Codex completed');
                resolve({ success: true });
            } else {
                logger.debug(chalk.red(`\n❌ Codex CLI exited with code ${code}`));
                resolve({
                    success: false,
                    error: `Codex CLI exited with code ${code}: ${stderr.substring(0, 200)}`
                });
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            logger.debug(chalk.red('❌ Failed to spawn Codex CLI:'), err.message);
            resolve({
                success: false,
                error: `Failed to spawn Codex CLI: ${err.message}`
            });
        });
    });
}

/**
 * Execute a prompt using Gemini CLI in headless mode.
 * Uses stream-json output for live progress updates.
 */
export async function executeGeminiHeadless(
    prompt: string,
    options: HeadlessOptions = {}
): Promise<HeadlessResult> {
    const {
        workingDir,
        timeout = 5 * 60 * 1000,
        onProgress
    } = options;

    logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
    logger.debug(chalk.magenta('🚀 STARTING Gemini HEADLESS execution'));
    logger.debug(chalk.cyan('📋 Prompt length:'), prompt.length, 'characters');
    logger.debug(chalk.cyan('📁 Working directory:'), workingDir || process.cwd());
    logger.debug(chalk.magenta('═'.repeat(60)));

    return new Promise((resolve) => {
        const args = ['--output-format', 'stream-json', '--approval-mode', 'yolo', prompt];

        logger.debug(chalk.yellow('\n[Headless] Spawning gemini CLI...'));

        const proc = spawn('gemini', args, {
            cwd: workingDir || process.cwd(),
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stderr = '';
        let buffer = '';
        let lastStatus = '';

        proc.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                const status = parseGenericStreamMessage(line);
                if (status && status !== lastStatus) {
                    lastStatus = status;
                    logger.debug(chalk.cyan(`  [Gemini] ${status}`));
                    onProgress?.(status);
                }
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
                logger.debug(chalk.green('✅ Gemini headless execution COMPLETED'));
                logger.debug(chalk.magenta('═'.repeat(60) + '\n'));
                onProgress?.('✅ Gemini completed');
                resolve({ success: true });
            } else {
                logger.debug(chalk.red(`\n❌ Gemini CLI exited with code ${code}`));
                resolve({
                    success: false,
                    error: `Gemini CLI exited with code ${code}: ${stderr.substring(0, 200)}`
                });
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            logger.debug(chalk.red('❌ Failed to spawn Gemini CLI:'), err.message);
            resolve({
                success: false,
                error: `Failed to spawn Gemini CLI: ${err.message}`
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
        case 'codex':
            return executeCodexHeadless(prompt, options);
        case 'gemini':
            return executeGeminiHeadless(prompt, options);
        case 'windsurf':
        case 'github-copilot':
            // These tools don't support headless mode
            return null;
        default:
            return null;
    }
}
