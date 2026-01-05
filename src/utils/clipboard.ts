import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import {
    getCurrentAITool,
    getAIToolConfig,
    type AITool,
    type AIToolConfig
} from '../services/settings-service.js';
import { logger } from './logger.js';
import { canUseHeadless } from './cli-detection.js';
import { executeHeadless } from '../services/headless-agent-service.js';
import { broadcastHeadlessProgress, broadcastHeadlessStarted, broadcastHeadlessCompleted } from '../services/websocket-service.js';

const execAsync = promisify(exec);

/**
 * Get the currently active application (macOS only)
 */
const getActiveApplication = async (): Promise<string | null> => {
    try {
        const { stdout } = await execAsync(
            `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
        );
        return stdout.trim();
    } catch {
        return null;
    }
};

/**
 * Copy text to system clipboard (cross-platform)
 */
export const copyToClipboard = async (text: string): Promise<void> => {
    try {
        if (process.platform === 'darwin') {
            await execAsync(`echo ${JSON.stringify(text)} | pbcopy`);
        } else if (process.platform === 'linux') {
            try {
                await execAsync(`echo ${JSON.stringify(text)} | xclip -selection clipboard`);
            } catch {
                // Fallback to wl-copy for Wayland
                await execAsync(`echo ${JSON.stringify(text)} | wl-copy`);
            }
        } else if (process.platform === 'win32') {
            await execAsync(`echo ${JSON.stringify(text)} | clip.exe`);
        } else {
            logger.debug(chalk.yellow('⚠️  Clipboard copy only supported on macOS, Linux, and Windows'));
        }
    } catch (error) {
        logger.error(chalk.red('Failed to copy to clipboard:'), error);
        throw error;
    }
};

/**
 * Monitor for when user switches to an AI tool and auto-paste immediately
 */
export const startAIToolFocusMonitoring = (toolConfig?: AIToolConfig): void => {
    const config = toolConfig || getAIToolConfig(getCurrentAITool());
    let hasPasted = false;
    
    const monitor = setInterval(async () => {
        try {
            const activeApp = await getActiveApplication();
            
            if (activeApp && activeApp.includes(config.appName) && !hasPasted) {
                logger.debug(chalk.green(`🎯 ${config.name} detected! Opening new chat...`));
                hasPasted = true;
                
                try {
                    // First, ensure we're in the app's main window (not in an existing chat input)
                    // by pressing Escape to dismiss any focused input
                    await execAsync(`osascript -e 'tell application "System Events" to key code 53'`); // Escape key
                    
                    // Brief pause to let escape register
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    // Open new chat using the tool's shortcut
                    await execAsync(`osascript -e 'tell application "System Events" to ${config.macShortcuts.openChat}'`);
                    
                    // Handle command palette flow for VS Code extensions that need it
                    if (config.requiresCommandPalette && config.commandPaletteCommand) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                        await execAsync(`osascript -e 'tell application "System Events" to keystroke "${config.commandPaletteCommand}"'`);
                        await execAsync(`osascript -e 'tell application "System Events" to key code 36'`); // Enter
                    }
                    
                    // Wait for chat to open
                    await new Promise(resolve => setTimeout(resolve, config.initWaitTime));
                    
                    // Paste the prompt with Cmd+V
                    await execAsync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
                    
                    logger.debug(chalk.green(`✨ Opened new chat and pasted in ${config.name}! Return to terminal when done.`));
                    clearInterval(monitor);
                } catch (error) {
                    logger.debug(chalk.yellow(`⚠️  Auto-paste failed - please open new chat and paste (Cmd+V)`));
                    clearInterval(monitor);
                }
            }
        } catch (error) {
            // Silently continue monitoring
        }
    }, 500); // Check every 500ms
    
    // Set a timeout to stop monitoring after 2 minutes
    setTimeout(() => {
        clearInterval(monitor);
    }, 120000);
};

// Backward compatibility alias
export const startCursorFocusMonitoring = (): void => {
    startAIToolFocusMonitoring(getAIToolConfig('cursor'));
};

/**
 * Open AI coding tool and paste text into a new chat
 * This is the main automation function used by the web UI
 *
 * HEADLESS MODE: If the tool supports headless execution (Claude Code, Cursor)
 * and the CLI is available, we use headless mode for faster, more reliable execution.
 * Otherwise, we fall back to keyboard automation.
 */
export const openAIToolAndPaste = async (text: string, workspacePath?: string, tool?: AITool): Promise<boolean> => {
    // Get the tool config - either from parameter or from saved settings
    const selectedTool = tool || getCurrentAITool();
    const config = getAIToolConfig(selectedTool);

    // Try headless mode first if available
    try {
        const headlessAvailable = await canUseHeadless(selectedTool);

        if (headlessAvailable) {
            logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
            logger.debug(chalk.magenta(`🚀 HEADLESS MODE available for ${config.name}`));
            logger.debug(chalk.cyan('📋 Using CLI instead of keyboard automation'));
            logger.debug(chalk.magenta('═'.repeat(60)));

            // Broadcast that headless execution is starting
            broadcastHeadlessStarted(config.name);

            const result = await executeHeadless(selectedTool, text, {
                workingDir: workspacePath,
                onProgress: (status: string) => {
                    // Broadcast progress to WebSocket clients
                    broadcastHeadlessProgress(status);
                }
            });

            if (result && result.success) {
                logger.debug(chalk.green(`✅ Headless execution completed successfully for ${config.name}`));
                broadcastHeadlessCompleted(config.name, true);
                return true;
            }

            // Headless failed, fall through to keyboard automation
            if (result && result.error) {
                logger.debug(chalk.yellow(`⚠️ Headless execution failed: ${result.error}`));
                logger.debug(chalk.yellow('Falling back to keyboard automation...'));
                broadcastHeadlessCompleted(config.name, false);
            }
        }
    } catch (headlessError) {
        logger.debug(chalk.yellow('⚠️ Error checking headless availability, using keyboard automation'));
        logger.debug(chalk.dim(String(headlessError)));
    }

    // Keyboard automation fallback
    try {
        logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
        logger.debug(chalk.magenta(`🚀 STARTING openAIToolAndPaste() for ${config.name} (keyboard automation)`));
        logger.debug(chalk.cyan('📋 Text length:'), text.length, 'characters');
        logger.debug(chalk.cyan('📁 Workspace path:'), workspacePath || 'none');
        logger.debug(chalk.cyan('💻 Platform:'), process.platform);
        logger.debug(chalk.cyan('🤖 AI Tool:'), config.name);
        logger.debug(chalk.magenta('═'.repeat(60)));
        
        // 1. Copy to clipboard (cross-platform)
        logger.debug(chalk.yellow('\n[Step 1] Copying to clipboard...'));
        if (process.platform === 'darwin') {
            await execAsync(`echo ${JSON.stringify(text)} | pbcopy`);
            logger.debug(chalk.green('✅ Copied to macOS clipboard (pbcopy)'));
        } else if (process.platform === 'linux') {
            try {
                await execAsync(`echo ${JSON.stringify(text)} | xclip -selection clipboard`);
                logger.debug(chalk.green('✅ Copied to Linux clipboard (xclip)'));
            } catch {
                await execAsync(`echo ${JSON.stringify(text)} | wl-copy`);
                logger.debug(chalk.green('✅ Copied to Linux clipboard (wl-copy)'));
            }
        } else if (process.platform === 'win32') {
            await execAsync(`echo ${JSON.stringify(text)} | clip.exe`);
            logger.debug(chalk.green('✅ Copied to Windows clipboard'));
        }
        
        logger.debug(chalk.cyan(`\n🚀 Opening ${config.name} and creating new chat...`));
        
        // 2. First, defocus from any browser page content with Cmd/Ctrl+L (universal)
        // This works in both regular browsers and integrated browsers
        logger.debug(chalk.yellow('\n[Step 2] Defocusing from browser page content...'));
        if (process.platform === 'darwin') {
            logger.debug(chalk.dim('  → Sending Cmd+L to focus address bar...'));
            await execAsync(`osascript -e 'tell application "System Events" to keystroke "l" using command down'`);
            logger.debug(chalk.green('  ✅ Cmd+L sent (address bar focused)'));
        } else if (process.platform === 'win32') {
            logger.debug(chalk.dim('  → Sending Ctrl+L to focus address bar...'));
            await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^l')"`);
            logger.debug(chalk.green('  ✅ Ctrl+L sent (address bar focused)'));
        }
        
        logger.debug(chalk.dim('  → Waiting 50ms...'));
        await new Promise(resolve => setTimeout(resolve, 50));
        logger.debug(chalk.green('  ✅ Wait complete'));
        
        // 3. Open/focus correct window using CLI (cross-platform)
        logger.debug(chalk.yellow(`\n[Step 3] Activating ${config.name} window...`));
        if (workspacePath) {
            try {
                logger.debug(chalk.dim(`  → Running: ${config.cliCommand} --reuse-window "${workspacePath}"`));
                await execAsync(`${config.cliCommand} --reuse-window "${workspacePath}"`, { timeout: 2000 });
                logger.debug(chalk.green(`  ✅ ${config.name} CLI command executed successfully`));
                
                logger.debug(chalk.dim('  → Waiting 400ms for window activation...'));
                await new Promise(resolve => setTimeout(resolve, 400));
                logger.debug(chalk.green('  ✅ Wait complete'));
            } catch (cliError) {
                logger.debug(chalk.yellow(`  ⚠️  ${config.name} CLI not available, using fallback...`));
                // Fallback: just activate the app generically
                if (process.platform === 'darwin') {
                    logger.debug(chalk.dim(`  → Running: osascript activate ${config.appName}`));
                    await execAsync(`osascript -e 'tell application "${config.appName}" to activate'`);
                    logger.debug(chalk.green(`  ✅ ${config.appName} activated via osascript`));
                    
                    logger.debug(chalk.dim('  → Waiting 300ms...'));
                    await new Promise(resolve => setTimeout(resolve, 300));
                    logger.debug(chalk.green('  ✅ Wait complete'));
                } else if (process.platform === 'win32') {
                    await execAsync(`powershell -Command "Start-Process ${config.cliCommand}"`).catch(() => {});
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } else {
            // No workspace path, use generic activation
            logger.debug(chalk.dim('  → No workspace path, using generic activation'));
            if (process.platform === 'darwin') {
                logger.debug(chalk.dim(`  → Running: osascript activate ${config.appName}`));
                await execAsync(`osascript -e 'tell application "${config.appName}" to activate'`);
                logger.debug(chalk.green(`  ✅ ${config.appName} activated via osascript`));
                
                logger.debug(chalk.dim('  → Waiting 300ms...'));
                await new Promise(resolve => setTimeout(resolve, 300));
                logger.debug(chalk.green('  ✅ Wait complete'));
            } else if (process.platform === 'win32') {
                await execAsync(`powershell -Command "Start-Process ${config.cliCommand}"`).catch(() => {});
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                logger.debug(chalk.yellow('⚠️  Auto-open only supported on macOS and Windows'));
                logger.debug(chalk.dim(`Please switch to ${config.name} and paste manually`));
                return false;
            }
        }
        
        // 4. Ensure we're not focused on any text input (like a chat)
        logger.debug(chalk.yellow('\n[Step 4] Ensuring focus is not in text input...'));
        if (process.platform === 'darwin') {
            logger.debug(chalk.dim('  → Sending Tab to defocus any text inputs...'));
            await execAsync(`osascript -e 'tell application "System Events" to key code 48'`); // Tab key (key code 48)
            logger.debug(chalk.green('  ✅ Tab sent'));
            
            logger.debug(chalk.dim('  → Waiting 50ms...'));
            await new Promise(resolve => setTimeout(resolve, 50));
            logger.debug(chalk.green('  ✅ Wait complete'));
        } else if (process.platform === 'win32') {
            logger.debug(chalk.dim('  → Sending Tab to defocus any text inputs...'));
            await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{TAB}')"`);
            logger.debug(chalk.green('  ✅ Tab sent'));
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 5. Keyboard automation (platform-specific)
        logger.debug(chalk.yellow('\n[Step 5] Sending keyboard shortcuts...'));
        if (process.platform === 'darwin') {
            // macOS: Use AppleScript
            logger.debug(chalk.dim(`  → Sending ${config.name} open chat shortcut...`));
            await execAsync(`osascript -e 'tell application "System Events" to ${config.macShortcuts.openChat}'`);
            logger.debug(chalk.green('  ✅ Open chat shortcut sent'));
            
            // Handle command palette flow for VS Code extensions that need it
            if (config.requiresCommandPalette && config.commandPaletteCommand) {
                logger.debug(chalk.dim(`  → Waiting 300ms for command palette...`));
                await new Promise(resolve => setTimeout(resolve, 300));
                logger.debug(chalk.dim(`  → Typing: ${config.commandPaletteCommand}...`));
                await execAsync(`osascript -e 'tell application "System Events" to keystroke "${config.commandPaletteCommand}"'`);
                await new Promise(resolve => setTimeout(resolve, 200));
                logger.debug(chalk.dim('  → Pressing Enter...'));
                await execAsync(`osascript -e 'tell application "System Events" to key code 36'`); // Enter
                logger.debug(chalk.green('  ✅ Command palette command executed'));
            }
            
            logger.debug(chalk.dim(`  → Waiting ${config.initWaitTime}ms for chat to open...`));
            await new Promise(resolve => setTimeout(resolve, config.initWaitTime));
            logger.debug(chalk.green('  ✅ Wait complete'));
            
            logger.debug(chalk.dim('  → Sending Cmd+V...'));
            await execAsync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`); // Cmd+V
            logger.debug(chalk.green('  ✅ Cmd+V sent'));
            
        } else if (process.platform === 'win32') {
            // Windows: Use PowerShell SendKeys
            let openChatKeys = config.windowsShortcuts.openChat;
            
            const ps = `
                Add-Type -AssemblyName System.Windows.Forms
                Start-Sleep -Milliseconds 100
                [System.Windows.Forms.SendKeys]::SendWait("${openChatKeys}")
                ${config.requiresCommandPalette && config.commandPaletteCommand ? `
                Start-Sleep -Milliseconds 300
                [System.Windows.Forms.SendKeys]::SendWait("${config.commandPaletteCommand}")
                Start-Sleep -Milliseconds 200
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                ` : ''}
                Start-Sleep -Milliseconds ${config.initWaitTime}
                [System.Windows.Forms.SendKeys]::SendWait("^v")
            `.trim();
            
            await execAsync(`powershell -Command "${ps.replace(/\n/g, '; ')}"`);
            
        } else {
            logger.debug(chalk.yellow(`📋 Prompt copied! Please paste manually into ${config.name}`));
            return false;
        }
        
        logger.debug(chalk.magenta('\n' + '═'.repeat(60)));
        logger.debug(chalk.green(`✨ COMPLETED: Prompt pasted in ${config.name}! Review and press Enter.`));
        logger.debug(chalk.magenta('═'.repeat(60) + '\n'));
        return true;
        
    } catch (error) {
        logger.debug(chalk.red('\n❌ ERROR in openAIToolAndPaste():'));
        logger.debug(chalk.red(error));
        logger.debug(chalk.dim('Prompt is in clipboard - please paste manually'));
        return false;
    }
};

/**
 * Open Cursor and paste text into a new chat
 * This is kept for backward compatibility - now uses the generic openAIToolAndPaste
 */
export const openCursorAndPaste = async (text: string, workspacePath?: string): Promise<boolean> => {
    return openAIToolAndPaste(text, workspacePath);
};

/**
 * Inject text into existing AI tool chat (doesn't open new chat, just pastes)
 */
export const injectIntoAIToolChat = async (text: string, tool?: AITool): Promise<void> => {
    const selectedTool = tool || getCurrentAITool();
    const config = getAIToolConfig(selectedTool);
    
    try {
        // Copy text to clipboard
        if (process.platform === 'darwin') {
            await execAsync(`echo "${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" | pbcopy`);
        } else if (process.platform === 'win32') {
            await execAsync(`echo "${text.replace(/"/g, '""')}" | clip.exe`);
        } else {
            logger.debug(chalk.yellow('⚠️  Clipboard injection only supported on macOS and Windows'));
            return;
        }
        
        logger.debug(chalk.cyan(`📋 Prompt copied to clipboard! Monitoring for ${config.name}...`));
        logger.debug(chalk.dim(`💡 Switch to ${config.name} to auto-paste`));
        logger.debug("");
        
        // Start monitoring for tool focus
        let hasPasted = false;
        
        const monitor = setInterval(async () => {
            try {
                const activeApp = await getActiveApplication();
                
                if (activeApp && activeApp.includes(config.appName) && !hasPasted) {
                    logger.debug(chalk.green(`🎯 ${config.name} detected! Injecting into existing chat...`));
                    hasPasted = true;
                    
                    try {
                        // First, ensure we're not in a focused file editor by pressing Escape
                        await execAsync(`osascript -e 'tell application "System Events" to key code 53'`); // Escape key
                        
                        // Brief pause to let escape register
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Use focus chat shortcut if available, otherwise use open chat
                        const focusShortcut = config.macShortcuts.focusChat || config.macShortcuts.openChat;
                        await execAsync(`osascript -e 'tell application "System Events" to ${focusShortcut}'`);
                        
                        // Wait for chat input to be focused and ready
                        await new Promise(resolve => setTimeout(resolve, config.initWaitTime));
                        
                        // Paste the prompt into the chat (Cmd+V)
                        await execAsync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
                        
                        logger.debug(chalk.green(`✨ Prompt pasted into ${config.name} chat! Review and press Enter when ready.`));
                        logger.debug(chalk.dim('💡 You can choose your preferred model before submitting.'));
                        logger.debug("");
                        clearInterval(monitor);
                    } catch (error) {
                        logger.debug(chalk.yellow('⚠️  Auto-paste failed - please paste manually (Cmd+V)'));
                        clearInterval(monitor);
                    }
                }
            } catch (error) {
                // Silently continue monitoring
            }
        }, 500); // Check every 500ms
        
        // Set a timeout to stop monitoring after 2 minutes
        setTimeout(() => {
            clearInterval(monitor);
        }, 120000);
        
    } catch (error) {
        logger.error(chalk.red(`Failed to inject into ${config.name} chat:`), error);
        throw error;
    }
};

// Backward compatibility alias
export const injectIntoCursorChat = async (text: string): Promise<void> => {
    return injectIntoAIToolChat(text, 'cursor');
};
