/**
 * Server Manager - Handles web server lifecycle and reuse
 * 
 * Checks if server is already running, reuses if available, otherwise starts new server.
 */

import http from 'http';
import chalk from 'chalk';
import open from 'open';
import { startWebServer } from '../web-server.js';
import { logger } from './logger.js';

const DEFAULT_PORT = 3456;
const HEALTH_CHECK_TIMEOUT = 1000; // 1 second

let serverInstance: { server: any; wss: any; watcher: any } | null = null;

/**
 * Check if server is already running on the port
 */
async function isServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/projects`, { timeout: HEALTH_CHECK_TIMEOUT }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404); // 404 is OK, means server is running
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Ensure web server is running, reuse if available
 * @param url Optional URL to open in browser after ensuring server is running
 * @returns Promise that resolves when server is ready
 */
export async function ensureWebServerRunning(url?: string): Promise<void> {
  // Check if server is already running
  const isRunning = await isServerRunning(DEFAULT_PORT);
  
  if (isRunning) {
    logger.debug(chalk.green('✅ Web server already running'));
    logger.debug(chalk.dim(`   Reusing existing server on port ${DEFAULT_PORT}`));
    logger.debug('');
    
    // Open browser to specified URL if provided
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `http://localhost:${DEFAULT_PORT}${url}`;
      logger.debug(chalk.cyan('🌐 Opening browser...'));
      logger.debug(chalk.dim(`   ${fullUrl}`));
      logger.debug('');
      
      try {
        await open(fullUrl);
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
      } catch (error) {
        logger.debug(chalk.yellow('⚠️  Could not open browser automatically'));
        logger.debug(chalk.dim(`   Please navigate to: ${fullUrl}`));
        logger.debug('');
      }
    }
    
    return;
  }
  
  // Server not running, start it
  logger.debug(chalk.dim('Starting web server...'));
  logger.debug('');
  
  try {
    serverInstance = await startWebServer(DEFAULT_PORT);
    
    logger.debug(chalk.green('✅ Web server running'));
    logger.debug('');
    
    // Open browser to specified URL if provided
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `http://localhost:${DEFAULT_PORT}${url}`;
      logger.debug(chalk.cyan('🌐 Opening browser...'));
      logger.debug(chalk.dim(`   ${fullUrl}`));
      logger.debug('');
      
      try {
        await open(fullUrl);
        logger.debug(chalk.green('✅ Browser opened!'));
        logger.debug('');
      } catch (error) {
        logger.debug(chalk.yellow('⚠️  Could not open browser automatically'));
        logger.debug(chalk.dim(`   Please navigate to: ${fullUrl}`));
        logger.debug('');
      }
    }
    
    // Keep server running (don't exit)
    // The server will stay alive until user presses Ctrl+C
    await new Promise(() => {}); // Never resolves, keeps server alive
    
  } catch (error: any) {
    logger.error('');
    logger.error(chalk.red('❌ Failed to start web server'));
    logger.error('');
    
    if (error.message?.includes('EADDRINUSE') || error.message?.includes('already in use')) {
      logger.error(chalk.yellow(`Port ${DEFAULT_PORT} is already in use.`));
      logger.error(chalk.dim('Try stopping any existing SpecWright web server.'));
      logger.error(chalk.dim('Or wait a moment and try again - server may be starting up.'));
    } else {
      logger.error(chalk.dim(error.message));
    }
    
    logger.error('');
    throw error;
  }
}

/**
 * Get the current server instance (if running)
 */
export function getServerInstance() {
  return serverInstance;
}



