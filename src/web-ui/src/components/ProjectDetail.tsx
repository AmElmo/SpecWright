import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { MarkdownViewer } from './MarkdownViewer';
import { TechnologyChoicesViewer } from './TechnologyChoicesViewer';
import { AcceptanceCriteriaEditor } from './AcceptanceCriteriaEditor';
import { ScreensRenderer } from './ScreensRenderer';
import { CostWidget } from './CostWidget';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useRealtimeUpdates } from '@/lib/use-realtime';
import { useAIToolName } from '@/lib/use-ai-tool';
import { IconPicker, IconSVG } from './IconPicker';
import { useShipModal } from '@/lib/ship-modal-context';
import { IssueModal } from './IssueModal';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

interface ProjectIcon {
  type: 'icon' | 'emoji';
  value: string;
  color?: string;
}

interface ProjectData {
  id: string;
  path: string;
  request?: string;
  prd?: string;
  acceptanceCriteria?: string;
  design?: string;
  screens?: string;
  tech?: string;
  techChoices?: string;
  summary?: {
    issues_list: any[];
  };
  screenInventory?: any;
}

interface ProjectStatus {
  phases: {
    pm: { complete: boolean };
    ux: { complete: boolean };
    engineer: { complete: boolean };
  };
  currentPhase: string;
  isComplete: boolean;
}

interface Issue {
  id: string;
  title: string;
  status: 'pending' | 'in-review' | 'approved';
  complexity?: string;
}

// Full issue data for Kanban board
interface FullIssue {
  issueId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-review' | 'approved';
  estimatedHours: number;
  dependencies: string[];
  // Traceability fields
  screensAffected?: string[];
  // Issue content
  keyDecisions?: string[];
  acceptanceCriteria?: Array<{ id: string; description: string }>;  // Objects with id and description
  technicalDetails?: string;
  testStrategy?: {
    automated_tests?: string;
    manual_verification?: string;
  };
  humanInTheLoop?: string[];
  // Legacy fields (deprecated)
  implementationNotes?: string;
  filePath?: string;
  projectId: string;
  projectName: string;
}

interface TaskCounts {
  blocked: number;
  ready: number;
  inReview: number;
  approved: number;
  total: number;
}

// Status configuration for issue badges (simple view)
const issueStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  'pending': { 
    label: 'Ready', 
    color: 'hsl(235 69% 50%)', 
    bgColor: 'hsl(235 69% 95%)',
  },
  'in-review': { 
    label: 'In Review', 
    color: 'hsl(45 93% 35%)', 
    bgColor: 'hsl(45 93% 95%)',
  },
  'approved': { 
    label: 'Done', 
    color: 'hsl(142 76% 36%)', 
    bgColor: 'hsl(142 76% 94%)',
  },
};

// Status configuration for Kanban board columns
const boardStatusConfig = {
  blocked: { label: 'Blocked', color: 'hsl(0 0% 46%)', bgColor: 'hsl(0 0% 94%)' },
  ready: { label: 'Ready', color: 'hsl(44 100% 42%)', bgColor: 'hsl(44 100% 94%)' },
  inReview: { label: 'In Review', color: 'hsl(210 100% 45%)', bgColor: 'hsl(210 100% 95%)' },
  approved: { label: 'Completed', color: 'hsl(142 76% 36%)', bgColor: 'hsl(142 76% 94%)' }
};

interface Question {
  id: string;
  question: string;
  options?: string[];
  rationale?: string;
  // "answer" is the field used by QuestionForm when users fill out questions
  // "decision" is used in AI-generated/test data for backwards compatibility
  answer?: string;
  decision?: string;
  rejected_alternatives?: string[];
}

interface QuestionsData {
  project_request: string;
  questions: Question[];
}

interface AllQuestions {
  pm: QuestionsData | null;
  ux: QuestionsData | null;
  engineer: QuestionsData | null;
}

// Icons
const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IssuesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
  </svg>
);

const BoardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 4.5V8L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="7.5" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 7.5V5C5 3.34315 6.34315 2 8 2C9.65685 2 11 3.34315 11 5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ProjectsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const DocumentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 1H4C3.44772 1 3 1.44772 3 2V14C3 14.5523 3.44772 15 4 15H12C12.5523 15 13 14.5523 13 14V5L9 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 1V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const QuestionsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 6C6 5.17157 6.67157 4.5 7.5 4.5H8C8.82843 4.5 9.5 5.17157 9.5 6C9.5 6.82843 8.82843 7.5 8 7.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="10.5" r="0.75" fill="currentColor"/>
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

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"></path>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
  </svg>
);

const LinearIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 90c-22.1 0-40-17.9-40-40s17.9-40 40-40 40 17.9 40 40-17.9 40-40 40z" fill="currentColor"/>
    <path d="M68.5 35.5L44.5 59.5l-13-13" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Document type definitions with emojis and descriptions
const documentTypes = [
  { id: 'request', label: 'Request', shortLabel: 'Request', emoji: '💬', description: 'Your original project request and requirements', agent: null },
  { id: 'prd', label: 'PRD', shortLabel: 'PRD', emoji: '📋', description: 'Product Requirements Document with user stories and features', agent: 'Product Manager' },
  { id: 'acceptance-criteria', label: 'Acceptance Criteria', shortLabel: 'Criteria', emoji: '✅', description: 'Testable criteria that define when features are complete', agent: 'Product Manager' },
  { id: 'design-brief', label: 'Design Brief', shortLabel: 'Design', emoji: '🎨', description: 'UX guidelines, user flows, and interaction patterns', agent: 'Designer' },
  { id: 'screens', label: 'Screens', shortLabel: 'Screens', emoji: '🖼️', description: 'Visual wireframes and screen layouts for the UI', agent: 'Designer' },
  { id: 'tech', label: 'Technical Spec', shortLabel: 'Tech Spec', emoji: '⚙️', description: 'Architecture decisions, APIs, and implementation details', agent: 'Engineer' },
  { id: 'tech-choices', label: 'Technology Choices', shortLabel: 'Choices', emoji: '🔧', description: 'Framework and library selections with rationale', agent: 'Engineer' },
];

export function ProjectDetail() {
  const { id, section, docType } = useParams<{ id: string; section?: string; docType?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const aiToolName = useAIToolName();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null);
  const [questions, setQuestions] = useState<AllQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [breakingDown, setBreakingDown] = useState(false);
  const [breakdownPrompt, setBreakdownPrompt] = useState<string>('');
  
  // Determine active view from URL
  const activeSection = section || 'docs';
  const activeDocType = docType || 'request';
  
  // Configuration modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [projectSettings, setProjectSettings] = useState({
    question_depth: 'standard' as 'light' | 'standard' | 'thorough',
    document_length: 'standard' as 'brief' | 'standard' | 'comprehensive'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Project icon state
  const [projectIcon, setProjectIcon] = useState<ProjectIcon | null>(null);
  
  // Issues board state
  const [issuesViewMode, setIssuesViewMode] = useState<'board' | 'list'>('board');
  const [fullIssues, setFullIssues] = useState<FullIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<FullIssue | null>(null);

  // Drag and drop state
  const [draggedIssue, setDraggedIssue] = useState<FullIssue | null>(null);
  const [draggedFromColumn, setDraggedFromColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Use context for ShipModal - modal is rendered at App level
  const { openShipModal } = useShipModal();

  // Linear sync status
  const [linearSyncStatus, setLinearSyncStatus] = useState<{
    synced: boolean;
    linearUrl?: string;
    syncedAt?: string;
  } | null>(null);
  const [syncingToLinear, setSyncingToLinear] = useState(false);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const fetchProject = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Project not found');
      const data = await res.json();
      setProject(data);
      setError(null);
      
      // Also fetch the project status to check approval state
      try {
        const statusRes = await fetch(`/api/specification/status/${id}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setProjectStatus(statusData);
        }
      } catch (err) {
        logger.error('Failed to fetch project status:', err);
      }
      
      // Also fetch questions
      try {
        const questionsRes = await fetch(`/api/projects/${id}/questions`);
        if (questionsRes.ok) {
          const questionsData = await questionsRes.json();
          setQuestions(questionsData);
        }
      } catch (err) {
        logger.error('Failed to fetch questions:', err);
      }
      
      // Also fetch project icon
      try {
        const iconRes = await fetch(`/api/projects/${id}/icon`);
        if (iconRes.ok) {
          const iconData = await iconRes.json();
          setProjectIcon(iconData.icon || null);
        }
      } catch (err) {
        logger.error('Failed to fetch project icon:', err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };
  
  // Save project icon
  const handleIconChange = async (newIcon: ProjectIcon | null) => {
    if (!id) return;

    try {
      const response = await fetch(`/api/projects/${id}/icon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon: newIcon })
      });

      if (response.ok) {
        setProjectIcon(newIcon);
      }
    } catch (err) {
      logger.error('Failed to save project icon:', err);
    }
  };

  // Fetch Linear sync status (with verification against Linear API)
  const fetchLinearSyncStatus = async () => {
    if (!id) return;
    try {
      // Use verify=true to check if the Linear project still exists
      const response = await fetch(`/api/projects/${id}/linear-status?verify=true`);
      if (response.ok) {
        const status = await response.json();
        setLinearSyncStatus({
          synced: status.synced,
          linearUrl: status.syncState?.linearProjectUrl,
          syncedAt: status.syncState?.syncedAt
        });
      }
    } catch (err) {
      logger.error('Failed to fetch Linear sync status:', err);
    }
  };

  // Sync project to Linear
  const syncToLinear = async () => {
    if (!id) return;
    setSyncingToLinear(true);
    try {
      const response = await fetch(`/api/projects/${id}/sync-to-linear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const result = await response.json();
        setLinearSyncStatus({
          synced: true,
          linearUrl: result.linearProjectUrl,
          syncedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      logger.error('Failed to sync to Linear:', err);
    } finally {
      setSyncingToLinear(false);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchLinearSyncStatus();
  }, [id]);

  // Fetch full issues for Kanban board
  const fetchFullIssues = async () => {
    if (!id) return;
    
    try {
      setLoadingIssues(true);
      const numericId = id?.split('-')[0] || id;
      const response = await fetch(`/api/issues`);
      if (!response.ok) throw new Error('Failed to fetch issues');
      
      const allIssues: FullIssue[] = await response.json();
      // Filter to only this project's issues
      const projectIssues = allIssues.filter(issue => issue.projectId === numericId);
      setFullIssues(projectIssues);
    } catch (err) {
      logger.error('Failed to fetch full issues:', err);
    } finally {
      setLoadingIssues(false);
    }
  };

  // Fetch full issues when viewing issues section
  const issuesCount = (project?.summary?.issues || project?.summary?.issues_list)?.length ?? 0;
  useEffect(() => {
    if (activeSection === 'issues' && issuesCount > 0) {
      fetchFullIssues();
    }
  }, [activeSection, id, issuesCount]);

  // Real-time updates
  useRealtimeUpdates(() => {
    logger.debug('Refreshing project due to file change...');
    fetchProject();
    
    // Also refresh issues if on issues section
    if (activeSection === 'issues') {
      fetchFullIssues();
    }
    
    // Check if breakdown completed
    if (breakingDown) {
      checkBreakdownStatus();
    }
  });
  
  // Poll for breakdown completion
  useEffect(() => {
    if (breakingDown) {
      const interval = setInterval(() => {
        checkBreakdownStatus();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [breakingDown]);
  
  const checkBreakdownStatus = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/specification/breakdown-status/${id}`);
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.isComplete && data.issueCount > 0) {
        setBreakingDown(false);
        fetchProject();
      }
    } catch (err) {
      logger.error('Error checking breakdown status:', err);
    }
  };
  
  const handleStartSpec = async () => {
    if (!id) return;
    
    try {
      setSavingSettings(true);
      
      const response = await fetch(`/api/projects/${id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: projectSettings })
      });
      
      if (!response.ok) throw new Error('Failed to save settings');
      
      setShowConfigModal(false);
      navigate(`/specification/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };
  
  const triggerIssueCreation = async () => {
    if (!id) return;
    
    try {
      setBreakingDown(true);
      setError(null);
      
      const response = await fetch(`/api/specification/breakdown/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.prompt) {
          setBreakdownPrompt(data.prompt);
        }
      } else {
        setError(data.error || 'Failed to create issues');
        setBreakingDown(false);
      }
    } catch (err) {
      setError('Failed to create issues');
      setBreakingDown(false);
      logger.error(err);
    }
  };
  
  const copyBreakdownPrompt = async () => {
    if (!breakdownPrompt) return;
    
    try {
      await navigator.clipboard.writeText(breakdownPrompt);
    } catch (err) {
      logger.error('Failed to copy prompt:', err);
    }
  };
  
  const handleDeleteProject = async () => {
    if (!id) return;
    
    try {
      setDeleting(true);
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }
      
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Helper functions
  const getDocumentStatus = (docId: string): 'complete' | 'pending' => {
    if (!project) return 'pending';
    
    switch (docId) {
      case 'request': return project.request ? 'complete' : 'pending';
      case 'prd': return project.prd ? 'complete' : 'pending';
      case 'acceptance-criteria': return project.acceptanceCriteria ? 'complete' : 'pending';
      case 'design-brief': return project.design ? 'complete' : 'pending';
      case 'screens': return project.screens ? 'complete' : 'pending';
      case 'tech': return project.tech ? 'complete' : 'pending';
      case 'tech-choices': return project.techChoices ? 'complete' : 'pending';
      default: return 'pending';
    }
  };

  const getCompletedDocCount = () => {
    if (!project) return 0;
    return documentTypes.filter(doc => getDocumentStatus(doc.id) === 'complete').length;
  };

  const getIssues = (): Issue[] => {
    const issuesList = project?.summary?.issues || project?.summary?.issues_list;
    if (!issuesList) return [];
    return issuesList.map((issue: any, index: number) => ({
      id: issue.id || issue.issue_id || `ENG-${String(index + 1).padStart(3, '0')}`,
      title: issue.title || issue.name || 'Untitled Issue',
      status: issue.status || 'pending',
      complexity: issue.complexity
    }));
  };

  const hasRequest = !!project?.request;
  const hasPRD = !!project?.prd;
  const hasAcceptanceCriteria = !!project?.acceptanceCriteria;
  const hasDesign = !!project?.design;
  const hasScreens = !!project?.screens;
  const hasTech = !!project?.tech;
  const hasTechChoices = !!project?.techChoices;
  const issues = getIssues();
  const hasIssues = issues.length > 0;
  
  // Kanban board helpers
  const getIssueDependenciesMet = (issue: FullIssue): boolean => {
    if (issue.dependencies.length === 0) return true;
    return issue.dependencies.every(depId => {
      const depIssue = fullIssues.find(i => i.issueId === depId);
      return depIssue?.status === 'approved';
    });
  };

  const categorizedIssues = {
    blocked: fullIssues.filter(i => i.status === 'pending' && !getIssueDependenciesMet(i)),
    ready: fullIssues.filter(i => i.status === 'pending' && getIssueDependenciesMet(i)),
    inReview: fullIssues.filter(i => i.status === 'in-review'),
    approved: fullIssues.filter(i => i.status === 'approved')
  };

  const taskCounts: TaskCounts = {
    blocked: categorizedIssues.blocked.length,
    ready: categorizedIssues.ready.length,
    inReview: categorizedIssues.inReview.length,
    approved: categorizedIssues.approved.length,
    total: fullIssues.length
  };

  const handleShip = (issue: FullIssue, e: React.MouseEvent) => {
    e.stopPropagation();
    openShipModal({
      issueId: issue.issueId,
      title: issue.title,
      projectId: issue.projectId,
      projectName: project?.name || project?.id || ''
    });
    setSelectedIssue(null); // Close issue detail modal if open
  };

  const handleApprove = async (issue: FullIssue) => {
    try {
      const response = await fetch(`/api/issues/${issue.projectId}/${issue.issueId}/approve`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to approve');

      await fetchFullIssues();
      setSelectedIssue(null);
    } catch (err) {
      logger.error('Failed to approve:', err);
    }
  };

  const handleStatusChange = async (issue: FullIssue, newStatus: string) => {
    try {
      const response = await fetch(`/api/issues/${issue.projectId}/${issue.issueId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      await fetchFullIssues();
      setSelectedIssue(null);
    } catch (err) {
      logger.error('Failed to update status:', err);
    }
  };

  const hasQuestions = !!(questions?.pm || questions?.ux || questions?.engineer);
  const getQuestionsCount = () => {
    let count = 0;
    if (questions?.pm?.questions) count += questions.pm.questions.length;
    if (questions?.ux?.questions) count += questions.ux.questions.length;
    if (questions?.engineer?.questions) count += questions.engineer.questions.length;
    return count;
  };

  // Spec status
  const allPhasesApproved = projectStatus?.isComplete ?? false;
  const specHasStarted = projectStatus?.currentPhase && projectStatus.currentPhase !== 'pm-questions-generate';
  const isNotSpecced = !hasPRD && !hasDesign && !hasTech && !specHasStarted;
  const isPartiallySpecced = ((hasPRD || hasDesign || hasTech) || specHasStarted) && !allPhasesApproved;
  const isFullySpecced = hasPRD && hasDesign && hasTech && allPhasesApproved;

  // Navigation helpers
  const navigateToDoc = (docId: string) => {
    navigate(`/project/${id}/docs/${docId}`);
  };

  const navigateToIssues = () => {
    navigate(`/project/${id}/issues`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="linear-spinner"></div>
            <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Loading project...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <Link 
              to="/" 
              className="inline-flex items-center gap-1.5 text-[13px] font-medium mb-4 no-underline"
              style={{ color: 'hsl(0 0% 46%)' }}
            >
              <BackIcon /> Back to Projects
            </Link>
            <div className="rounded-lg p-4" style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}>
              <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>
                {error || 'Project not found'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Icon for issue breakdown
  const IssueBreakdownIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 3V8C13 8.55228 13.4477 9 14 9H19" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );

  // Copy button with feedback for breakdown prompt
  const CopyBreakdownPromptButton = ({ prompt }: { prompt: string }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        logger.error('Failed to copy prompt:', err);
      }
    };
    
    return (
      <button
        onClick={handleCopy}
        className="px-4 py-2 rounded-md text-[12px] font-medium transition-all"
        style={{ 
          backgroundColor: copied ? 'hsl(142 76% 36%)' : 'transparent', 
          color: copied ? 'white' : 'hsl(0 0% 32%)', 
          border: copied ? '1px solid hsl(142 76% 36%)' : '1px solid hsl(0 0% 90%)' 
        }}
      >
        {copied ? (
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Copied to Clipboard
          </span>
        ) : (
          'Copy Prompt to Clipboard'
        )}
      </button>
    );
  };

  // Breakdown overlay - now matches light theme AI working style
  if (breakingDown) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        {/* Sidebar */}
        <aside 
          className="w-[220px] h-screen flex flex-col border-r sticky top-0 flex-shrink-0"
          style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
        >
          <div className="px-4 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
            <Link to="/" className="flex items-center gap-2.5 no-underline">
              <img src={specwrightLogo} alt="SpecWright" className="w-7 h-7" />
              <span className="font-semibold text-[18px]" style={{ color: 'hsl(0 0% 9%)' }}>SpecWright</span>
            </Link>
          </div>
          <nav className="flex-1 p-2">
            <ul className="space-y-0.5">
              <li>
                <Link
                  to="/"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                  style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
                >
                  <ProjectsIcon />
                  <span className="text-[13px] font-medium">Projects</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/issues"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                  style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
                >
                  <IssuesIcon />
                  <span className="text-[13px] font-medium">Issues</span>
                </Link>
              </li>
            </ul>
          </nav>
          {/* Cost Widget and Settings at bottom */}
          <div className="mt-auto">
            {id && (
              <div className="px-3 py-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                <CostWidget projectId={id} />
              </div>
            )}
            <div className="p-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
              <Link
                to="/settings"
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
              >
                <SettingsIcon />
                <span className="text-[13px] font-medium">Settings</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
            <div className="flex items-center gap-2">
              <Link to="/" className="text-[13px] no-underline" style={{ color: 'hsl(0 0% 46%)' }}>Projects</Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{project?.id || id}</span>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Generate Issues</span>
            </div>
          </header>
          
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {/* Working card with animation */}
              <div className="rounded-lg p-8 text-center relative overflow-hidden" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                {/* Animated background gradient */}
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'radial-gradient(circle at 50% 0%, hsl(235 69% 61% / 0.15) 0%, transparent 50%)',
                    animation: 'pulse 3s ease-in-out infinite'
                  }}
                />
                
                {/* Agent icon with animated rings */}
                <div className="relative mx-auto mb-6" style={{ width: '100px', height: '100px' }}>
                  {/* Outer pulsing ring */}
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{ 
                      border: '2px solid hsl(235 69% 61% / 0.2)',
                      animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                    }}
                  />
                  {/* Middle ring */}
                  <div 
                    className="absolute rounded-full"
                    style={{ 
                      inset: '10px',
                      border: '2px solid hsl(235 69% 61% / 0.3)',
                      animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s'
                    }}
                  />
                  {/* Inner icon container */}
                  <div 
                    className="absolute rounded-full flex items-center justify-center"
                    style={{ 
                      inset: '20px',
                      backgroundColor: 'hsl(235 69% 61%)',
                      color: 'white',
                      boxShadow: '0 4px 20px hsl(235 69% 61% / 0.4)'
                    }}
                  >
                    <IssueBreakdownIcon />
                  </div>
                </div>
                
                <h2 className="text-[18px] font-semibold mb-2 relative" style={{ color: 'hsl(0 0% 9%)' }}>
                  Generating issues...
                </h2>
                <p className="text-[14px] font-medium mb-1 relative" style={{ color: 'hsl(235 69% 61%)' }}>
                  Generating Issues
                </p>
                <p className="text-[13px] mb-4 relative" style={{ color: 'hsl(0 0% 46%)' }}>
                  Analyzing the specification and creating implementation tasks
                </p>
                
                {/* Animated progress bar */}
                <div 
                  className="w-48 h-1 mx-auto rounded-full mb-4 overflow-hidden relative"
                  style={{ backgroundColor: 'hsl(0 0% 92%)' }}
                >
                  <div 
                    className="h-full rounded-full absolute"
                    style={{ 
                      width: '30%',
                      backgroundColor: 'hsl(235 69% 61%)',
                      animation: 'shimmer 1.5s ease-in-out infinite'
                    }}
                  />
                </div>
                
                {/* Document being generated */}
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full relative"
                  style={{ backgroundColor: 'hsl(235 69% 97%)', border: '1px solid hsl(235 69% 90%)' }}
                >
                  <div className="linear-spinner" style={{ width: '14px', height: '14px' }}></div>
                  <span className="text-[12px] font-mono font-medium" style={{ color: 'hsl(235 69% 50%)' }}>
                    issues.json
                  </span>
                </div>
                
                {/* CSS animations */}
                <style>{`
                  @keyframes ping {
                    0% { transform: scale(1); opacity: 1; }
                    75%, 100% { transform: scale(1.3); opacity: 0; }
                  }
                  @keyframes shimmer {
                    0% { left: -30%; }
                    100% { left: 100%; }
                  }
                  @keyframes pulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.5; }
                  }
                `}</style>
                
                <p className="text-[11px] mt-4 relative" style={{ color: 'hsl(0 0% 60%)' }}>
                  This typically takes 1-2 minutes. The page will update automatically.
                </p>
                
                {breakdownPrompt && (
                  <div className="mt-6 pt-6 relative" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                    <p className="text-[12px] mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                      If {aiToolName} didn't open correctly:
                    </p>
                    <CopyBreakdownPromptButton prompt={breakdownPrompt} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main content renderer
  const renderMainContent = () => {
    if (activeSection === 'issues') {
      // Issues view
      if (!hasIssues) {
        return (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: 'hsl(0 0% 96%)' }}
              >
                <IssuesIcon />
              </div>
              <h2 className="text-[17px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                No Issues Yet
              </h2>
              <p className="text-[13px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
                {isFullySpecced 
                  ? "Generate implementation issues from your completed specification."
                  : "Complete the specification process first, then generate implementation issues."}
              </p>
              
              {isFullySpecced && (
                <Button onClick={triggerIssueCreation}>
                  <PlusIcon />
                  <span>Generate Issues</span>
                </Button>
              )}
              
              {isPartiallySpecced && (
                <Button onClick={() => navigate(`/specification/${id}`)} variant="warning">
                  Continue Specification
                </Button>
              )}
              
              {isNotSpecced && (
                <Button onClick={() => setShowConfigModal(true)}>
                  ✨ Start Specification
                </Button>
              )}
            </div>
          </div>
        );
      }

      // Drag and drop logic
      const columnToStatus: Record<string, string> = {
        ready: 'pending',
        inReview: 'in-review',
        approved: 'approved'
      };
      const isValidDrop = (targetColumn: string): boolean => {
        if (!draggedFromColumn || draggedFromColumn === targetColumn) return false;
        if (targetColumn === 'blocked') return false;
        return true;
      };
      const handleDragStart = (e: React.DragEvent, issue: FullIssue, fromColumn: string) => {
        setDraggedIssue(issue);
        setDraggedFromColumn(fromColumn);
        e.dataTransfer.effectAllowed = 'move';
        if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.5';
      };
      const handleDragEnd = (e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1';
        setDraggedIssue(null);
        setDraggedFromColumn(null);
        setDragOverColumn(null);
      };
      const handleDragOver = (e: React.DragEvent, column: string) => {
        if (isValidDrop(column)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
      };
      const handleDragEnter = (e: React.DragEvent, column: string) => {
        e.preventDefault();
        if (isValidDrop(column)) setDragOverColumn(column);
      };
      const handleDragLeave = (e: React.DragEvent, column: string) => {
        const relatedTarget = e.relatedTarget as Node | null;
        if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
        if (dragOverColumn === column) setDragOverColumn(null);
      };
      const handleDrop = (e: React.DragEvent, targetColumn: string) => {
        e.preventDefault();
        setDragOverColumn(null);
        if (draggedIssue && isValidDrop(targetColumn)) {
          const newStatus = columnToStatus[targetColumn];
          if (newStatus) handleStatusChange(draggedIssue, newStatus);
        }
        setDraggedIssue(null);
        setDraggedFromColumn(null);
      };
      const isDraggable = (columnType: string): boolean => {
        return columnType !== 'blocked';
      };

      // Issue card renderer
      const renderIssueCard = (issue: FullIssue, columnType: keyof typeof boardStatusConfig) => {
        const isBlocked = columnType === 'blocked';
        const isReady = columnType === 'ready';
        const canDrag = isDraggable(columnType);

        return (
          <div
            key={issue.issueId}
            className="rounded-lg p-4 cursor-pointer transition-all duration-150"
            style={{
              backgroundColor: 'white',
              border: '1px solid hsl(0 0% 92%)',
            }}
            draggable={canDrag}
            onDragStart={canDrag ? (e) => handleDragStart(e, issue, columnType) : undefined}
            onDragEnd={canDrag ? handleDragEnd : undefined}
            onClick={() => setSelectedIssue(issue)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(0 0% 99%)';
              e.currentTarget.style.borderColor = 'hsl(0 0% 85%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
            }}
          >
            {/* Title */}
            <h3 className="text-[13px] font-semibold mb-2 line-clamp-2" style={{ color: 'hsl(0 0% 9%)' }}>
              {issue.title}
            </h3>
            
            {/* Blocked indicator */}
            {isBlocked && issue.dependencies.length > 0 && (
              <div 
                className="text-[11px] px-2 py-1.5 rounded mb-3 flex items-center gap-1.5"
                style={{ 
                  backgroundColor: 'hsl(25 95% 94%)',
                  color: 'hsl(25 95% 40%)'
                }}
              >
                <LockIcon />
                <span>Blocked by {issue.dependencies.length} {issue.dependencies.length === 1 ? 'issue' : 'issues'}</span>
              </div>
            )}
            
            {/* Footer */}
            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid hsl(0 0% 94%)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>
                {issue.issueId}
              </span>
            </div>
            
            {/* Ship button */}
            {isReady && (
              <button
                className="w-full mt-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: 'hsl(235 69% 61%)',
                  color: 'white',
                }}
                onClick={(e) => handleShip(issue, e)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)';
                }}
              >
                Ship
              </button>
            )}
          </div>
        );
      };

      // Has issues - show Kanban board
      return (
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[17px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                Implementation Issues
              </h2>
              <span 
                className="text-[12px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}
              >
                {taskCounts.total}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div 
                className="flex rounded-md overflow-hidden"
                style={{ border: '1px solid hsl(0 0% 90%)' }}
              >
                <button
                  onClick={() => setIssuesViewMode('board')}
                  className="px-2.5 py-1.5 flex items-center gap-1.5 text-[13px] transition-colors"
                  style={{
                    backgroundColor: issuesViewMode === 'board' ? 'hsl(0 0% 96%)' : 'transparent',
                    color: issuesViewMode === 'board' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                  }}
                >
                  <BoardIcon />
                  Board
                </button>
                <button
                  onClick={() => setIssuesViewMode('list')}
                  className="px-2.5 py-1.5 flex items-center gap-1.5 text-[13px] transition-colors"
                  style={{
                    backgroundColor: issuesViewMode === 'list' ? 'hsl(0 0% 96%)' : 'transparent',
                    color: issuesViewMode === 'list' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                    borderLeft: '1px solid hsl(0 0% 90%)'
                  }}
                >
                  <ListIcon />
                  List
                </button>
              </div>
              
              {/* Open Board in New Tab */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const numericId = id?.split('-')[0] || id;
                  window.open(`/issues?project=${numericId}`, '_blank');
                }}
              >
                Open Board →
              </Button>
            </div>
          </div>
          
          {/* Loading state */}
          {loadingIssues && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="linear-spinner"></div>
                <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                  Loading issues...
                </span>
              </div>
            </div>
          )}

          {/* Board View */}
          {!loadingIssues && issuesViewMode === 'board' && (
            <div className="grid grid-cols-4 gap-4">
              {(Object.entries({
                blocked: { label: 'Blocked', issues: categorizedIssues.blocked, emptyText: 'No blocked issues' },
                ready: { label: 'Ready', issues: categorizedIssues.ready, emptyText: 'No issues ready' },
                inReview: { label: 'In Review', issues: categorizedIssues.inReview, emptyText: 'No issues in review' },
                approved: { label: 'Completed', issues: categorizedIssues.approved, emptyText: 'No completed issues' },
              }) as [keyof typeof boardStatusConfig, { label: string; issues: FullIssue[]; emptyText: string }][]).map(([columnKey, { label, issues: columnIssues, emptyText }]) => {
                const config = boardStatusConfig[columnKey];
                const isDropTarget = draggedIssue && isValidDrop(columnKey);
                const isDraggedOver = dragOverColumn === columnKey;

                return (
                  <div
                    key={columnKey}
                    className="min-h-[200px] rounded-lg p-2 transition-all duration-200"
                    style={{
                      backgroundColor: isDraggedOver ? config.bgColor : 'transparent',
                      border: isDropTarget ? `2px dashed ${config.color}` : '2px dashed transparent',
                      opacity: draggedIssue && !isDropTarget && columnKey !== draggedFromColumn ? 0.5 : 1,
                    }}
                    onDragOver={(e) => handleDragOver(e, columnKey)}
                    onDragEnter={(e) => handleDragEnter(e, columnKey)}
                    onDragLeave={(e) => handleDragLeave(e, columnKey)}
                    onDrop={(e) => handleDrop(e, columnKey)}
                  >
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                      <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>{label}</span>
                      <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}>
                        {columnIssues.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {columnIssues.length > 0 ? (
                        columnIssues.map(issue => renderIssueCard(issue, columnKey))
                      ) : (
                        <div
                          className="rounded-lg p-4 text-center"
                          style={{
                            backgroundColor: isDraggedOver ? 'rgba(255,255,255,0.7)' : 'hsl(0 0% 100%)',
                            border: '1px dashed hsl(0 0% 88%)'
                          }}
                        >
                          <p className="text-[12px]" style={{ color: 'hsl(0 0% 60%)' }}>
                            {isDraggedOver ? 'Drop here' : emptyText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {!loadingIssues && issuesViewMode === 'list' && (
            <div className="space-y-2">
              {fullIssues.map(issue => {
                const isBlocked = issue.status === 'pending' && !getIssueDependenciesMet(issue);
                const isReady = issue.status === 'pending' && getIssueDependenciesMet(issue);
                const status = issue.status === 'approved' ? 'approved' : issue.status === 'in-review' ? 'inReview' : isBlocked ? 'blocked' : 'ready';
                const config = boardStatusConfig[status as keyof typeof boardStatusConfig];
                
                return (
                  <div
                    key={issue.issueId}
                    className="flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid hsl(0 0% 92%)',
                    }}
                    onClick={() => setSelectedIssue(issue)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 99%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }} />
                    <span className="font-mono text-[11px] flex-shrink-0" style={{ color: 'hsl(0 0% 46%)' }}>{issue.issueId}</span>
                    <span className="text-[13px] flex-1 truncate" style={{ color: 'hsl(0 0% 9%)' }}>{issue.title}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.bgColor, color: config.color }}>
                      {config.label}
                    </span>
                    {isReady && (
                      <button
                        className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors flex-shrink-0"
                        style={{
                          backgroundColor: 'hsl(235 69% 61%)',
                          color: 'white',
                        }}
                        onClick={(e) => handleShip(issue, e)}
                      >
                        Ship
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Issue Detail Modal */}
          {selectedIssue && (
            <IssueModal
              issue={selectedIssue}
              onClose={() => setSelectedIssue(null)}
              onShip={handleShip}
              onApprove={handleApprove}
              onStatusChange={handleStatusChange}
              canShip={getIssueDependenciesMet(selectedIssue)}
              isBlocked={!getIssueDependenciesMet(selectedIssue)}
              statusConfig={boardStatusConfig}
            />
          )}
        </div>
      );
    }

    // Questions view
    if (activeSection === 'questions') {
      // Determine which agent's questions to show
      const agentType = activeDocType as 'pm' | 'ux' | 'engineer';
      const agentConfig = {
        pm: { name: 'Product Manager', emoji: '📋', color: 'hsl(235 69% 61%)' },
        ux: { name: 'Designer', emoji: '🎨', color: 'hsl(328 73% 52%)' },
        engineer: { name: 'Engineer', emoji: '⚙️', color: 'hsl(142 76% 36%)' }
      };
      const config = agentConfig[agentType] || agentConfig.pm;
      const agentQuestions = questions?.[agentType];

      // Empty state for this specific agent
      if (!agentQuestions?.questions?.length) {
        return (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl"
                style={{ backgroundColor: 'hsl(0 0% 96%)' }}
              >
                {config.emoji}
              </div>
              <h2 className="text-[17px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                No {config.name} Questions Yet
              </h2>
              <p className="text-[13px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
                Questions from the {config.name} will appear here once their phase of the specification process is complete.
              </p>
              
              {isNotSpecced && (
                <Button onClick={() => setShowConfigModal(true)}>
                  ✨ Start Specification
                </Button>
              )}
              
              {isPartiallySpecced && (
                <Button onClick={() => navigate(`/specification/${id}`)} variant="warning">
                  Continue Specification
                </Button>
              )}
            </div>
          </div>
        );
      }

      // Render questions for this agent
      return (
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{config.emoji}</span>
              <h2 className="text-[17px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                {config.name} Questions
              </h2>
              <span 
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${config.color}15`, color: config.color }}
              >
                {agentQuestions.questions.length}
              </span>
            </div>
            <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
              Questions and decisions from the {config.name}
            </p>
          </div>
          
          <div className="space-y-4">
            {agentQuestions.questions.map((q, index) => {
              // Get the answer - "answer" is used by QuestionForm, "decision" is used in AI-generated data
              const selectedAnswer = q.answer || q.decision || '';
              
              // Determine if this is a custom answer (not in the predefined options)
              const isCustomAnswer = q.options && q.options.length > 0 && selectedAnswer && !q.options.includes(selectedAnswer);
              
              return (
                <div
                  key={q.id || index}
                  className="rounded-lg overflow-hidden"
                  style={{ 
                    backgroundColor: 'hsl(0 0% 100%)', 
                    border: '1px solid hsl(0 0% 92%)' 
                  }}
                >
                  <div className="p-4">
                    {/* Question */}
                    <div className="flex items-start gap-3 mb-4">
                      <span 
                        className="text-[11px] font-mono px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                        style={{ backgroundColor: `${config.color}15`, color: config.color }}
                      >
                        Q{index + 1}
                      </span>
                      <p className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                        {q.question}
                      </p>
                    </div>
                    
                    {/* Options with highlighted selection */}
                    {q.options && q.options.length > 0 ? (
                      <div className="ml-8 space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = opt === selectedAnswer;
                          return (
                            <div 
                              key={optIdx}
                              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
                              style={{ 
                                backgroundColor: isSelected ? 'hsl(142 76% 97%)' : 'transparent',
                                border: isSelected ? '1px solid hsl(142 76% 85%)' : '1px solid hsl(0 0% 92%)'
                              }}
                            >
                              <div 
                                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ 
                                  backgroundColor: isSelected ? 'hsl(142 76% 36%)' : 'transparent',
                                  border: isSelected ? 'none' : '1.5px solid hsl(0 0% 75%)'
                                }}
                              >
                                {isSelected && (
                                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <span 
                                className="text-[13px]"
                                style={{ 
                                  color: isSelected ? 'hsl(142 76% 25%)' : 'hsl(0 0% 32%)',
                                  fontWeight: isSelected ? 500 : 400
                                }}
                              >
                                {opt}
                              </span>
                            </div>
                          );
                        })}
                        
                        {/* Custom answer if the selected answer isn't in options */}
                        {isCustomAnswer && (
                          <div 
                            className="flex items-center gap-3 px-3 py-2 rounded-md"
                            style={{ 
                              backgroundColor: 'hsl(142 76% 97%)',
                              border: '1px solid hsl(142 76% 85%)'
                            }}
                          >
                            <div 
                              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: 'hsl(142 76% 36%)' }}
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            <span 
                              className="text-[13px] font-medium"
                              style={{ color: 'hsl(142 76% 25%)' }}
                            >
                              {selectedAnswer}
                            </span>
                            <span 
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: 'hsl(142 76% 90%)', color: 'hsl(142 76% 30%)' }}
                            >
                              Custom
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      // No options - just show the answer
                      <div 
                        className="ml-8 px-3 py-2 rounded-md"
                        style={{ 
                          backgroundColor: 'hsl(142 76% 97%)',
                          border: '1px solid hsl(142 76% 85%)'
                        }}
                      >
                        <p className="text-[13px] font-medium" style={{ color: 'hsl(142 76% 25%)' }}>
                          {selectedAnswer}
                        </p>
                      </div>
                    )}
                    
                    {/* Rationale - shown smaller below */}
                    {q.rationale && (
                      <div className="ml-8 mt-3 pt-3" style={{ borderTop: '1px solid hsl(0 0% 94%)' }}>
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                          <span className="font-medium">Rationale:</span> {q.rationale}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Document view
    const currentDoc = documentTypes.find(d => d.id === activeDocType);
    const docStatus = getDocumentStatus(activeDocType);

    if (docStatus === 'pending') {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div 
              className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center text-4xl"
              style={{ backgroundColor: 'hsl(235 69% 97%)', border: '1px solid hsl(235 69% 90%)' }}
            >
              {currentDoc?.emoji || '📄'}
            </div>
            <h2 className="text-[18px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
              {currentDoc?.label} Not Generated
            </h2>
            <p className="text-[13px] mb-2" style={{ color: 'hsl(0 0% 32%)' }}>
              {currentDoc?.description || 'This document will be created during the specification process.'}
            </p>
            {currentDoc?.agent && (
              <p className="text-[12px] mb-6" style={{ color: 'hsl(0 0% 56%)' }}>
                Generated by the {currentDoc.agent}
              </p>
            )}
            {!currentDoc?.agent && (
              <p className="text-[12px] mb-6" style={{ color: 'hsl(0 0% 56%)' }}>
                Created when you start the project
              </p>
            )}
            
            {isNotSpecced && (
              <Button onClick={() => setShowConfigModal(true)}>
                ✨ Start Specification
              </Button>
            )}
            
            {isPartiallySpecced && (
              <Button onClick={() => navigate(`/specification/${id}`)} variant="warning">
                Continue Specification
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Render actual document content
    return (
      <div className="p-6">
        <div 
          className="rounded-lg"
          style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
        >
          <div className="p-6">
            {activeDocType === 'request' && project.request && (
              <MarkdownViewer content={project.request} />
            )}
            
            {activeDocType === 'prd' && project.prd && (
              <MarkdownViewer content={project.prd} />
            )}
            
            {activeDocType === 'acceptance-criteria' && project.acceptanceCriteria && (
              <AcceptanceCriteriaEditor
                content={project.acceptanceCriteria}
                projectId={id || ''}
                onSave={() => fetchProject()}
                readOnly={true}
              />
            )}
            
            {activeDocType === 'design-brief' && project.design && (
              <MarkdownViewer content={project.design} />
            )}
            
            {activeDocType === 'screens' && project.screens && (
              <ScreensRenderer
                content={project.screens}
                projectId={id || ''}
              />
            )}
            
            {activeDocType === 'tech' && project.tech && (
              <MarkdownViewer content={project.tech} />
            )}
            
            {activeDocType === 'tech-choices' && project.techChoices && (
              <TechnologyChoicesViewer content={project.techChoices} />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      {/* Contextual Sidebar */}
      <aside 
        className="w-[260px] h-screen flex flex-col border-r sticky top-0 flex-shrink-0"
        style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
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

        {/* Back to Projects */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <Link 
            to="/" 
            className="flex items-center gap-2 text-[13px] font-medium no-underline transition-colors"
            style={{ color: 'hsl(0 0% 46%)' }}
          >
            <BackIcon />
            <span>Projects</span>
          </Link>
        </div>

        {/* Project Title */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <div className="flex items-center gap-2">
            <IconPicker
              value={projectIcon}
              onChange={handleIconChange}
              trigger={
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-300"
                  style={{
                    backgroundColor: projectIcon?.type === 'icon'
                      ? projectIcon.color || 'hsl(235 69% 61%)'
                      : projectIcon?.type === 'emoji'
                        ? 'hsl(0 0% 96%)'
                        : 'hsl(235 69% 61%)',
                    color: 'white'
                  }}
                >
                  {projectIcon?.type === 'emoji' ? (
                    <span className="text-[18px]">{projectIcon.value}</span>
                  ) : projectIcon?.type === 'icon' ? (
                    <IconSVG name={projectIcon.value} color="white" />
                  ) : (
                    <span className="text-[14px] font-semibold">{id?.charAt(0).toUpperCase() || 'P'}</span>
                  )}
                </div>
              }
            />
            <div className="flex-1 min-w-0">
              <h1
                className="text-[14px] font-semibold truncate"
                style={{ color: 'hsl(0 0% 9%)' }}
                title={id}
              >
                {id}
              </h1>
            </div>
          </div>

          {/* Linear Sync Status - only show if already synced, or if spec is complete and has issues */}
          {linearSyncStatus !== null && (linearSyncStatus.synced || (isFullySpecced && hasIssues)) && (
            <div className="mt-3 flex items-center gap-2">
              {linearSyncStatus.synced ? (
                <a
                  href={linearSyncStatus.linearUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors no-underline"
                  style={{
                    backgroundColor: 'hsl(235 69% 97%)',
                    color: '#5E6AD2',
                    border: '1px solid hsl(235 69% 90%)'
                  }}
                  title={`Synced ${linearSyncStatus.syncedAt ? new Date(linearSyncStatus.syncedAt).toLocaleDateString() : ''}`}
                >
                  <LinearIcon size={12} />
                  <span>View in Linear</span>
                </a>
              ) : (
                <button
                  onClick={syncToLinear}
                  disabled={syncingToLinear}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'hsl(0 0% 96%)',
                    color: 'hsl(0 0% 46%)',
                    border: '1px solid hsl(0 0% 90%)'
                  }}
                  title="Sync this project to Linear"
                >
                  <LinearIcon size={12} />
                  <span>{syncingToLinear ? 'Syncing...' : 'Sync to Linear'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto py-3">
          {/* Issues Section */}
          <div className="px-3 mb-4">
            <div 
              className="flex items-center justify-between px-2 py-1.5 mb-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(0 0% 46%)' }}>
                Issues
              </span>
              {hasIssues && (
                <span 
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}
                >
                  {issues.length}
                </span>
              )}
            </div>
            
            <button
              onClick={navigateToIssues}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
              style={{
                backgroundColor: activeSection === 'issues' ? 'hsl(235 69% 97%)' : 'transparent',
                color: activeSection === 'issues' ? 'hsl(235 69% 50%)' : 'hsl(0 0% 32%)',
              }}
            >
              <IssuesIcon />
              <span className="text-[13px] font-medium flex-1">
                {hasIssues ? 'View Issues' : 'No issues yet'}
              </span>
              {!hasIssues && (
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'hsl(0 0% 80%)' }}
                />
              )}
            </button>
          </div>

          {/* Questions Section */}
          <div className="px-3 mb-4">
            <div 
              className="flex items-center justify-between px-2 py-1.5 mb-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(0 0% 46%)' }}>
                Questions
              </span>
              {hasQuestions && (
                <span 
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}
                >
                  {getQuestionsCount()}
                </span>
              )}
            </div>
            
            <div className="space-y-0.5">
              {/* Product Manager */}
              <button
                onClick={() => navigate(`/project/${id}/questions/pm`)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
                style={{
                  backgroundColor: activeSection === 'questions' && activeDocType === 'pm' ? 'hsl(235 69% 97%)' : 'transparent',
                  color: activeSection === 'questions' && activeDocType === 'pm' 
                    ? 'hsl(235 69% 50%)' 
                    : questions?.pm ? 'hsl(0 0% 32%)' : 'hsl(0 0% 60%)',
                }}
              >
                {questions?.pm ? (
                  <div 
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                  >
                    <CheckIcon />
                  </div>
                ) : (
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ border: '1.5px solid hsl(0 0% 80%)' }}
                  />
                )}
                <span className="text-[13px] font-medium">Product Manager</span>
              </button>

              {/* Designer */}
              <button
                onClick={() => navigate(`/project/${id}/questions/ux`)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
                style={{
                  backgroundColor: activeSection === 'questions' && activeDocType === 'ux' ? 'hsl(235 69% 97%)' : 'transparent',
                  color: activeSection === 'questions' && activeDocType === 'ux' 
                    ? 'hsl(235 69% 50%)' 
                    : questions?.ux ? 'hsl(0 0% 32%)' : 'hsl(0 0% 60%)',
                }}
              >
                {questions?.ux ? (
                  <div 
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                  >
                    <CheckIcon />
                  </div>
                ) : (
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ border: '1.5px solid hsl(0 0% 80%)' }}
                  />
                )}
                <span className="text-[13px] font-medium">Designer</span>
              </button>

              {/* Engineer */}
              <button
                onClick={() => navigate(`/project/${id}/questions/engineer`)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
                style={{
                  backgroundColor: activeSection === 'questions' && activeDocType === 'engineer' ? 'hsl(235 69% 97%)' : 'transparent',
                  color: activeSection === 'questions' && activeDocType === 'engineer' 
                    ? 'hsl(235 69% 50%)' 
                    : questions?.engineer ? 'hsl(0 0% 32%)' : 'hsl(0 0% 60%)',
                }}
              >
                {questions?.engineer ? (
                  <div 
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                  >
                    <CheckIcon />
                  </div>
                ) : (
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ border: '1.5px solid hsl(0 0% 80%)' }}
                  />
                )}
                <span className="text-[13px] font-medium">Engineer</span>
              </button>
            </div>
          </div>

          {/* Documents Section */}
          <div className="px-3">
            <div 
              className="flex items-center justify-between px-2 py-1.5 mb-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(0 0% 46%)' }}>
                Documents
              </span>
              <span 
                className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}
              >
                {getCompletedDocCount()}/{documentTypes.length}
              </span>
            </div>
            
            <div className="space-y-0.5">
              {documentTypes.map((doc) => {
                const status = getDocumentStatus(doc.id);
                const isActive = activeSection === 'docs' && activeDocType === doc.id;
                
                return (
                  <button
                    key={doc.id}
                    onClick={() => navigateToDoc(doc.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
                    style={{
                      backgroundColor: isActive ? 'hsl(235 69% 97%)' : 'transparent',
                      color: isActive ? 'hsl(235 69% 50%)' : status === 'complete' ? 'hsl(0 0% 32%)' : 'hsl(0 0% 60%)',
                    }}
                  >
                    {status === 'complete' ? (
                      <div 
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                      >
                        <CheckIcon />
                      </div>
                    ) : (
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ border: '1.5px solid hsl(0 0% 80%)' }}
                      />
                    )}
                    <span className="text-[13px] font-medium truncate">
                      {doc.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          {/* Primary Action Button */}
          {isNotSpecced && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all mb-2"
              style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
            >
              ✨ Start Specification
            </button>
          )}
          
          {isPartiallySpecced && !hasIssues && (
            <button
              onClick={() => navigate(`/specification/${id}`)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all mb-2"
              style={{ backgroundColor: 'hsl(45 93% 47%)', color: 'hsl(0 0% 9%)' }}
            >
              Continue Specification
            </button>
          )}
          
          {isFullySpecced && !hasIssues && (
            <button
              onClick={triggerIssueCreation}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all mb-2"
              style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
            >
              <PlusIcon />
              Generate Issues
            </button>
          )}

          {/* Cost Widget */}
          {id && (
            <div className="mb-2">
              <CostWidget projectId={id} />
            </div>
          )}

          {/* Settings/Delete Menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
              style={{
                backgroundColor: showMenu ? 'hsl(0 0% 96%)' : 'transparent',
                color: 'hsl(0 0% 46%)',
              }}
            >
              <SettingsIcon />
              <span className="text-[13px] font-medium">Project Settings</span>
            </button>
            
            {showMenu && (
              <div 
                className="absolute bottom-full left-0 right-0 mb-1 rounded-lg overflow-hidden"
                style={{ 
                  backgroundColor: 'white',
                  boxShadow: '0 -4px 12px -2px rgb(0 0 0 / 0.1)',
                  border: '1px solid hsl(0 0% 92%)'
                }}
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{ color: 'hsl(0 84% 45%)' }}
                >
                  <TrashIcon />
                  <span className="text-[13px] font-medium">Delete Project</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen flex flex-col">
        {/* Header */}
        <header 
          className="sticky top-0 z-10 px-6 py-3 border-b flex items-center justify-between"
          style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
              {activeSection === 'issues' ? 'Issues' : activeSection === 'questions' ? 'Questions' : 'Documents'}
            </span>
            {activeSection === 'docs' && (
              <>
                <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
                <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                  {documentTypes.find(d => d.id === activeDocType)?.label || 'Document'}
                </span>
              </>
            )}
            {activeSection === 'questions' && (
              <>
                <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
                <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                  {activeDocType === 'pm' ? 'Product Manager' : activeDocType === 'ux' ? 'Designer' : 'Engineer'}
                </span>
              </>
            )}
          </div>
          
          {/* Status badge */}
          {activeSection === 'docs' && (
            <div 
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium"
              style={{
                backgroundColor: getDocumentStatus(activeDocType) === 'complete' 
                  ? 'hsl(142 76% 94%)' 
                  : 'hsl(0 0% 96%)',
                color: getDocumentStatus(activeDocType) === 'complete' 
                  ? 'hsl(142 76% 30%)' 
                  : 'hsl(0 0% 46%)'
              }}
            >
              {getDocumentStatus(activeDocType) === 'complete' ? (
                <>
                  <CheckIcon />
                  <span>Complete</span>
                </>
              ) : (
                <span>Pending</span>
              )}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {renderMainContent()}
        </div>
      </main>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowConfigModal(false)}
        >
          <div 
            className="rounded-xl p-6 w-full max-w-lg"
            style={{ backgroundColor: 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
              Configure Specification
            </h2>
            <p className="text-[13px] mb-5" style={{ color: 'hsl(0 0% 46%)' }}>
              These settings apply to all agents (PM, Designer, Engineer)
            </p>
            
            {/* Question Depth */}
            <div className="mb-5">
              <label className="block text-[13px] font-medium mb-2" style={{ color: 'hsl(0 0% 32%)' }}>
                Question depth
              </label>
              <div className="space-y-2">
                {[
                  { value: 'light', label: 'Light', desc: '3-5 questions', emoji: '⚡' },
                  { value: 'standard', label: 'Standard', desc: '5-8 questions (recommended)', emoji: '⚖️' },
                  { value: 'thorough', label: 'Thorough', desc: '8-12 questions', emoji: '🔬' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setProjectSettings({ ...projectSettings, question_depth: option.value as any })}
                    className="w-full p-3 rounded-lg text-left transition-all flex items-center gap-3"
                    style={{
                      border: `2px solid ${projectSettings.question_depth === option.value ? 'hsl(235 69% 61%)' : 'hsl(0 0% 92%)'}`,
                      backgroundColor: projectSettings.question_depth === option.value ? 'hsl(235 69% 97%)' : 'white'
                    }}
                  >
                    <span className="text-xl">{option.emoji}</span>
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{option.label}</div>
                      <div className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>{option.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Document Length */}
            <div className="mb-6">
              <label className="block text-[13px] font-medium mb-2" style={{ color: 'hsl(0 0% 32%)' }}>
                Document detail level
              </label>
              <div className="space-y-2">
                {[
                  { value: 'brief', label: 'Brief', desc: '~5 min read', emoji: '📝' },
                  { value: 'standard', label: 'Standard', desc: '~10 min read (recommended)', emoji: '📄' },
                  { value: 'comprehensive', label: 'Comprehensive', desc: '~15 min read', emoji: '📚' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setProjectSettings({ ...projectSettings, document_length: option.value as any })}
                    className="w-full p-3 rounded-lg text-left transition-all flex items-center gap-3"
                    style={{
                      border: `2px solid ${projectSettings.document_length === option.value ? 'hsl(235 69% 61%)' : 'hsl(0 0% 92%)'}`,
                      backgroundColor: projectSettings.document_length === option.value ? 'hsl(235 69% 97%)' : 'white'
                    }}
                  >
                    <span className="text-xl">{option.emoji}</span>
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{option.label}</div>
                      <div className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>{option.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowConfigModal(false)} disabled={savingSettings}>
                Cancel
              </Button>
              <Button onClick={handleStartSpec} disabled={savingSettings}>
                {savingSettings ? 'Starting...' : '✨ Start Specification'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Delete Project</DialogTitle>
            <DialogDescription className="text-slate-600">
              Are you sure you want to delete <span className="font-semibold">{id}</span>? 
              This will permanently remove all project files including documents, questions, and specifications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteProject} 
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
