/**
 * Scoping Service - Project scoping logic
 * 
 * This module contains functions for finalizing and managing scoping plans.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { OUTPUT_DIR, TEMPLATES_DIR } from '../config/constants.js';
import { getNextProjectId } from '../utils/id-generator.js';
import { printSeparator } from '../ui/display.js';
import { createProjectFolder } from './project-service.js';
import { initializeProjectStatus } from './status-service.js';
import type { ScopingPlan } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Finalize a scoping plan - create folders and files from the scoping plan
 * Returns an array of folder names for the newly created projects
 */
export const finalizeScopingPlan = async (scopingPlan: ScopingPlan): Promise<string[]> => {
    if (scopingPlan.type === 'direct') {
        // Work doesn't warrant a project - suggest working directly
        logger.debug("");
        logger.debug(chalk.yellowBright('💡 NO PROJECT NEEDED'));
        logger.debug("");
        logger.debug(chalk.dim('This work is too small to warrant a full project specification.'));
        logger.debug("");
        logger.debug(chalk.bold('Suggestion:'));
        logger.debug(chalk.cyan(`  ${scopingPlan.direct_work_suggestion || 'Implement this change directly in Cursor without creating a project.'}`));
        logger.debug("");
        logger.debug(chalk.dim('💡 SpecWright is for specification-driven development.'));
        logger.debug(chalk.dim('   For quick fixes and small changes, just implement them directly!'));
        logger.debug("");
        printSeparator();
        
        // Reset scoping_plan.json back to template
        resetScopingPlanToTemplate();
        return []; // No projects created
    } else if (scopingPlan.type === 'project') {
        // Handle project creation
        logger.debug("");
        logger.debug(chalk.yellowBright('📁 Creating Project Folders...'));
        logger.debug("");
        
        const PROJECTS_DIR = path.join(OUTPUT_DIR, 'projects');
        if (!fs.existsSync(PROJECTS_DIR)) {
            fs.mkdirSync(PROJECTS_DIR, { recursive: true });
        }
        
        // Support both old 'features' and new 'projects' field names for backward compatibility
        const projectsList = scopingPlan.projects || [];
        
        // Assign dynamic IDs to projects
        let currentId = parseInt(getNextProjectId());
        for (const project of projectsList) {
            project.id = currentId.toString().padStart(3, '0');
            currentId++;
        }
        
        // Build a map of project IDs to projects for resolving dependencies
        const projectMap = new Map<string, any>();
        for (const project of projectsList) {
            projectMap.set(project.id, project);
        }
        
        // Track newly created project folder names
        const createdProjectFolderNames: string[] = [];
        
        for (const project of projectsList) {
            // Get dependencies string from the project (could be "None" or a list)
            const dependenciesStr = (project as any).dependencies || 'None';
            
            // Use centralized project folder creation
            const projectDir = createProjectFolder(
                project.id,
                project.name || '',
                project.description || '',
                {
                    testable_outcome: project.testable_outcome,
                    dependencies: dependenciesStr,
                    from_project: scopingPlan.project_name,
                    previous_project: undefined, // Dependencies are now explicitly listed
                    settings: project.settings || scopingPlan.settings // Pass settings from project or plan
                }
            );
            
            const projectSlug = (project.name || '').trim()
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .replace(/^-+|-+$/g, '');
            const projectFolderName = `${project.id}-${projectSlug}`;
            
            // Track this newly created project
            createdProjectFolderNames.push(projectFolderName);
            
            // Initialize project status tracking with settings
            const projectSettings = project.settings || scopingPlan.settings;
            initializeProjectStatus(projectFolderName, projectSettings);
            
            logger.debug(chalk.green(`✅ Created: ${projectFolderName}/`));
        }
        
        logger.debug("");
        printSeparator();
        logger.debug(chalk.greenBright('🎉 PROJECTS CREATED!'));
        logger.debug("");
        logger.debug(chalk.dim('Project folders created under ') + chalk.cyan('outputs/projects/'));
        logger.debug("");
        logger.debug(chalk.bold.yellowBright('✅ Done Scoping!'));
        logger.debug("");
        logger.debug(chalk.dim('Next steps:'));
        logger.debug(chalk.dim('  • Run ') + chalk.cyan('specwright spec') + chalk.dim(' to create full specifications'));
        logger.debug("");
        printSeparator();
        
        // Reset scoping_plan.json back to template
        resetScopingPlanToTemplate();
        
        return createdProjectFolderNames; // Return the newly created project folder names
    }
    
    return []; // Fallback if neither type matched
};

/**
 * Reset scoping_plan.json back to the template
 * This keeps the file clean for the next scoping session
 */
const resetScopingPlanToTemplate = (): void => {
    const scopingPlanFile = path.join(OUTPUT_DIR, 'scoping_plan.json');
    const templateFile = path.join(TEMPLATES_DIR, 'scoping_plan_template.json');
    
    try {
        if (fs.existsSync(templateFile)) {
            const templateContent = fs.readFileSync(templateFile, 'utf-8');
            fs.writeFileSync(scopingPlanFile, templateContent);
            logger.debug("");
        }
    } catch (error) {
        // Silently fail - this is a cleanup operation
        logger.debug("");
        logger.debug(chalk.dim('⚠️  Could not reset scoping_plan.json to template'));
    }
};

