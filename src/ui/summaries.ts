/**
 * Summary display functions
 * 
 * This module contains functions for displaying summaries of screens
 * and issue breakdowns.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { getDesignBriefPath, getWireframesPath } from '../utils/project-paths.js';
import { printSeparator } from './display.js';
import { navigateIssueBreakdown } from './navigation.js';
import { logger } from '../utils/logger.js';

/**
 * Displays design brief and wireframe locations
 */
export const displayScreenSummaryAndWireframes = async (projectDir: string): Promise<void> => {
    const projectId = path.basename(projectDir);
    const designBriefFile = getDesignBriefPath(projectId);
    
    try {
        logger.debug("");
        printSeparator();
        logger.debug(chalk.yellowBright('📱 DESIGN BRIEF SUMMARY'));
        logger.debug("");
        
        // Show design brief location
        logger.debug(chalk.bold.cyanBright('📋 DESIGN BRIEF:'));
        logger.debug(chalk.dim(`  📄 Design brief: ${chalk.bold(designBriefFile)}`));
        logger.debug("");
        
        // Show wireframe location
        const wireframesFile = getWireframesPath(projectId);
        logger.debug(chalk.bold.magentaBright('🖼️  WIREFRAMES LOCATION:'));
        logger.debug(chalk.dim(`  📁 Wireframes: ${chalk.bold(wireframesFile)}`));
        
        logger.debug("");
        printSeparator();
        
    } catch (error) {
        logger.debug(chalk.yellow('⚠️  Could not display design brief summary.'));
    }
};

/**
 * Displays issue breakdown summary with detailed statistics
 */
export const displayIssueBreakdownSummary = async (projectDir: string): Promise<void> => {
    const projectSummaryFile = path.join(projectDir, 'issues', 'issues.json');
    
    if (!fs.existsSync(projectSummaryFile)) {
        logger.debug(chalk.yellow('⚠️  No project summary found.'));
        return;
    }
    
    const issuesDir = path.join(projectDir, 'issues');
    
    try {
        const summaryData = JSON.parse(fs.readFileSync(projectSummaryFile, 'utf-8'));
        
        logger.debug("");
        printSeparator();
        logger.debug(chalk.yellowBright('📋 ISSUE BREAKDOWN SUMMARY'));
        logger.debug("");
        
        // Overview stats
        // Handle both new (issues) and legacy (issues_list) field names
        const issuesList = summaryData.issues || summaryData.issues_list || [];
        const totalIssues = summaryData.total_issues || issuesList.length || 0;
        const totalHours = summaryData.total_estimated_hours || 0;
        
        logger.debug(chalk.bold.cyanBright('📊 PROJECT OVERVIEW:'));
        logger.debug(chalk.green(`  🎯 Project: ${summaryData.project_name || 'Unknown'}`));
        logger.debug(chalk.blue(`  ⏱️  Total Estimated Time: ${totalHours} hours`));
        logger.debug("");
        
        logger.debug(chalk.bold.greenBright('📝 ISSUE BREAKDOWN:'));
        logger.debug(chalk.white(`  📋 Total Issues: ${totalIssues}`));
        logger.debug("");
        
        // Priority breakdown
        if (issuesList.length > 0) {
            const priorityCounts: Record<string, number> = {};
            issuesList.forEach((issue: any) => {
                const priority = issue.priority || 'medium';
                priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
            });
            
            logger.debug(chalk.bold.redBright('⚡ ISSUES BY PRIORITY:'));
            if (priorityCounts.critical) logger.debug(chalk.red(`  🔴 Critical: ${priorityCounts.critical}`));
            if (priorityCounts.high) logger.debug(chalk.red(`  🔴 High: ${priorityCounts.high}`));
            if (priorityCounts.medium) logger.debug(chalk.yellow(`  🟡 Medium: ${priorityCounts.medium}`));
            if (priorityCounts.low) logger.debug(chalk.green(`  🟢 Low: ${priorityCounts.low}`));
            logger.debug("");
        }
        
        // File locations
        logger.debug(chalk.bold.magentaBright('📁 DELIVERABLES:'));
        logger.debug(chalk.dim(`  📋 Project Summary: ${chalk.bold(projectSummaryFile)}`));
        logger.debug(chalk.dim(`  📁 Individual Issues: ${chalk.bold(issuesDir)}`));
        
        logger.debug("");
        
        // Offer issue exploration
        if (totalIssues > 0) {
            const { exploreIssues } = await inquirer.prompt([{
                type: 'list',
                name: 'exploreIssues',
                message: chalk.bold.cyan('Would you like to explore the detailed issue breakdown?'),
                choices: ['Yes', 'No'],
                default: 'No',
                prefix: '  '
            }]);
            
            if (exploreIssues === 'Yes') {
                await navigateIssueBreakdown(projectDir);
            }
        }
        
        logger.debug("");
        printSeparator();
        
    } catch (error) {
        logger.debug(chalk.yellow('⚠️  Could not read project summary file for summary.'));
        logger.error(error);
    }
};
