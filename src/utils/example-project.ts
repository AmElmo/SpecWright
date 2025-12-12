/**
 * Example Project Generator
 * 
 * Creates a demo "Team Invite System" project to help users understand
 * what a complete SpecWright project looks like.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OUTPUT_DIR } from '../config/constants.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Template directory is in the package root
const EXAMPLE_TEMPLATE_DIR = path.resolve(__dirname, '../../templates/example-project');

/**
 * Check if example project already exists
 */
export function exampleProjectExists(): boolean {
  const projectsDir = path.join(OUTPUT_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return false;
  }
  
  const folders = fs.readdirSync(projectsDir);
  return folders.some(f => f.startsWith('000-') || f === '000');
}

/**
 * Get the example project folder name if it exists
 */
export function getExampleProjectFolder(): string | null {
  const projectsDir = path.join(OUTPUT_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return null;
  }
  
  const folders = fs.readdirSync(projectsDir);
  return folders.find(f => f.startsWith('000-')) || null;
}

/**
 * Copy directory recursively
 */
function copyDirRecursive(src: string, dest: string): void {
  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Generate the example project
 * 
 * Creates the "Team Invite System" demo project in the outputs/projects folder.
 * Uses project ID "000" which is reserved for the example.
 * 
 * @returns Object with success status and project details
 */
export function generateExampleProject(): { 
  success: boolean; 
  projectId: string; 
  projectPath: string;
  error?: string;
} {
  const projectId = '000-ai-code-review-assistant';
  const projectsDir = path.join(OUTPUT_DIR, 'projects');
  const projectPath = path.join(projectsDir, projectId);
  
  try {
    // Check if template exists
    if (!fs.existsSync(EXAMPLE_TEMPLATE_DIR)) {
      return {
        success: false,
        projectId,
        projectPath,
        error: 'Example project template not found'
      };
    }
    
    // Check if example already exists
    if (exampleProjectExists()) {
      const existingFolder = getExampleProjectFolder();
      return {
        success: false,
        projectId: existingFolder || projectId,
        projectPath: existingFolder ? path.join(projectsDir, existingFolder) : projectPath,
        error: 'Example project already exists'
      };
    }
    
    // Ensure projects directory exists
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }
    
    // Copy the template to projects folder
    copyDirRecursive(EXAMPLE_TEMPLATE_DIR, projectPath);
    
    // Update timestamps in project_status.json to current time
    const statusPath = path.join(projectPath, 'project_status.json');
    if (fs.existsSync(statusPath)) {
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      const now = new Date().toISOString();
      status.createdAt = now;
      status.lastUpdatedAt = now;
      fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    }
    
    logger.debug(`✅ Example project created: ${projectId}`);
    
    return {
      success: true,
      projectId,
      projectPath
    };
    
  } catch (error) {
    logger.error('Error generating example project:', error);
    return {
      success: false,
      projectId,
      projectPath,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete the example project
 */
export function deleteExampleProject(): boolean {
  const projectsDir = path.join(OUTPUT_DIR, 'projects');
  const existingFolder = getExampleProjectFolder();
  
  if (!existingFolder) {
    return false;
  }
  
  try {
    const projectPath = path.join(projectsDir, existingFolder);
    fs.rmSync(projectPath, { recursive: true, force: true });
    logger.debug(`🗑️  Example project deleted: ${existingFolder}`);
    return true;
  } catch (error) {
    logger.error('Error deleting example project:', error);
    return false;
  }
}

