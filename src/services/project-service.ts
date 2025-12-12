/**
 * Project Service - Project operations and management
 * 
 * This module contains functions for creating, loading, and managing projects.
 */

import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';
import type { ProjectMetadata, IssueMetadata, ProjectSettings } from '../types/index.js';
import { readProjectStatus } from './status-service.js';
import { getReconciledProjectStatus } from './reconciliation-service.js';
import { getIssueStatusCounts } from './issue-service.js';
import { logger } from '../utils/logger.js';
import {
    getProjectPath,
    getPMQuestionsPath,
    getUXQuestionsPath,
    getEngineerQuestionsPath,
    getTechnologyChoicesPath,
    getAcceptanceCriteriaPath,
    getPRDPath,
    getDesignBriefPath,
    getWireframesPath,
    getScreensPath,
    getTechnicalSpecPath,
    getProjectSummaryPath
} from '../utils/project-paths.js';

/**
 * Get all existing projects from the outputs/projects directory
 */
export const getExistingProjects = (): ProjectMetadata[] => {
    const projectsDir = path.join(OUTPUT_DIR, 'projects');
    
    if (!fs.existsSync(projectsDir)) {
        return [];
    }
    
    const projectDirs = fs.readdirSync(projectsDir)
        .filter(name => /^\d{3}(-.*)?$/.test(name)) // Match 3-digit folders with optional name suffix
        .sort((a, b) => {
            // Extract the numeric part for sorting
            const aNum = parseInt(a.substring(0, 3), 10);
            const bNum = parseInt(b.substring(0, 3), 10);
            return aNum - bNum;
        });
    
    const projects: ProjectMetadata[] = [];
    
    for (const projectDirName of projectDirs) {
        const projectDir = path.join(projectsDir, projectDirName);
        // Try both old and new file names for backward compatibility
        let projectRequestFile = path.join(projectDir, 'project_request.md');
        if (!fs.existsSync(projectRequestFile)) {
            projectRequestFile = path.join(projectDir, 'feature_request.md'); // fallback to old name
        }
        
        // Extract ID and name from folder name
        const parts = projectDirName.split('-');
        const projectId = parts[0]; // e.g., "001"
        const projectName = parts.length > 1 ? parts.slice(1).join('-').replace(/-/g, ' ') : null; // e.g., "user auth"
        
        if (fs.existsSync(projectRequestFile)) {
            try {
                const content = fs.readFileSync(projectRequestFile, 'utf-8');
                // Extract the project description from the markdown file
                const lines = content.split('\n');
                let description = '';
                
                // Look for ## Project Name or ## Description section
                let inSection = false;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('## Project Name') || line.startsWith('## Description')) {
                        inSection = true;
                        continue;
                    }
                    if (inSection && line.startsWith('##')) {
                        break;
                    }
                    if (inSection && line && !line.startsWith('---') && !line.startsWith('*')) {
                        description = line;
                        break;
                    }
                }
                
                // Use project name from folder if available, otherwise use description
                let displayName = projectName ? 
                    projectName.charAt(0).toUpperCase() + projectName.slice(1) : // Capitalize first letter
                    (description || 'No description available');
                
                // Truncate long descriptions
                if (displayName.length > 60) {
                    displayName = displayName.substring(0, 60) + '...';
                }
                
                projects.push({
                    id: projectId,
                    fullId: projectDirName, // Full folder name
                    folderName: projectDirName,
                    name: projectName,
                    description: displayName,
                    path: projectDir
                });
            } catch (error) {
                // If we can't read the file, still include it but with a generic description
                const displayName = projectName ? 
                    projectName.charAt(0).toUpperCase() + projectName.slice(1) :
                    'Project request file unreadable';
                
                projects.push({
                    id: projectId,
                    fullId: projectDirName,
                    folderName: projectDirName,
                    name: projectName,
                    description: displayName,
                    path: projectDir
                });
            }
        }
    }
    
    return projects;
};

/**
 * Determine granular spec status based on which files exist AND approval status
 * 
 * Badge Logic (determined by file existence AND project_status.json):
 * - 'ready_to_spec': No PM PRD file yet
 * - 'pm_complete': PM PRD exists (>500 chars) - PM phase complete
 * - 'ux_in_progress': PM complete + (screen inventory OR wireframes exist) - UX phase started
 * - 'engineer_in_progress': PM + screen inventory + wireframes complete - Architect phase started
 * - 'ready_to_break': All spec phases complete AND approved (PM + UX + Architect) - Ready for issue breakdown
 * - 'ready_to_ship': Issues exist, all pending (none started yet)
 * - 'implementing': At least one issue in-review or approved, but not all approved
 * - 'completed': All issues approved
 * 
 * File checks:
 * - PM: prd.md exists and has >500 chars
 * - Design Brief: design_brief.md exists and has >500 chars
 * - Architect: technical_specification.md exists and has >500 chars
 * - Issues: issues/issues.json exists with valid issues
 * 
 * IMPORTANT: For 'ready_to_break' status, we also check project_status.json to ensure
 * all review phases have been completed (not just file existence).
 */
export const getProjectSpecStatus = (projectDir: string): ProjectMetadata['status'] => {
    const hasPM = isPMPRDComplete(projectDir);
    const hasDesignBrief = isUXDesignBriefComplete(projectDir);
    const hasArchitect = isArchitectComplete(projectDir);
    const hasIssueBreakdown = isIssueBreakdownComplete(projectDir);
    
    // All phases complete + issues broken down - check issue progress
    if (hasPM && hasDesignBrief && hasArchitect && hasIssueBreakdown) {
        const projectId = path.basename(projectDir);
        const counts = getIssueStatusCounts(projectId);
        
        if (counts.total === 0) {
            return 'ready_to_ship';
        }
        
        // All issues approved = completed
        if (counts.approved === counts.total) {
            return 'completed';
        }
        
        // At least one issue started (in-review or approved) = implementing
        if (counts.inReview > 0 || counts.approved > 0) {
            return 'implementing';
        }
        
        // All issues still pending = ready to ship
        return 'ready_to_ship';
    }
    
    // All spec phases complete, BUT need to check if they've been approved
    if (hasPM && hasDesignBrief && hasArchitect) {
        // Check project_status.json to see if all review phases are complete
        // Uses reconciled status to ensure stored status matches file reality
        const projectId = path.basename(projectDir);
        const status = getReconciledProjectStatus(projectId);
        
        if (status) {
            // Check if all three agents have completed their phases (including reviews)
            const pmComplete = status.agents.pm.status === 'complete';
            const uxComplete = status.agents.ux.status === 'complete';
            const engineerComplete = status.agents.engineer.status === 'complete';
            
            if (pmComplete && uxComplete && engineerComplete) {
                // All reviews approved - ready to break down
                return 'ready_to_break';
            } else {
                // Files exist but not all approved yet - still in engineer phase
                return 'engineer_in_progress';
            }
        }
        
        // No status file or can't read it - fall back to file-based logic
        return 'ready_to_break';
    }
    
    // Architect phase in progress or started
    if (hasPM && hasDesignBrief) {
        return 'engineer_in_progress';
    }
    
    // UX phase in progress
    if (hasPM) {
        return 'ux_in_progress';
    }
    
    // PM phase in progress or started
    if (hasPM) {
        return 'pm_complete';
    }
    
    // Nothing started yet
    return 'ready_to_spec';
};

/**
 * Enrich projects with progress data from issue breakdowns and detailed status
 */
export const enrichProjectsWithProgress = (projects: ProjectMetadata[]): ProjectMetadata[] => {
    return projects.map(project => {
        const projectDir = project.path || path.join(OUTPUT_DIR, 'projects', project.folderName || project.fullId);
        
        const projectSummaryPath = path.join(projectDir, 'issues', 'issues.json');
        
        const projectId = project.folderName || project.fullId || '';
        
        // Determine granular status
        const status = getProjectSpecStatus(projectDir);
        
        let progressData = null;
        if (fs.existsSync(projectSummaryPath)) {
            try {
                const summaryData = JSON.parse(fs.readFileSync(projectSummaryPath, 'utf-8'));
                // Handle both new (issues) and legacy (issues_list) field names
                const issuesList = summaryData.issues || summaryData.issues_list || [];
                const totalIssues = issuesList.length;
                const completedIssues = issuesList.filter((issue: any) => issue.status === 'approved').length;
                const progressPercent = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
                
                progressData = {
                    completed: completedIssues,
                    total: totalIssues,
                    percent: progressPercent
                };
            } catch (error) {
                // Silently skip
            }
        }
        
        // Load project icon from project_status.json (using reconciled status)
        let icon = undefined;
        const projectStatus = getReconciledProjectStatus(projectId);
        if (projectStatus?.icon) {
            icon = projectStatus.icon;
        }
        
        return { ...project, status, progressData, icon };
    });
};

/**
 * Get all issues from issues.json files and standalone issues folder
 * Issues can exist in:
 * 1. Project folders (issues/issues.json)
 * 2. Standalone issues folder (created from "direct work" scoping)
 */
export const getAllIssues = (projects: ProjectMetadata[]): IssueMetadata[] => {
    const allIssues: IssueMetadata[] = [];
    
    // 1. Get issues from each project's issues.json
    projects.forEach(project => {
        const projectDir = project.path || path.join(OUTPUT_DIR, 'projects', project.folderName || project.fullId);
        
        const projectSummaryPath = path.join(projectDir, 'issues', 'issues.json');
        
        if (fs.existsSync(projectSummaryPath)) {
            try {
                const summaryData = JSON.parse(fs.readFileSync(projectSummaryPath, 'utf-8'));
                // Handle both new (issues) and legacy (issues_list) field names
                const issuesList = summaryData.issues || summaryData.issues_list || [];
                
                issuesList.forEach((issue: any) => {
                    if (issue.issue_id) {
                        // Handle both new (testing_strategy) and legacy (test_strategy) field names
                        const testStrategy = issue.testing_strategy || issue.test_strategy;
                        
                        // Normalize acceptance criteria: handle both new format (objects) and legacy (strings)
                        const normalizedAcceptanceCriteria = (issue.acceptance_criteria || []).map((ac: any, index: number) => {
                            if (typeof ac === 'string') {
                                return { id: `ac_${index + 1}`, description: ac };
                            }
                            return { id: ac.id, description: ac.description };
                        });
                        
                        allIssues.push({
                            issueId: issue.issue_id,
                            title: issue.title || 'Untitled Issue',
                            description: issue.description || '',
                            status: (issue.status || 'pending') as 'pending' | 'in-review' | 'approved',
                            complexityScore: issue.complexity || 0,
                            estimatedHours: issue.estimated_hours || 0,
                            dependencies: issue.dependencies || [],
                            // Traceability fields (new format)
                            screensAffected: issue.screens_affected || issue.covers_screens || [],
                            // Issue content
                            acceptanceCriteria: normalizedAcceptanceCriteria,
                            keyDecisions: issue.key_decisions || [],
                            technicalDetails: issue.technical_details || undefined,
                            testStrategy: testStrategy || undefined,
                            humanInTheLoop: issue.human_in_the_loop || [],
                            // No file path - issues are inline in JSON now
                            filePath: undefined,
                            projectId: project.id!,
                            projectName: project.name || project.description
                        });
                    }
                });
            } catch (error) {
                logger.error(`Error reading project summary: ${projectSummaryPath}`, error);
            }
        }
    });
    
    // 2. Get standalone issues from outputs/issues/ folder (legacy direct work issues)
    const standaloneIssuesDir = path.join(OUTPUT_DIR, 'issues');
    if (fs.existsSync(standaloneIssuesDir)) {
        try {
            const issueFiles = fs.readdirSync(standaloneIssuesDir)
                .filter(f => f.startsWith('ISSUE-') && f.endsWith('.md'))
                .sort();
            
            issueFiles.forEach(filename => {
                const issueFilePath = path.join(standaloneIssuesDir, filename);
                try {
                    const content = fs.readFileSync(issueFilePath, 'utf-8');
                    
                    // Parse markdown to extract metadata
                    const lines = content.split('\n');
                    let issueId = '';
                    let title = '';
                    let status = 'pending';
                    let description = '';
                    
                    // Extract title (first line starting with #)
                    const titleLine = lines.find(l => l.startsWith('# '));
                    if (titleLine) {
                        title = titleLine.replace(/^#\s*/, '').trim();
                    }
                    
                    // Extract issue ID from metadata
                    const idLine = lines.find(l => l.startsWith('**Issue ID**:'));
                    if (idLine) {
                        issueId = idLine.replace(/^\*\*Issue ID\*\*:\s*/, '').trim();
                    }
                    
                    // Extract status from metadata
                    const statusLine = lines.find(l => l.startsWith('**Status**:'));
                    if (statusLine) {
                        status = statusLine.replace(/^\*\*Status\*\*:\s*/, '').trim();
                    }
                    
                    // Extract description section
                    const descIdx = lines.findIndex(l => l.trim() === '## Description');
                    const analysisIdx = lines.findIndex(l => l.trim() === '## Analysis');
                    if (descIdx >= 0 && analysisIdx > descIdx) {
                        description = lines.slice(descIdx + 1, analysisIdx)
                            .join('\n')
                            .trim();
                    }
                    
                    if (issueId && title) {
                        allIssues.push({
                            issueId,
                            title,
                            description,
                            status: (status === 'pending' || status === 'in-review' || status === 'approved') ? status : 'pending',
                            complexityScore: 0,
                            estimatedHours: 0,
                            dependencies: [],
                            acceptanceCriteria: [],
                            filePath: issueFilePath,
                            projectId: 'standalone',
                            projectName: 'Direct Work'
                        });
                    }
                } catch (error) {
                    // Skip malformed issue files
                    logger.error(`Error parsing issue file ${filename}:`, error);
                }
            });
        } catch (error) {
            // Skip if issues directory can't be read
            logger.error('Error reading standalone issues:', error);
        }
    }
    
    return allIssues;
};

// REMOVED: project.json metadata functions - using pure file heuristics instead

/**
 * Create a new project folder with all required structure
 * This is the single source of truth for project folder creation
 * 
 * @param projectId - Numeric project ID (e.g., "001")
 * @param projectName - Human-readable project name
 * @param projectDescription - Full project description
 * @param additionalContext - Optional context like testable outcome, etc.
 * @returns The full path to the created project directory
 */
export const createProjectFolder = (
    projectId: string,
    projectName: string,
    projectDescription: string,
    additionalContext?: {
        testable_outcome?: string;
        dependencies?: string;
        from_project?: string;
        previous_project?: { id: string; slug: string };
        settings?: ProjectSettings;
    }
): string => {
    const PROJECTS_DIR = path.join(OUTPUT_DIR, 'projects');
    
    // Ensure projects directory exists
    if (!fs.existsSync(PROJECTS_DIR)) {
        fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }
    
    // Create slug from project name
    const projectSlug = projectName.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    // Create project folder
    const projectFolderName = `${projectId}-${projectSlug}`;
    const projectDir = path.join(PROJECTS_DIR, projectFolderName);
    
    if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Create new folder structure: questions/ and documents/
    const QUESTIONS_DIR = path.join(projectDir, 'questions');
    const DOCUMENTS_DIR = path.join(projectDir, 'documents');
    
    [QUESTIONS_DIR, DOCUMENTS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    
    // Create project_request.md
    let projectRequestContent = `# Project Request #${projectId}

## Project Name
${projectName}

## Description
${projectDescription}`;
    
    if (additionalContext?.dependencies) {
        projectRequestContent += `\n\n## Dependencies\n${additionalContext.dependencies}`;
        
        // Add link to previous project if it exists in the same batch
        if (additionalContext.previous_project) {
            const previousProjectFolderName = `${additionalContext.previous_project.id}-${additionalContext.previous_project.slug}`;
            projectRequestContent += `\n\nDepends on: [${previousProjectFolderName}](../${previousProjectFolderName}/project_request.md)`;
        }
    } else {
        projectRequestContent += `\n\n## Dependencies\nNone`;
    }
    
    if (additionalContext?.testable_outcome) {
        projectRequestContent += `\n\n## Testable Outcome\n${additionalContext.testable_outcome}`;
    }
    
    projectRequestContent += `\n\n---
*Created: ${new Date().toISOString()}*`;
    
    if (additionalContext?.from_project) {
        projectRequestContent += `\n*From Project: ${additionalContext.from_project}*`;
    }
    
    fs.writeFileSync(path.join(projectDir, 'project_request.md'), projectRequestContent);
    
    // Note: Settings are now stored in project_status.json (not project_config.json)
    // The caller should pass settings to initializeProjectStatus after calling createProjectFolder
    
    return projectDir;
};

// REMOVED: markAgentComplete - no longer needed with file-based heuristics

/**
 * Check if a project is fully specced (all agents complete)
 * Uses file-based heuristics instead of metadata
 */
export const isProjectSpecced = (projectDir: string): boolean => {
    // Extract project ID from directory name
    const projectId = path.basename(projectDir);
    const prdFile = getPRDPath(projectId);
    const designBriefFile = getDesignBriefPath(projectId);
    const technicalSpecFile = getTechnicalSpecPath(projectId);
    
    // Check if all key output files exist and have substantial content
    try {
        if (!fs.existsSync(prdFile) || !fs.existsSync(designBriefFile) || !fs.existsSync(technicalSpecFile)) {
            return false;
        }
        
        const prdContent = fs.readFileSync(prdFile, 'utf-8');
        const designBriefContent = fs.readFileSync(designBriefFile, 'utf-8');
        const technicalSpecContent = fs.readFileSync(technicalSpecFile, 'utf-8');
        
        // Check each has substantial content (not just template)
        return prdContent.length > 500 && 
               designBriefContent.length > 500 && 
               technicalSpecContent.length > 500;
    } catch (error) {
        return false;
    }
};

/**
 * CENTRALIZED FILE COMPLETION CHECKER
 * 
 * Checks if a file was completed/updated during a specific phase.
 * Uses timestamp-based detection + size validation + minimum time threshold.
 * 
 * The minimum time threshold prevents false positives from template writes:
 * - Template write happens within 1 second of phase start
 * - AI work completion happens 10+ seconds after phase start
 * 
 * @param filePath - Full path to the file to check
 * @param phaseStartedAt - ISO timestamp when the phase started (from project_status.json)
 * @param minSize - Minimum file size in bytes (default: 500)
 * @param minTimeThresholdSeconds - Minimum seconds after phase start (default: 5)
 * @returns true if file was modified significantly after phase start and meets size requirement
 */
export const isFileCompletedInPhase = (
    filePath: string, 
    phaseStartedAt: string | null, 
    minSize: number = 500,
    minTimeThresholdSeconds: number = 5
): boolean => {
    // File must exist
    if (!fs.existsSync(filePath)) {
        return false;
    }
    
    try {
        const stats = fs.statSync(filePath);
        
        // Check minimum size requirement (basic sanity check)
        if (stats.size < minSize) {
            return false;
        }
        
        // If we have a phase start timestamp, check if file was modified after that
        if (phaseStartedAt) {
            const phaseStart = new Date(phaseStartedAt);
            const fileModified = stats.mtime;
            
            // File must have been modified AFTER the phase started
            if (fileModified <= phaseStart) {
                return false;
            }
            
            // CRITICAL: Check minimum time threshold
            // This prevents template writes (within 1s) from being considered "complete"
            // AI work takes longer (10+ seconds), so we require at least minTimeThresholdSeconds
            const timeDiffSeconds = (fileModified.getTime() - phaseStart.getTime()) / 1000;
            if (timeDiffSeconds < minTimeThresholdSeconds) {
                return false; // Too soon after phase start - likely just template write
            }
        }
        
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Check if PM questions have been generated (Phase 1 complete)
 */
export const isPMQuestionsGenerated = (projectDir: string, phaseStartedAt?: string): boolean => {
    const projectId = path.basename(projectDir);
    const questionsFile = getPMQuestionsPath(projectId);
    
    if (!fs.existsSync(questionsFile)) {
        return false;
    }
    
    try {
        const content = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
        // Check if questions have been generated (not the placeholder text)
        if (!content.questions || content.questions.length === 0) {
            return false;
        }
        
        // Check if still has placeholder text
        const firstQuestion = content.questions[0];
        if (firstQuestion.question.includes('Waiting for the Product Manager')) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Check if PM questions have been answered (Phase 2 complete)
 */
export const isPMQuestionsAnswered = (projectDir: string): boolean => {
    const projectId = path.basename(projectDir);
    const questionsFile = getPMQuestionsPath(projectId);
    
    if (!fs.existsSync(questionsFile)) {
        return false;
    }
    
    try {
        const content = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
        if (!content.questions || content.questions.length === 0) {
            return false;
        }
        
        // Check if all questions have answers
        const allAnswered = content.questions.every((q: any) => 
            q.answer && q.answer.trim() !== '' || q.decision && q.decision.trim() !== ''
        );
        
        return allAnswered;
    } catch (error) {
        return false;
    }
};

/**
 * Check if PRD and Acceptance Criteria have been written and validated (PM agent generate phase complete)
 * Uses timestamp-based detection - requires BOTH files to be complete
 */
export const isPMPRDComplete = (projectDir: string, phaseStartedAt?: string): boolean => {
    const projectId = path.basename(projectDir);
    const prdFile = getPRDPath(projectId);
    const acceptanceCriteriaFile = getAcceptanceCriteriaPath(projectId);
    
    // Need both PRD and acceptance_criteria.json to be complete
    const prdComplete = isFileCompletedInPhase(prdFile, phaseStartedAt || null);
    const acComplete = isFileCompletedInPhase(acceptanceCriteriaFile, phaseStartedAt || null, 100); // JSON files are smaller
    
    return prdComplete && acComplete;
};

/**
 * Check if UX questions have been answered
 */
export const isUXQuestionsAnswered = (projectDir: string): boolean => {
    const projectId = path.basename(projectDir);
    const questionsFile = getUXQuestionsPath(projectId);
    
    if (!fs.existsSync(questionsFile)) {
        return false;
    }
    
    try {
        const content = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
        if (!content.questions || content.questions.length === 0) {
            return false;
        }
        
        // Check if all questions have answers
        const allAnswered = content.questions.every((q: any) => 
            q.answer && q.answer.trim() !== '' || q.decision && q.decision.trim() !== ''
        );
        
        return allAnswered;
    } catch (error) {
        return false;
    }
};

/**
 * Check if UX design brief has been completed
 * Uses timestamp-based detection
 */
export const isUXDesignBriefComplete = (projectDir: string, phaseStartedAt?: string): boolean => {
    const projectId = path.basename(projectDir);
    const designBriefFile = getDesignBriefPath(projectId);
    return isFileCompletedInPhase(designBriefFile, phaseStartedAt || null);
};

/**
 * Check if UX design files are complete and validated (UX agent complete)
 * Uses timestamp-based detection - requires design_brief.md AND screens.json
 */
export const isUXWireframesComplete = (projectDir: string, phaseStartedAt?: string): boolean => {
    const projectId = path.basename(projectDir);
    const designBriefFile = getDesignBriefPath(projectId);
    const screensFile = getScreensPath(projectId);
    
    // Need both files to exist and be completed
    const designBriefComplete = isFileCompletedInPhase(designBriefFile, phaseStartedAt || null, 200);
    const screensComplete = isFileCompletedInPhase(screensFile, phaseStartedAt || null, 100); // JSON files are smaller
    
    return designBriefComplete && screensComplete;
};

/**
 * Check if architect questions have been answered
 */
export const isArchitectQuestionsAnswered = (projectDir: string): boolean => {
    const projectId = path.basename(projectDir);
    const questionsFile = getEngineerQuestionsPath(projectId);
    
    if (!fs.existsSync(questionsFile)) {
        return false;
    }
    
    try {
        const content = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
        if (!content.questions || content.questions.length === 0) {
            return false;
        }
        
        // Check if all questions have answers
        const allAnswered = content.questions.every((q: any) => 
            q.answer && q.answer.trim() !== '' || q.decision && q.decision.trim() !== ''
        );
        
        return allAnswered;
    } catch (error) {
        return false;
    }
};

/**
 * Check if architecture analysis is complete
 * Uses timestamp-based detection
 */
export const isArchitectureAnalysisComplete = (projectDir: string, phaseStartedAt?: string): boolean => {
    const projectId = path.basename(projectDir);
    const engineerFile = getTechnicalSpecPath(projectId);
    return isFileCompletedInPhase(engineerFile, phaseStartedAt || null);
};

/**
 * Check if architecture and technology selection is complete and validated (Architect agent complete)
 * Uses timestamp-based detection
 * Requires BOTH technical_specification.md AND technology_choices.json to be complete
 */
export const isArchitectComplete = (projectDir: string, phaseStartedAt?: string): boolean => {
    const projectId = path.basename(projectDir);
    const technicalSpecFile = getTechnicalSpecPath(projectId);
    const technologyChoicesFile = getTechnologyChoicesPath(projectId);
    
    // Need both files to exist and be completed
    return isFileCompletedInPhase(technicalSpecFile, phaseStartedAt || null) && 
           isFileCompletedInPhase(technologyChoicesFile, phaseStartedAt || null, 200);
};

/**
 * Check if issues have been properly broken down and created
 * 
 * Verifies that:
 * 1. issues.json exists (in issues/ folder)
 * 2. issues.json is properly filled (no placeholders)
 * 3. Has at least one issue with valid data
 * 
 * Note: Issues are now inline in issues.json, no separate .md files needed.
 */
export const isIssueBreakdownComplete = (projectDir: string): boolean => {
    const projectSummaryFile = path.join(projectDir, 'issues', 'issues.json');
    
    if (!fs.existsSync(projectSummaryFile)) {
        return false;
    }
    
    try {
        // Check if issues.json has been properly filled (not just template)
        const summaryContent = fs.readFileSync(projectSummaryFile, 'utf-8');
        const projectSummary = JSON.parse(summaryContent);
        
        // Handle both new (issues) and legacy (issues_list) field names
        const issuesList = projectSummary.issues || projectSummary.issues_list || [];
        
        // Check if it still contains placeholder text (template not filled)
        if (
            projectSummary.project_name?.includes('PLACEHOLDER') ||
            projectSummary.total_issues === '[TOTAL_ISSUES_PLACEHOLDER]' ||
            issuesList.length === 0
        ) {
            return false;
        }
        
        // Check that issues have real content (not just placeholders)
        const hasValidIssues = issuesList.some((issue: any) => 
            issue.issue_id && 
            !issue.issue_id.includes('PLACEHOLDER') &&
            issue.title &&
            !issue.title.includes('PLACEHOLDER')
        );
        
        return hasValidIssues;
    } catch (error) {
        // If we can't parse the JSON or read files, it's not complete
        return false;
    }
};

