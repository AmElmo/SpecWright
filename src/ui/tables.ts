/**
 * Table display functions
 * 
 * This module contains functions for rendering tables for projects and issues.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import type { ProjectMetadata, IssueMetadata } from '../types/index.js';
import { getStatusBadge, getCategoryBadge } from '../config/styles.js';
import { logger } from '../utils/logger.js';

/**
 * Renders a table of projects with visual progress bars
 */
export const renderProjectsTable = (projects: ProjectMetadata[]): void => {
    if (projects.length === 0) return;

    logger.debug(chalk.bold.magentaBright('📁 PROJECTS'));
    logger.debug("");
    
    const projectTable = new Table({
        head: [
            chalk.dim('ID'),
            chalk.dim('Name'),
            chalk.dim('Status'),
            chalk.dim('Progress')
        ],
        style: {
            head: [],
            border: ['dim'],
            compact: false,
            'padding-left': 1,
            'padding-right': 1
        },
        colWidths: [8, 40, 26, 28],
        wordWrap: true
    });
    
    projects.forEach(project => {
        const statusBadge = getStatusBadge(project.status || 'ready_to_spec');
        
        // Create visual progress bar
        let progressDisplay = chalk.dim('—');
        if (project.progressData) {
            const { completed, total, percent } = project.progressData;
            const barLength = 10;
            const filled = Math.floor((percent / 100) * barLength);
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
            
            const progressColor = percent === 100 ? chalk.green : 
                                 percent >= 50 ? chalk.yellow : chalk.gray;
            progressDisplay = progressColor(`${bar}  ${completed}/${total}`);
        }
        
        projectTable.push([
            chalk.cyan(project.id),
            chalk.whiteBright(project.name || project.description),
            statusBadge,
            progressDisplay
        ]);
    });
    
    logger.debug(projectTable.toString());
    logger.debug("");
};

/**
 * Renders a table of all issues from projects
 * All issues are part of a project (stored in issues/ folder)
 */
export const renderIssuesTable = (issues: IssueMetadata[]): void => {
    if (issues.length === 0) return;

    logger.debug(chalk.bold.magentaBright('📋 PROJECT ISSUES'));
    logger.debug("");
    
    const issueTable = new Table({
        head: [
            chalk.dim('ID'),
            chalk.dim('Title'),
            chalk.dim('Category'),
            chalk.dim('Project'),
            chalk.dim('Status')
        ],
        style: {
            head: [],
            border: ['dim'],
            compact: false,
            'padding-left': 1,
            'padding-right': 1
        },
        colWidths: [12, 35, 14, 12, 15],
        wordWrap: true
    });
    
    issues.forEach(issue => {
        // All issues now have a projectId
        const projectDisplay = chalk.cyan(issue.projectId);
        
        // Normalize issue ID to ENG- prefix
        let issueId = issue.issueId || '';
        if (issueId) {
            // If it has a prefix (e.g., ISSUE-001, AUTH-001), extract the number part
            const match = issueId.match(/^[A-Z]+-(\d+)$/);
            if (match) {
                issueId = `ENG-${match[1]}`;
            } else if (!issueId.startsWith('ENG-')) {
                // If no standard prefix format, just use as-is with ENG-
                issueId = `ENG-${issueId}`;
            }
        }
        
        issueTable.push([
            chalk.cyan(issueId),
            chalk.whiteBright(issue.title),
            projectDisplay,
            getStatusBadge(issue.status || 'todo')
        ]);
    });
    
    logger.debug(issueTable.toString());
    logger.debug("");
};
