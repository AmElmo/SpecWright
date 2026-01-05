/**
 * Web Server - Express server with API routes and WebSocket support
 *
 * This module provides the web interface for SpecWright with real-time updates.
 *
 * Tracing: All functions are automatically traced by Babel when --trace flag is used.
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { getExistingProjects, enrichProjectsWithProgress, getAllIssues, isPMPRDComplete, isUXWireframesComplete, isArchitectComplete, isPMQuestionsGenerated, isPMQuestionsAnswered, isUXDesignBriefComplete, createProjectFolder } from './services/project-service.js';
import { logger } from './utils/logger.js';
import { OUTPUT_DIR, TEMPLATES_DIR } from './config/constants.js';
import { openCursorAndPaste, type OpenAIToolResult } from './utils/clipboard.js';
import { finalizeScopingPlan } from './services/scoping-service.js';
import { executeClaudeHeadless } from './services/headless-agent-service.js';
import { broadcastHeadlessStarted, broadcastHeadlessProgress, broadcastHeadlessCompleted } from './services/websocket-service.js';
import { saveScopingSession, saveAgentSession, getAgentSession, getAllSessions, type AgentType as SessionAgentType } from './services/session-service.js';
import {
  getOrCreateStatus,
  markAIWorkStarted,
  markAIWorkComplete,
  completePhaseAndAdvance,
  isHumanInputRequired,
  readProjectStatus,
  validateAndRecoverPhase,
  initializeProjectStatus,
  updateProjectSettings,
  updateProjectIcon,
  getProjectIcon
} from './services/status-service.js';
import { getReconciledProjectStatus } from './services/reconciliation-service.js';
import type { AgentType } from './types/project-status.js';
import { parseIssueFile, getIssueById } from './services/issue-service.js';
import {
  generatePMQuestionsPrompt,
  generatePMPRDPrompt,
  generateUXQuestionsPrompt,
  generateUXDesignBriefPrompt,
  generateEngineerQuestionsPrompt,
  generateEngineerSpecPrompt,
  generateTechLeadBreakdownPrompt,
  generateIssuePrompt
} from './services/prompt-generator.js';
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
  getProjectSummaryPath,
  getIssuesDir,
  getDocumentPathByType,
  mapLegacyPath,
  toRelativePath
} from './utils/project-paths.js';
import {
  loadSettings,
  updateSettings,
  loadGitPreferences,
  saveGitPreferences,
  getAllAIToolConfigs,
  isValidAITool,
  type Settings,
  type GitPreferences,
  type AITool
} from './services/settings-service.js';
import {
  generateExampleProject,
  exampleProjectExists
} from './utils/example-project.js';
import {
  countPromptTokens,
  addInputTokens,
  getCostSummary,
  isCostEstimationEnabled,
  invalidateOutputTokenCache
} from './services/cost-tracking-service.js';
import { formatCost, formatTokens } from './utils/cost-estimation.js';
import { getHeadlessStatus } from './utils/cli-detection.js';
import { initWebSocketService } from './services/websocket-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Helper to ensure directory exists
 */
const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Render an issue from JSON to Markdown format (for backward compatibility)
 */
const renderIssueAsMarkdown = (issue: any): string => {
  const testStrategy = issue.testing_strategy || issue.test_strategy || {};
  
  let md = `# ${issue.title}\n\n`;
  md += `**Issue ID**: ${issue.issue_id}\n`;
  md += `**Status**: ${issue.status || 'pending'}\n`;
  md += `**Estimated Hours**: ${issue.estimated_hours || 0}h\n\n`;
  
  if (issue.description) {
    md += `## Description\n\n${issue.description}\n\n`;
  }
  
  if (issue.key_decisions && issue.key_decisions.length > 0) {
    md += `## Key Decisions\n\n`;
    issue.key_decisions.forEach((decision: string) => {
      md += `- ${decision}\n`;
    });
    md += '\n';
  }
  
  if (issue.acceptance_criteria && issue.acceptance_criteria.length > 0) {
    md += `## Acceptance Criteria\n\n`;
    issue.acceptance_criteria.forEach((criterion: string) => {
      md += `- [ ] ${criterion}\n`;
    });
    md += '\n';
  }
  
  if (issue.technical_details) {
    md += `## Technical Details\n\n${issue.technical_details}\n\n`;
  }
  
  if (testStrategy.automated_tests || testStrategy.manual_verification) {
    md += `## Testing Strategy\n\n`;
    if (testStrategy.automated_tests) {
      md += `### Automated Tests\n\n${testStrategy.automated_tests}\n\n`;
    }
    if (testStrategy.manual_verification) {
      md += `### Manual Verification\n\n${testStrategy.manual_verification}\n\n`;
    }
  }
  
  if (issue.human_in_the_loop && issue.human_in_the_loop.length > 0) {
    md += `## Human-in-the-Loop Verification\n\n`;
    issue.human_in_the_loop.forEach((step: string, idx: number) => {
      md += `${idx + 1}. ${step}\n`;
    });
    md += '\n';
  }
  
  if (issue.dependencies && issue.dependencies.length > 0) {
    md += `## Dependencies\n\n`;
    issue.dependencies.forEach((dep: string) => {
      md += `- ${dep}\n`;
    });
    md += '\n';
  }
  
  return md;
};

export async function startWebServer(port = 5174) {
  const app = express();
  
  // Capture workspace path for Cursor targeting
  const WORKSPACE_PATH = process.cwd();
  
  /**
   * Reset scoping_plan.json to its placeholder/template state
   * Called at the start of scoping and after completion (issue/project creation)
   */
  function resetScopingPlanFile(): void {
    const scopingPlanFile = path.join(OUTPUT_DIR, 'scoping_plan.json');
    const templatePath = path.join(TEMPLATES_DIR, 'scoping_plan_template.json');
    
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      fs.writeFileSync(scopingPlanFile, templateContent);
    } else {
      // Create minimal template if template file doesn't exist
      const minimalTemplate = {
        type: "direct",
        scope_analysis: "[ANALYSIS_PLACEHOLDER - Explain why this doesn't need a project]",
        direct_work_suggestion: "[SUGGESTION_PLACEHOLDER - How to implement directly]"
      };
      fs.writeFileSync(scopingPlanFile, JSON.stringify(minimalTemplate, null, 2));
    }
  }
  
  app.use(express.json());
  
  // Serve static UI files (built Vite app)
  const uiPath = path.join(__dirname, '../dist/web-ui');
  if (fs.existsSync(uiPath)) {
    app.use(express.static(uiPath));
  }
  
  // API Routes
  
  // Get all projects with enriched data
  app.get('/api/projects', (req, res) => {
    try {
      const projects = getExistingProjects();
      const enriched = enrichProjectsWithProgress(projects);
      res.json(enriched);
    } catch (error) {
      logger.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });
  
  // Get workspace info (repository name, etc.)
  app.get('/api/workspace-info', (req, res) => {
    try {
      const workspaceName = path.basename(WORKSPACE_PATH);
      res.json({ 
        repositoryName: workspaceName,
        workspacePath: WORKSPACE_PATH
      });
    } catch (error) {
      logger.error('Error fetching workspace info:', error);
      res.status(500).json({ error: 'Failed to fetch workspace info' });
    }
  });
  
  // Check initialization status
  app.get('/api/initialization-status', (req, res) => {
    try {
      const specwrightDir = path.join(WORKSPACE_PATH, 'specwright');
      const isInitialized = fs.existsSync(specwrightDir);
      
      res.json({ 
        isInitialized,
        projectRoot: WORKSPACE_PATH,
        repositoryName: path.basename(WORKSPACE_PATH)
      });
    } catch (error) {
      logger.error('Error checking initialization status:', error);
      res.status(500).json({ error: 'Failed to check initialization status' });
    }
  });
  
  // Initialize SpecWright (run init command)
  app.post('/api/initialize', async (req, res) => {
    try {
      const { handleInitCommand } = await import('./commands/init.js');
      
      // Check if already initialized
      const specwrightDir = path.join(WORKSPACE_PATH, 'specwright');
      if (fs.existsSync(specwrightDir)) {
        return res.status(400).json({ 
          error: 'SpecWright is already initialized in this directory' 
        });
      }
      
      logger.debug('🚀 Running initialization from Web UI...');
      
      // Run initialization programmatically (without interactive prompts)
      // We'll create the folders directly here since we can't use the interactive version
      
      // Create specwright/ directory
      if (!fs.existsSync(specwrightDir)) {
        fs.mkdirSync(specwrightDir, { recursive: true });
      }
      
      // Source directories from the installed package
      const packageDir = path.resolve(__dirname, '..');
      
      // Import utilities
      const { copyRecursiveSync } = await import('./utils/file.js');
      
      // Copy templates/ directory
      const templatesSrc = path.join(packageDir, 'templates');
      const templatesDest = path.join(specwrightDir, 'templates');
      if (fs.existsSync(templatesSrc)) {
        copyRecursiveSync(templatesSrc, templatesDest);
      }
      
      // Copy agents/ directory
      const agentsSrc = path.join(packageDir, 'agents');
      const agentsDest = path.join(specwrightDir, 'agents');
      if (fs.existsSync(agentsSrc)) {
        copyRecursiveSync(agentsSrc, agentsDest);
      }
      
      // Create outputs/ directories with .gitkeep files
      const outputsDir = path.join(specwrightDir, 'outputs');
      const projectsDir = path.join(outputsDir, 'projects');
      const issuesDir = path.join(outputsDir, 'issues');
      
      if (!fs.existsSync(outputsDir)) {
        fs.mkdirSync(outputsDir, { recursive: true });
      }
      if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
        fs.writeFileSync(path.join(projectsDir, '.gitkeep'), '');
      }
      if (!fs.existsSync(issuesDir)) {
        fs.mkdirSync(issuesDir, { recursive: true });
        fs.writeFileSync(path.join(issuesDir, '.gitkeep'), '');
      }
      
      logger.debug('✅ SpecWright initialized successfully!');
      
      res.json({ 
        success: true,
        message: 'SpecWright initialized successfully!'
      });
    } catch (error) {
      logger.error('Error initializing SpecWright:', error);
      res.status(500).json({ 
        error: 'Failed to initialize SpecWright',
        details: error.message
      });
    }
  });
  
  // Generate example project
  app.post('/api/generate-example-project', (req, res) => {
    try {
      // Check if already exists
      if (exampleProjectExists()) {
        return res.status(409).json({ 
          error: 'Example project already exists',
          exists: true 
        });
      }
      
      const result = generateExampleProject();
      
      if (result.success) {
        logger.debug('✅ Example project generated successfully');
        res.json({
          success: true,
          projectId: result.projectId,
          message: 'Example project "Team Invite System" created successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to generate example project'
        });
      }
    } catch (error) {
      logger.error('Error generating example project:', error);
      res.status(500).json({ 
        error: 'Failed to generate example project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Check if example project exists
  app.get('/api/example-project-exists', (req, res) => {
    try {
      res.json({ exists: exampleProjectExists() });
    } catch (error) {
      logger.error('Error checking example project:', error);
      res.status(500).json({ error: 'Failed to check example project status' });
    }
  });
  
  // ==========================================
  // Playbook API endpoints
  // ==========================================
  
  // Get playbook status (exists + content)
  app.get('/api/playbook/status', (req, res) => {
    try {
      const playbookPath = path.join(WORKSPACE_PATH, 'PLAYBOOK.md');
      const exists = fs.existsSync(playbookPath);
      
      if (exists) {
        const content = fs.readFileSync(playbookPath, 'utf-8');
        res.json({ exists: true, content });
      } else {
        res.json({ exists: false });
      }
    } catch (error) {
      logger.error('Error checking playbook status:', error);
      res.status(500).json({ error: 'Failed to check playbook status' });
    }
  });
  
  // Generate playbook prompt
  app.post('/api/playbook/generate', async (req, res) => {
    try {
      // Build the generation prompt
      const prompt = `@specwright/agents/playbook/generation_prompt.md
@package.json
@README.md

Follow the instructions in the generation prompt to create a PLAYBOOK.md file for this project.

IMPORTANT: Create the file at the project root as PLAYBOOK.md`;
      
      // Check if request is from integrated browser (skip automation)
      const skipAutomation = req.headers['x-integrated-browser'] === 'true';

      let result: OpenAIToolResult = { success: true };
      if (!skipAutomation) {
        // Trigger Cursor automation with workspace targeting
        result = await openCursorAndPaste(prompt, WORKSPACE_PATH);

        if (result.success) {
          logger.debug('⏳ Waiting for AI to create: PLAYBOOK.md');
          logger.debug('   File watcher is active - changes will appear automatically');
        }
      }

      res.json({
        success: result.success,
        prompt,
        message: skipAutomation
          ? 'Prompt ready. Please paste manually in your AI tool.'
          : (result.success
            ? 'AI tool opened and prompt pasted. Review and press Enter.'
            : 'Failed to open AI tool automatically. Prompt is in clipboard.')
      });
    } catch (error) {
      logger.error('Error generating playbook prompt:', error);
      res.status(500).json({ error: 'Failed to generate playbook prompt' });
    }
  });

  // Update playbook prompt
  app.post('/api/playbook/update', async (req, res) => {
    try {
      const playbookPath = path.join(WORKSPACE_PATH, 'PLAYBOOK.md');
      
      if (!fs.existsSync(playbookPath)) {
        return res.status(404).json({ error: 'No PLAYBOOK.md found. Generate one first.' });
      }
      
      // Build the update prompt
      const prompt = `@specwright/agents/playbook/update_prompt.md
@PLAYBOOK.md
@package.json
@README.md

Follow the instructions in the update prompt to sync the PLAYBOOK.md with the current codebase state.

Key points:
- Generate a Sync Impact Report at the top
- Update version number appropriately (MAJOR/MINOR/PATCH)
- Only change what has actually changed in the codebase
- Document any drift from stated principles`;
      
      // Check if request is from integrated browser (skip automation)
      const skipAutomation = req.headers['x-integrated-browser'] === 'true';

      let updateResult: OpenAIToolResult = { success: true };
      if (!skipAutomation) {
        // Trigger Cursor automation with workspace targeting
        updateResult = await openCursorAndPaste(prompt, WORKSPACE_PATH);

        if (updateResult.success) {
          logger.debug('⏳ Waiting for AI to update: PLAYBOOK.md');
          logger.debug('   File watcher is active - changes will appear automatically');
        }
      }

      res.json({
        success: updateResult.success,
        prompt,
        message: skipAutomation
          ? 'Prompt ready. Please paste manually in your AI tool.'
          : (updateResult.success
            ? 'AI tool opened and prompt pasted. Review and press Enter.'
            : 'Failed to open AI tool automatically. Prompt is in clipboard.')
      });
    } catch (error) {
      logger.error('Error generating update prompt:', error);
      res.status(500).json({ error: 'Failed to generate update prompt' });
    }
  });

  // Audit playbook prompt (no automation needed - just copy to clipboard)
  app.post('/api/playbook/audit', (req, res) => {
    try {
      const playbookPath = path.join(WORKSPACE_PATH, 'PLAYBOOK.md');
      
      if (!fs.existsSync(playbookPath)) {
        return res.status(404).json({ error: 'No PLAYBOOK.md found. Generate one first.' });
      }
      
      // Build the audit prompt
      const prompt = `@specwright/agents/playbook/audit_prompt.md
@PLAYBOOK.md

Follow the instructions in the audit prompt to analyze codebase compliance with the playbook.

IMPORTANT: 
- Only analyze and provide recommendations
- Do NOT implement any changes
- Be specific with evidence (file names, line numbers, examples)
- Prioritize findings by impact (Critical/High/Medium/Low)
- Acknowledge what's working well

Generate a comprehensive audit report showing:
1. Compliance status for each principle
2. Specific evidence of compliance or violations
3. Actionable recommendations for improvements
4. Priority actions sorted by impact`;
      
      // Audit is read-only, so just return the prompt for manual pasting
      res.json({ 
        success: true, 
        prompt,
        message: 'Audit prompt generated. Copy and paste into your AI tool.'
      });
    } catch (error) {
      logger.error('Error generating audit prompt:', error);
      res.status(500).json({ error: 'Failed to generate audit prompt' });
    }
  });
  
  // Get file content for customization
  app.get('/api/customize/file', async (req, res) => {
    try {
      const filePath = req.query.path as string;
      
      if (!filePath) {
        return res.status(400).json({ error: 'File path required' });
      }
      
      // Security: only allow files in specwright/agents/ and specwright/templates/ directories
      const isValidPath = filePath.startsWith('specwright/agents/') || 
                          filePath.startsWith('specwright/templates/');
      
      if (!isValidPath) {
        return res.status(403).json({ error: 'Access denied: only specwright/agents/ and specwright/templates/ files can be accessed' });
      }
      
      // Only allow .md files
      if (!filePath.endsWith('.md')) {
        return res.status(403).json({ error: 'Access denied: only .md files can be edited' });
      }
      
      const absolutePath = path.join(WORKSPACE_PATH, filePath);
      
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: `File not found: ${filePath}. Make sure you have run 'specwright init' in this project.` });
      }
      
      const content = fs.readFileSync(absolutePath, 'utf-8');
      res.json({ content, path: filePath });
      
    } catch (error) {
      logger.error('Error reading file:', error);
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  // Save file content for customization
  app.put('/api/customize/file', async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      
      if (!filePath || content === undefined) {
        return res.status(400).json({ error: 'File path and content required' });
      }
      
      // Security: only allow files in specwright/agents/ and specwright/templates/ directories
      const isValidPath = filePath.startsWith('specwright/agents/') || 
                          filePath.startsWith('specwright/templates/');
      
      if (!isValidPath) {
        return res.status(403).json({ error: 'Access denied: only specwright/agents/ and specwright/templates/ files can be modified' });
      }
      
      // Only allow .md files
      if (!filePath.endsWith('.md')) {
        return res.status(403).json({ error: 'Access denied: only .md files can be edited' });
      }
      
      const absolutePath = path.join(WORKSPACE_PATH, filePath);
      
      // Check if file exists (it should if init was run)
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: `File not found: ${filePath}. Make sure you have run 'specwright init' in this project.` });
      }
      
      // Create backup before saving
      const backupPath = `${absolutePath}.backup`;
      fs.copyFileSync(absolutePath, backupPath);
      logger.debug(`✅ Created backup: ${backupPath}`);
      
      fs.writeFileSync(absolutePath, content, 'utf-8');
      logger.debug(`✅ Saved file: ${filePath}`);
      res.json({ success: true, message: 'File saved successfully' });
      
    } catch (error) {
      logger.error('Error saving file:', error);
      res.status(500).json({ error: 'Failed to save file' });
    }
  });

  // Get git preferences
  app.get('/api/settings/git-preferences', (req, res) => {
    try {
      const preferences = loadGitPreferences();
      res.json(preferences);
    } catch (error) {
      logger.error('Error loading git preferences:', error);
      res.status(500).json({ error: 'Failed to load git preferences' });
    }
  });

  // Save git preferences
  app.put('/api/settings/git-preferences', (req, res) => {
    try {
      const preferences: GitPreferences = req.body;
      
      // Validate preferences
      if (typeof preferences.enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid preferences: enabled must be a boolean' });
      }
      
      if (!['none', 'branch-per-issue', 'branch-per-project'].includes(preferences.strategy)) {
        return res.status(400).json({ error: 'Invalid preferences: strategy must be none, branch-per-issue, or branch-per-project' });
      }
      
      saveGitPreferences(preferences);
      logger.debug('✅ Git preferences saved:', preferences);
      res.json({ success: true, preferences });
      
    } catch (error) {
      logger.error('Error saving git preferences:', error);
      res.status(500).json({ error: 'Failed to save git preferences' });
    }
  });

  // Get AI tool preference
  app.get('/api/settings/ai-tool', (req, res) => {
    try {
      const settings = loadSettings();
      res.json({ tool: settings.aiTool });
    } catch (error) {
      logger.error('Error loading AI tool preference:', error);
      res.status(500).json({ error: 'Failed to load AI tool preference' });
    }
  });

  // Save AI tool preference
  app.put('/api/settings/ai-tool', (req, res) => {
    try {
      const { tool } = req.body;
      
      // Validate tool
      if (!isValidAITool(tool)) {
        return res.status(400).json({ 
          error: 'Invalid tool: must be cursor, windsurf, github-copilot, or claude-code' 
        });
      }
      
      const updated = updateSettings({ aiTool: tool as AITool });
      logger.debug('✅ AI tool preference saved:', tool);
      res.json({ success: true, tool: updated.aiTool });
      
    } catch (error) {
      logger.error('Error saving AI tool preference:', error);
      res.status(500).json({ error: 'Failed to save AI tool preference' });
    }
  });

  // Get all available AI tool configurations
  app.get('/api/settings/ai-tools', (req, res) => {
    try {
      const tools = getAllAIToolConfigs();
      res.json(tools);
    } catch (error) {
      logger.error('Error getting AI tool configs:', error);
      res.status(500).json({ error: 'Failed to get AI tool configurations' });
    }
  });

  // Get headless CLI status for all AI tools
  app.get('/api/settings/headless-status', async (req, res) => {
    try {
      const status = await getHeadlessStatus();
      res.json(status);
    } catch (error) {
      logger.error('Error getting headless status:', error);
      res.status(500).json({ error: 'Failed to get headless status' });
    }
  });

  // Get cost estimation settings
  app.get('/api/settings/cost-estimation', (req, res) => {
    try {
      const settings = loadSettings();
      res.json(settings.costEstimation);
    } catch (error) {
      logger.error('Error loading cost estimation settings:', error);
      res.status(500).json({ error: 'Failed to load cost estimation settings' });
    }
  });
  
  // Save cost estimation settings
  app.put('/api/settings/cost-estimation', (req, res) => {
    try {
      const { enabled, tier } = req.body;
      
      // Validate settings
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid settings: enabled must be a boolean' });
      }
      
      if (!['budget', 'standard', 'premium'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid settings: tier must be budget, standard, or premium' });
      }
      
      const updated = updateSettings({ costEstimation: { enabled, tier } });
      logger.debug('✅ Cost estimation settings saved:', updated.costEstimation);
      res.json({ success: true, costEstimation: updated.costEstimation });
      
    } catch (error) {
      logger.error('Error saving cost estimation settings:', error);
      res.status(500).json({ error: 'Failed to save cost estimation settings' });
    }
  });
  
  // Get a specific project with all its documentation
  app.get('/api/projects/:id', (req, res) => {
    try {
      const projectId = req.params.id;
      const projectPath = getProjectPath(projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Read all relevant files using centralized path utilities
      const prdPath = getPRDPath(projectId);
      const designPath = getDesignBriefPath(projectId);
      const wireframesPath = getWireframesPath(projectId);
      const techPath = getTechnicalSpecPath(projectId);
      const techChoicesPath = getTechnologyChoicesPath(projectId);
      const summaryPath = getProjectSummaryPath(projectId);
      const requestPath = path.join(projectPath, 'project_request.md');
      
      const data: any = { 
        id: projectId,
        path: projectPath
      };
      
      // Also get acceptance criteria path
      const acceptanceCriteriaPath = getAcceptanceCriteriaPath(projectId);
      
      if (fs.existsSync(requestPath)) {
        data.request = fs.readFileSync(requestPath, 'utf-8');
      }
      if (fs.existsSync(prdPath)) {
        data.prd = fs.readFileSync(prdPath, 'utf-8');
      }
      if (fs.existsSync(acceptanceCriteriaPath)) {
        data.acceptanceCriteria = fs.readFileSync(acceptanceCriteriaPath, 'utf-8');
      }
      if (fs.existsSync(designPath)) {
        data.design = fs.readFileSync(designPath, 'utf-8');
      }
      // Also get screens.json path
      const screensPath = getScreensPath(projectId);
      if (fs.existsSync(screensPath)) {
        data.screens = fs.readFileSync(screensPath, 'utf-8');
      }
      if (fs.existsSync(techPath)) {
        data.tech = fs.readFileSync(techPath, 'utf-8');
      }
      if (fs.existsSync(techChoicesPath)) {
        const techChoicesContent = fs.readFileSync(techChoicesPath, 'utf-8');
        data.techChoices = techChoicesContent;
      }
      if (fs.existsSync(summaryPath)) {
        data.summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      }
      
      res.json(data);
    } catch (error) {
      logger.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project details' });
    }
  });
  
  // Update a project document
  app.put('/api/projects/:id/document/:documentType', (req, res) => {
    try {
      const { id, documentType } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      const projectPath = getProjectPath(id);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Use centralized path utility
      const filePath = getDocumentPathByType(id, documentType);
      
      if (!filePath) {
        return res.status(400).json({ error: 'Invalid document type' });
      }
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write the updated content
      fs.writeFileSync(filePath, content, 'utf-8');
      
      res.json({ success: true, message: 'Document updated successfully' });
    } catch (error) {
      logger.error('Error updating document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  });
  
  // Get all issues across all projects
  app.get('/api/issues', (req, res) => {
    try {
      const projects = getExistingProjects();
      const issues = getAllIssues(projects);
      
      // Debug: Log issue statuses
      logger.debug('\n📋 [API /api/issues] Returning issues:');
      issues.forEach(issue => {
        logger.debug(`   ${issue.issueId}: status="${issue.status}"`);
      });
      
      res.json(issues);
    } catch (error) {
      logger.error('Error fetching issues:', error);
      res.status(500).json({ error: 'Failed to fetch issues' });
    }
  });
  
  // Scoping API endpoints
  
  // Get or create scoping session
  app.post('/api/scoping/start', (req, res) => {
    try {
      const { userRequest } = req.body;
      
      // No longer require userRequest at start - can be entered in UI
      
      // Create/reset scoping plan file
      const scopingPlanFile = path.join(OUTPUT_DIR, 'scoping_plan.json');
      const templatePath = path.join(TEMPLATES_DIR, 'scoping_plan_template.json');
      
      if (fs.existsSync(templatePath)) {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        fs.writeFileSync(scopingPlanFile, templateContent);
      } else {
        // Create minimal template
        const minimalTemplate = {
          type: "direct",
          scope_analysis: "[ANALYSIS_PLACEHOLDER]",
          direct_work_suggestion: "[SUGGESTION_PLACEHOLDER]"
        };
        fs.writeFileSync(scopingPlanFile, JSON.stringify(minimalTemplate, null, 2));
      }
      
      res.json({ 
        success: true,
        sessionId: Date.now().toString(),
        userRequest: userRequest || '',
        scopingPlanPath: scopingPlanFile
      });
    } catch (error) {
      logger.error('Error starting scoping session:', error);
      res.status(500).json({ error: 'Failed to start scoping session' });
    }
  });
  
  // Trigger AI classification in Cursor
  app.post('/api/scoping/classify', async (req, res) => {
    try {
      const { userRequest } = req.body;
      
      if (!userRequest) {
        return res.status(400).json({ error: 'User request is required' });
      }
      
      // RESET scoping_plan.json to placeholder state before starting
      // This ensures a clean slate regardless of previous user actions
      resetScopingPlanFile();
      
      // Build the scoping prompt
      const scopingPromptPath = path.join(TEMPLATES_DIR, 'scoping_prompt.md');
      let scopingPromptTemplate = '';
      
      if (fs.existsSync(scopingPromptPath)) {
        scopingPromptTemplate = fs.readFileSync(scopingPromptPath, 'utf8');
      }
      
      const prompt = `@specwright/templates/scoping_prompt.md

USER REQUEST:
${userRequest}

Please analyze this request and update the scoping_plan.json file.`;
      
      // Check if request is from integrated browser (skip automation)
      const skipAutomation = req.headers['x-integrated-browser'] === 'true';

      let result: OpenAIToolResult = { success: true };
      if (!skipAutomation) {
        // Trigger Cursor automation with workspace targeting
        result = await openCursorAndPaste(prompt, WORKSPACE_PATH);

        if (result.success) {
          logger.debug('⏳ Waiting for AI to update: scoping_plan.json');
          logger.debug('   File watcher is active - changes will appear automatically');

          // Save session ID if headless mode was used
          if (result.sessionId) {
            saveScopingSession(result.sessionId);
            logger.debug(`📌 Saved scoping session ID: ${result.sessionId}`);
          }
        }
      }

      res.json({
        success: result.success,
        sessionId: result.sessionId,
        message: skipAutomation
          ? 'Prompt ready. Please paste manually in Cursor.'
          : (result.success
            ? 'Cursor opened and prompt pasted. Review and press Enter.'
            : 'Failed to open Cursor automatically. Prompt is in clipboard.'),
        prompt // Return the prompt so UI can offer to copy it
      });
    } catch (error) {
      logger.error('Error triggering classification:', error);
      res.status(500).json({ error: 'Failed to trigger classification' });
    }
  });
  
  // Get current scoping plan status
  app.get('/api/scoping/status', (req, res) => {
    try {
      const scopingPlanFile = path.join(OUTPUT_DIR, 'scoping_plan.json');

      if (!fs.existsSync(scopingPlanFile)) {
        return res.json({ status: 'not_started' });
      }

      const content = fs.readFileSync(scopingPlanFile, 'utf8');
      const plan = JSON.parse(content);

      // Check if it's still a template (has placeholders)
      const isTemplate =
        content.includes('[ANALYSIS_PLACEHOLDER]') ||
        content.includes('[SUGGESTION_PLACEHOLDER]');

      res.json({
        status: isTemplate ? 'generating' : 'complete',
        plan
      });
    } catch (error) {
      logger.error('Error getting scoping status:', error);
      res.status(500).json({ error: 'Failed to get scoping status' });
    }
  });

  // Get session IDs for a project or scoping
  app.get('/api/sessions/:projectId?', (req, res) => {
    try {
      const projectId = req.params.projectId || '_scoping_active';
      const sessions = getAllSessions(projectId);

      logger.debug(`📌 Retrieved sessions for ${projectId}:`, sessions);
      res.json({ sessions });
    } catch (error) {
      logger.error('Error getting sessions:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  });

  // Create projects from scoping plan
  app.post('/api/scoping/finalize', async (req, res) => {
    try {
      const scopingPlanFile = path.join(OUTPUT_DIR, 'scoping_plan.json');
      
      if (!fs.existsSync(scopingPlanFile)) {
        return res.status(404).json({ error: 'No scoping plan found' });
      }
      
      // Read and parse the scoping plan
      const planContent = fs.readFileSync(scopingPlanFile, 'utf-8');
      const scopingPlan = JSON.parse(planContent);
      
      // Validate that it's not a template
      if (planContent.includes('[ANALYSIS_PLACEHOLDER]') || 
          planContent.includes('[SUGGESTION_PLACEHOLDER]')) {
        return res.status(400).json({ error: 'Scoping plan is not complete yet' });
      }
      
      // Finalize the scope (creates projects) and get the newly created project folder names
      const createdProjectFolderNames = await finalizeScopingPlan(scopingPlan);
      
      // Get all projects
      const projects = getExistingProjects();
      const enriched = enrichProjectsWithProgress(projects);
      
      res.json({ 
        success: true,
        type: scopingPlan.type,
        projects: enriched,
        projectIds: createdProjectFolderNames // Return only the newly created project folder names
      });
    } catch (error) {
      logger.error('Error finalizing scope:', error);
      res.status(500).json({ error: 'Failed to finalize scope' });
    }
  });

  // Refine AI output with user feedback
  // Uses --resume to continue a previous Claude session
  app.post('/api/refine', async (req, res) => {
    try {
      const { phase, projectId, sessionId, feedback, images } = req.body;

      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ error: 'Feedback is required' });
      }

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required for refinement' });
      }

      logger.debug(chalk.magenta(`\n🔄 Starting refinement for phase: ${phase}`));
      logger.debug(chalk.cyan(`  Session ID: ${sessionId}`));
      logger.debug(chalk.cyan(`  Feedback: ${feedback.substring(0, 100)}...`));
      logger.debug(chalk.cyan(`  Images: ${images?.length || 0}`));

      // Build the refinement prompt
      let prompt = `USER FEEDBACK:\n${feedback}\n\nPlease refine your previous output based on this feedback.`;

      // Add image references if provided
      if (images && images.length > 0) {
        prompt += `\n\nThe user has attached ${images.length} image(s) for reference.`;
        // Note: Claude CLI image support would need to be added here
        // For now, we mention that images were attached
      }

      // Broadcast that refinement has started
      broadcastHeadlessStarted('claude-code', phase);

      // Execute with resume
      const result = await executeClaudeHeadless(prompt, {
        workingDir: WORKSPACE_PATH,
        resumeSessionId: sessionId,
        onProgress: (status: string) => {
          broadcastHeadlessProgress(status, phase);
        }
      });

      // Broadcast completion with session ID for frontend
      broadcastHeadlessCompleted('claude-code', result.success, phase, result.sessionId);

      if (result.success) {
        res.json({
          success: true,
          sessionId: result.sessionId || sessionId // Return new or same session ID
        });
      } else {
        res.json({
          success: false,
          error: result.error || 'Refinement failed'
        });
      }
    } catch (error) {
      logger.error('Error during refinement:', error);
      res.status(500).json({ error: 'Failed to refine output' });
    }
  });

  // Save project settings (stored in project_status.json)
  app.post('/api/projects/:projectId/settings', (req, res) => {
    try {
      const { projectId } = req.params;
      const { settings } = req.body;
      const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Save settings to project_status.json using status service
      updateProjectSettings(projectId, settings);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error saving project settings:', error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });
  
  // Update project icon (stored in project_status.json)
  app.post('/api/projects/:projectId/icon', (req, res) => {
    try {
      const { projectId } = req.params;
      const { icon } = req.body;
      const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Validate icon structure if provided
      if (icon !== null && icon !== undefined) {
        if (!icon.type || !['icon', 'emoji'].includes(icon.type)) {
          return res.status(400).json({ error: 'Invalid icon type. Must be "icon" or "emoji"' });
        }
        if (!icon.value || typeof icon.value !== 'string') {
          return res.status(400).json({ error: 'Invalid icon value' });
        }
      }
      
      // Save icon to project_status.json using status service
      updateProjectIcon(projectId, icon || null);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error saving project icon:', error);
      res.status(500).json({ error: 'Failed to save icon' });
    }
  });
  
  // Get project icon (from project_status.json)
  app.get('/api/projects/:projectId/icon', (req, res) => {
    try {
      const { projectId } = req.params;
      const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const icon = getProjectIcon(projectId);
      
      res.json({ icon: icon || null });
    } catch (error) {
      logger.error('Error getting project icon:', error);
      res.status(500).json({ error: 'Failed to get icon' });
    }
  });
  
  // Create project manually (without AI scoping)
  app.post('/api/projects/create-manual', async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required' });
      }
      
      logger.debug('');
      logger.debug(chalk.yellowBright('📁 Creating Manual Project...'));
      logger.debug('');
      
      const PROJECTS_DIR = path.join(OUTPUT_DIR, 'projects');
      if (!fs.existsSync(PROJECTS_DIR)) {
        fs.mkdirSync(PROJECTS_DIR, { recursive: true });
      }
      
      // Get next project ID
      const { getNextProjectId } = await import('./utils/id-generator.js');
      const projectId = getNextProjectId();
      
      // Default settings for manually created projects
      const defaultSettings = {
        question_depth: 'standard' as const,
        document_length: 'standard' as const
      };
      
      // Create project folder using existing service
      const projectDir = createProjectFolder(
        projectId,
        name,
        description,
        {
          testable_outcome: undefined, // Leave testable_outcome empty for manual projects
          dependencies: 'None',
          from_project: 'Manual Creation',
          previous_project: undefined
        }
      );
      
      const projectSlug = name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
      const projectFolderName = `${projectId}-${projectSlug}`;
      
      // Initialize project status tracking with default settings
      initializeProjectStatus(projectFolderName, defaultSettings);
      
      logger.debug(chalk.green(`✅ Created: ${projectFolderName}/`));
      logger.debug('');
      
      res.json({ 
        success: true,
        projectId: projectFolderName,
        message: 'Project created successfully'
      });
    } catch (error) {
      logger.error('Error creating manual project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });
  
  // Questions API endpoints
  
  // Get ALL questions for a project (for viewing in project detail)
  app.get('/api/projects/:projectId/questions', (req, res) => {
    try {
      const { projectId } = req.params;
      const projectPath = getProjectPath(projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const result: {
        pm: any | null;
        ux: any | null;
        engineer: any | null;
      } = {
        pm: null,
        ux: null,
        engineer: null
      };
      
      // Read PM questions
      const pmQuestionsFile = getPMQuestionsPath(projectId);
      if (fs.existsSync(pmQuestionsFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(pmQuestionsFile, 'utf-8'));
          // Only include if it has real questions (not just placeholders)
          if (content.questions && content.questions.length > 0 && 
              !content.questions[0]?.question?.includes('Waiting for')) {
            result.pm = content;
          }
        } catch (e) {
          logger.error('Error reading PM questions:', e);
        }
      }
      
      // Read UX questions
      const uxQuestionsFile = getUXQuestionsPath(projectId);
      if (fs.existsSync(uxQuestionsFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(uxQuestionsFile, 'utf-8'));
          // Only include if it has real questions
          if (content.questions && content.questions.length > 0 && 
              !content.questions[0]?.question?.includes('Waiting for')) {
            result.ux = content;
          }
        } catch (e) {
          logger.error('Error reading UX questions:', e);
        }
      }
      
      // Read Engineer questions
      const engineerQuestionsFile = getEngineerQuestionsPath(projectId);
      if (fs.existsSync(engineerQuestionsFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(engineerQuestionsFile, 'utf-8'));
          // Only include if it has real questions
          if (content.questions && content.questions.length > 0 && 
              !content.questions[0]?.question?.includes('Waiting for')) {
            result.engineer = content;
          }
        } catch (e) {
          logger.error('Error reading Engineer questions:', e);
        }
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Error fetching project questions:', error);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  });
  
  // Get questions for a specific phase
  app.get('/api/questions/:projectId/:phase', (req, res) => {
    try {
      const { projectId, phase } = req.params;
      const projectPath = getProjectPath(projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      let questionsFile: string;
      if (phase === 'pm') {
        questionsFile = getPMQuestionsPath(projectId);
      } else if (phase === 'ux') {
        questionsFile = getUXQuestionsPath(projectId);
      } else if (phase === 'engineer') {
        questionsFile = getEngineerQuestionsPath(projectId);
      } else {
        return res.status(400).json({ error: 'Invalid phase' });
      }
      
      if (!fs.existsSync(questionsFile)) {
        return res.status(404).json({ error: 'Questions file not found' });
      }
      
      const questionsData = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
      res.json(questionsData);
    } catch (error) {
      logger.error('Error fetching questions:', error);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  });
  
  // Save answers for a specific phase
  app.post('/api/questions/:projectId/:phase', (req, res) => {
    try {
      const { projectId, phase } = req.params;
      const questionsData = req.body;
      const projectPath = getProjectPath(projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      let questionsFile: string;
      let agent: AgentType;
      
      if (phase === 'pm') {
        questionsFile = getPMQuestionsPath(projectId);
        agent = 'pm';
      } else if (phase === 'ux') {
        questionsFile = getUXQuestionsPath(projectId);
        agent = 'ux';
      } else if (phase === 'engineer') {
        questionsFile = getEngineerQuestionsPath(projectId);
        agent = 'engineer';
      } else {
        return res.status(400).json({ error: 'Invalid phase' });
      }
      
      // Ensure directory exists
      ensureDir(path.dirname(questionsFile));
      
      // Write the updated questions data
      fs.writeFileSync(questionsFile, JSON.stringify(questionsData, null, 2));
      
      // Mark questions-answer phase as complete and advance
      completePhaseAndAdvance(projectId, agent, 'questions-answer');
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error saving questions:', error);
      res.status(500).json({ error: 'Failed to save questions' });
    }
  });
  
  // Specification API endpoints
  
  // Get specification status for a project
  app.get('/api/specification/status/:projectId', (req, res) => {
    logger.debug(`\n📊 [API] GET /api/specification/status/${req.params.projectId}`);
    
    try {
      const projectPath = path.join(OUTPUT_DIR, 'projects', req.params.projectId);
      
      if (!fs.existsSync(projectPath)) {
        logger.debug(`❌ [API] Project not found: ${req.params.projectId}`);
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Get or create status
      let status = getOrCreateStatus(req.params.projectId);
      
      // 🔧 RESILIENCE: Validate and auto-recover from invalid phase states
      try {
        status = validateAndRecoverPhase(req.params.projectId);
      } catch (validationError) {
        logger.error(`⚠️  [API] Validation/recovery failed, using status as-is:`, validationError);
        // Continue with the status we have - don't fail the entire request
      }
      
      logger.debug(`📋 [API] Status loaded:`);
      logger.debug(`   - Current Agent: ${status.currentAgent}`);
      logger.debug(`   - Current Phase: ${status.currentPhase}`);
      logger.debug(`   - PM Complete: ${status.agents.pm.status === 'complete'}`);
      logger.debug(`   - UX Complete: ${status.agents.ux.status === 'complete'}`);
      logger.debug(`   - Engineer Complete: ${status.agents.engineer.status === 'complete'}`);
      
      // Use status directly - no conversion needed!
      const currentAgent = status.currentAgent;
      const currentPhase = status.currentPhase;
      
      // Map phase status to completion boolean for backward compatibility
      const pmComplete = status.agents.pm.status === 'complete';
      const uxComplete = status.agents.ux.status === 'complete';
      const engineerComplete = status.agents.engineer.status === 'complete';
      
      // Determine if we need review based on phase status
      let needsReview = false;
      let reviewDocument: string | null = null;
      let nextPhase: string | null = null;
      
      if (currentAgent !== 'complete') {
        const agentStatus = status.agents[currentAgent];
        const currentPhaseName = agentStatus.currentPhase;
        
        if (currentPhaseName) {
          const phaseData = agentStatus.phases[currentPhaseName];
          
          // RETROACTIVE CHECK: For generate phases, check if files exist regardless of status
          // This handles cases where user left and came back, or status wasn't properly updated
          let effectiveStatus = phaseData.status;
          const isGeneratePhase = currentPhaseName.includes('-generate');
          
          // Only run retroactive check if:
          // 1. It's a generate phase
          // 2. Status is NOT already user-reviewing (meaning we haven't already advanced)
          if (isGeneratePhase && phaseData.status !== 'user-reviewing') {
            logger.debug(`🔍 [API] Retroactive check for generate phase: ${currentAgent}-${currentPhaseName} (status: ${phaseData.status})`);
            
            // Check if the file was actually updated
            // Pass the phase startedAt timestamp for timestamp-based checking
            const phaseStartedAt = phaseData.startedAt || null;
            let fileWasUpdated = false;
            
            if (currentPhaseName === 'questions-generate' && currentAgent === 'pm') {
              fileWasUpdated = isPMQuestionsGenerated(projectPath, phaseStartedAt);
            } else if (currentPhaseName === 'prd-generate') {
              fileWasUpdated = isPMPRDComplete(projectPath, phaseStartedAt);
            } else if (currentPhaseName === 'questions-generate' && currentAgent === 'ux') {
              const projectId = path.basename(projectPath);
              const uxQuestionsFile = getUXQuestionsPath(projectId);
              if (fs.existsSync(uxQuestionsFile)) {
                try {
                  const content = JSON.parse(fs.readFileSync(uxQuestionsFile, 'utf-8'));
                  fileWasUpdated = content.questions && content.questions.length > 0 && 
                    !content.questions[0].question.includes('Waiting for');
                } catch (e) {
                  fileWasUpdated = false;
                }
              }
            } else if (currentPhaseName === 'design-brief-generate') {
              // UX phase generates design_brief.md AND screens.json
              fileWasUpdated = isUXWireframesComplete(projectPath, phaseStartedAt);
              logger.debug(`🎨 [API] UX files complete check (design brief + screens.json): ${fileWasUpdated}`);
            } else if (currentPhaseName === 'questions-generate' && currentAgent === 'engineer') {
              const projectId = path.basename(projectPath);
              const engineerQuestionsFile = getEngineerQuestionsPath(projectId);
              if (fs.existsSync(engineerQuestionsFile)) {
                try {
                  const content = JSON.parse(fs.readFileSync(engineerQuestionsFile, 'utf-8'));
                  fileWasUpdated = content.questions && content.questions.length > 0 && 
                    !content.questions[0].question?.includes('Waiting for');
                } catch (e) {
                  fileWasUpdated = false;
                }
              }
            } else if (currentPhaseName === 'spec-generate') {
              fileWasUpdated = isArchitectComplete(projectPath, phaseStartedAt);
            }
            
            logger.debug(`📁 [API] Files complete: ${fileWasUpdated}`);
            
            // Handle mismatch between status and actual file state
            if (fileWasUpdated) {
              // File WAS updated but status wasn't advanced yet (user left and came back)
              // Retroactively advance the phase now
              logger.debug(`✨ [API] Phase ${currentAgent}-${currentPhaseName} files ARE complete - advancing phase retroactively`);
              markAIWorkComplete(req.params.projectId);
              
              // Re-read the updated status and get the NEW phase info
              status = getOrCreateStatus(req.params.projectId);
              const updatedAgentStatus = status.agents[currentAgent];
              const updatedPhaseName = updatedAgentStatus.currentPhase;
              logger.debug(`📍 [API] After retroactive advance: ${currentAgent}-${updatedPhaseName}`);
              
              // Map the NEW phase name to determine review document
              needsReview = true;
              if (updatedPhaseName === 'prd-review') {
                reviewDocument = 'documents/prd.md';
              } else if (updatedPhaseName === 'design-brief-review') {
                reviewDocument = 'documents/design_brief.md';
              } else if (updatedPhaseName === 'wireframes-review') {
                reviewDocument = 'documents/ux_designer_wireframes.md';
              } else if (updatedPhaseName === 'spec-review') {
                reviewDocument = 'documents/technical_specification.md';
              }
              
              // Skip rest of phase logic since we've handled it here
              effectiveStatus = 'user-reviewing';
            } else if (phaseData.status === 'ai-working') {
              // File not updated but status is ai-working - allow retry
              logger.debug(`⚠️  [API] Phase ${currentAgent}-${currentPhaseName} is ai-working but file not updated - allowing retry`);
              effectiveStatus = 'not-started';
            }
          }
          
          // If phase is user-reviewing, show review screen (and not handled above)
          if (effectiveStatus === 'user-reviewing' && !needsReview) {
            needsReview = true;
            
            // Map phase to document path
            if (currentPhaseName === 'prd-review') {
              reviewDocument = 'documents/prd.md';
            } else if (currentPhaseName === 'design-brief-review') {
              reviewDocument = 'documents/design_brief.md';
            } else if (currentPhaseName === 'wireframes-review') {
              reviewDocument = 'documents/ux_designer_wireframes.md';
            } else if (currentPhaseName === 'spec-review') {
              reviewDocument = 'documents/technical_specification.md';
            }
          }
          
          // Determine next phase for button
          // Don't show button for awaiting-user phases (they need to fill form)
          if (effectiveStatus === 'not-started') {
            // Phase ready to start (or needs retry)
            nextPhase = `${currentAgent}-${currentPhaseName}`;
          } else if (effectiveStatus === 'complete') {
            // Phase complete, move to next
            const phaseList = getPhaseListForAgent(currentAgent);
            const currentIndex = phaseList.indexOf(currentPhaseName);
            
            if (currentIndex < phaseList.length - 1) {
              nextPhase = `${currentAgent}-${phaseList[currentIndex + 1]}`;
            } else if (currentAgent === 'pm' && pmComplete) {
              nextPhase = 'ux-questions-generate';
            } else if (currentAgent === 'ux' && uxComplete) {
              nextPhase = 'engineer-questions-generate';
            }
          }
          // Note: awaiting-user and user-reviewing don't get nextPhase
        }
      }
      
      // Use the current status values (may have been updated retroactively)
      const finalPmComplete = status.agents.pm.status === 'complete';
      const finalUxComplete = status.agents.ux.status === 'complete';
      const finalEngineerComplete = status.agents.engineer.status === 'complete';
      
      res.json({
        projectId: req.params.projectId,
        phases: {
          pm: { complete: finalPmComplete },
          ux: { complete: finalUxComplete },
          engineer: { complete: finalEngineerComplete }
        },
        currentPhase: status.currentPhase, // Use updated status
        nextPhase,
        needsReview,
        reviewDocument,
        isComplete: finalPmComplete && finalUxComplete && finalEngineerComplete
      });
      
      logger.debug(`📤 [API] Returning status:`);
      logger.debug(`   - currentPhase: ${status.currentPhase}`);
      logger.debug(`   - nextPhase: ${nextPhase}`);
      logger.debug(`   - needsReview: ${needsReview}`);
      logger.debug(`   - reviewDocument: ${reviewDocument}`);
      
    } catch (error) {
      logger.error(`❌ [API] Error getting specification status:`, error);
      res.status(500).json({ error: 'Failed to get specification status' });
    }
  });
  
  // Helper function to get phase list for an agent
  function getPhaseListForAgent(agent: AgentType): string[] {
    const PHASE_LISTS = {
      pm: ['questions-generate', 'questions-answer', 'prd-generate', 'prd-review'],
      ux: ['questions-generate', 'questions-answer', 'design-brief-generate', 'design-brief-review'],
      engineer: ['questions-generate', 'questions-answer', 'spec-generate', 'spec-review']
    };
    
    return PHASE_LISTS[agent] || [];
  }
  
  // Get cost summary for a project
  app.get('/api/specification/cost/:projectId', (req, res) => {
    try {
      const projectId = req.params.projectId;
      const costSummary = getCostSummary(projectId);
      
      if (!costSummary) {
        // Cost estimation disabled
        return res.json({ enabled: false });
      }
      
      res.json(costSummary);
    } catch (error) {
      logger.error('Error fetching cost summary:', error);
      res.status(500).json({ error: 'Failed to fetch cost summary' });
    }
  });
  
  // Get document content for review
  app.get('/api/specification/document/:projectId/:documentPath(*)', (req, res) => {
    try {
      const projectPath = path.join(OUTPUT_DIR, 'projects', req.params.projectId);
      const documentPath = req.params.documentPath;
      const fullPath = path.join(projectPath, documentPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      res.json({ content });
    } catch (error) {
      logger.error('Error fetching document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });
  
  // Update document content (supports nested paths like engineer/technology_choices.json)
  app.put('/api/specification/document/:projectId/:documentPath(*)', (req, res) => {
    try {
      const { projectId, documentPath } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const fullPath = path.join(projectPath, documentPath);
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write the updated content
      fs.writeFileSync(fullPath, content, 'utf-8');
      
      res.json({ success: true, message: 'Document updated successfully' });
    } catch (error) {
      logger.error('Error updating document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  });
  
  // Approve a review and move to next phase
  app.post('/api/specification/approve/:projectId/:phase', async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
      const phase = req.params.phase;
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Parse phase to get agent and phase name
      // phase format: "pm-prd-review", "ux-design-brief-review", etc.
      const parts = phase.split('-');
      let agent: AgentType | null = null;
      let phaseName: string | null = null;
      
      if (phase === 'pm-prd-review') {
        agent = 'pm';
        phaseName = 'prd-review';
      } else if (phase === 'ux-design-brief-review') {
        agent = 'ux';
        phaseName = 'design-brief-review';
      } else if (phase === 'engineer-spec-review') {
        agent = 'engineer';
        phaseName = 'spec-review';
      }
      
      if (!agent || !phaseName) {
        return res.status(400).json({ error: 'Invalid phase format' });
      }
      
      // Mark phase as complete and advance
      const updatedStatus = completePhaseAndAdvance(projectId, agent, phaseName);
      
      // Determine next action based on new current phase
      let nextAction = null;
      const nextPhase = updatedStatus.currentPhase;
      
      if (nextPhase !== 'complete') {
        // Extract action from current phase
        nextAction = nextPhase;
      } else {
        nextAction = 'complete';
      }
      
      res.json({ 
        success: true,
        message: `${phase} approved`,
        phase,
        nextAction
      });
    } catch (error) {
      logger.error('Error approving phase:', error);
      res.status(500).json({ error: 'Failed to approve phase' });
    }
  });
  
  // Trigger Cursor for a specific phase
  app.post('/api/specification/continue/:projectId/:phase', async (req, res) => {
    try {
      const projectPath = path.join(OUTPUT_DIR, 'projects', req.params.projectId);
      const phase = req.params.phase;
      const { documentDetail } = req.body; // Extract parameters from request body
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Helper function to get detail instructions for documents
      const getDetailInstructions = (detail: string = 'balanced') => {
        const detailLevels: { [key: string]: { description: string; wordTarget: string; readTime: string } } = {
          quick: {
            description: 'STRICT WORD LIMIT: Maximum 900 words - this is a hard constraint, not a suggestion. Exceeding means task failure.',
            wordTarget: '600-900 words',
            readTime: '2-3 minutes'
          },
          balanced: {
            description: 'STRICT WORD LIMIT: Maximum 2100 words - this is a hard constraint, not a suggestion. Exceeding means task failure.',
            wordTarget: '1500-2100 words',
            readTime: '5-7 minutes'
          },
          thorough: {
            description: 'STRICT WORD LIMIT: Maximum 4500 words - this is a hard constraint, not a suggestion. Exceeding means task failure.',
            wordTarget: '3600-4500 words',
            readTime: '12-15 minutes'
          }
        };
        return detailLevels[detail] || detailLevels.balanced;
      }
      
      // Map API phase names to internal phase names
      const phaseMapping: { [key: string]: { agent: AgentType; phase: string } } = {
        'pm-questions': { agent: 'pm', phase: 'questions-generate' },
        'pm-questions-generate': { agent: 'pm', phase: 'questions-generate' },
        'pm-prd': { agent: 'pm', phase: 'prd-generate' },
        'pm-prd-generate': { agent: 'pm', phase: 'prd-generate' },
        'ux-questions': { agent: 'ux', phase: 'questions-generate' },
        'ux-questions-generate': { agent: 'ux', phase: 'questions-generate' },
        'ux-design-brief': { agent: 'ux', phase: 'design-brief-generate' },
        'ux-design-brief-generate': { agent: 'ux', phase: 'design-brief-generate' },
        'engineer-questions': { agent: 'engineer', phase: 'questions-generate' },
        'engineer-questions-generate': { agent: 'engineer', phase: 'questions-generate' },
        'engineer': { agent: 'engineer', phase: 'spec-generate' },
        'engineer-spec-generate': { agent: 'engineer', phase: 'spec-generate' }
      };
      
      const mappedPhase = phaseMapping[phase];
      if (mappedPhase) {
        // Update status to reflect that we're starting this phase
        const status = getOrCreateStatus(req.params.projectId);
        if (status.currentAgent === mappedPhase.agent && 
            status.agents[mappedPhase.agent].currentPhase === mappedPhase.phase) {
          // Phase matches, mark as ai-working
          markAIWorkStarted(req.params.projectId);
          
          // Small delay to ensure status file is written to disk before we create any files
          // that might trigger the file watcher (prevents race condition)
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Read project request
      const projectRequestFile = path.join(projectPath, 'project_request.md');
      let userRequest = '';
      if (fs.existsSync(projectRequestFile)) {
        const content = fs.readFileSync(projectRequestFile, 'utf-8');
        const lines = content.split('\n');
        let inDescription = false;
        for (const line of lines) {
          if (line.startsWith('## Description')) {
            inDescription = true;
            continue;
          }
          if (inDescription && line.startsWith('##')) {
            break;
          }
          if (inDescription && line.trim()) {
            userRequest = line.trim();
            break;
          }
        }
      }
      
      // Build prompt based on phase
      // Normalize phase name (remove -generate suffix for backward compatibility)
      const normalizedPhase = phase.replace('-generate', '');
      
      let prompt = '';
      const projectId = req.params.projectId;
      
      if (normalizedPhase === 'pm-questions') {
        const questionsFile = getPMQuestionsPath(projectId);
        
        // Ensure questions directory exists
        ensureDir(path.dirname(questionsFile));
        
        if (!fs.existsSync(questionsFile)) {
          // Create initial questions file
          const initialJson = {
            project_request: userRequest,
            questions: [
              {
                question: "Waiting for the Product Manager to generate questions....",
                answer: ""
              }
            ]
          };
          fs.writeFileSync(questionsFile, JSON.stringify(initialJson, null, 2));
        }
        
        prompt = generatePMQuestionsPrompt(projectPath, toRelativePath(questionsFile), userRequest);
        
      } else if (normalizedPhase === 'pm-prd') {
        const prdFile = getPRDPath(projectId);
        const acceptanceCriteriaFile = getAcceptanceCriteriaPath(projectId);
        const questionsFile = getPMQuestionsPath(projectId);
        const detail = getDetailInstructions(documentDetail);
        
        // Ensure documents directory exists
        ensureDir(path.dirname(prdFile));
        
        // Always recreate PRD template to ensure we start fresh with placeholders
        // This prevents issues where a previous run left a completed PRD that would
        // immediately trigger the file watcher to mark the phase as complete
        const prdTemplatePath = path.join(TEMPLATES_DIR, 'prd_template.md');
        if (fs.existsSync(prdTemplatePath)) {
          const prdTemplateContent = fs.readFileSync(prdTemplatePath, 'utf8');
          fs.writeFileSync(prdFile, prdTemplateContent);
          logger.debug(`📝 Reset PRD file with template (contains placeholders for AI to fill)`);
        }
        
        // Also create acceptance criteria template
        const acTemplatePath = path.join(TEMPLATES_DIR, 'acceptance_criteria_template.json');
        if (fs.existsSync(acTemplatePath)) {
          const acTemplateContent = fs.readFileSync(acTemplatePath, 'utf8');
          fs.writeFileSync(acceptanceCriteriaFile, acTemplateContent);
          logger.debug(`📝 Reset acceptance criteria file with template`);
        }
        
        prompt = generatePMPRDPrompt(
          projectPath,
          questionsFile,
          toRelativePath(prdFile),
          toRelativePath(acceptanceCriteriaFile),
          userRequest,
          undefined,
          undefined,
          undefined,
          detail
        );
        
      } else if (normalizedPhase === 'ux-questions') {
        const uxQuestionsFile = getUXQuestionsPath(projectId);
        const prdFile = getPRDPath(projectId);
        
        // Ensure questions directory exists
        ensureDir(path.dirname(uxQuestionsFile));
        
        // Check if questions exist
        if (!fs.existsSync(uxQuestionsFile)) {
          // Create initial questions file
          const initialJson = {
            project_request: userRequest,
            questions: [
              {
                question: "Waiting for the UX Designer to generate questions....",
                options: [],
                answer: ""
              }
            ]
          };
          fs.writeFileSync(uxQuestionsFile, JSON.stringify(initialJson, null, 2));
        }
        
        prompt = generateUXQuestionsPrompt(projectPath, toRelativePath(uxQuestionsFile), userRequest);
        
      } else if (normalizedPhase === 'ux-design-brief') {
        const designBriefFile = getDesignBriefPath(projectId);
        const uxDesignerWireframesFile = getWireframesPath(projectId);
        const screensFile = getScreensPath(projectId);
        const prdFile = getPRDPath(projectId);
        const uxQuestionsFile = getUXQuestionsPath(projectId);
        const detail = getDetailInstructions(documentDetail);
        
        // Ensure documents directory exists
        ensureDir(path.dirname(designBriefFile));
        
        // Create screens template
        const screensTemplatePath = path.join(TEMPLATES_DIR, 'screens_template.json');
        if (fs.existsSync(screensTemplatePath)) {
          const screensTemplateContent = fs.readFileSync(screensTemplatePath, 'utf8');
          fs.writeFileSync(screensFile, screensTemplateContent);
          logger.debug(`📝 Reset screens file with template`);
        }
        
        prompt = generateUXDesignBriefPrompt(projectPath, uxQuestionsFile, screensFile, detail);
        
      } else if (normalizedPhase === 'engineer-questions') {
        const engineerQuestionsFile = getEngineerQuestionsPath(projectId);
        const prdFile = getPRDPath(projectId);
        const designBriefFile = getDesignBriefPath(projectId);
        
        // Ensure questions directory exists
        ensureDir(path.dirname(engineerQuestionsFile));
        
        // Check if questions exist
        if (!fs.existsSync(engineerQuestionsFile)) {
          // Create initial questions file
          const initialJson = {
            project_request: userRequest,
            questions: []
          };
          fs.writeFileSync(engineerQuestionsFile, JSON.stringify(initialJson, null, 2));
        }
        
        prompt = generateEngineerQuestionsPrompt(projectPath, toRelativePath(engineerQuestionsFile), userRequest);
        
      } else if (normalizedPhase === 'engineer' || normalizedPhase === 'engineer-spec') {
        const technicalSpecFile = getTechnicalSpecPath(projectId);
        const engineerQuestionsFile = getEngineerQuestionsPath(projectId);
        const prdFile = getPRDPath(projectId);
        const designBriefFile = getDesignBriefPath(projectId);
        const detail = getDetailInstructions(documentDetail);
        
        prompt = generateEngineerSpecPrompt(projectPath, engineerQuestionsFile, detail);
        
      } else {
        return res.status(400).json({ error: `Unknown phase: ${phase} (normalized: ${normalizedPhase})` });
      }
      
      // Mark AI work as started in status
      // (already handled above in phase mapping section)
      
      // Check if request is from integrated browser (skip automation)
      const skipAutomation = req.headers['x-integrated-browser'] === 'true';
      
      logger.debug(`🔵 [DEBUG] skipAutomation = ${skipAutomation} (header value: ${req.headers['x-integrated-browser']})`);
      logger.debug(`🔵 [DEBUG] All headers:`, req.headers);

      let result: OpenAIToolResult = { success: true };
      let sessionId: string | undefined = undefined;

      if (!skipAutomation) {
        // Determine which agent this phase belongs to
        const projectId = req.params.projectId;
        const agent = mappedPhase.agent as SessionAgentType;
        const isFirstPhaseOfAgent = mappedPhase.phase === 'questions-generate';

        // Check if we should resume an existing session
        const existingSessionId = getAgentSession(projectId, agent);

        if (existingSessionId && !isFirstPhaseOfAgent) {
          // Resume existing session for this agent
          logger.debug(`📌 Resuming ${agent} agent session: ${existingSessionId}`);
          sessionId = existingSessionId;
          // TODO: For now, still using keyboard automation with session tracking
          // When refine endpoint is called, it will use --resume
          result = await openCursorAndPaste(prompt, WORKSPACE_PATH);
        } else {
          // Create new session (first phase of agent)
          logger.debug(`🆕 Starting new ${agent} agent session`);
          result = await openCursorAndPaste(prompt, WORKSPACE_PATH);

          // Save the session ID if headless mode was used
          if (result.sessionId) {
            saveAgentSession(projectId, agent, result.sessionId);
            sessionId = result.sessionId;
            logger.debug(`💾 Saved ${agent} session ID: ${result.sessionId}`);
          }
        }

        logger.debug(`🔵 [DEBUG] openCursorAndPaste returned:`, result);

        // Determine which file we're waiting for based on phase
        if (result.success) {
          let waitingFor = '';
          const cleanPhase = phase.replace('-generate', '');
          if (cleanPhase === 'pm-questions') {
            waitingFor = 'questions/pm_questions.json';
          } else if (cleanPhase === 'pm-prd') {
            waitingFor = 'documents/prd.md';
          } else if (cleanPhase === 'ux-questions') {
            waitingFor = 'questions/ux_questions.json';
          } else if (cleanPhase === 'ux-design-brief') {
            waitingFor = 'documents/design_brief.md';
          } else if (cleanPhase === 'engineer-questions') {
            waitingFor = 'questions/engineer_questions.json';
          } else if (cleanPhase === 'engineer' || cleanPhase === 'engineer-spec') {
            waitingFor = 'documents/technical_specification.md';
          }
          
          if (waitingFor) {
            logger.debug(`⏳ Waiting for AI to update: ${waitingFor}`);
            logger.debug('   File watcher is active - changes will appear automatically');
          }
        }
      }
      
      // Track input cost if enabled
      let costInfo: { inputTokens: number; inputCost: string } | null = null;
      if (isCostEstimationEnabled()) {
        const inputTokens = countPromptTokens(prompt);
        addInputTokens(projectId, inputTokens);
        const settings = loadSettings();
        const { calculateInputCost, formatCost: formatCostFn } = await import('./utils/cost-estimation.js');
        const inputCostData = calculateInputCost(inputTokens, settings.costEstimation?.tier || 'standard');
        costInfo = {
          inputTokens,
          inputCost: formatCostFn(inputCostData.inputCost)
        };
        logger.debug(`💰 [Cost] Input: ${formatTokens(inputTokens)} tokens → ${costInfo.inputCost}`);
      }
      
      const responseData = {
        success: result.success,
        sessionId, // Include session ID for frontend
        message: skipAutomation
          ? 'Prompt ready. Please paste manually in Cursor.'
          : (result.success
            ? 'Cursor opened and prompt pasted. Review and press Enter.'
            : 'Failed to open Cursor automatically. Prompt is in clipboard.'),
        phase,
        prompt, // Return the prompt so UI can offer to copy it
        cost: costInfo // Include cost info in response
      };
      
      logger.debug(`🔵 [DEBUG] Sending response:`, {
        success: responseData.success,
        message: responseData.message,
        phase: responseData.phase,
        promptLength: responseData.prompt.length,
        cost: responseData.cost
      });
      
      res.json(responseData);
    } catch (error) {
      logger.error('Error triggering specification phase:', error);
      res.status(500).json({ error: 'Failed to trigger specification phase' });
    }
  });
  
  // Create issue from direct work suggestion
  app.post('/api/issues/create', (req, res) => {
    try {
      const { description, analysis, suggestion } = req.body;
      
      if (!description || !description.trim()) {
        return res.status(400).json({ error: 'Description is required' });
      }
      
      const issuesDir = path.join(OUTPUT_DIR, 'issues');
      
      // Create issues directory if it doesn't exist
      if (!fs.existsSync(issuesDir)) {
        fs.mkdirSync(issuesDir, { recursive: true });
      }
      
      // Generate next issue ID using the standard ID generator
      const existingIssues = fs.readdirSync(issuesDir)
        .filter(f => f.startsWith('ISSUE-') && f.endsWith('.md'))
        .map(f => parseInt(f.replace('ISSUE-', '').replace('.md', '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a);
      
      const nextId = existingIssues.length > 0 ? existingIssues[0] + 1 : 1;
      const issueId = `ISSUE-${String(nextId).padStart(3, '0')}`;
      
      // Create issue file
      const issueFile = path.join(issuesDir, `${issueId}.md`);
      const issueContent = `# ${description}

**Issue ID**: ${issueId}
**Type**: Direct Work
**Status**: pending
**Created**: ${new Date().toISOString()}

## Description

${description}

## Analysis

${analysis || 'This work can be implemented directly without a full project specification.'}

## Implementation Suggestion

${suggestion || 'Implement this change directly in your code editor.'}

## Acceptance Criteria

- [ ] Change implemented as described
- [ ] Manual verification complete
- [ ] No regressions introduced

---

*Created from scoping analysis - classified as direct work that doesn't require a full project specification.*
`;
      
      fs.writeFileSync(issueFile, issueContent);
      
      // Reset scoping_plan.json back to placeholder state after successful issue creation
      resetScopingPlanFile();
      
      res.json({ 
        success: true,
        issueId,
        filePath: issueFile
      });
    } catch (error) {
      logger.error('Error creating issue:', error);
      res.status(500).json({ error: 'Failed to create issue' });
    }
  });
  
  // Trigger issue creation for a fully-specced project
  app.post('/api/specification/breakdown/:projectId', async (req, res) => {
    try {
      const projectPath = path.join(OUTPUT_DIR, 'projects', req.params.projectId);
      const { breakdownLevel } = req.body; // Extract breakdown level from request body
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check if project is fully specced
      const pmComplete = isPMPRDComplete(projectPath);
      const uxComplete = isUXWireframesComplete(projectPath);
      const engineerComplete = isArchitectComplete(projectPath);
      
      if (!pmComplete || !uxComplete || !engineerComplete) {
        return res.status(400).json({ error: 'Project must be fully specced before issue creation' });
      }
      
      // Read project request for title
      const projectRequestFile = path.join(projectPath, 'project_request.md');
      let userRequest = '';
      let projectTitle = req.params.projectId;
      if (fs.existsSync(projectRequestFile)) {
        const content = fs.readFileSync(projectRequestFile, 'utf-8');
        const lines = content.split('\n');
        
        // Extract title from first h1
        const titleLine = lines.find(l => l.startsWith('# '));
        if (titleLine) {
          projectTitle = titleLine.replace('# ', '').trim();
        }
        
        let inDescription = false;
        for (const line of lines) {
          if (line.startsWith('## Description')) {
            inDescription = true;
            continue;
          }
          if (inDescription && line.startsWith('##')) {
            break;
          }
          if (inDescription && line.trim()) {
            userRequest = line.trim();
            break;
          }
        }
      }
      
      // Create issues directory for breakdown
      const issuesDir = path.join(projectPath, 'issues');
      
      if (!fs.existsSync(issuesDir)) {
        fs.mkdirSync(issuesDir, { recursive: true });
      }
      
      // Handle one-shot: create issue heuristically without AI (all inline in JSON)
      if (breakdownLevel === 'one-shot') {
        const issueId = 'ENG-001';
        
        // Create issues.json with the one-shot issue inline
        const projectSummaryFile = path.join(issuesDir, 'issues.json');
        const projectSummary = {
          project_name: projectTitle,
          project_id: req.params.projectId,
          total_estimated_hours: 0,
          total_issues: 1,
          generated_at: new Date().toISOString(),
          issues_by_complexity: { low: 1, medium: 0, high: 0 },
          issues: [{
            issue_id: issueId,
            title: `Implement: ${projectTitle}`,
            status: 'pending',
            estimated_hours: 0,
            dependencies: [],
            description: 'Implement the complete specification for this project.',
            key_decisions: [
              'Follow all patterns and conventions from the technical specification',
              'Implement UI according to wireframes and design brief',
              'Refer to PRD for acceptance criteria'
            ],
            acceptance_criteria: [
              'All features from PRD implemented',
              'UI matches wireframes and design brief',
              'Technical implementation follows tech spec',
              'Manual verification complete'
            ],
            technical_details: 'See technical specification for architecture and implementation details.',
            testing_strategy: {
              automated_tests: 'TBD based on feature criticality',
              manual_verification: 'Verify all PRD acceptance criteria are met'
            },
            human_in_the_loop: [
              'Run the application locally',
              'Test each feature described in the PRD',
              'Verify UI matches wireframes',
              'Check for any console errors or warnings',
              'Confirm all acceptance criteria are met'
            ]
          }],
          definition_of_done: ['All acceptance criteria met and manually verified']
        };
        fs.writeFileSync(projectSummaryFile, JSON.stringify(projectSummary, null, 2));
        
        logger.debug(`✅ One-shot issue created in: ${projectSummaryFile}`);
        
        return res.json({
          success: true,
          message: 'One-shot issue created instantly',
          issueCount: 1,
          isOneShot: true
        });
      }
      
      // Create project summary template for AI breakdown
      const projectSummaryFile = path.join(issuesDir, 'issues.json');
      const projectSummaryTemplatePath = path.join(TEMPLATES_DIR, 'issues_template.json');
      
      if (fs.existsSync(projectSummaryTemplatePath)) {
        const projectSummaryTemplateContent = fs.readFileSync(projectSummaryTemplatePath, 'utf8');
        fs.writeFileSync(projectSummaryFile, projectSummaryTemplateContent);
      }
      
      // Build the breakdown prompt with breakdown level
      const prompt = generateTechLeadBreakdownPrompt(
        projectPath,
        issuesDir,
        projectSummaryFile,
        userRequest,
        false,  // Don't include codebase analysis for Web UI
        breakdownLevel  // Pass breakdown level to prompt generator
      );
      
      // Track input cost if enabled
      if (isCostEstimationEnabled()) {
        const inputTokens = countPromptTokens(prompt);
        addInputTokens(req.params.projectId, inputTokens);
        logger.debug(`💰 [Cost] Breakdown input: ${inputTokens} tokens`);
      }
      
      // Check if request is from integrated browser (skip automation)
      const skipAutomation = req.headers['x-integrated-browser'] === 'true';

      let breakdownResult: OpenAIToolResult = { success: true };
      if (!skipAutomation) {
        // Trigger Cursor automation
        breakdownResult = await openCursorAndPaste(prompt, WORKSPACE_PATH);

        if (breakdownResult.success) {
          logger.debug('⏳ Waiting for AI to create: issues/issues.json');
          logger.debug('   File watcher is active - issues will appear automatically');
        }
      }

      res.json({
        success: breakdownResult.success,
        message: skipAutomation
          ? 'Prompt ready. Please paste manually in Cursor.'
          : (breakdownResult.success
            ? 'Cursor opened with issue creation prompt'
            : 'Failed to open Cursor automatically'),
        prompt
      });
    } catch (error) {
      logger.error('Error creating issues:', error);
      res.status(500).json({ error: 'Failed to create issues' });
    }
  });

  // Check if issue creation is complete
  app.get('/api/specification/breakdown-status/:projectId', (req, res) => {
    try {
      const projectPath = path.join(OUTPUT_DIR, 'projects', req.params.projectId);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const projectSummaryFile = path.join(projectPath, 'issues', 'issues.json');
      
      // Initial check: issues.json must exist
      if (!fs.existsSync(projectSummaryFile)) {
        return res.json({
          isComplete: false,
          issueCount: 0
        });
      }
      
      // Check if issues.json has been properly filled (not just template)
      let projectSummary: any;
      try {
        const summaryContent = fs.readFileSync(projectSummaryFile, 'utf-8');
        projectSummary = JSON.parse(summaryContent);
        
        // Handle both new (issues) and legacy (issues_list) field names
        const issuesList = projectSummary.issues || projectSummary.issues_list || [];
        
        // Check if it still contains placeholder text (template not filled)
        if (
          projectSummary.project_name?.includes('PLACEHOLDER') ||
          projectSummary.total_issues === '[TOTAL_ISSUES_PLACEHOLDER]' ||
          issuesList.length === 0
        ) {
          return res.json({
            isComplete: false,
            issueCount: 0
          });
        }
        
        // Check that issues have real content (not just placeholders)
        const validIssues = issuesList.filter((issue: any) => 
          issue.issue_id && 
          !issue.issue_id.includes('PLACEHOLDER') &&
          issue.title &&
          !issue.title.includes('PLACEHOLDER')
        );
        
        const isComplete = validIssues.length > 0;
        
        res.json({
          isComplete,
          issueCount: validIssues.length,
          expectedCount: issuesList.length
        });
      } catch (error) {
        // If we can't parse the JSON or it's malformed, it's not complete
        return res.json({
          isComplete: false,
          issueCount: 0
        });
      }
    } catch (error) {
      logger.error('Error checking breakdown status:', error);
      res.status(500).json({ error: 'Failed to check breakdown status' });
    }
  });
  
  // Auto-detect next incomplete phase for a project
  app.get('/api/projects/:id/next-phase', (req, res) => {
    try {
      const projectPath = path.join(OUTPUT_DIR, 'projects', req.params.id);
      
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check phase completion
      const pmComplete = isPMPRDComplete(projectPath);
      const uxComplete = isUXWireframesComplete(projectPath);
      const engineerComplete = isArchitectComplete(projectPath);
      
      let nextPhase: string | null = null;
      
      if (!pmComplete) {
        const questionsGenerated = isPMQuestionsGenerated(projectPath);
        const questionsAnswered = isPMQuestionsAnswered(projectPath);
        
        if (!questionsGenerated) {
          nextPhase = 'pm-questions';
        } else if (!questionsAnswered) {
          nextPhase = 'pm-answers';
        } else {
          nextPhase = 'pm-prd';
        }
      } else if (!uxComplete) {
        nextPhase = 'ux';
      } else if (!engineerComplete) {
        nextPhase = 'engineer';
      } else {
        nextPhase = null; // All complete
      }
      
      res.json({
        projectId: req.params.id,
        nextPhase,
        isComplete: pmComplete && uxComplete && engineerComplete
      });
    } catch (error) {
      logger.error('Error detecting next phase:', error);
      res.status(500).json({ error: 'Failed to detect next phase' });
    }
  });
  
  // Task Board API endpoints
  
  // Get task prompt for specific issue
  app.get('/api/issues/:projectId/:issueId/prompt', (req, res) => {
    try {
      const { projectId, issueId } = req.params;
      logger.debug(`[API] Generating prompt for ${projectId}/${issueId}`);

      // Find the actual project folder (could be "002" or "002-project-name")
      const projectsDir = path.join(OUTPUT_DIR, 'projects');
      const projectFolders = fs.readdirSync(projectsDir);
      const matchingFolder = projectFolders.find(f =>
        f === projectId || f.startsWith(`${projectId}-`)
      );

      if (!matchingFolder) {
        logger.error(`[API] Project folder not found for ID: ${projectId}`);
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get issue from issues.json (issues are stored in JSON, not separate .md files)
      const issue = getIssueById(projectId, issueId);

      if (!issue) {
        logger.error(`[API] Issue not found: ${issueId} in project ${projectId}`);
        return res.status(404).json({ error: 'Issue not found' });
      }

      logger.debug(`[API] Successfully loaded issue: ${issue.issueId}`);

      // Generate full contextual prompt with all project specs and completion instructions
      const prompt = generateIssuePrompt(issue, matchingFolder);

      logger.debug(`[API] Generated prompt (${prompt.length} chars)`);

      res.json({ prompt });
    } catch (error) {
      logger.error('Error generating task prompt:', error);
      res.status(500).json({ error: 'Failed to generate prompt' });
    }
  });
  
  // Get full issue details from issues.json
  app.get('/api/issues/:projectId/:issueId/details', (req, res) => {
    try {
      const { projectId, issueId } = req.params;
      
      // Find the actual project folder (could be "002" or "002-project-name")
      const projectsDir = path.join(OUTPUT_DIR, 'projects');
      const projectFolders = fs.readdirSync(projectsDir);
      const matchingFolder = projectFolders.find(f => 
        f === projectId || f.startsWith(`${projectId}-`)
      );
      
      if (!matchingFolder) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const projectPath = path.join(projectsDir, matchingFolder);
      const summaryPath = path.join(projectPath, 'issues', 'issues.json');
      
      if (!fs.existsSync(summaryPath)) {
        return res.status(404).json({ error: 'Project summary not found' });
      }
      
      // Read and parse the project summary
      const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      const issuesList = summaryData.issues || summaryData.issues_list || [];
      
      // Find the specific issue
      const issue = issuesList.find((i: any) => i.issue_id === issueId);
      
      if (!issue) {
        return res.status(404).json({ error: 'Issue not found' });
      }
      
      // Return the full issue data (no markdown - it's all JSON now)
      res.json({ 
        issue,
        // Also provide a rendered markdown for backward compatibility
        markdown: renderIssueAsMarkdown(issue)
      });
    } catch (error) {
      logger.error('Error fetching issue details:', error);
      res.status(500).json({ error: 'Failed to fetch issue details' });
    }
  });
  
  // Trigger Cursor with prompt (legacy endpoint - kept for backward compatibility)
  app.post('/api/issues/trigger-cursor', async (req, res) => {
    try {
      logger.debug('\n' + '='.repeat(60));
      logger.debug('🎯 [API] /api/issues/trigger-cursor endpoint called');
      logger.debug('='.repeat(60));
      logger.debug('📥 Request body keys:', Object.keys(req.body));
      logger.debug('📋 Prompt length:', req.body.prompt?.length || 0, 'characters');
      logger.debug('📁 Workspace path:', WORKSPACE_PATH);
      logger.debug('='.repeat(60) + '\n');
      
      const { prompt } = req.body;
      
      logger.debug('🚀 [API] Calling openCursorAndPaste()...\n');
      const result = await openCursorAndPaste(prompt, WORKSPACE_PATH);
      
      logger.debug('\n' + '='.repeat(60));
      logger.debug('✅ [API] openCursorAndPaste() returned:', result);
      logger.debug('='.repeat(60) + '\n');
      
      res.json({ success: true });
    } catch (error) {
      logger.error('\n' + '='.repeat(60));
      logger.error('❌ [API] Error in /api/issues/trigger-cursor:');
      logger.error(error);
      logger.error('='.repeat(60) + '\n');
      res.status(500).json({ error: 'Failed to trigger Cursor' });
    }
  });
  
  // Combined ship endpoint - generates prompt AND triggers Cursor in one call (faster)
  app.post('/api/issues/:projectId/:issueId/ship', async (req, res) => {
    try {
      const { projectId, issueId } = req.params;
      logger.debug(`\n🚀 [API] Shipping issue ${issueId} in project ${projectId}`);

      // Find the actual project folder (could be "002" or "002-project-name")
      const projectsDir = path.join(OUTPUT_DIR, 'projects');
      const projectFolders = fs.readdirSync(projectsDir);
      const matchingFolder = projectFolders.find(f =>
        f === projectId || f.startsWith(`${projectId}-`)
      );

      if (!matchingFolder) {
        logger.error(`[API] Project folder not found for ID: ${projectId}`);
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get issue from issues.json (issues are stored in JSON, not separate .md files)
      const issue = getIssueById(projectId, issueId);

      if (!issue) {
        logger.error(`[API] Issue not found: ${issueId} in project ${projectId}`);
        return res.status(404).json({ error: 'Issue not found' });
      }

      // Generate full contextual prompt with all project specs and completion instructions
      const prompt = generateIssuePrompt(issue, matchingFolder);

      logger.debug(`[API] Generated prompt (${prompt.length} chars)`);

      // Trigger automation and wait for result (with reduced timeouts it should be ~1-2s max)
      let shipResult: OpenAIToolResult = { success: false };
      try {
        logger.debug('🚀 [API] Triggering AI tool automation...');
        shipResult = await openCursorAndPaste(prompt, WORKSPACE_PATH);
        logger.debug(`[API] AI tool automation result:`, shipResult);
      } catch (err) {
        logger.error('[API] Failed to trigger AI tool:', err);
        // Automation failed, but we still have the prompt for manual copy
      }

      res.json({
        success: shipResult.success,
        prompt,
        message: shipResult.success
          ? 'Prompt sent to AI tool successfully'
          : 'Prompt ready - paste manually if AI tool did not open'
      });
    } catch (error) {
      logger.error('Error shipping issue:', error);
      res.status(500).json({ error: 'Failed to ship issue' });
    }
  });
  
  // Approve task - updates status in issues.json (single source of truth)
  app.post('/api/issues/:projectId/:issueId/approve', (req, res) => {
    try {
      const { projectId, issueId } = req.params;
      
      logger.debug(`\n✅ [API] Approving issue ${issueId} in project ${projectId}`);
      
      // Find the actual project folder (handles both "002" and "002-project-name")
      const projectsDir = path.join(OUTPUT_DIR, 'projects');
      const projectFolders = fs.readdirSync(projectsDir);
      const matchingFolder = projectFolders.find(f => f === projectId || f.startsWith(`${projectId}-`));
      
      if (!matchingFolder) {
        logger.error(`❌ Project folder not found for: ${projectId}`);
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const projectPath = path.join(projectsDir, matchingFolder);
      const summaryPath = path.join(projectPath, 'issues', 'issues.json');
      
      if (!fs.existsSync(summaryPath)) {
        logger.error(`❌ issues.json not found in: ${projectPath}`);
        return res.status(404).json({ error: 'Project summary not found' });
      }
      
      logger.debug(`📄 Reading: ${summaryPath}`);
      
      // Read and parse issues.json
      const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      
      // Handle both new (issues) and legacy (issues_list) field names
      const issuesList = summaryData.issues || summaryData.issues_list || [];
      
      // Find the issue and update its status
      const issue = issuesList.find((i: any) => i.issue_id === issueId);
      
      if (!issue) {
        logger.error(`❌ Issue ${issueId} not found in project summary`);
        return res.status(404).json({ error: 'Issue not found in project summary' });
      }
      
      logger.debug(`📝 Updating status: ${issue.status} → approved`);
      
      issue.status = 'approved';
      
      // Write back to issues.json
      fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
      
      logger.debug(`✅ Successfully approved ${issueId}\n`);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('❌ Error approving task:', error);
      res.status(500).json({ error: 'Failed to approve task' });
    }
  });
  
  // Request changes on task

  // ============================================================================
  // Linear Integration Endpoints
  // ============================================================================

  // Get Linear configuration status
  app.get('/api/linear/status', async (req, res) => {
    try {
      const { isLinearConfigured, getLinearConfig } = await import('./services/linear-sync-service.js');
      const configured = isLinearConfigured();
      const config = getLinearConfig();

      res.json({
        configured,
        hasApiKey: !!config?.apiKey,
        defaultTeamId: config?.defaultTeamId,
        defaultTeamName: config?.defaultTeamName,
      });
    } catch (error) {
      logger.error('Error getting Linear status:', error);
      res.status(500).json({ error: 'Failed to get Linear status' });
    }
  });

  // Save Linear configuration
  app.put('/api/linear/config', async (req, res) => {
    try {
      const { apiKey, defaultTeamId, defaultTeamName } = req.body;
      const { saveLinearConfig, validateLinearApiKey, getLinearConfig } = await import('./services/linear-sync-service.js');

      // If apiKey is explicitly null, clear the configuration (disconnect)
      if (apiKey === null) {
        saveLinearConfig({
          apiKey: undefined,
          defaultTeamId: undefined,
          defaultTeamName: undefined,
        });
        return res.json({ success: true, disconnected: true });
      }

      // Validate API key if provided as a string
      if (apiKey && typeof apiKey === 'string') {
        const valid = await validateLinearApiKey(apiKey);
        if (!valid) {
          return res.status(400).json({ error: 'Invalid Linear API key' });
        }
      }

      // Get existing config to preserve apiKey when only updating team
      const existingConfig = getLinearConfig();

      saveLinearConfig({
        apiKey: apiKey || existingConfig?.apiKey,
        defaultTeamId: defaultTeamId !== undefined ? defaultTeamId : existingConfig?.defaultTeamId,
        defaultTeamName: defaultTeamName !== undefined ? defaultTeamName : existingConfig?.defaultTeamName,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error saving Linear config:', error);
      res.status(500).json({ error: 'Failed to save Linear configuration' });
    }
  });

  // Get available Linear teams
  app.get('/api/linear/teams', async (req, res) => {
    try {
      const { getLinearTeams } = await import('./services/linear-sync-service.js');
      const teams = await getLinearTeams();
      res.json({ teams });
    } catch (error) {
      logger.error('Error fetching Linear teams:', error);
      res.status(500).json({ error: 'Failed to fetch Linear teams' });
    }
  });

  // Validate Linear API key
  app.post('/api/linear/validate', async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: 'API key required' });
      }

      const { validateLinearApiKey } = await import('./services/linear-sync-service.js');
      const valid = await validateLinearApiKey(apiKey);
      res.json({ valid });
    } catch (error) {
      logger.error('Error validating Linear API key:', error);
      res.status(500).json({ error: 'Failed to validate API key' });
    }
  });

  // Get project sync status (with optional verification against Linear)
  app.get('/api/projects/:projectId/linear-status', async (req, res) => {
    try {
      const { projectId } = req.params;
      const verify = req.query.verify === 'true';
      const { isProjectSynced, getProjectSyncState, verifyLinearProjectExists } = await import('./services/linear-sync-service.js');

      // If verify=true, check if the project still exists in Linear
      if (verify) {
        const exists = await verifyLinearProjectExists(projectId);
        if (!exists) {
          return res.json({ synced: false, syncState: null });
        }
      }

      const synced = isProjectSynced(projectId);
      const syncState = synced ? getProjectSyncState(projectId) : null;

      res.json({
        synced,
        syncState,
      });
    } catch (error) {
      logger.error('Error getting project Linear status:', error);
      res.status(500).json({ error: 'Failed to get project Linear status' });
    }
  });

  // Sync project to Linear
  app.post('/api/projects/:projectId/sync-to-linear', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { teamId } = req.body;

      logger.debug(`\n🔄 [API] Syncing project ${projectId} to Linear`);

      // Find the project folder
      // Prefer folder with full name (e.g., "001-project-name") over just the ID (e.g., "001")
      const projectsDir = path.join(OUTPUT_DIR, 'projects');
      const projectFolders = fs.readdirSync(projectsDir);
      const matchingFolders = projectFolders.filter(f => f === projectId || f.startsWith(`${projectId}-`));
      // Sort to prefer longer names (full folder name > just ID)
      matchingFolders.sort((a, b) => b.length - a.length);
      const matchingFolder = matchingFolders[0];

      if (!matchingFolder) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const projectPath = path.join(projectsDir, matchingFolder);

      // Extract project number and title from folder name (e.g., "001-document-upload-and-storage-system")
      const projectNumber = matchingFolder.match(/^(\d+)/)?.[1] || projectId;
      const projectTitle = matchingFolder.replace(/^\d+-/, '').replace(/-/g, ' ');
      // Capitalize first letter of each word for the title
      const formattedTitle = projectTitle.replace(/\b\w/g, c => c.toUpperCase());

      // Load project metadata
      const statusPath = path.join(projectPath, 'project_status.json');
      let projectMetadata: any = {
        id: projectNumber,
        name: formattedTitle,
        fullId: matchingFolder, // Full folder name for URLs
      };

      if (fs.existsSync(statusPath)) {
        try {
          const statusContent = fs.readFileSync(statusPath, 'utf-8');
          const status = JSON.parse(statusContent);
          // Merge status but preserve our extracted name and id
          projectMetadata = {
            ...status,
            id: projectNumber,
            name: formattedTitle,
            fullId: matchingFolder,
          };
          logger.debug(`📋 Project metadata after merge:`);
          logger.debug(`  id: ${projectMetadata.id}`);
          logger.debug(`  name: ${projectMetadata.name}`);
          logger.debug(`  fullId: ${projectMetadata.fullId}`);
        } catch (e) {
          // Use basic metadata
          logger.error('Failed to parse project status:', e);
        }
      }

      // Load project request for description - extract just the Description section
      const requestPath = path.join(projectPath, 'project_request.md');
      if (fs.existsSync(requestPath)) {
        const requestContent = fs.readFileSync(requestPath, 'utf-8');
        // Extract the Description section content
        const descriptionMatch = requestContent.match(/## Description\s*\n([\s\S]*?)(?=\n## |\n---|\n\*Created|$)/);
        if (descriptionMatch) {
          projectMetadata.description = descriptionMatch[1].trim();
        }
      }

      // Load issues
      const issuesPath = path.join(projectPath, 'issues', 'issues.json');
      let issues: any[] = [];

      if (fs.existsSync(issuesPath)) {
        try {
          const issuesContent = fs.readFileSync(issuesPath, 'utf-8');
          const issuesData = JSON.parse(issuesContent);
          logger.debug(`Found ${(issuesData.issues || issuesData.issues_list || []).length} issues to sync`);
          issues = (issuesData.issues || issuesData.issues_list || []).map((issue: any) => ({
            issueId: issue.issue_id,
            title: issue.title,
            description: issue.description,
            status: issue.status || 'pending',
            estimatedHours: issue.estimated_hours || 0,
            dependencies: issue.dependencies || [],
            screensAffected: issue.screens_affected || [],
            keyDecisions: issue.key_decisions || [],
            acceptanceCriteria: (issue.acceptance_criteria || []).map((ac: any) =>
              typeof ac === 'string' ? { id: '', description: ac } : { id: ac.id || '', description: ac.description || ac }
            ),
            technicalDetails: issue.technical_details,
            testStrategy: issue.testing_strategy || issue.test_strategy,
            humanInTheLoop: issue.human_in_the_loop || [],
            projectId: matchingFolder,
            projectName: formattedTitle,
          }));
        } catch (e) {
          logger.error('Failed to parse issues:', e);
        }
      } else {
        logger.debug(`No issues file found at ${issuesPath}`);
      }

      // Perform sync - use matchingFolder (full folder name) for URLs and sync state
      const { syncProjectToLinear } = await import('./services/linear-sync-service.js');
      const result = await syncProjectToLinear(matchingFolder, projectMetadata, issues, teamId);

      if (result.success) {
        logger.debug(`✅ Project ${projectId} synced to Linear: ${result.linearProjectUrl}`);
      } else {
        logger.debug(`⚠️ Project ${projectId} sync completed with errors`);
      }

      res.json(result);
    } catch (error) {
      logger.error('Error syncing project to Linear:', error);
      res.status(500).json({ error: 'Failed to sync project to Linear' });
    }
  });

  // Get all synced projects
  app.get('/api/linear/synced-projects', async (req, res) => {
    try {
      const { getSyncedProjects } = await import('./services/linear-sync-service.js');
      const projects = getSyncedProjects();
      res.json({ projects });
    } catch (error) {
      logger.error('Error getting synced projects:', error);
      res.status(500).json({ error: 'Failed to get synced projects' });
    }
  });

  // ============================================================================
  // End Linear Integration Endpoints
  // ============================================================================

  // Delete a project
  app.delete('/api/projects/:projectId', (req, res) => {
    try {
      const { projectId } = req.params;
      
      logger.debug(`\n🗑️  [API] Deleting project: ${projectId}`);
      
      // Find the actual project folder
      const projectsDir = path.join(OUTPUT_DIR, 'projects');
      const projectFolders = fs.readdirSync(projectsDir);
      const matchingFolder = projectFolders.find(f => f === projectId || f.startsWith(`${projectId}-`));
      
      if (!matchingFolder) {
        logger.error(`❌ Project folder not found for: ${projectId}`);
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const projectPath = path.join(projectsDir, matchingFolder);
      
      // Recursively delete the project folder
      fs.rmSync(projectPath, { recursive: true, force: true });
      
      logger.debug(`✅ Successfully deleted project: ${matchingFolder}`);
      
      res.json({ success: true, message: `Project ${matchingFolder} deleted successfully` });
    } catch (error) {
      logger.error('❌ Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });
  
  // Fallback for client-side routing (SPA)
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../dist/web-ui/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Web UI not built. Run: npm run build:ui');
    }
  });
  
  // Start HTTP server with error handling
  const server = await new Promise<any>((resolve, reject) => {
    const srv = app.listen(port, () => {
      logger.debug(`✨ Web server running on http://localhost:${port}`);
      resolve(srv);
    });
    
    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Please stop the existing server or use a different port.`));
      } else {
        reject(err);
      }
    });
  });
  
  // Setup WebSocket for real-time updates
  const wss = new WebSocketServer({ server });

  // Initialize the WebSocket service for cross-module broadcasting
  initWebSocketService(wss);

  // Track connected clients (silent - UI implementation detail)
  wss.on('connection', (ws) => {
    ws.on('close', () => {
      // Silent - just UI disconnecting
    });
  });
  
  // Watch filesystem for changes
  const watchPaths = [
    path.join(OUTPUT_DIR, '**/*.{json,md}'),
    path.join(WORKSPACE_PATH, 'PLAYBOOK.md')  // Also watch playbook in project root
  ];
  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });
  
  logger.debug(`👀 File watcher active: monitoring ${OUTPUT_DIR} and PLAYBOOK.md for changes`);
  logger.debug(`📂 Workspace path: ${WORKSPACE_PATH}`);
  
  watcher.on('change', (filePath) => {
    // Show file system changes - indicates actual work happening
    const fileName = path.basename(filePath);
    const relativePath = path.relative(OUTPUT_DIR, filePath);
    logger.debug(`\n📝 [File Watcher] File updated: ${relativePath}`);
    logger.debug(`   Full path: ${filePath}`);
    logger.debug(`   File name: ${fileName}`);
    
    // Check if this is a significant file change that indicates AI work completion
    logger.debug(`🔍 [File Watcher] Checking if ${fileName} indicates AI work completion...`);
    checkAndUpdateStatusFromFileChange(filePath);
    
    // Broadcast to all connected clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({ 
          type: 'file_changed', 
          path: filePath,
          timestamp: Date.now()
        }));
      }
    });
    logger.debug(`📡 [WebSocket] Broadcasted file_changed event to ${wss.clients.size} client(s)\n`);
  });
  
  watcher.on('add', (filePath) => {
    // Show file creation - indicates actual work happening
    const fileName = path.basename(filePath);
    const relativePath = path.relative(OUTPUT_DIR, filePath);
    logger.debug(`\n✨ [File Watcher] File created: ${relativePath}`);
    logger.debug(`   Full path: ${filePath}`);
    logger.debug(`   File name: ${fileName}`);
    
    // Check if this is a significant file that indicates AI work completion
    logger.debug(`🔍 [File Watcher] Checking if new file indicates AI work completion...`);
    checkAndUpdateStatusFromFileChange(filePath);
    
    // Broadcast to all connected clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ 
          type: 'file_added', 
          path: filePath,
          timestamp: Date.now()
        }));
      }
    });
    logger.debug(`📡 [WebSocket] Broadcasted file_added event to ${wss.clients.size} client(s)\n`);
  });
  
  /**
   * Check if a file change indicates AI work completion and update status accordingly
   */
  /**
   * Check if a markdown file still has placeholder content (not yet completed by AI)
   * Returns true if file has placeholders (incomplete), false if ready
   */
  function hasMarkdownPlaceholders(content: string): boolean {
    // Check for common placeholder patterns (case-insensitive for robustness)
    const placeholderPatterns = [
      /\[.*?PLACEHOLDER.*?\]/gi,           // [PLACEHOLDER], [PROJECT_NAME_PLACEHOLDER], etc.
      /TODO:/gi,                            // TODO: markers
      /\[TBD\]/gi,                          // [TBD] markers
      /\[INSERT\s+.*?\]/gi,                 // [INSERT ...] patterns
      /^#{1,6}\s+\w+\s*\n\s*\[/gm,         // Headers followed by [ on next line
    ];
    
    return placeholderPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if a JSON questions file has real content (not placeholders)
   * Returns true if file has real questions, false if still waiting
   */
  function hasRealQuestions(content: string): boolean {
    try {
      const data = JSON.parse(content);
      
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        return false;
      }
      
      // Multiple questions = definitely real
      if (data.questions.length > 1) {
        return true;
      }
      
      // Single question: check if it's not a "Waiting for..." placeholder
      const question = data.questions[0].question || '';
      return !question.toLowerCase().includes('waiting for');
    } catch (e) {
      logger.debug(`❌ JSON parse error: ${e}`);
      return false;
    }
  }

  /**
   * Check if a JSON file (non-questions) has real content
   * Returns true if file has real content, false if has placeholders
   */
  function hasRealJsonContent(content: string): boolean {
    // Check for placeholder strings (case-insensitive)
    const placeholderPatterns = [
      /PLACEHOLDER/gi,
      /TODO:/gi,
      /\[TBD\]/gi,
    ];
    
    return !placeholderPatterns.some(pattern => pattern.test(content));
  }

  function checkAndUpdateStatusFromFileChange(filePath: string) {
    logger.debug(`\n${'='.repeat(80)}`);
    logger.debug(`🔍 [Status Check] Starting file change analysis`);
    logger.debug(`📁 File: ${filePath}`);
    
    // Extract project ID from path
    // Path format: .../outputs/projects/{projectId}/{file}
    const relativePath = path.relative(OUTPUT_DIR, filePath);
    const parts = relativePath.split(path.sep);
    
    logger.debug(`📊 Path parts: ${JSON.stringify(parts)}`);
    
    if (parts[0] !== 'projects' || parts.length < 2) {
      logger.debug(`❌ Not a project file, skipping`);
      logger.debug(`${'='.repeat(80)}\n`);
      return; // Not a project file
    }
    
    const projectId = parts[1];
    const fileName = path.basename(filePath);
    const dirName = parts.length > 2 ? parts[parts.length - 2] : '';
    
    logger.debug(`🆔 Project ID: ${projectId}`);
    logger.debug(`📄 File name: ${fileName}`);
    logger.debug(`📂 Directory: ${dirName}`);
    
    // Get current status
    const status = readProjectStatus(projectId);
    if (!status) {
      logger.debug(`❌ No status file found for project ${projectId}`);
      logger.debug(`${'='.repeat(80)}\n`);
      return;
    }
    
    if (status.currentAgent === 'complete') {
      logger.debug(`✅ Project already complete, skipping`);
      logger.debug(`${'='.repeat(80)}\n`);
      return;
    }
    
    const currentAgent = status.currentAgent;
    const currentPhase = status.agents[currentAgent]?.currentPhase;
    
    logger.debug(`👤 Current agent: ${currentAgent}`);
    logger.debug(`📍 Current phase: ${currentPhase}`);
    logger.debug(`📊 Full current phase: ${status.currentPhase}`);
    
    // Check if this file indicates AI work completion
    let shouldUpdateStatus = false;
    
    // Check file content to validate it's real content
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      logger.debug(`📏 File size: ${content.length} characters`);
      
      // Validate minimum content length (avoid empty files)
      if (content.trim().length < 50) {
        logger.debug(`❌ File too small (< 50 chars), skipping`);
        logger.debug(`${'='.repeat(80)}\n`);
        return;
      }
      
      // PM phases
      if (fileName === 'pm_questions.json' && dirName === 'questions') {
        logger.debug(`🎯 Detected PM questions file`);
        if (currentPhase === 'questions-generate') {
          logger.debug(`✅ Current phase matches: questions-generate`);
          const hasReal = hasRealQuestions(content);
          logger.debug(`🎲 Has real questions: ${hasReal}`);
          if (hasReal) {
            shouldUpdateStatus = true;
          }
        } else {
          logger.debug(`⚠️  Phase mismatch - current: ${currentPhase}, expected: questions-generate`);
        }
      } else if ((fileName === 'prd.md' || fileName === 'acceptance_criteria.json') && dirName === 'documents') {
        logger.debug(`🎯 Detected PM file: ${fileName}`);
        if (currentPhase === 'prd-generate') {
          logger.debug(`✅ Current phase matches: prd-generate`);
          
          // For PM phase, we need BOTH files to be complete (PRD AND acceptance_criteria.json)
          const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
          const phaseStartedAt = status.agents[currentAgent]?.phases['prd-generate']?.startedAt || null;
          const bothFilesComplete = isPMPRDComplete(projectPath, phaseStartedAt);
          logger.debug(`🎲 Both PM files complete (PRD + acceptance_criteria.json): ${bothFilesComplete}`);
          
          if (bothFilesComplete) {
            shouldUpdateStatus = true;
          }
        } else {
          logger.debug(`⚠️  Phase mismatch - current: ${currentPhase}, expected: prd-generate`);
        }
      }
      // UX phases
      else if (fileName === 'ux_questions.json' && dirName === 'questions') {
        logger.debug(`🎯 Detected UX questions file`);
        if (currentPhase === 'questions-generate') {
          logger.debug(`✅ Current phase matches: questions-generate`);
          const hasReal = hasRealQuestions(content);
          logger.debug(`🎲 Has real questions: ${hasReal}`);
          if (hasReal) {
            shouldUpdateStatus = true;
          }
        } else {
          logger.debug(`⚠️  Phase mismatch - current: ${currentPhase}, expected: questions-generate`);
        }
      } else if ((fileName === 'design_brief.md' || fileName === 'screens.json') && dirName === 'documents') {
        logger.debug(`🎯 Detected UX design file: ${fileName}`);
        if (currentPhase === 'design-brief-generate') {
          logger.debug(`✅ Current phase matches: design-brief-generate`);
          
          // For UX phase, we need BOTH files to be complete (design_brief.md AND screens.json)
          const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
          const phaseStartedAt = status.agents[currentAgent]?.phases['design-brief-generate']?.startedAt || null;
          const allFilesComplete = isUXWireframesComplete(projectPath, phaseStartedAt);
          logger.debug(`🎲 Both UX files complete (design brief + screens.json): ${allFilesComplete}`);
          
          if (allFilesComplete) {
            shouldUpdateStatus = true;
          }
        } else {
          logger.debug(`⚠️  Phase mismatch - current: ${currentPhase}, expected: design-brief-generate`);
        }
      }
      // Engineer phases
      else if (fileName === 'engineer_questions.json' && dirName === 'questions') {
        logger.debug(`🎯 Detected Engineer questions file`);
        if (currentPhase === 'questions-generate') {
          logger.debug(`✅ Current phase matches: questions-generate`);
          const hasReal = hasRealQuestions(content);
          logger.debug(`🎲 Has real questions: ${hasReal}`);
          if (hasReal) {
            shouldUpdateStatus = true;
          }
        } else {
          logger.debug(`⚠️  Phase mismatch - current: ${currentPhase}, expected: questions-generate`);
        }
      } else if (fileName === 'technical_specification.md' && dirName === 'documents') {
        logger.debug(`🎯 Detected technical specification file`);
        if (currentPhase === 'spec-generate') {
          logger.debug(`✅ Current phase matches: spec-generate`);
          const hasPlaceholders = hasMarkdownPlaceholders(content);
          logger.debug(`🎲 Has placeholders: ${hasPlaceholders}`);
          
          if (!hasPlaceholders) {
            // Check if technology_choices.json is also complete
            const techChoicesPath = getTechnologyChoicesPath(projectId);
            
            if (fs.existsSync(techChoicesPath)) {
              const techChoicesContent = fs.readFileSync(techChoicesPath, 'utf-8');
              const choicesHasPlaceholders = !hasRealJsonContent(techChoicesContent);
              logger.debug(`🎲 Technology choices has placeholders: ${choicesHasPlaceholders}`);
              
              if (!choicesHasPlaceholders) {
            shouldUpdateStatus = true;
              } else {
                logger.debug(`⏳ Waiting for technology_choices.json to be complete`);
              }
            } else {
              logger.debug(`⚠️  Technology choices not found yet`);
            }
          }
        } else {
          logger.debug(`⚠️  Phase mismatch - current: ${currentPhase}, expected: spec-generate`);
        }
      } else if (fileName === 'technology_choices.json' && dirName === 'documents') {
        // technology_choices.json needs to be checked along with tech spec
        logger.debug(`🎯 Detected technology choices file`);
        if (currentPhase === 'spec-generate') {
          logger.debug(`✅ Current phase matches: spec-generate`);
          const choicesHasPlaceholders = !hasRealJsonContent(content);
          logger.debug(`🎲 Technology choices has placeholders: ${choicesHasPlaceholders}`);
          
          if (!choicesHasPlaceholders) {
          // Check if technical_specification.md is also complete
          const techSpecPath = getTechnicalSpecPath(projectId);
          
          if (fs.existsSync(techSpecPath)) {
            const techSpecContent = fs.readFileSync(techSpecPath, 'utf-8');
              const techSpecHasPlaceholders = hasMarkdownPlaceholders(techSpecContent);
              logger.debug(`🎲 Technical spec has placeholders: ${techSpecHasPlaceholders}`);
            
              if (!techSpecHasPlaceholders) {
              shouldUpdateStatus = true;
              } else {
                logger.debug(`⏳ Waiting for technical_specification.md to be complete`);
            }
          } else {
            logger.debug(`⚠️  Technical specification not found yet`);
            }
          }
        } else {
          logger.debug(`⚠️  Phase mismatch - current: ${currentPhase}, expected: spec-generate`);
        }
      } else {
        logger.debug(`⚠️  File not recognized for status updates: ${fileName} in ${dirName}`);
      }
      
      if (shouldUpdateStatus) {
        logger.debug(`\n🎉 AI WORK COMPLETE DETECTED!`);
        
        // Invalidate output token cache so it gets recalculated on next cost widget load
        if (isCostEstimationEnabled()) {
          invalidateOutputTokenCache(projectId);
          logger.debug(`💰 [Cost] Output token cache invalidated for ${projectId}`);
        }
        
        logger.debug(`✅ Calling markAIWorkComplete(${projectId})`);
        markAIWorkComplete(projectId);
      } else {
        logger.debug(`\n⏸️  No status update needed`);
      }
    } catch (error) {
      logger.debug(`❌ Error reading file: ${error}`);
    }
    
    logger.debug(`${'='.repeat(80)}\n`);
  }
  
  // Handle graceful shutdown
  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) {
      return; // Prevent multiple shutdown attempts
    }
    isShuttingDown = true;
    
    logger.debug('\nShutting down web server...');
    
    // Close file watcher
    watcher.close();
    
    // Forcibly close all WebSocket connections
    wss.clients.forEach(client => {
      client.terminate();
    });
    wss.close();
    
    // Close HTTP server
    server.close(() => {
      logger.debug('Web server stopped');
      process.exit(0);
    });
    
    // Force exit after 2 seconds if graceful shutdown fails
    setTimeout(() => {
      logger.debug('Forcing shutdown...');
      process.exit(0);
    }, 2000);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  return { server, wss, watcher };
}

