import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';

/**
 * Generate next sequential project ID
 */
export const generateNextProjectId = (): string => {
    const projectsDir = path.join(OUTPUT_DIR, 'projects');
    
    // Ensure projects directory exists
    if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
        return '001'; // First project
    }
    
    // Read existing project directories and extract IDs
    const existingProjects = fs.readdirSync(projectsDir)
        .filter(name => /^\d{3}(-.*)?$/.test(name)) // Match 3-digit folders with optional name suffix
        .map(name => parseInt(name.substring(0, 3), 10)) // Extract just the numeric part
        .filter(id => !isNaN(id)) // Filter out any NaN values
        .sort((a, b) => a - b);
    
    // Get next ID by finding the highest existing ID and incrementing
    const nextId = existingProjects.length > 0 ? Math.max(...existingProjects) + 1 : 1;
    
    // Format as 3-digit string with leading zeros
    return nextId.toString().padStart(3, '0');
};

/**
 * Get the next available project ID
 */
export const getNextProjectId = (): string => {
    const PROJECTS_DIR = path.join(OUTPUT_DIR, 'projects');
    if (!fs.existsSync(PROJECTS_DIR)) {
        return '001';
    }
    
    const existingProjects = fs.readdirSync(PROJECTS_DIR)
        .filter(f => {
            const fullPath = path.join(PROJECTS_DIR, f);
            return fs.statSync(fullPath).isDirectory();
        })
        .map(f => {
            const match = f.match(/^(\d+)-/);
            return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0)
        .sort((a, b) => b - a);
    
    const nextId = existingProjects.length > 0 ? existingProjects[0] + 1 : 1;
    return nextId.toString().padStart(3, '0');
};

/**
 * Get the next available issue ID
 */
export const getNextIssueId = (): string => {
    const ISSUES_DIR = path.join(OUTPUT_DIR, 'issues');
    if (!fs.existsSync(ISSUES_DIR)) {
        return '001';
    }
    
    const existingIssues = fs.readdirSync(ISSUES_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => parseInt(f.replace('issue-', '').replace('.json', '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a);
    
    const nextId = existingIssues.length > 0 ? existingIssues[0] + 1 : 1;
    return nextId.toString().padStart(3, '0');
};

