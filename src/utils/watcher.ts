import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Calculate hash of file content for comparison
 */
const getContentHash = (content: string): string => {
    return crypto.createHash('md5').update(content).digest('hex');
};

/**
 * Watch a file for updates and return when it's been modified
 * 
 * This uses a robust polling approach with content-based detection to handle:
 * - Rapid file updates (common with AI editors)
 * - File system delays and caching
 * - Partial writes
 * - Race conditions
 * 
 * @param filePath - Path to file to watch
 * @param timeout - Timeout in milliseconds (default: 5 minutes)
 * @param waitForChange - If true, wait for a change from current state (for refinement iterations).
 *                        If false, return immediately if file already has valid content (for first iteration).
 * @returns Promise that resolves to true if file was updated, false if timeout
 */
export const watchForFileUpdate = (filePath: string, timeout: number = 300000, waitForChange: boolean = false): Promise<boolean> => {
    return new Promise((resolve) => {
        let resolved = false;
        let initialContentHash: string | null = null;
        let initialContentLength: number = 0;
        let baselineEstablished = false;
        
        // Helper function to check if content has substantial changes
        // Check if the change from initial state is meaningful (>100 characters difference)
        const hasSubstantialChange = (content: string): boolean => {
            const lengthDifference = Math.abs(content.length - initialContentLength);
            return lengthDifference > 100;
        };
        
        // Helper function to check if content is valid (for new files that appear)
        // Simple check: just ensure file has substantial content (not empty/tiny)
        const isValidContent = (content: string): boolean => {
            return content.length > 100;
        };
        
        // Set timeout (always set this up, regardless of early exit paths)
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(false);
            }
        }, timeout);
        
        // Polling-based watcher (more reliable on macOS than fs.watch for rapid changes)
        const pollInterval = 300; // Check every 300ms for faster detection
        let pollCount = 0;
        const maxStabilityChecks = 3; // Verify stability over 3 consecutive checks
        let stabilityChecksPassed = 0;
        let lastSeenHash: string | null = initialContentHash;
        
        const poll = () => {
            if (resolved) return;
            pollCount++;
            
            try {
                // Check if file exists and read content
                const content = fs.readFileSync(filePath, 'utf-8');
                const currentHash = getContentHash(content);
                
                // Verify it has meaningful content (not just template)
                const hasValidContent = isValidContent(content);
                
                // First poll: establish baseline if we don't have one yet
                if (!baselineEstablished && !initialContentHash) {
                    if (hasValidContent) {
                        // File appeared with valid content - this IS the change we're waiting for
                        resolved = true;
                        resolve(true);
                        return;
                    }
                    // File exists but no valid content yet, keep polling
                    initialContentHash = currentHash;
                    initialContentLength = content.length;
                    lastSeenHash = currentHash;
                    if (!resolved) {
                        setTimeout(poll, pollInterval);
                    }
                    return;
                }
                
                // Special case: If initial hash was from template but file now has valid content,
                // and we haven't established baseline yet, check if content is already valid
                if (!baselineEstablished && initialContentHash && hasValidContent) {
                    // Content is valid and different from template - this is the update!
                    if (currentHash !== initialContentHash && hasSubstantialChange(content)) {
                        resolved = true;
                        resolve(true);
                        return;
                    }
                }
                
                // Check if content has changed from baseline
                if (currentHash !== initialContentHash && hasSubstantialChange(content)) {
                    // Content changed! But verify it's stable (not mid-write)
                    if (currentHash === lastSeenHash) {
                        stabilityChecksPassed++;
                        
                        // Content stable for multiple checks? It's a confirmed update
                        if (stabilityChecksPassed >= maxStabilityChecks) {
                            resolved = true;
                            resolve(true);
                            return;
                        }
                    } else {
                        // Content still changing, reset stability counter
                        stabilityChecksPassed = 0;
                        lastSeenHash = currentHash;
                    }
                } else if (currentHash === lastSeenHash) {
                    // Content hasn't changed, establish baseline
                    baselineEstablished = true;
                } else {
                    // Content changed but doesn't meet criteria yet
                    lastSeenHash = currentHash;
                    stabilityChecksPassed = 0;
                }
                
                // Schedule next poll
                if (!resolved) {
                    setTimeout(poll, pollInterval);
                }
            } catch (error) {
                // File might not exist yet or being written, try again
                // On first few polls, this is expected behavior
                if (!resolved) {
                    setTimeout(poll, pollInterval);
                }
            }
        };
        
        // Capture initial state IMMEDIATELY (no delay to avoid missing rapid updates)
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            initialContentHash = getContentHash(content);
            initialContentLength = content.length;
            
            // Check if file already has valid content (not just template)
            // This handles the case where Cursor wrote the file before we started watching
            if (isValidContent(content) && !waitForChange) {
                // For first iteration: wait a bit to see if content is still being written, then check stability
                // For refinement iterations (waitForChange=true): skip this and go straight to polling
                setTimeout(() => {
                    if (resolved) return;
                    
                    try {
                        const stableContent = fs.readFileSync(filePath, 'utf-8');
                        const stableHash = getContentHash(stableContent);
                        
                        if (stableHash === initialContentHash && isValidContent(stableContent)) {
                            // File has valid content and is stable - return immediately
                            clearTimeout(timeoutId);
                            resolved = true;
                            resolve(true);
                            return;
                        }
                    } catch (error) {
                        // File might have changed, continue with normal watching
                    }
                    
                    // If we get here, start normal polling
                    poll();
                }, 500);
                return; // Exit early, poll() will be called by setTimeout if needed
            }
            // If waitForChange=true, we skip the early return and go straight to polling
            // This ensures we wait for a CHANGE from the current state, not just detect it's already valid
        } catch (error) {
            // File doesn't exist yet, that's okay - we'll detect when it appears
        }
        
        // Start polling immediately
        poll();
    });
};

