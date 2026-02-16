import { useState, useEffect, ReactNode, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select-new';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { CursorLogo, ClaudeCodeLogo, CodexLogo, GeminiLogo, GitHubCopilotLogo, WindsurfLogo } from './AIToolLogos';
import { invalidateAIToolPreferenceCache } from '@/lib/use-ai-tool';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';
import { useSidebarWidth } from '../hooks/use-sidebar-width';
import { SidebarResizeHandle } from './SidebarResizeHandle';

interface GitPreferences {
  enabled: boolean;
  strategy: 'none' | 'branch-per-issue' | 'branch-per-project';
}

type AITool = 'cursor' | 'windsurf' | 'github-copilot' | 'claude-code' | 'codex' | 'gemini';

interface AIToolPreferences {
  tool: AITool;
}

interface HeadlessStatus {
  available: boolean;
  reason?: string;
}

const AI_TOOL_INFO: Record<AITool, { name: string; logo: ReactNode; description: string }> = {
  'cursor': {
    name: 'Cursor',
    logo: <CursorLogo size={20} />,
    description: 'Standalone AI IDE with built-in agent mode'
  },
  'claude-code': {
    name: 'Claude Code',
    logo: <ClaudeCodeLogo size={20} />,
    description: 'Claude\'s coding assistant in VS Code'
  },
  'codex': {
    name: 'Codex CLI',
    logo: <CodexLogo size={20} />,
    description: 'OpenAI coding agent CLI (headless)'
  },
  'gemini': {
    name: 'Gemini CLI',
    logo: <GeminiLogo size={20} />,
    description: 'Google Gemini coding CLI (headless)'
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    logo: <GitHubCopilotLogo size={20} />,
    description: 'AI assistant in VS Code'
  },
  'windsurf': {
    name: 'Windsurf',
    logo: <WindsurfLogo size={20} />,
    description: 'AI-powered IDE with Cascade flow'
  }
};

// Icons
const ProjectsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IssuesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H10M14 4H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="11" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 8H4M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 12H8M14 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="9" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 3C2 2.44772 2.44772 2 3 2H6C7.10457 2 8 2.89543 8 4V13C8 12.4477 7.55228 12 7 12H3C2.44772 12 2 11.5523 2 11V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M14 3C14 2.44772 13.5523 2 13 2H10C8.89543 2 8 2.89543 8 4V13C8 12.4477 8.44772 12 9 12H13C13.5523 12 14 11.5523 14 11V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const PlaybookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2H4C3.44772 2 3 2.44772 3 3V13C3 13.5523 3.44772 14 4 14H12C12.5523 14 13 13.5523 13 13V3C13 2.44772 12.5523 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.5 5H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5.5 8H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5.5 11H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ============================================
// Customize Agents Types and Data
// ============================================

interface CustomizableFile {
  path: string;
  displayName: string;
  description: string;
  type: 'prompt' | 'template' | 'system';
  editable: boolean;
}

interface AgentFlow {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
  systemPrompt?: CustomizableFile;
  phases: {
    name: string;
    prompt: CustomizableFile;
  }[];
  outputTemplates: CustomizableFile[];
}

const AGENT_FLOWS: AgentFlow[] = [
  {
    id: 'product_manager',
    name: 'Product Manager',
    emoji: '✍️',
    role: 'Requirements & Behavior',
    color: '#8b5cf6',
    systemPrompt: {
      path: 'specwright/agents/product_manager/system_prompt.md',
      displayName: 'System Prompt',
      description: 'PM role & expertise',
      type: 'system',
      editable: true
    },
    phases: [
      {
        name: 'Questions Phase',
        prompt: {
          path: 'specwright/agents/product_manager/questioning_prompt.md',
          displayName: 'Questioning Prompt',
          description: 'How PM asks strategic questions',
          type: 'prompt',
          editable: true
        }
      },
      {
        name: 'Analysis Phase',
        prompt: {
          path: 'specwright/agents/product_manager/analysis_prompt.md',
          displayName: 'Analysis Prompt',
          description: 'How PM writes requirements',
          type: 'prompt',
          editable: true
        }
      }
    ],
    outputTemplates: [
      {
        path: 'specwright/templates/prd_template.md',
        displayName: 'PRD Template',
        description: 'Product Requirements Document structure',
        type: 'template',
        editable: true
      }
    ]
  },
  {
    id: 'ux_designer',
    name: 'Designer',
    emoji: '🎨',
    role: 'User Experience',
    color: '#06b6d4',
    systemPrompt: {
      path: 'specwright/agents/ux_designer/system_prompt.md',
      displayName: 'System Prompt',
      description: 'Designer role & expertise',
      type: 'system',
      editable: true
    },
    phases: [
      {
        name: 'Questions Phase',
        prompt: {
          path: 'specwright/agents/ux_designer/questioning_prompt.md',
          displayName: 'Questioning Prompt',
          description: 'How Designer asks UX questions',
          type: 'prompt',
          editable: true
        }
      },
      {
        name: 'Design Phase',
        prompt: {
          path: 'specwright/agents/ux_designer/analysis_prompt.md',
          displayName: 'Analysis Prompt',
          description: 'How Designer creates briefs',
          type: 'prompt',
          editable: true
        }
      }
    ],
    outputTemplates: [
      {
        path: 'specwright/templates/design_brief_template.md',
        displayName: 'Design Brief',
        description: 'Design Brief structure',
        type: 'template',
        editable: true
      }
    ]
  },
  {
    id: 'engineer',
    name: 'Engineer',
    emoji: '🔧',
    role: 'Technical Specification',
    color: '#f59e0b',
    systemPrompt: {
      path: 'specwright/agents/engineer/system_prompt.md',
      displayName: 'System Prompt',
      description: 'Engineer role & expertise',
      type: 'system',
      editable: true
    },
    phases: [
      {
        name: 'Questions Phase',
        prompt: {
          path: 'specwright/agents/engineer/questioning_prompt.md',
          displayName: 'Questioning Prompt',
          description: 'How Engineer asks tech questions',
          type: 'prompt',
          editable: true
        }
      },
      {
        name: 'Specification Phase',
        prompt: {
          path: 'specwright/agents/engineer/analysis_prompt.md',
          displayName: 'Analysis Prompt',
          description: 'How Engineer writes specs',
          type: 'prompt',
          editable: true
        }
      }
    ],
    outputTemplates: [
      {
        path: 'specwright/templates/technical_specification_template.md',
        displayName: 'Tech Spec',
        description: 'Technical Specification structure',
        type: 'template',
        editable: true
      }
    ]
  },
  {
    id: 'breakdown',
    name: 'Issue Breakdown',
    emoji: '📋',
    role: 'Implementation Planning',
    color: '#10b981',
    systemPrompt: {
      path: 'specwright/agents/breakdown/system_prompt.md',
      displayName: 'System Prompt',
      description: 'Breakdown role & expertise',
      type: 'system',
      editable: true
    },
    phases: [
      {
        name: 'Breakdown Phase',
        prompt: {
          path: 'specwright/agents/breakdown/issue_breakdown_prompt.md',
          displayName: 'Breakdown Prompt',
          description: 'How breakdown creates issues',
          type: 'prompt',
          editable: true
        }
      }
    ],
    outputTemplates: [
      {
        path: 'specwright/templates/issue_template.md',
        displayName: 'Issue Template',
        description: 'ENG-* issue structure',
        type: 'template',
        editable: true
      }
    ]
  }
];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

function getTokenColor(count: number): string {
  if (count < 500) return '#22c55e';
  if (count < 1500) return '#f59e0b';
  if (count < 3000) return '#f97316';
  return '#ef4444';
}

function findNonEditableRanges(content: string): { pattern: string; count: number; examples: string[] }[] {
  const found: { pattern: string; count: number; examples: string[] }[] = [];
  
  const fileRefsInParens = content.match(/\([a-zA-Z0-9_\-]+\.(md|json|txt|ts|tsx|js|jsx|py|yml|yaml)\)/g);
  if (fileRefsInParens && fileRefsInParens.length > 0) {
    const unique = [...new Set(fileRefsInParens)];
    found.push({ 
      pattern: 'File references in parentheses', 
      count: fileRefsInParens.length,
      examples: unique.slice(0, 5)
    });
  }
  
  const standaloneFiles = content.match(/\b([a-zA-Z0-9_\-]+\.(md|json))\b/g);
  if (standaloneFiles && standaloneFiles.length > 0) {
    const parenFiles = fileRefsInParens ? fileRefsInParens.map(f => f.slice(1, -1)) : [];
    const newFiles = standaloneFiles.filter(f => !parenFiles.includes(f));
    if (newFiles.length > 0) {
      const unique = [...new Set(newFiles)];
      found.push({ 
        pattern: 'Standalone file references', 
        count: newFiles.length,
        examples: unique.slice(0, 5)
      });
    }
  }
  
  const templateVars = content.match(/@\$\{[^}]+\}/g);
  if (templateVars && templateVars.length > 0) {
    const unique = [...new Set(templateVars)];
    found.push({ 
      pattern: 'Template variables', 
      count: templateVars.length,
      examples: unique.slice(0, 3)
    });
  }
  
  const doubleBrackets = content.match(/\{\{[^}]+\}\}/g);
  if (doubleBrackets && doubleBrackets.length > 0) {
    const unique = [...new Set(doubleBrackets)];
    found.push({ 
      pattern: 'Path variables', 
      count: doubleBrackets.length,
      examples: unique.slice(0, 3)
    });
  }
  
  return found;
}

// Cost estimation settings interface
interface CostEstimationSettings {
  enabled: boolean;
  tier: 'budget' | 'standard' | 'premium';
}

// Linear integration settings interface
interface LinearSettings {
  apiKey?: string;
  defaultTeamId?: string;
  defaultTeamName?: string;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export function Settings() {
  const { sidebarWidth, handleResizeStart } = useSidebarWidth();
  const location = useLocation();
  const [gitPreferences, setGitPreferences] = useState<GitPreferences>({
    enabled: false,
    strategy: 'none'
  });
  const [aiToolPreferences, setAIToolPreferences] = useState<AIToolPreferences>({
    tool: 'cursor'
  });
  const [costEstimation, setCostEstimation] = useState<CostEstimationSettings>({
    enabled: true,
    tier: 'standard'
  });
  const [loading, setLoading] = useState(true);
  const [savingGit, setSavingGit] = useState(false);
  const [savingAITool, setSavingAITool] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const [hasGitChanges, setHasGitChanges] = useState(false);
  const [hasAIToolChanges, setHasAIToolChanges] = useState(false);
  const [hasCostChanges, setHasCostChanges] = useState(false);
  const [initialGitPreferences, setInitialGitPreferences] = useState<GitPreferences | null>(null);
  const [initialAIToolPreferences, setInitialAIToolPreferences] = useState<AIToolPreferences | null>(null);
  const [initialCostEstimation, setInitialCostEstimation] = useState<CostEstimationSettings | null>(null);
  const [headlessStatus, setHeadlessStatus] = useState<Record<AITool, HeadlessStatus> | null>(null);

  // Linear integration state
  const [linearSettings, setLinearSettings] = useState<LinearSettings>({});
  const [, setInitialLinearSettings] = useState<LinearSettings | null>(null);
  const [, setHasLinearChanges] = useState(false);
  const [savingLinear, setSavingLinear] = useState(false);
  const [linearTeams, setLinearTeams] = useState<LinearTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [linearApiKeyInput, setLinearApiKeyInput] = useState('');
  const [linearError, setLinearError] = useState<string | null>(null);
  const [linearSuccess, setLinearSuccess] = useState<string | null>(null);
  const [validatingApiKey, setValidatingApiKey] = useState(false);

  // Sync status for existing projects
  const [projectSyncList, setProjectSyncList] = useState<Array<{ id: string; name: string; synced: boolean; linearUrl?: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState<Set<string>>(new Set());
  const [syncAllInProgress, setSyncAllInProgress] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // View state: 'main' or 'customize'
  const [settingsView, setSettingsView] = useState<'main' | 'customize'>('main');
  
  // Customize agents state
  const [selectedFile, setSelectedFile] = useState<CustomizableFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const gitResponse = await fetch('/api/settings/git-preferences');
      if (gitResponse.ok) {
        const data = await gitResponse.json();
        setGitPreferences(data);
        setInitialGitPreferences(data);
      }
      
      const aiToolResponse = await fetch('/api/settings/ai-tool');
      if (aiToolResponse.ok) {
        const data = await aiToolResponse.json();
        setAIToolPreferences(data);
        setInitialAIToolPreferences(data);
      }
      
      const costResponse = await fetch('/api/settings/cost-estimation');
      if (costResponse.ok) {
        const data = await costResponse.json();
        setCostEstimation(data);
        setInitialCostEstimation(data);
      }

      // Load Linear settings
      const linearResponse = await fetch('/api/linear/status');
      if (linearResponse.ok) {
        const data = await linearResponse.json();
        if (data.configured) {
          const settings: LinearSettings = {
            apiKey: '••••••••', // Masked - we don't expose the actual key
            defaultTeamId: data.defaultTeamId,
            defaultTeamName: data.defaultTeamName,
          };
          setLinearSettings(settings);
          setInitialLinearSettings(settings);
          // Load teams if configured
          loadLinearTeams();
        }
      }

      // Load headless CLI status
      const headlessResponse = await fetch('/api/settings/headless-status');
      if (headlessResponse.ok) {
        const data = await headlessResponse.json();
        setHeadlessStatus(data);
      }
    } catch (error) {
      logger.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveGitPreferences = async () => {
    setSavingGit(true);
    try {
      const response = await fetch('/api/settings/git-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gitPreferences)
      });
      
      if (response.ok) {
        setInitialGitPreferences(gitPreferences);
        setHasGitChanges(false);
      }
    } catch (error) {
      logger.error('Error saving preferences:', error);
    } finally {
      setSavingGit(false);
    }
  };

  const saveAIToolPreferences = async () => {
    setSavingAITool(true);
    try {
      const response = await fetch('/api/settings/ai-tool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiToolPreferences)
      });
      
      if (response.ok) {
        invalidateAIToolPreferenceCache();
        setInitialAIToolPreferences(aiToolPreferences);
        setHasAIToolChanges(false);
      }
    } catch (error) {
      logger.error('Error saving preferences:', error);
    } finally {
      setSavingAITool(false);
    }
  };

  const saveCostEstimation = async () => {
    setSavingCost(true);
    try {
      const response = await fetch('/api/settings/cost-estimation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(costEstimation)
      });
      
      if (response.ok) {
        setInitialCostEstimation(costEstimation);
        setHasCostChanges(false);
      }
    } catch (error) {
      logger.error('Error saving cost estimation settings:', error);
    } finally {
      setSavingCost(false);
    }
  };

  const handleCostEnabledChange = (enabled: boolean) => {
    const newSettings = { ...costEstimation, enabled };
    setCostEstimation(newSettings);
    setHasCostChanges(JSON.stringify(newSettings) !== JSON.stringify(initialCostEstimation));
  };

  const handleCostTierChange = (tier: string) => {
    const newSettings = { ...costEstimation, tier: tier as CostEstimationSettings['tier'] };
    setCostEstimation(newSettings);
    setHasCostChanges(JSON.stringify(newSettings) !== JSON.stringify(initialCostEstimation));
  };

  // Linear integration functions
  const loadLinearTeams = async () => {
    setLoadingTeams(true);
    try {
      const response = await fetch('/api/linear/teams');
      if (response.ok) {
        const data = await response.json();
        setLinearTeams(data.teams || []);
      }
    } catch (error) {
      logger.error('Failed to load Linear teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const validateAndSaveLinearApiKey = async () => {
    if (!linearApiKeyInput.trim()) {
      setLinearError('Please enter an API key');
      return;
    }

    setValidatingApiKey(true);
    setLinearError(null);
    setLinearSuccess(null);

    try {
      // First validate the API key
      const validateResponse = await fetch('/api/linear/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: linearApiKeyInput.trim() })
      });

      const validateData = await validateResponse.json();

      if (!validateData.valid) {
        setLinearError('Invalid API key. Please check and try again.');
        return;
      }

      // Save the API key
      const saveResponse = await fetch('/api/linear/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: linearApiKeyInput.trim() })
      });

      if (saveResponse.ok) {
        setLinearSuccess('API key saved successfully!');
        setLinearApiKeyInput('');
        setLinearSettings({
          apiKey: '••••••••',
          defaultTeamId: undefined,
          defaultTeamName: undefined,
        });
        setInitialLinearSettings({
          apiKey: '••••••••',
          defaultTeamId: undefined,
          defaultTeamName: undefined,
        });
        // Load teams after saving
        loadLinearTeams();
      } else {
        setLinearError('Failed to save API key');
      }
    } catch (error) {
      logger.error('Error validating/saving Linear API key:', error);
      setLinearError('Failed to connect. Please try again.');
    } finally {
      setValidatingApiKey(false);
    }
  };

  const handleLinearTeamChange = async (teamId: string) => {
    const team = linearTeams.find(t => t.id === teamId);
    if (!team) return;

    setSavingLinear(true);
    setLinearError(null);
    setLinearSuccess(null);

    try {
      const response = await fetch('/api/linear/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultTeamId: teamId,
          defaultTeamName: team.name
        })
      });

      if (response.ok) {
        const newSettings = {
          ...linearSettings,
          defaultTeamId: teamId,
          defaultTeamName: team.name,
        };
        setLinearSettings(newSettings);
        setInitialLinearSettings(newSettings);
        setHasLinearChanges(false);
        setLinearSuccess('Default team updated!');
      } else {
        setLinearError('Failed to update default team');
      }
    } catch (error) {
      logger.error('Error updating Linear team:', error);
      setLinearError('Failed to update. Please try again.');
    } finally {
      setSavingLinear(false);
    }
  };

  const disconnectLinear = async () => {
    setSavingLinear(true);
    setLinearError(null);
    setLinearSuccess(null);

    try {
      const response = await fetch('/api/linear/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: null })
      });

      if (response.ok) {
        setLinearSettings({});
        setInitialLinearSettings(null);
        setLinearTeams([]);
        setProjectSyncList([]);
        setLinearSuccess('Linear disconnected');
      } else {
        setLinearError('Failed to disconnect');
      }
    } catch (error) {
      logger.error('Error disconnecting Linear:', error);
      setLinearError('Failed to disconnect. Please try again.');
    } finally {
      setSavingLinear(false);
    }
  };

  // Load all projects with their sync status
  const loadProjectsSyncStatus = async () => {
    setLoadingProjects(true);
    setSyncError(null);
    try {
      // Get all projects
      const projectsResponse = await fetch('/api/projects');
      if (!projectsResponse.ok) throw new Error('Failed to load projects');
      const projects = await projectsResponse.json();

      // Get sync status for each project (with verification against Linear API)
      const projectsWithStatus = await Promise.all(
        projects.map(async (project: { id: string; name: string }) => {
          try {
            // Use verify=true to check if the Linear project still exists
            const statusResponse = await fetch(`/api/projects/${project.id}/linear-status?verify=true`);
            if (statusResponse.ok) {
              const status = await statusResponse.json();
              return {
                id: project.id,
                name: project.name || project.id,
                synced: status.synced,
                linearUrl: status.syncState?.linearProjectUrl
              };
            }
          } catch {
            // Ignore individual status errors
          }
          return {
            id: project.id,
            name: project.name || project.id,
            synced: false
          };
        })
      );

      setProjectSyncList(projectsWithStatus);
    } catch (error) {
      logger.error('Failed to load projects sync status:', error);
      setSyncError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Sync a single project to Linear
  const syncSingleProject = async (projectId: string) => {
    if (!linearSettings.defaultTeamId) {
      setSyncError('Please select a default team first');
      return;
    }

    setSyncingProjects(prev => new Set(prev).add(projectId));
    setSyncError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/sync-to-linear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: linearSettings.defaultTeamId })
      });

      if (response.ok) {
        const result = await response.json();
        // Update the project in the list
        setProjectSyncList(prev =>
          prev.map(p =>
            p.id === projectId
              ? { ...p, synced: true, linearUrl: result.linearProjectUrl }
              : p
          )
        );
        setLinearSuccess(`Project synced successfully (${result.issuesSynced} issues, ${result.documentsSynced} documents)`);
      } else {
        const error = await response.json();
        setSyncError(error.error || 'Failed to sync project');
      }
    } catch (error) {
      logger.error('Failed to sync project:', error);
      setSyncError('Failed to sync project');
    } finally {
      setSyncingProjects(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  };

  // Sync all unsynced projects
  const syncAllProjects = async () => {
    if (!linearSettings.defaultTeamId) {
      setSyncError('Please select a default team first');
      return;
    }

    const unsyncedProjects = projectSyncList.filter(p => !p.synced);
    if (unsyncedProjects.length === 0) {
      setLinearSuccess('All projects are already synced!');
      return;
    }

    setSyncAllInProgress(true);
    setSyncError(null);
    let successCount = 0;
    let failCount = 0;

    for (const project of unsyncedProjects) {
      try {
        setSyncingProjects(prev => new Set(prev).add(project.id));

        const response = await fetch(`/api/projects/${project.id}/sync-to-linear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: linearSettings.defaultTeamId })
        });

        if (response.ok) {
          const result = await response.json();
          setProjectSyncList(prev =>
            prev.map(p =>
              p.id === project.id
                ? { ...p, synced: true, linearUrl: result.linearProjectUrl }
                : p
            )
          );
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      } finally {
        setSyncingProjects(prev => {
          const next = new Set(prev);
          next.delete(project.id);
          return next;
        });
      }
    }

    setSyncAllInProgress(false);
    if (failCount === 0) {
      setLinearSuccess(`Successfully synced ${successCount} project${successCount !== 1 ? 's' : ''}!`);
    } else {
      setSyncError(`Synced ${successCount} project${successCount !== 1 ? 's' : ''}, ${failCount} failed`);
    }
  };

  // Load projects when Linear is connected and team is selected
  useEffect(() => {
    if (linearSettings.apiKey && linearSettings.defaultTeamId) {
      loadProjectsSyncStatus();
    }
  }, [linearSettings.apiKey, linearSettings.defaultTeamId]);

  const handleStrategyChange = (value: string) => {
    const newPreferences: GitPreferences = {
      enabled: value !== 'none',
      strategy: value as GitPreferences['strategy']
    };
    setGitPreferences(newPreferences);
    setHasGitChanges(JSON.stringify(newPreferences) !== JSON.stringify(initialGitPreferences));
  };

  const handleAIToolChange = (value: string) => {
    const newPreferences: AIToolPreferences = {
      tool: value as AITool
    };
    setAIToolPreferences(newPreferences);
    setHasAIToolChanges(JSON.stringify(newPreferences) !== JSON.stringify(initialAIToolPreferences));
  };

  const getStrategyDescription = (strategy: string) => {
    switch (strategy) {
      case 'none':
        return {
          title: 'No Git Instructions',
          description: 'Ship prompts will not include any git workflow instructions.',
          example: null
        };
      case 'branch-per-issue':
        return {
          title: 'Branch Per Issue',
          description: 'Create one feature branch for each ENG-XXX issue.',
          example: {
            branch: 'feature/ENG-001-user-authentication',
            commits: ['ENG-001: Add authentication form', 'ENG-001: Implement validation']
          }
        };
      case 'branch-per-project':
        return {
          title: 'Branch Per Project',
          description: 'Create one feature branch for the entire project.',
          example: {
            branch: 'feature/001-google-signin-integration',
            commits: ['ENG-001: Add OAuth config', 'ENG-002: Implement UI']
          }
        };
      default:
        return null;
    }
  };

  // Customize agents functions
  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile.path);
    }
  }, [selectedFile]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedFile) {
        setSelectedFile(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedFile]);

  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && selectedFile && !saving) {
        e.preventDefault();
        saveFileContent();
      }
    };

    document.addEventListener('keydown', handleSave);
    return () => document.removeEventListener('keydown', handleSave);
  }, [selectedFile, saving, editedContent]);

  const loadFileContent = async (filePath: string) => {
    setLoadingFile(true);
    try {
      const response = await fetch(`/api/customize/file?path=${encodeURIComponent(filePath)}`);
      if (!response.ok) throw new Error('Failed to load file');
      const data = await response.json();
      setFileContent(data.content);
      setEditedContent(data.content);
    } catch (error) {
      logger.error('Error loading file:', error);
      alert('Failed to load file content. Make sure you have run "specwright init" in this project.');
    } finally {
      setLoadingFile(false);
    }
  };

  const saveFileContent = async () => {
    if (!selectedFile) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/customize/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path, content: editedContent })
      });
      
      if (!response.ok) throw new Error('Failed to save file');
      setFileContent(editedContent);
      setSelectedFile(null);
      alert('✅ File saved! Changes will take effect on next workflow run.');
    } catch (error) {
      logger.error('Error saving file:', error);
      alert('❌ Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const tokenCount = useMemo(() => estimateTokens(editedContent), [editedContent]);
  const originalTokenCount = useMemo(() => estimateTokens(fileContent), [fileContent]);
  const tokenDiff = tokenCount - originalTokenCount;
  const nonEditableWarnings = useMemo(() => findNonEditableRanges(editedContent), [editedContent]);

  const currentStrategyInfo = getStrategyDescription(gitPreferences.strategy);
  const currentToolInfo = AI_TOOL_INFO[aiToolPreferences.tool];

  // Sidebar nav items
  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/', active: location.pathname === '/' },
    { label: 'Issues', icon: IssuesIcon, path: '/issues', active: location.pathname === '/issues' },
    { label: 'Playbook', icon: PlaybookIcon, path: '/playbook', active: location.pathname === '/playbook' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings', active: location.pathname === '/settings' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <div className="linear-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      {/* Sidebar */}
      <aside
        className="relative flex-shrink-0 h-screen flex flex-col border-r sticky top-0"
        style={{
          width: sidebarWidth,
          backgroundColor: 'white',
          borderColor: 'hsl(0 0% 92%)'
        }}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <img src={specwrightLogo} alt="SpecWright" className="w-7 h-7" />
            <span className="font-semibold text-[18px]" style={{ color: 'hsl(0 0% 9%)' }}>
              SpecWright
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-0.5">
            {navItems.filter(item => item.label !== 'Settings').map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                  style={{
                    backgroundColor: item.active ? 'hsl(0 0% 96%)' : 'transparent',
                    color: item.active ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                  }}
                  onMouseEnter={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <item.icon />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* Settings at bottom */}
        {(() => {
          const settingsItem = navItems.find(item => item.label === 'Settings');
          if (!settingsItem) return null;
          return (
            <div className="p-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
              <Link
                to={settingsItem.path}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                style={{
                  backgroundColor: settingsItem.active ? 'hsl(0 0% 96%)' : 'transparent',
                  color: settingsItem.active ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                }}
                onMouseEnter={(e) => {
                  if (!settingsItem.active) {
                    e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!settingsItem.active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <settingsItem.icon />
                <span className="text-[13px] font-medium">{settingsItem.label}</span>
              </Link>
            </div>
          );
        })()}
        <SidebarResizeHandle onMouseDown={handleResizeStart} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header 
          className="sticky top-0 z-10 px-6 py-3 border-b flex items-center gap-3"
          style={{ 
            backgroundColor: 'white',
            borderColor: 'hsl(0 0% 92%)'
          }}
        >
          {settingsView === 'customize' && (
            <button
              onClick={() => setSettingsView('main')}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[13px] transition-colors"
              style={{ color: 'hsl(0 0% 46%)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <BackIcon />
            </button>
          )}
          <SettingsIcon />
          <h1 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
            {settingsView === 'main' ? 'Settings' : 'Customize Prompts & Templates'}
          </h1>
          {settingsView === 'customize' && (
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                backgroundColor: 'hsl(235 69% 61%)',
                color: 'white',
              }}
              title="How does it work?"
            >
              ?
            </button>
          )}
        </header>

        {/* Help Modal for Customize View */}
        {showHelp && settingsView === 'customize' && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setShowHelp(false)}
          >
            <div
              className="max-w-[550px] w-full rounded-lg"
              style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                  How Does It Work?
                </h2>
              </div>
              <div className="p-5 text-[13px]" style={{ color: 'hsl(0 0% 32%)', lineHeight: '1.7' }}>
                <p className="mb-4">
                  SpecWright uses <strong>AI agents</strong> (Product Manager, Designer, Engineer) to create specifications. Each agent follows a workflow:
                </p>
                
                <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}>
                  <div className="mb-3">
                    <strong style={{ color: '#8b5cf6' }}>⚡ System Prompt</strong>
                    <p className="text-[12px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                      Defines the agent's role, expertise, and personality.
                    </p>
                  </div>
                  <div className="mb-3">
                    <strong style={{ color: '#3b82f6' }}>🔹 Phase Prompts</strong>
                    <p className="text-[12px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                      Instructions for each phase of work.
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#22c55e' }}>📄 Output Templates</strong>
                    <p className="text-[12px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                      Structure for documents the agent creates.
                    </p>
                  </div>
                </div>
                
                <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                  💡 Changes take effect on the next workflow run.
                </p>
              </div>
              <div className="p-4 border-t flex justify-end" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-4 py-2 rounded-md text-[13px] font-medium"
                  style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {settingsView === 'main' ? (
            // Main Settings View
            <div className="max-w-3xl">
              {/* Learn More Section */}
              <section className="mb-8">
                <div 
                  className="rounded-lg p-5"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>Learn More</h2>
                  <p className="text-[13px] mb-4" style={{ color: 'hsl(0 0% 46%)' }}>
                    Understand how SpecWright works and the concepts behind it
                  </p>

                  <Link
                    to="/how-it-works"
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors no-underline"
                    style={{ 
                      backgroundColor: 'hsl(235 69% 97%)',
                      border: '1px solid hsl(235 69% 92%)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(235 69% 95%)';
                      e.currentTarget.style.borderColor = 'hsl(235 69% 85%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(235 69% 97%)';
                      e.currentTarget.style.borderColor = 'hsl(235 69% 92%)';
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                      >
                        <BookIcon />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>How does SpecWright work?</p>
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>Projects, Issues, AI Agents, and the specification workflow</p>
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </Link>
                </div>
              </section>

              {/* AI Tool Section */}
              <section className="mb-8">
                <div 
                  className="rounded-lg p-5"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>AI Coding Tool</h2>
                      <p className="text-[13px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                        Select which AI assistant SpecWright will open and paste prompts into.
                      </p>
                    </div>
                    {hasAIToolChanges && (
                      <button
                        onClick={saveAIToolPreferences}
                        disabled={savingAITool}
                        className="px-3 py-1.5 rounded-md text-[13px] font-medium"
                        style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                      >
                        {savingAITool ? 'Saving...' : 'Save'}
                      </button>
                    )}
                  </div>

                  <div className="mb-4">
                    <Label htmlFor="ai-tool" className="text-[13px] mb-2 block">Select AI Tool</Label>
                    <Select value={aiToolPreferences.tool} onValueChange={handleAIToolChange}>
                      <SelectTrigger id="ai-tool" className="w-full max-w-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cursor">
                          <div className="flex items-center gap-2">
                            <CursorLogo size={18} />
                            <span>Cursor</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="claude-code">
                          <div className="flex items-center gap-2">
                            <ClaudeCodeLogo size={18} />
                            <span>Claude Code</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="codex">
                          <div className="flex items-center gap-2">
                            <CodexLogo size={18} />
                            <span>Codex CLI</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini">
                          <div className="flex items-center gap-2">
                            <GeminiLogo size={18} />
                            <span>Gemini CLI</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="github-copilot">
                          <div className="flex items-center gap-2">
                            <GitHubCopilotLogo size={18} />
                            <span>GitHub Copilot</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="windsurf">
                          <div className="flex items-center gap-2">
                            <WindsurfLogo size={18} />
                            <span>Windsurf</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {currentToolInfo && (
                    <div
                      className="p-4 rounded-lg flex items-center gap-3"
                      style={{ backgroundColor: 'hsl(210 100% 97%)', border: '1px solid hsl(210 100% 92%)' }}
                    >
                      {currentToolInfo.logo}
                      <div className="flex-1">
                        <p className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{currentToolInfo.name}</p>
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>{currentToolInfo.description}</p>
                      </div>
                      {/* Headless status indicator */}
                      {headlessStatus && headlessStatus[aiToolPreferences.tool] && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {headlessStatus[aiToolPreferences.tool].available ? (
                            <>
                              <span style={{ color: 'hsl(142 76% 36%)' }}>✓</span>
                              <span style={{ color: 'hsl(142 76% 36%)' }}>Headless mode</span>
                            </>
                          ) : (aiToolPreferences.tool === 'claude-code' || aiToolPreferences.tool === 'cursor') ? (
                            <>
                              <span style={{ color: 'hsl(0 0% 60%)' }}>○</span>
                              <span style={{ color: 'hsl(0 0% 60%)' }}>Keyboard automation</span>
                            </>
                          ) : (aiToolPreferences.tool === 'codex' || aiToolPreferences.tool === 'gemini') ? (
                            <>
                              <span style={{ color: 'hsl(0 84% 45%)' }}>!</span>
                              <span style={{ color: 'hsl(0 84% 45%)' }}>
                                CLI setup required
                              </span>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Customization Section */}
              <section className="mb-8">
                <div 
                  className="rounded-lg p-5"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>Customization</h2>
                  <p className="text-[13px] mb-4" style={{ color: 'hsl(0 0% 46%)' }}>
                    Customize AI agent prompts and document templates
                  </p>

                  <button
                    onClick={() => setSettingsView('customize')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors"
                    style={{ 
                      backgroundColor: 'hsl(0 0% 98%)',
                      border: '1px solid hsl(0 0% 92%)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 98%)';
                    }}
                  >
                    <div className="text-left">
                      <p className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>Customize Prompts & Templates</p>
                      <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>Edit agent behavior, questions, and document structures</p>
                    </div>
                    <ChevronRightIcon />
                  </button>
                </div>
              </section>

              {/* Git Workflow Section */}
              <section>
                <div 
                  className="rounded-lg p-5"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>Git Workflow</h2>
                      <p className="text-[13px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                        Configure how SpecWright generates git instructions in Ship prompts.
                      </p>
                    </div>
                    {hasGitChanges && (
                      <button
                        onClick={saveGitPreferences}
                        disabled={savingGit}
                        className="px-3 py-1.5 rounded-md text-[13px] font-medium"
                        style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                      >
                        {savingGit ? 'Saving...' : 'Save'}
                      </button>
                    )}
                  </div>

                  <div className="mb-4">
                    <Label htmlFor="git-strategy" className="text-[13px] mb-2 block">Git Strategy</Label>
                    <Select value={gitPreferences.strategy} onValueChange={handleStrategyChange}>
                      <SelectTrigger id="git-strategy" className="w-full max-w-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Git Instructions</SelectItem>
                        <SelectItem value="branch-per-issue">Branch Per Issue</SelectItem>
                        <SelectItem value="branch-per-project">Branch Per Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {currentStrategyInfo && (
                    <div 
                      className="p-4 rounded-lg"
                      style={{ 
                        backgroundColor: gitPreferences.enabled ? 'hsl(210 100% 97%)' : 'hsl(0 0% 98%)',
                        border: `1px solid ${gitPreferences.enabled ? 'hsl(210 100% 92%)' : 'hsl(0 0% 94%)'}`
                      }}
                    >
                      <p className="text-[13px] font-medium mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                        {currentStrategyInfo.title}
                      </p>
                      <p className="text-[12px] mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                        {currentStrategyInfo.description}
                      </p>

                      {currentStrategyInfo.example && (
                        <div 
                          className="p-3 rounded"
                          style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                        >
                          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'hsl(0 0% 46%)' }}>
                            Example
                          </p>
                          <p className="text-[12px] font-mono mb-2" style={{ color: 'hsl(0 0% 32%)' }}>
                            {currentStrategyInfo.example.branch}
                          </p>
                          <div className="space-y-1">
                            {currentStrategyInfo.example.commits.map((commit, idx) => (
                              <p key={idx} className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 46%)' }}>
                                • {commit}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Cost Estimation Section */}
              <section>
                <div 
                  className="rounded-lg p-5"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>Token Cost Estimation</h2>
                      <p className="text-[13px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                        Track estimated API costs during specification workflows.
                      </p>
                    </div>
                    {hasCostChanges && (
                      <button
                        onClick={saveCostEstimation}
                        disabled={savingCost}
                        className="px-3 py-1.5 rounded-md text-[13px] font-medium"
                        style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                      >
                        {savingCost ? 'Saving...' : 'Save'}
                      </button>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-[13px]">Enable Cost Tracking</Label>
                        <p className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 60%)' }}>
                          Show token usage and cost estimates during specification
                        </p>
                      </div>
                      <Switch 
                        checked={costEstimation.enabled}
                        onCheckedChange={handleCostEnabledChange}
                      />
                    </div>
                  </div>

                  {costEstimation.enabled && (
                    <div className="mb-4">
                      <Label htmlFor="cost-tier" className="text-[13px] mb-2 block">Reference Pricing Tier</Label>
                      <Select value={costEstimation.tier} onValueChange={handleCostTierChange}>
                        <SelectTrigger id="cost-tier" className="w-full max-w-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="budget">Budget (GPT-4o-mini, Claude Haiku)</SelectItem>
                          <SelectItem value="standard">Standard (GPT-4o, Claude Sonnet)</SelectItem>
                          <SelectItem value="premium">Premium (Claude Opus, o1)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] mt-2" style={{ color: 'hsl(0 0% 60%)' }}>
                        Estimates are based on typical API pricing for this tier. Actual costs from your AI tool may vary.
                      </p>
                    </div>
                  )}

                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: costEstimation.enabled ? 'hsl(235 69% 97%)' : 'hsl(0 0% 98%)',
                      border: `1px solid ${costEstimation.enabled ? 'hsl(235 69% 92%)' : 'hsl(0 0% 94%)'}`
                    }}
                  >
                    <p className="text-[13px] font-medium mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                      {costEstimation.enabled ? 'Cost estimates will appear in the sidebar' : 'Cost tracking disabled'}
                    </p>
                    <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                      {costEstimation.enabled
                        ? 'During specification, you\'ll see input and output token counts with estimated costs for each phase.'
                        : 'Enable to track token usage and see cost estimates during specification workflows.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Linear Integration Section */}
              <section className="mt-8">
                <div
                  className="rounded-lg p-5"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: 'hsl(0 0% 9%)' }}>
                        <svg width="16" height="16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 90c-22.1 0-40-17.9-40-40s17.9-40 40-40 40 17.9 40 40-17.9 40-40 40z" fill="#5E6AD2"/>
                          <path d="M68.5 35.5L44.5 59.5l-13-13" stroke="#5E6AD2" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Linear Integration
                      </h2>
                      <p className="text-[13px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                        Connect to Linear to sync projects and issues.
                      </p>
                    </div>
                  </div>

                  {/* Error/Success Messages */}
                  {linearError && (
                    <div
                      className="p-3 rounded-lg mb-4"
                      style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}
                    >
                      <p className="text-[13px]" style={{ color: 'hsl(0 84% 40%)' }}>{linearError}</p>
                    </div>
                  )}
                  {linearSuccess && (
                    <div
                      className="p-3 rounded-lg mb-4"
                      style={{ backgroundColor: 'hsl(142 76% 97%)', border: '1px solid hsl(142 76% 85%)' }}
                    >
                      <p className="text-[13px]" style={{ color: 'hsl(142 76% 30%)' }}>{linearSuccess}</p>
                    </div>
                  )}

                  {/* Not Connected State */}
                  {!linearSettings.apiKey && (
                    <div>
                      <div className="mb-4">
                        <Label htmlFor="linear-api-key" className="text-[13px] mb-2 block">API Key</Label>
                        <div className="flex gap-2 max-w-md">
                          <Input
                            id="linear-api-key"
                            type="password"
                            placeholder="lin_api_..."
                            value={linearApiKeyInput}
                            onChange={(e) => setLinearApiKeyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                validateAndSaveLinearApiKey();
                              }
                            }}
                          />
                          <button
                            onClick={validateAndSaveLinearApiKey}
                            disabled={validatingApiKey || !linearApiKeyInput.trim()}
                            className="px-4 py-2 rounded-md text-[13px] font-medium whitespace-nowrap disabled:opacity-50"
                            style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                          >
                            {validatingApiKey ? 'Connecting...' : 'Connect'}
                          </button>
                        </div>
                        <p className="text-[11px] mt-2" style={{ color: 'hsl(0 0% 60%)' }}>
                          Get your API key from{' '}
                          <a
                            href="https://linear.app/settings/api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                            style={{ color: 'hsl(235 69% 61%)' }}
                          >
                            Linear Settings → API
                          </a>
                        </p>
                      </div>

                      <div
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 94%)' }}
                      >
                        <p className="text-[13px] font-medium mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                          Not connected
                        </p>
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                          Connect your Linear account to sync projects and issues directly from SpecWright.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Connected State */}
                  {linearSettings.apiKey && (
                    <div>
                      {/* Team Selection */}
                      <div className="mb-4">
                        <Label htmlFor="linear-team" className="text-[13px] mb-2 block">Default Team</Label>
                        <Select
                          value={linearSettings.defaultTeamId || ''}
                          onValueChange={handleLinearTeamChange}
                          disabled={loadingTeams || savingLinear}
                        >
                          <SelectTrigger id="linear-team" className="w-full max-w-sm">
                            <SelectValue placeholder={loadingTeams ? 'Loading teams...' : 'Select a team'} />
                          </SelectTrigger>
                          <SelectContent>
                            {linearTeams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(0 0% 95%)' }}>
                                    {team.key}
                                  </span>
                                  <span>{team.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] mt-2" style={{ color: 'hsl(0 0% 60%)' }}>
                          Projects will sync to this team by default.
                        </p>
                      </div>

                      <div
                        className="p-4 rounded-lg mb-4"
                        style={{ backgroundColor: 'hsl(142 76% 97%)', border: '1px solid hsl(142 76% 85%)' }}
                      >
                        <p className="text-[13px] font-medium mb-1" style={{ color: 'hsl(142 76% 30%)' }}>
                          Connected to Linear
                        </p>
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                          {linearSettings.defaultTeamName
                            ? `Projects will sync to ${linearSettings.defaultTeamName}`
                            : 'Select a default team above to enable syncing.'}
                        </p>
                      </div>

                      {/* Sync Existing Projects Section */}
                      {linearSettings.defaultTeamId && (
                        <div
                          className="p-4 rounded-lg mb-4"
                          style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                                Sync Existing Projects
                              </p>
                              <p className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                                Sync projects that were created before Linear integration
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={loadProjectsSyncStatus}
                                disabled={loadingProjects}
                                className="text-[12px] px-2.5 py-1 rounded transition-colors"
                                style={{
                                  backgroundColor: 'transparent',
                                  color: 'hsl(235 69% 61%)',
                                  border: '1px solid hsl(235 69% 80%)'
                                }}
                                title="Refresh project list"
                              >
                                {loadingProjects ? '...' : '↻'}
                              </button>
                              <button
                                onClick={syncAllProjects}
                                disabled={syncAllInProgress || loadingProjects || projectSyncList.filter(p => !p.synced).length === 0}
                                className="text-[12px] px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
                                style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                              >
                                {syncAllInProgress ? 'Syncing...' : 'Sync All'}
                              </button>
                            </div>
                          </div>

                          {/* Sync Error */}
                          {syncError && (
                            <div
                              className="p-2 rounded mb-3"
                              style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}
                            >
                              <p className="text-[12px]" style={{ color: 'hsl(0 84% 40%)' }}>{syncError}</p>
                            </div>
                          )}

                          {/* Projects List */}
                          {loadingProjects ? (
                            <div className="py-4 text-center">
                              <div className="linear-spinner mx-auto" style={{ width: '20px', height: '20px' }}></div>
                              <p className="text-[12px] mt-2" style={{ color: 'hsl(0 0% 46%)' }}>Loading projects...</p>
                            </div>
                          ) : projectSyncList.length === 0 ? (
                            <p className="text-[12px] py-2" style={{ color: 'hsl(0 0% 46%)' }}>
                              No projects found
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-[240px] overflow-y-auto">
                              {projectSyncList.map((project) => (
                                <div
                                  key={project.id}
                                  className="flex items-center justify-between p-2 rounded"
                                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {project.synced ? (
                                      <span
                                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: 'hsl(142 76% 90%)', color: 'hsl(142 76% 36%)' }}
                                        title="Synced to Linear"
                                      >
                                        ✓
                                      </span>
                                    ) : (
                                      <span
                                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: 'hsl(0 0% 95%)', color: 'hsl(0 0% 60%)' }}
                                        title="Not synced"
                                      >
                                        ○
                                      </span>
                                    )}
                                    <span className="text-[12px] truncate" style={{ color: 'hsl(0 0% 9%)' }}>
                                      {project.name}
                                    </span>
                                  </div>
                                  <div className="flex-shrink-0 ml-2">
                                    {project.synced ? (
                                      <a
                                        href={project.linearUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] px-2 py-1 rounded transition-colors"
                                        style={{
                                          backgroundColor: 'hsl(235 69% 97%)',
                                          color: 'hsl(235 69% 61%)',
                                          textDecoration: 'none'
                                        }}
                                      >
                                        Open in Linear →
                                      </a>
                                    ) : (
                                      <button
                                        onClick={() => syncSingleProject(project.id)}
                                        disabled={syncingProjects.has(project.id) || syncAllInProgress}
                                        className="text-[11px] px-2 py-1 rounded transition-colors disabled:opacity-50"
                                        style={{
                                          backgroundColor: 'hsl(235 69% 61%)',
                                          color: 'white'
                                        }}
                                      >
                                        {syncingProjects.has(project.id) ? 'Syncing...' : 'Sync'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Summary */}
                          {projectSyncList.length > 0 && (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                              <p className="text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>
                                {projectSyncList.filter(p => p.synced).length} of {projectSyncList.length} projects synced
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Disconnect Button */}
                      <button
                        onClick={disconnectLinear}
                        disabled={savingLinear}
                        className="text-[13px] px-3 py-1.5 rounded-md transition-colors"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'hsl(0 84% 40%)',
                          border: '1px solid hsl(0 84% 80%)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'hsl(0 84% 97%)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {savingLinear ? 'Disconnecting...' : 'Disconnect Linear'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            // Customize Prompts View
            <div>
              <p className="text-[12px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
                Edit prompts and templates to customize AI behavior • Click any <span style={{ color: '#22c55e' }}>✏️</span> to edit
              </p>
              
              {/* Scoping Prompt Section */}
              <div className="mb-6">
                <h2 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'hsl(0 0% 9%)' }}>
                  <span>🎯</span>
                  <span>Project Scoping</span>
                </h2>
                <div 
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div 
                    onClick={() => setSelectedFile({
                      path: 'specwright/templates/scoping_prompt.md',
                      displayName: 'Scoping Prompt',
                      description: 'Determines work classification and project breakdown logic',
                      type: 'prompt',
                      editable: true
                    })}
                    className="p-3 rounded-md cursor-pointer transition-all flex items-center justify-between"
                    style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(235 69% 61%)';
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 98%)';
                    }}
                  >
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                        scoping_prompt.md
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                        Controls work classification and project breakdown
                      </div>
                    </div>
                    <Badge style={{ backgroundColor: 'hsl(235 69% 61% / 0.1)', color: 'hsl(235 69% 61%)', fontSize: '0.7rem' }}>
                      ✏️ Edit
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Playbook Section */}
              <div className="mb-6">
                <h2 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'hsl(0 0% 9%)' }}>
                  <span>📜</span>
                  <span>Project Playbook</span>
                </h2>
                <div 
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="grid gap-2">
                    {/* Generation Prompt */}
                    <div 
                      onClick={() => setSelectedFile({
                        path: 'specwright/agents/playbook/generation_prompt.md',
                        displayName: 'Generation Prompt',
                        description: 'How the AI analyzes your codebase and creates the initial playbook',
                        type: 'prompt',
                        editable: true
                      })}
                      className="p-3 rounded-md cursor-pointer transition-all flex items-center justify-between"
                      style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(235 69% 61%)';
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
                        e.currentTarget.style.backgroundColor = 'hsl(0 0% 98%)';
                      }}
                    >
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                          generation_prompt.md
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                          Controls how the playbook is initially generated
                        </div>
                      </div>
                      <Badge style={{ backgroundColor: 'hsl(235 69% 61% / 0.1)', color: 'hsl(235 69% 61%)', fontSize: '0.7rem' }}>
                        ✏️ Edit
                      </Badge>
                    </div>
                    
                    {/* Update Prompt */}
                    <div 
                      onClick={() => setSelectedFile({
                        path: 'specwright/agents/playbook/update_prompt.md',
                        displayName: 'Update Prompt',
                        description: 'How the AI syncs the playbook with codebase changes',
                        type: 'prompt',
                        editable: true
                      })}
                      className="p-3 rounded-md cursor-pointer transition-all flex items-center justify-between"
                      style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(235 69% 61%)';
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
                        e.currentTarget.style.backgroundColor = 'hsl(0 0% 98%)';
                      }}
                    >
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                          update_prompt.md
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                          Controls playbook sync with codebase drift
                        </div>
                      </div>
                      <Badge style={{ backgroundColor: 'hsl(235 69% 61% / 0.1)', color: 'hsl(235 69% 61%)', fontSize: '0.7rem' }}>
                        ✏️ Edit
                      </Badge>
                    </div>
                    
                    {/* Audit Prompt */}
                    <div 
                      onClick={() => setSelectedFile({
                        path: 'specwright/agents/playbook/audit_prompt.md',
                        displayName: 'Audit Prompt',
                        description: 'How the AI checks codebase compliance with playbook principles',
                        type: 'prompt',
                        editable: true
                      })}
                      className="p-3 rounded-md cursor-pointer transition-all flex items-center justify-between"
                      style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(235 69% 61%)';
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
                        e.currentTarget.style.backgroundColor = 'hsl(0 0% 98%)';
                      }}
                    >
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                          audit_prompt.md
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                          Controls compliance audit reports
                        </div>
                      </div>
                      <Badge style={{ backgroundColor: 'hsl(235 69% 61% / 0.1)', color: 'hsl(235 69% 61%)', fontSize: '0.7rem' }}>
                        ✏️ Edit
                      </Badge>
                    </div>
                    
                    {/* Playbook Template */}
                    <div 
                      onClick={() => setSelectedFile({
                        path: 'specwright/templates/playbook_template.md',
                        displayName: 'Playbook Template',
                        description: 'The structure and format of the generated PLAYBOOK.md file',
                        type: 'template',
                        editable: true
                      })}
                      className="p-3 rounded-md cursor-pointer transition-all flex items-center justify-between"
                      style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(142 76% 36%)';
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
                        e.currentTarget.style.backgroundColor = 'hsl(0 0% 98%)';
                      }}
                    >
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                          playbook_template.md
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                          Template structure for PLAYBOOK.md output
                        </div>
                      </div>
                      <Badge style={{ backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)', fontSize: '0.7rem' }}>
                        📄 Template
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Agent Workflows Section */}
              <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'hsl(0 0% 9%)' }}>
                Agent Workflows
              </h2>
              
              {/* Legend */}
              <div 
                className="flex gap-6 mb-4 p-3 rounded-lg"
                style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#a855f7' }}></div>
                  <span className="text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>System Prompt</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                  <span className="text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>Phase Prompt</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }}></div>
                  <span className="text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>Output Template</span>
                </div>
              </div>

              {/* Agent Flow Diagrams */}
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {AGENT_FLOWS.map((agent) => (
                  <AgentFlowDiagram
                    key={agent.id}
                    agent={agent}
                    onEditFile={setSelectedFile}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* File Editor Modal */}
        <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}>
            {selectedFile && (
              <>
                <DialogHeader className="pb-4 pr-12" style={{ borderBottom: '1px solid hsl(0 0% 92%)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <DialogTitle style={{ color: 'hsl(0 0% 9%)' }}>{selectedFile.displayName}</DialogTitle>
                      <DialogDescription className="mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
                        {selectedFile.description}
                      </DialogDescription>
                      <code className="text-xs px-2 py-1 rounded mt-2 inline-block font-mono" style={{ backgroundColor: 'hsl(235 69% 97%)', color: 'hsl(235 69% 50%)' }}>
                        {selectedFile.path}
                      </code>
                    </div>
                    
                    <div className="flex flex-col items-end min-w-[100px]">
                      <div 
                        className="text-xl font-bold font-mono"
                        style={{ color: getTokenColor(tokenCount) }}
                      >
                        ~{formatTokenCount(tokenCount)}
                      </div>
                      <div className="text-xs" style={{ color: 'hsl(0 0% 46%)' }}>tokens</div>
                      {tokenDiff !== 0 && (
                        <div 
                          className="text-sm mt-1"
                          style={{ color: tokenDiff > 0 ? '#f59e0b' : '#22c55e' }}
                        >
                          {tokenDiff > 0 ? '+' : ''}{formatTokenCount(tokenDiff)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {nonEditableWarnings.length > 0 && (
                    <Alert variant="warning" className="mt-4">
                      <span className="text-lg">⚠️</span>
                      <AlertTitle>Protected File References - Do Not Edit</AlertTitle>
                      <AlertDescription>
                        {nonEditableWarnings.map((warning, idx) => (
                          <div key={idx} className="mt-2">
                            <div className="text-xs font-medium text-amber-900 mb-1">
                              {warning.pattern}: {warning.count} occurrence{warning.count > 1 ? 's' : ''}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {warning.examples.map((example, exIdx) => (
                                <code key={exIdx} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                                  {example}
                                </code>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="text-xs text-amber-800 mt-3 italic">
                          These references tell the system which files to load. Changing them will break the workflow.
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </DialogHeader>
                
                <div className="flex-1 overflow-auto p-6">
                  {loadingFile ? (
                    <div className="text-center py-12">
                      <div className="linear-spinner mx-auto" style={{ width: '32px', height: '32px' }}></div>
                      <p className="mt-4" style={{ color: 'hsl(0 0% 46%)' }}>Loading file...</p>
                    </div>
                  ) : (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full h-full min-h-[450px] font-mono text-sm"
                      style={{ 
                        backgroundColor: 'hsl(0 0% 98%)', 
                        color: 'hsl(0 0% 9%)', 
                        border: '1px solid hsl(0 0% 92%)',
                      }}
                    />
                  )}
                </div>
                
                <DialogFooter className="pt-4" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                  <div className="flex items-center justify-between w-full">
                    <div className="text-xs" style={{ color: 'hsl(0 0% 46%)' }}>
                      💡 Tip: Changes take effect on next workflow run
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setSelectedFile(null)}
                        disabled={saving}
                        variant="outline"
                        style={{ borderColor: 'hsl(0 0% 90%)', color: 'hsl(0 0% 32%)' }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={saveFileContent}
                        disabled={saving || editedContent === fileContent}
                        style={{ 
                          backgroundColor: editedContent === fileContent ? 'hsl(0 0% 90%)' : 'hsl(235 69% 61%)', 
                          color: editedContent === fileContent ? 'hsl(0 0% 46%)' : 'white' 
                        }}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

// Flow Diagram Component
function AgentFlowDiagram({ 
  agent, 
  onEditFile 
}: { 
  agent: AgentFlow; 
  onEditFile: (file: CustomizableFile) => void;
}) {
  return (
    <div 
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
    >
      {/* Agent Header */}
      <div 
        className="px-4 py-3"
        style={{ 
          background: `linear-gradient(135deg, ${agent.color}15 0%, ${agent.color}05 100%)`,
          borderBottom: `2px solid ${agent.color}30`
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{agent.emoji}</span>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>{agent.name}</div>
            <div className="text-[10px]" style={{ color: 'hsl(0 0% 46%)' }}>{agent.role}</div>
          </div>
        </div>
      </div>

      {/* Flow Content */}
      <div className="p-4 relative">
        <div className="absolute left-7 top-4 bottom-4 w-0.5" style={{ backgroundColor: 'hsl(0 0% 92%)' }} />

        {agent.systemPrompt && (
          <FlowNode
            icon="⚡"
            color="#a855f7"
            file={agent.systemPrompt}
            onEdit={onEditFile}
          />
        )}

        {agent.phases.map((phase, idx) => (
          <FlowNode
            key={idx}
            icon={`${idx + 1}`}
            color="#3b82f6"
            label={phase.name}
            file={phase.prompt}
            onEdit={onEditFile}
          />
        ))}

        <div className="ml-8 my-3 border-t border-dashed relative" style={{ borderColor: 'hsl(0 0% 85%)' }}>
          <span 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-[9px] uppercase tracking-wide"
            style={{ backgroundColor: 'white', color: 'hsl(0 0% 46%)' }}
          >
            Outputs
          </span>
        </div>

        {agent.outputTemplates.map((template, idx) => (
          <FlowNode
            key={idx}
            icon="📄"
            color={template.editable ? '#22c55e' : '#64748b'}
            file={template}
            onEdit={onEditFile}
          />
        ))}
      </div>
    </div>
  );
}

// Individual Flow Node
function FlowNode({
  icon,
  color,
  label,
  file,
  onEdit
}: {
  icon: string;
  color: string;
  label?: string;
  file: CustomizableFile;
  onEdit: (file: CustomizableFile) => void;
}) {
  const isNumber = /^\d+$/.test(icon);
  
  return (
    <div className="flex items-start gap-2.5 mb-2.5 relative">
      <div 
        className="flex items-center justify-center flex-shrink-0 z-[1]"
        style={{
          width: '22px',
          height: '22px',
          borderRadius: isNumber ? '4px' : '50%',
          backgroundColor: color,
          fontSize: isNumber ? '0.65rem' : '0.7rem',
          fontWeight: isNumber ? '700' : '400',
          color: 'white',
          boxShadow: '0 0 0 2px white'
        }}
      >
        {icon}
      </div>

      <div 
        onClick={file.editable ? () => onEdit(file) : undefined}
        className="flex-1 p-2.5 rounded-md transition-all"
        style={{
          backgroundColor: file.editable ? 'hsl(0 0% 98%)' : 'hsl(0 0% 96%)',
          border: `1px solid ${file.editable ? 'hsl(0 0% 92%)' : 'hsl(0 0% 88%)'}`,
          cursor: file.editable ? 'pointer' : 'not-allowed',
          opacity: file.editable ? 1 : 0.7
        }}
        onMouseEnter={(e) => {
          if (file.editable) {
            e.currentTarget.style.borderColor = color;
            e.currentTarget.style.backgroundColor = 'white';
          }
        }}
        onMouseLeave={(e) => {
          if (file.editable) {
            e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
            e.currentTarget.style.backgroundColor = 'hsl(0 0% 98%)';
          }
        }}
      >
        {label && (
          <div 
            className="text-[9px] uppercase tracking-wide mb-0.5"
            style={{ color: 'hsl(0 0% 46%)' }}
          >
            {label}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
            {file.displayName}
          </span>
          {file.editable ? (
            <Badge style={{ backgroundColor: `${color}15`, color: color, fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
              ✏️
            </Badge>
          ) : (
            <Badge style={{ backgroundColor: 'hsl(0 0% 90%)', color: 'hsl(0 0% 46%)', fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
              🔒
            </Badge>
          )}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
          {file.description}
        </div>
      </div>
    </div>
  );
}
