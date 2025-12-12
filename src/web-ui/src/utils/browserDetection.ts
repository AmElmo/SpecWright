/**
 * Browser Detection Utility
 * 
 * Detects if the web UI is running inside Cursor's integrated browser
 * (Simple Browser extension) vs an external browser like Chrome/Firefox.
 * 
 * This is used to provide different UX for each environment:
 * - External browser: Full automation (opens Cursor, creates new chat, pastes)
 * - Integrated browser: Manual instructions (since automation doesn't work properly)
 */

import { logger } from './logger';

/**
 * Detects if the current environment is Cursor's integrated browser
 * 
 * Detection methods:
 * 1. Check for Electron in user agent (Cursor is built on Electron)
 * 2. Check for VS Code API presence (Cursor is based on VS Code)
 * 3. Check if running in an iframe (simple browser extension uses iframes)
 * 
 * @returns true if running in Cursor's integrated browser, false otherwise
 */
export const isIntegratedBrowser = (): boolean => {
  if (typeof window === 'undefined') {
    logger.debug('[BrowserDetection] ❌ Window undefined (SSR)');
    return false;
  }
  
  const ua = navigator.userAgent;
  logger.debug('[BrowserDetection] 🔍 User Agent:', ua);
  
  // Check for Cursor's integrated browser specifically
  // User agent includes: "Cursor/X.X.X ... Electron/X.X.X"
  const hasCursor = ua.includes('Cursor/');
  const hasElectron = ua.includes('Electron');
  logger.debug('[BrowserDetection] 🔍 Has "Cursor/":', hasCursor);
  logger.debug('[BrowserDetection] 🔍 Has "Electron":', hasElectron);
  
  if (hasCursor && hasElectron) {
    logger.debug('[BrowserDetection] ✅ DETECTED: Cursor integrated browser');
    return true;
  }
  
  // Check for VS Code's integrated browser
  const hasVSCode = ua.includes('VSCode') || ua.includes('Code/');
  logger.debug('[BrowserDetection] 🔍 Has VSCode:', hasVSCode);
  if (hasVSCode) {
    logger.debug('[BrowserDetection] ✅ DETECTED: VS Code integrated browser');
    return true;
  }
  
  // Check for VS Code specific API
  // @ts-ignore - vscode API may or may not exist
  const hasVSCodeAPI = typeof window.vscode !== 'undefined';
  logger.debug('[BrowserDetection] 🔍 Has vscode API:', hasVSCodeAPI);
  if (hasVSCodeAPI) {
    logger.debug('[BrowserDetection] ✅ DETECTED: vscode API present');
    return true;
  }
  
  // Check if we're in an iframe (simple browser extension behavior)
  const inIframe = window.parent !== window;
  logger.debug('[BrowserDetection] 🔍 In iframe:', inIframe);
  if (inIframe) {
    logger.debug('[BrowserDetection] ✅ DETECTED: Running in iframe');
    return true;
  }
  
  logger.debug('[BrowserDetection] ❌ External browser detected');
  return false;
};

/**
 * Returns user-friendly instructions for manually pasting in the AI coding tool
 * 
 * @param aiToolName - The name of the AI coding tool (e.g., "Cursor", "Windsurf")
 * @returns Instructions text
 */
export const getManualPasteInstructions = (aiToolName: string = 'your AI tool'): string => {
  // Check if prompt is in clipboard or fallback storage
  const hasFallback = (window as any).__specwright_prompt;
  
  if (hasFallback) {
    return '✨ Prompt ready!\n\n' +
           '⚠️ Note: Clipboard access was blocked, but the prompt is stored.\n\n' +
           'To continue:\n' +
           `1. Press Cmd+Shift+I (or Cmd+L) to open ${aiToolName} chat\n` +
           '2. Type: window.__specwright_prompt\n' +
           '3. Copy the output and paste into chat\n\n' +
           'OR just work directly from the text shown in this browser.';
  }
  
  return '✨ Prompt copied to clipboard!\n\n' +
         'To continue:\n' +
         `1. Press Cmd+Shift+I (or Cmd+L) to open ${aiToolName} chat\n` +
         '2. Press Cmd+V to paste the prompt\n' +
         '3. Review and press Enter to submit';
};

/**
 * Shows a notification to the user with manual paste instructions
 * 
 * @param customMessage Optional custom message to show instead of default
 * @param aiToolName Optional name of the AI coding tool for default instructions
 */
export const showManualPasteNotification = (customMessage?: string, aiToolName?: string): void => {
  const message = customMessage || getManualPasteInstructions(aiToolName);
  
  // Use alert for now - could be replaced with a toast notification system later
  alert(message);
};

/**
 * Returns fetch headers that include integrated browser detection
 * Merge these with your existing headers when making API calls
 * 
 * @returns Headers object with x-integrated-browser header
 */
export const getIntegratedBrowserHeaders = (): Record<string, string> => {
  const isIntegrated = isIntegratedBrowser();
  logger.debug('[BrowserDetection] 🎯 getIntegratedBrowserHeaders() returning:', isIntegrated ? 'INTEGRATED' : 'EXTERNAL');
  
  if (isIntegrated) {
    logger.debug('[BrowserDetection] 📤 Sending header: x-integrated-browser: true');
    return { 'x-integrated-browser': 'true' };
  }
  logger.debug('[BrowserDetection] 📤 No special header sent (external browser)');
  return {};
};


