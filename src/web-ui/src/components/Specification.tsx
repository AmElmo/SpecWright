import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { useRealtimeUpdates } from '../lib/use-realtime';
import { useAIToolName, AI_TOOL_NAMES, type AITool } from '../lib/use-ai-tool';
import { getActionIcon } from '../lib/action-icons';
import { QuestionForm } from './QuestionForm';
import { DocumentReview } from './DocumentReview';
import { CostWidget } from './CostWidget';
// RefinePanel is now integrated within DocumentReview
import { AIActionSplitButton } from './AIActionSplitButton';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';
import { useSidebarWidth } from '../hooks/use-sidebar-width';
import { SidebarResizeHandle } from './SidebarResizeHandle';

interface DocFileProgress {
  name: string;
  label: string;
  complete: boolean;
}

interface AgentDocProgress {
  status: string;
  files: DocFileProgress[];
}

interface SpecificationStatus {
  projectId: string;
  phases: {
    pm: { complete: boolean };
    ux: { complete: boolean };
    engineer: { complete: boolean };
  };
  currentPhase: string;
  nextPhase: string | null;
  needsReview: boolean;
  reviewDocument: string | null;
  isComplete: boolean;
  needsGeneration?: boolean;
  docsProgress?: {
    pm: AgentDocProgress;
    ux: AgentDocProgress;
    engineer: AgentDocProgress;
  };
  isGenerating?: boolean;
  generatingPhase?: string | null;
}

// Log entry for streaming progress
interface HeadlessLogEntry {
  id: number;
  message: string;
  icon: string;
  timestamp: Date;
}

type PhaseStatus = 'pending' | 'in-progress' | 'complete';

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

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function Specification() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const aiToolName = useAIToolName();
  
  const [status, setStatus] = useState<SpecificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [triggeringPhase, setTriggeringPhase] = useState<string | null>(null);
  const [automationStatus, setAutomationStatus] = useState<'sending' | 'sent' | 'failed' | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const [reviewDocumentContent, setReviewDocumentContent] = useState<string>('');
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [breakingDown, setBreakingDown] = useState(false);
  const [hasTasks, setHasTasks] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [isInReviewMode, setIsInReviewMode] = useState(false);
  const [sessions, setSessions] = useState<{ pm?: string; ux?: string; engineer?: string }>({});
  const [isHeadlessMode, setIsHeadlessMode] = useState(false);
  const [headlessLogs, setHeadlessLogs] = useState<HeadlessLogEntry[]>([]);
  const [logIdCounter, setLogIdCounter] = useState(0);
  const [lastProgressTime, setLastProgressTime] = useState<number | null>(null);
  const [currentRunTool, setCurrentRunTool] = useState<AITool | null>(null);

  // Per-agent streaming logs for docs-generate phase
  const [agentLogs, setAgentLogs] = useState<Record<string, HeadlessLogEntry[]>>({ pm: [], ux: [], engineer: [] });
  const [agentActiveTab, setAgentActiveTab] = useState<string>('pm');
  const [agentCompleted, setAgentCompleted] = useState<Record<string, boolean>>({ pm: false, ux: false, engineer: false });

  const activeToolName = currentRunTool ? AI_TOOL_NAMES[currentRunTool] : aiToolName;

  const showQuestionForm = status?.currentPhase === 'pm-questions-answer' || 
                           status?.currentPhase === 'ux-questions-answer' || 
                           status?.currentPhase === 'engineer-questions-answer';
  const questionPhase: 'pm' | 'ux' | 'engineer' | null = 
    status?.currentPhase === 'pm-questions-answer' ? 'pm' :
    status?.currentPhase === 'ux-questions-answer' ? 'ux' :
    status?.currentPhase === 'engineer-questions-answer' ? 'engineer' : null;
  
  // Map WS event phase to agent key for per-agent log routing
  const phaseToAgent = (phase?: string): string | null => {
    if (!phase) return null;
    if (phase.startsWith('pm')) return 'pm';
    if (phase.startsWith('ux')) return 'ux';
    if (phase.startsWith('engineer')) return 'engineer';
    return null;
  };

  useRealtimeUpdates((event) => {
    // Refinement events have isRefinement=true and are handled by RefinePanel
    const isRefinementEvent = event.isRefinement === true;
    const isDocsGenerate = triggeringPhase === 'docs-generate';
    const eventAgent = phaseToAgent(event.phase);

    // Track headless mode and streaming logs - but not for refinement events
    if (event.type === 'headless_started' && !isRefinementEvent) {
      if (isDocsGenerate && eventAgent) {
        // Per-agent: add start entry to the specific agent's log
        const startEntry: HeadlessLogEntry = {
          id: Date.now(),
          message: `Starting ${activeToolName}...`,
          icon: '🚀',
          timestamp: new Date()
        };
        setAgentLogs(prev => ({ ...prev, [eventAgent]: [startEntry] }));
        setAgentCompleted(prev => ({ ...prev, [eventAgent]: false }));
      } else {
        // Single-agent mode (non-docs-generate)
        setIsHeadlessMode(true);
        setHeadlessLogs([]);
        setLogIdCounter(0);
        setLastProgressTime(Date.now());
        const startEntry: HeadlessLogEntry = {
          id: 0,
          message: `Starting ${activeToolName}...`,
          icon: '🚀',
          timestamp: new Date()
        };
        setHeadlessLogs([startEntry]);
        setLogIdCounter(1);
      }
      setAutomationStatus('sent');
    }
    if (event.type === 'headless_progress' && event.status && !isRefinementEvent) {
      const message = event.status;
      if (isDocsGenerate && eventAgent) {
        // Per-agent: append to the specific agent's log
        const newEntry: HeadlessLogEntry = {
          id: Date.now() + Math.random(),
          message,
          icon: getActionIcon(message),
          timestamp: new Date()
        };
        setAgentLogs(prev => ({
          ...prev,
          [eventAgent]: [...(prev[eventAgent] || []), newEntry]
        }));
      } else {
        // Single-agent mode
        const newEntry: HeadlessLogEntry = {
          id: logIdCounter,
          message,
          icon: getActionIcon(message),
          timestamp: new Date()
        };
        setHeadlessLogs(prev => [...prev, newEntry]);
        setLogIdCounter(prev => prev + 1);
        setLastProgressTime(Date.now());
      }
    }
    if (event.type === 'headless_completed' && !isRefinementEvent) {
      const message = event.success ? 'Task completed successfully' : 'Task failed';
      if (isDocsGenerate && eventAgent) {
        // Per-agent: mark completed
        const finalEntry: HeadlessLogEntry = {
          id: Date.now(),
          message,
          icon: event.success ? '✅' : '⚠️',
          timestamp: new Date()
        };
        setAgentLogs(prev => ({
          ...prev,
          [eventAgent]: [...(prev[eventAgent] || []), finalEntry]
        }));
        setAgentCompleted(prev => ({ ...prev, [eventAgent]: true }));
      } else {
        // Single-agent mode
        const finalEntry: HeadlessLogEntry = {
          id: logIdCounter,
          message,
          icon: event.success ? '✅' : '⚠️',
          timestamp: new Date()
        };
        setHeadlessLogs(prev => [...prev, finalEntry]);
        setLastProgressTime(null);
        setTimeout(() => {
          setHeadlessLogs([]);
          setIsHeadlessMode(false);
        }, 3000);
      }
    }
    // Handle headless cancellation - reset all working state
    if (event.type === 'headless_cancelled') {
      setTriggeringPhase(null);
      setAutomationStatus(null);
      setIsHeadlessMode(false);
      setHeadlessLogs([]);
      setLastProgressTime(null);
      setBreakingDown(false);
      setCurrentRunTool(null);
      setAgentLogs({ pm: [], ux: [], engineer: [] });
      setAgentCompleted({ pm: false, ux: false, engineer: false });
    }
    // Handle early session capture - enables RefinePanel immediately
    if (event.type === 'session_captured' && event.sessionId) {
      logger.debug('Session captured early:', event.sessionId);
      if (status?.currentPhase) {
        if (status.currentPhase.startsWith('pm-')) {
          setSessions(prev => ({ ...prev, pm: event.sessionId }));
        } else if (status.currentPhase.startsWith('ux-')) {
          setSessions(prev => ({ ...prev, ux: event.sessionId }));
        } else if (status.currentPhase.startsWith('engineer-')) {
          setSessions(prev => ({ ...prev, engineer: event.sessionId }));
        }
      }
    }
    fetchStatus(isInReviewMode);
    if (triggeringPhase) {
      checkIfWorkComplete();
    }
    if (breakingDown) {
      checkBreakdownStatus();
    }
  });
  
  useEffect(() => {
    if (triggeringPhase || breakingDown) {
      const interval = setInterval(() => {
        fetchStatus();
        if (triggeringPhase) {
          checkIfWorkComplete();
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [triggeringPhase, breakingDown]);

  // Thinking indicator: show "thinking..." every 15 seconds if no progress
  useEffect(() => {
    if (!isHeadlessMode || !lastProgressTime) return;

    // Show thinking indicator every 15 seconds of inactivity
    const thinkingInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastProgressTime;
      if (elapsed >= 15000) {
        setHeadlessLogs(prev => [...prev, {
          id: Date.now(),
          message: 'Still thinking... (complex task in progress)',
          icon: '🧠',
          timestamp: new Date()
        }]);
      }
    }, 15000);

    return () => clearInterval(thinkingInterval);
  }, [isHeadlessMode, lastProgressTime]);
  
  const fetchStatus = async (skipDocumentReload = false) => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/specification/status/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();

      setStatus(data);
      setError('');

      // Restore "working" state if generation is in progress (for page reload)
      // Only restore if we're not already tracking a phase (prevents overriding user-initiated triggers)
      if (data.isGenerating && data.generatingPhase && !triggeringPhase) {
        logger.debug('Restoring generation state from server:', data.generatingPhase);
        setTriggeringPhase(data.generatingPhase);
        setAutomationStatus('sent');
        // For docs-generate, don't set isHeadlessMode — per-agent logs are used instead
        if (data.generatingPhase !== 'docs-generate') {
          setIsHeadlessMode(true);
        }
      }

      if (data.needsReview && data.reviewDocument) {
        if (!skipDocumentReload) {
          await fetchDocumentForReview(data.reviewDocument);
          setIsInReviewMode(true);
        }
      } else {
        setReviewDocumentContent('');
        setIsInReviewMode(false);
      }

      if (data.isComplete) {
        checkBreakdownStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };
  
  const checkBreakdownStatus = async () => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/specification/breakdown-status/${projectId}`);
      if (!response.ok) return;

      const data = await response.json();

      if (data.isComplete && data.issueCount > 0) {
        setHasTasks(true);
        setTaskCount(data.issueCount);
        setBreakingDown(false);
      } else if (data.isGenerating && !breakingDown) {
        // Restore breakdown "working" state if generation is in progress (for page reload)
        logger.debug('Restoring breakdown generation state from server');
        setBreakingDown(true);
      }
    } catch (err) {
      logger.error('Error checking breakdown status:', err);
    }
  };
  
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!projectId || cancelling) return;
    setCancelling(true);
    try {
      await fetch(`/api/headless/cancel/${projectId}`, { method: 'POST' });
      // State reset is handled by the headless_cancelled WebSocket event
    } catch (err) {
      logger.error('Failed to cancel:', err);
      // Fallback: reset state locally if the API call fails
      setTriggeringPhase(null);
      setAutomationStatus(null);
      setIsHeadlessMode(false);
      setHeadlessLogs([]);
      setLastProgressTime(null);
      setBreakingDown(false);
      setCurrentRunTool(null);
      setAgentLogs({ pm: [], ux: [], engineer: [] });
      setAgentCompleted({ pm: false, ux: false, engineer: false });
    } finally {
      setCancelling(false);
    }
  };

  const triggerBreakdown = async (toolOverride?: AITool) => {
    if (!projectId) return;

    try {
      setCurrentRunTool(toolOverride || null);
      setBreakingDown(true);
      setError('');
      // Clear previous headless logs and reset state for streaming
      setHeadlessLogs([]);
      setLogIdCounter(0);
      setIsHeadlessMode(false);

      const response = await fetch(`/api/specification/breakdown/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(toolOverride ? { aiTool: toolOverride } : {})
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.prompt) {
          setLastPrompt(data.prompt);
        }
      } else {
        setError(data.error || 'Failed to create issues');
        setBreakingDown(false);
      }
    } catch (err) {
      setError('Failed to create issues');
      setBreakingDown(false);
    }
  };
  
  const fetchDocumentForReview = async (documentPath: string) => {
    if (!projectId) return;
    
    try {
      setLoadingDocument(true);
      const response = await fetch(`/api/specification/document/${projectId}/${documentPath}`);
      if (!response.ok) throw new Error('Failed to fetch document');
      const data = await response.json();
      setReviewDocumentContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document for review');
    } finally {
      setLoadingDocument(false);
    }
  };
  
  const handleApproveDocument = async () => {
    if (!projectId || !status) return;
    
    try {
      const response = await fetch(`/api/specification/approve/${projectId}/${status.currentPhase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to approve document');
      
      await response.json();
      setIsInReviewMode(false);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve document');
    }
  };
  
  useEffect(() => {
    fetchStatus();
  }, [projectId]);

  // Fetch session IDs for refinement support
  useEffect(() => {
    const fetchSessions = async () => {
      if (!projectId) return;
      try {
        const response = await fetch(`/api/sessions/${projectId}`);
        const data = await response.json();
        if (data.sessions) {
          setSessions(data.sessions);
          logger.debug('Loaded sessions:', data.sessions);
        }
      } catch (err) {
        logger.error('Failed to fetch sessions:', err);
      }
    };
    fetchSessions();
  }, [projectId]);

  const checkIfWorkComplete = async () => {
    if (!triggeringPhase || !projectId) return;
    
    try {
      const response = await fetch(`/api/specification/status/${projectId}`);
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (triggeringPhase === 'pm-questions-generate' && data.currentPhase === 'pm-questions-answer') {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'ux-questions-generate' && data.currentPhase === 'ux-questions-answer') {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'engineer-questions-generate' && data.currentPhase === 'engineer-questions-answer') {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'docs-generate' && (data.currentPhase === 'pm-prd-review' || data.needsReview)) {
        // All docs generated, moved to review phase
        setTriggeringPhase(null);
      }
    } catch (err) {
      logger.error('Error checking work completion:', err);
    }
  };
  
  const triggerPhase = async (phase: string, toolOverride?: AITool) => {
    if (!projectId) return;

    try {
      setCurrentRunTool(toolOverride || null);
      setTriggeringPhase(phase);
      setAutomationStatus('sending');
      setError('');

      if (phase === 'docs-generate') {
        // Reset per-agent streaming state
        setAgentLogs({ pm: [], ux: [], engineer: [] });
        setAgentCompleted({ pm: false, ux: false, engineer: false });
        setAgentActiveTab('pm');

        // Determine which agents still need generation (skip already-complete ones)
        const allDocPhases = [
          { phase: 'pm-prd', agent: 'pm' },
          { phase: 'ux-design-brief', agent: 'ux' },
          { phase: 'engineer-spec-generate', agent: 'engineer' },
        ];
        const docsProgress = status?.docsProgress;
        const pendingPhases = allDocPhases.filter(d => {
          const agentProgress = docsProgress?.[d.agent as keyof typeof docsProgress];
          return agentProgress?.status !== 'complete';
        });

        if (pendingPhases.length === 0) {
          // All docs already complete — just refresh status
          setTriggeringPhase(null);
          setAutomationStatus(null);
          await fetchStatus();
          return;
        }

        // Fire parallel requests only for incomplete agents
        const results = await Promise.allSettled(
          pendingPhases.map(({ phase: docPhase }) =>
            fetch(`/api/specification/continue/${projectId}/${docPhase}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...(toolOverride ? { aiTool: toolOverride } : {})
              })
            }).then(r => r.json())
          )
        );

        const anySuccess = results.some(r => r.status === 'fulfilled' && r.value.success);
        const anyFailed = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

        if (anySuccess) {
          setAutomationStatus('sent');
          // Auto-select first pending agent's tab
          setAgentActiveTab(pendingPhases[0].agent);
        }
        if (anyFailed && !anySuccess) {
          setError('Failed to trigger document generation');
          setAutomationStatus('failed');
          setTriggeringPhase(null);
        }
      } else {
        const response = await fetch(`/api/specification/continue/${projectId}/${phase}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(toolOverride ? { aiTool: toolOverride } : {})
          })
        });

        const data = await response.json();

        if (data.prompt) {
          setLastPrompt(data.prompt);
        }

        if (data.success) {
          setAutomationStatus('sent');
        } else {
          if (data.message || data.error) {
            setError(data.message || data.error);
          }
          setAutomationStatus('failed');
        }
      }
    } catch (err) {
      setError('Failed to trigger phase');
      setAutomationStatus(null);
      setTriggeringPhase(null);
    }
  };

  // Copy button with feedback animation
  const CopyPromptButton = ({ prompt }: { prompt: string }) => {
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
  
  const getPhaseStatus = (phaseName: string): PhaseStatus => {
    if (!status) return 'pending';

    // Unified flow: 4 steps — PM Questions, UX Questions, Engineer Questions, Documents
    if (phaseName === 'pm') {
      // PM is complete when pm-questions-answer is done
      const pmQuestionsAnswered = status.currentPhase !== 'pm-questions-generate' &&
        status.currentPhase !== 'pm-questions-answer';
      if (pmQuestionsAnswered || status.phases.pm.complete) return 'complete';
      if (status.currentPhase.startsWith('pm')) return 'in-progress';
      return 'pending';
    }

    if (phaseName === 'ux') {
      const uxQuestionsAnswered = status.currentPhase !== 'pm-questions-generate' &&
        status.currentPhase !== 'pm-questions-answer' &&
        status.currentPhase !== 'ux-questions-generate' &&
        status.currentPhase !== 'ux-questions-answer';
      if (uxQuestionsAnswered || status.phases.ux.complete) return 'complete';
      if (status.currentPhase.startsWith('ux')) return 'in-progress';
      return 'pending';
    }

    if (phaseName === 'engineer') {
      const engineerQuestionsAnswered = ['docs-generate', 'pm-prd-review', 'ux-design-brief-review',
        'engineer-spec-review', 'complete'].includes(status.currentPhase);
      if (engineerQuestionsAnswered || status.phases.engineer.complete) return 'complete';
      if (status.currentPhase.startsWith('engineer')) return 'in-progress';
      return 'pending';
    }

    if (phaseName === 'documents') {
      if (status.isComplete) return 'complete';
      if (['docs-generate', 'pm-prd-review', 'ux-design-brief-review', 'engineer-spec-review'].includes(status.currentPhase)) {
        return 'in-progress';
      }
      return 'pending';
    }

    return 'pending';
  };
  
  const getPhaseInfo = (phase: string) => {
    const phases: Record<string, { agent: string; action: string; description: string }> = {
      'pm-questions-generate': { agent: 'Product Manager', action: 'Analyzing Codebase & Generating Questions', description: 'Reviewing your entire codebase to ask targeted questions about requirements' },
      'pm-prd-generate': { agent: 'Product Manager', action: 'Writing PRD', description: 'Creating the Product Requirements Document' },
      'ux-questions-generate': { agent: 'Designer', action: 'Analyzing UI & Generating Questions', description: 'Reviewing your components and UI patterns to ask relevant design questions' },
      'ux-design-brief-generate': { agent: 'Designer', action: 'Creating Design Brief', description: 'Designing screens and user flows' },
      'engineer-questions-generate': { agent: 'Engineer', action: 'Analyzing Architecture & Generating Questions', description: 'Reviewing your tech stack and codebase to ask precise technical questions' },
      'engineer-spec-generate': { agent: 'Engineer', action: 'Writing Tech Spec', description: 'Creating technical specification' },
      'docs-generate': { agent: 'All Agents', action: 'Generating Documents', description: 'Creating PRD, Design Brief, and Technical Spec in parallel' },
    };
    return phases[phase] || { agent: 'AI', action: 'Processing', description: 'Working on the next step' };
  };

  const getReadyInfo = (phase: string) => {
    const info: Record<string, { title: string; description: string; buttonText: string }> = {
      'pm-questions-generate': { 
        title: 'Generate PM Questions', 
        description: 'The Product Manager will ask strategic questions to understand your project requirements.',
        buttonText: 'Generate Questions'
      },
      'pm-prd-generate': { 
        title: 'Generate PRD', 
        description: 'The Product Manager will analyze your answers and create a Product Requirements Document.',
        buttonText: 'Generate PRD'
      },
      'ux-questions-generate': { 
        title: 'Generate Design Questions', 
        description: 'The Designer will ask questions about user interactions and design preferences.',
        buttonText: 'Generate Questions'
      },
      'ux-design-brief-generate': { 
        title: 'Generate Design Brief', 
        description: 'The Designer will create a design brief with screens and wireframes.',
        buttonText: 'Generate Design Brief'
      },
      'engineer-questions-generate': { 
        title: 'Generate Technical Questions', 
        description: 'The Engineer will ask questions about technical constraints and infrastructure.',
        buttonText: 'Generate Questions'
      },
      'engineer-spec-generate': {
        title: 'Generate Technical Spec',
        description: 'The Engineer will create a detailed technical specification.',
        buttonText: 'Generate Tech Spec'
      },
      'docs-generate': {
        title: 'Generate All Documents',
        description: 'All three agents will work in parallel to create the PRD, Design Brief, and Technical Specification.',
        buttonText: 'Generate All Documents'
      },
    };
    return info[phase] || { title: 'Continue', description: 'Continue to the next phase.', buttonText: 'Continue' };
  };

  // Sidebar nav items
  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/', active: false },
    { label: 'Issues', icon: IssuesIcon, path: '/issues', active: false },
    { label: 'Settings', icon: SettingsIcon, path: '/settings', active: false },
  ];

  const pmStatus = getPhaseStatus('pm');
  const uxStatus = getPhaseStatus('ux');
  const engineerStatus = getPhaseStatus('engineer');
  const docsStatus = getPhaseStatus('documents');
  const nextActionPhase = status?.nextPhase || null;

  // Phase icons
  const ProductManagerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 3V8C13 8.55228 13.4477 9 14 9H19" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );

  // Palette icon for Designer
  const DesignerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C12.9 22 13.6 21.3 13.6 20.4C13.6 20 13.4 19.6 13.2 19.4C13 19.1 12.8 18.8 12.8 18.4C12.8 17.5 13.5 16.8 14.4 16.8H16C19.3 16.8 22 14.1 22 10.8C22 5.9 17.5 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor"/>
      <circle cx="10.5" cy="7.5" r="1.5" fill="currentColor"/>
      <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor"/>
      <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor"/>
    </svg>
  );

  // Code brackets icon for Engineer
  const EngineerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 18L22 12L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 6L2 12L8 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // Documents icon for 4th step
  const DocumentsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 18H17V16H7V18ZM7 14H17V12H7V14ZM5 22C4.45 22 3.979 21.804 3.587 21.413C3.196 21.021 3 20.55 3 20V4C3 3.45 3.196 2.979 3.587 2.587C3.979 2.196 4.45 2 5 2H14L20 8V20C20 20.55 19.804 21.021 19.413 21.413C19.021 21.804 18.55 22 18 22H5Z" fill="currentColor" fillOpacity="0.2"/>
      <path d="M5 22C4.45 22 3.979 21.804 3.587 21.413C3.196 21.021 3 20.55 3 20V4C3 3.45 3.196 2.979 3.587 2.587C3.979 2.196 4.45 2 5 2H14L20 8V20C20 20.55 19.804 21.021 19.413 21.413C19.021 21.804 18.55 22 18 22H5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );

  // Phase indicator component - keeps original icon, changes color when complete
  const PhaseIndicator = ({ name, status: phaseStatus, phaseType }: { name: string; status: PhaseStatus; phaseType: 'pm' | 'ux' | 'engineer' | 'documents' }) => {
    const getIcon = () => {
      // Always show the agent's icon, never replace with checkmark
      switch (phaseType) {
        case 'pm': return <ProductManagerIcon />;
        case 'ux': return <DesignerIcon />;
        case 'engineer': return <EngineerIcon />;
        case 'documents': return <DocumentsIcon />;
      }
    };

    return (
      <div className="flex flex-col items-center">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all"
          style={{
            backgroundColor: phaseStatus === 'complete' ? 'hsl(142 76% 36%)' : 
                            phaseStatus === 'in-progress' ? 'hsl(235 69% 61%)' : 'hsl(0 0% 92%)',
            color: phaseStatus === 'pending' ? 'hsl(0 0% 46%)' : 'white',
            boxShadow: phaseStatus === 'in-progress' ? '0 0 0 4px hsl(235 69% 61% / 0.2)' : 'none'
          }}
        >
          {getIcon()}
        </div>
        <span className="text-[12px] font-medium mt-2" style={{ color: phaseStatus === 'pending' ? 'hsl(0 0% 46%)' : 'hsl(0 0% 9%)' }}>
          {name}
        </span>
        <span 
          className="text-[10px] mt-0.5 px-2 py-0.5 rounded-full"
          style={{ 
            backgroundColor: phaseStatus === 'complete' ? 'hsl(142 76% 94%)' : 
                            phaseStatus === 'in-progress' ? 'hsl(235 69% 95%)' : 'hsl(0 0% 96%)',
            color: phaseStatus === 'complete' ? 'hsl(142 76% 30%)' : 
                   phaseStatus === 'in-progress' ? 'hsl(235 69% 50%)' : 'hsl(0 0% 46%)'
          }}
        >
          {phaseStatus === 'complete' ? 'Complete' : phaseStatus === 'in-progress' ? 'In Progress' : 'Pending'}
        </span>
      </div>
    );
  };

  // Connector line component - uses flex-1 to fill available width
  const ConnectorLine = ({ complete }: { complete: boolean }) => (
    <div 
      className="flex-1 h-0.5 rounded-full mx-4"
      style={{ 
        backgroundColor: complete ? 'hsl(142 76% 36%)' : 'hsl(0 0% 90%)',
        marginTop: '-20px',
        minWidth: '60px',
        maxWidth: '120px'
      }}
    />
  );

  const { sidebarWidth, handleResizeStart } = useSidebarWidth();

  // Sidebar component
  const Sidebar = () => {
    const mainNavItems = navItems.filter(item => item.label !== 'Settings');
    const settingsItem = navItems.find(item => item.label === 'Settings');

    return (
      <aside
        className="h-screen flex flex-col border-r sticky top-0 flex-shrink-0 relative"
        style={{ width: `${sidebarWidth}px`, backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
      >
        <div className="px-4 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <img src={specwrightLogo} alt="SpecWright" className="w-7 h-7" />
            <span className="font-semibold text-[18px]" style={{ color: 'hsl(0 0% 9%)' }}>SpecWright</span>
          </Link>
        </div>
        <nav className="flex-1 p-2">
          <ul className="space-y-0.5">
            {mainNavItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-all duration-150"
                  style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(0 0% 94%)';
                    e.currentTarget.style.color = 'hsl(0 0% 20%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'hsl(0 0% 46%)';
                  }}
                >
                  <item.icon />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Cost widget and Settings at bottom */}
        <div className="mt-auto">
          {/* Cost Widget */}
          {projectId && (
            <div className="px-3 py-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
              <CostWidget projectId={projectId} />
            </div>
          )}

          {/* Settings */}
          {settingsItem && (
            <div className="p-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
              <Link
                to={settingsItem.path}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-all duration-150"
                style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(0 0% 94%)';
                  e.currentTarget.style.color = 'hsl(0 0% 20%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'hsl(0 0% 46%)';
                }}
              >
                <settingsItem.icon />
                <span className="text-[13px] font-medium">{settingsItem.label}</span>
              </Link>
            </div>
          )}
        </div>

        <SidebarResizeHandle onMouseDown={handleResizeStart} />
      </aside>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="linear-spinner"></div>
            <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Loading specification...</span>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error && !status) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-lg p-5" style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}>
              <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>{error}</p>
              <button
                onClick={() => navigate('/')}
                className="mt-4 px-4 py-2 rounded-md text-[13px] font-medium"
                style={{ backgroundColor: 'hsl(0 0% 9%)', color: 'white' }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!status) return null;

  // AI Working state
  if (triggeringPhase) {
    const phaseInfo = getPhaseInfo(triggeringPhase);

    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1">
          <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-[13px] no-underline hover:underline transition-colors"
                style={{ color: 'hsl(0 0% 46%)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(0 0% 20%)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 46%)'; }}
              >
                Specification
              </Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <Link
                to={`/project/${projectId}`}
                className="text-[13px] font-medium no-underline hover:underline transition-colors"
                style={{ color: 'hsl(0 0% 9%)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(235 69% 50%)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 9%)'; }}
              >
                {projectId}
              </Link>
            </div>
          </header>

          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {/* Progress indicator */}
              <div className="rounded-lg p-5 mb-6" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                <div className="flex items-center justify-center gap-4">
                  <PhaseIndicator name="PM Questions" status={pmStatus} phaseType="pm" />
                  <ConnectorLine complete={pmStatus === 'complete'} />
                  <PhaseIndicator name="Design Questions" status={uxStatus} phaseType="ux" />
                  <ConnectorLine complete={uxStatus === 'complete'} />
                  <PhaseIndicator name="Engineer Questions" status={engineerStatus} phaseType="engineer" />
                  <ConnectorLine complete={engineerStatus === 'complete'} />
                  <PhaseIndicator name="Documents" status={docsStatus} phaseType="documents" />
                </div>
              </div>

              {/* Automation Sending State - Full card while sending */}
              {automationStatus === 'sending' && (
                <div className="rounded-lg p-6 mb-6 text-center" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                  <div className="flex justify-center mb-4">
                    <div 
                      className="w-12 h-12 rounded-full animate-spin"
                      style={{ 
                        borderWidth: '3px',
                        borderColor: 'hsl(0 0% 92%)',
                        borderTopColor: 'hsl(235 69% 61%)'
                      }}
                    />
                  </div>
                  <p className="text-[14px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>
                    Sending to {activeToolName}...
                  </p>
                </div>
              )}
              
              {/* Automation Success Banner - Compact banner at top */}
              {automationStatus === 'sent' && (
                <div 
                  className="rounded-lg p-4 mb-6 flex items-center justify-center gap-3"
                  style={{ backgroundColor: 'hsl(142 76% 96%)', border: '1px solid hsl(142 76% 88%)' }}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'hsl(142 76% 90%)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="hsl(142 76% 36%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-medium" style={{ color: 'hsl(142 76% 30%)' }}>
                      {isHeadlessMode ? `Running via ${activeToolName}` : `Sent to ${activeToolName}!`}
                    </p>
                    <p className="text-[11px]" style={{ color: 'hsl(142 50% 40%)' }}>
                      {isHeadlessMode ? 'Executing in headless mode - no action needed' : 'Check your editor - the prompt is ready'}
                    </p>
                  </div>
                </div>
              )}

              {/* Automation Failed Status - Full card */}
              {automationStatus === 'failed' && (
                <div className="rounded-lg p-6 mb-6 text-center" style={{ backgroundColor: 'hsl(45 100% 96%)', border: '1px solid hsl(45 100% 88%)' }}>
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'hsl(45 100% 90%)' }}
                  >
                    <span className="text-2xl">📋</span>
                  </div>
                  <p className="text-[14px] font-medium mb-2" style={{ color: 'hsl(45 80% 25%)' }}>
                    {activeToolName} didn't open automatically
                  </p>
                  <p className="text-[12px] mb-4" style={{ color: 'hsl(45 60% 35%)' }}>
                    Copy the prompt and paste it manually
                  </p>
                  {lastPrompt && <CopyPromptButton prompt={lastPrompt} />}
                </div>
              )}

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
                    {phaseInfo.agent === 'Product Manager' && <ProductManagerIcon />}
                    {phaseInfo.agent === 'Designer' && <DesignerIcon />}
                    {phaseInfo.agent === 'Engineer' && <EngineerIcon />}
                    {phaseInfo.agent === 'All Agents' && (
                      <div className="flex items-center justify-center gap-0.5" style={{ transform: 'scale(0.7)' }}>
                        <ProductManagerIcon />
                        <DesignerIcon />
                        <EngineerIcon />
                      </div>
                    )}
                    {!['Product Manager', 'Designer', 'Engineer', 'All Agents'].includes(phaseInfo.agent) && (
                      <div className="linear-spinner" style={{ width: '24px', height: '24px' }}></div>
                    )}
                  </div>
                </div>
                
                <h2 className="text-[18px] font-semibold mb-2 relative" style={{ color: 'hsl(0 0% 9%)' }}>
                  {phaseInfo.agent} {phaseInfo.agent === 'All Agents' ? 'are' : 'is'} working...
                </h2>
                <p className="text-[14px] font-medium mb-1 relative" style={{ color: 'hsl(235 69% 61%)' }}>
                  {phaseInfo.action}
                </p>
                <p className="text-[13px] mb-2 relative" style={{ color: 'hsl(0 0% 46%)' }}>
                  {phaseInfo.description}
                </p>
                {triggeringPhase?.includes('questions-generate') && (
                  <p className="text-[12px] mb-4 relative" style={{ color: 'hsl(0 0% 62%)', fontStyle: 'italic' }}>
                    This may take a few minutes — your agent is reviewing the entire codebase to ask the most relevant questions.
                  </p>
                )}
                {!triggeringPhase?.includes('questions-generate') && <div className="mb-2" />}

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
                
                {/* Documents being generated - per-agent cards for docs-generate, pills for others */}
                {triggeringPhase === 'docs-generate' ? (() => {
                  const agents = [
                    { key: 'pm' as const, icon: <ProductManagerIcon />, agent: 'Product Manager' },
                    { key: 'ux' as const, icon: <DesignerIcon />, agent: 'Designer' },
                    { key: 'engineer' as const, icon: <EngineerIcon />, agent: 'Engineer' },
                  ];
                  const completedCount = agents.filter(a => status?.docsProgress?.[a.key]?.status === 'complete').length;
                  return (
                    <div className="relative w-full max-w-lg mx-auto">
                      <p className="text-[12px] font-medium mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                        {completedCount === 3
                          ? 'All documents generated'
                          : `${completedCount} of 3 agents complete`}
                      </p>
                      <div className="space-y-3">
                        {agents.map((a) => {
                          const agentProgress = status?.docsProgress?.[a.key];
                          const agentStatus = agentProgress?.status || 'ai-working';
                          const isAgentComplete = agentStatus === 'complete';
                          const files = agentProgress?.files || [];
                          const logs = agentLogs[a.key] || [];
                          const isExpanded = agentActiveTab === a.key;
                          const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
                          return (
                            <div
                              key={a.key}
                              className="rounded-lg overflow-hidden transition-all"
                              style={{
                                backgroundColor: isAgentComplete ? 'hsl(142 76% 97%)' : 'hsl(0 0% 99%)',
                                border: `1px solid ${isAgentComplete ? 'hsl(142 76% 88%)' : 'hsl(0 0% 90%)'}`,
                              }}
                            >
                              {/* Agent header — clickable to expand/collapse streaming */}
                              <button
                                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                                onClick={() => setAgentActiveTab(isExpanded ? '' : a.key)}
                              >
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{
                                    backgroundColor: isAgentComplete ? 'hsl(142 76% 90%)' : 'hsl(235 69% 93%)',
                                    color: isAgentComplete ? 'hsl(142 76% 30%)' : 'hsl(235 69% 50%)',
                                  }}
                                >
                                  {a.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 20%)' }}>
                                    {a.agent}
                                  </p>
                                  {/* Last streaming message preview (when collapsed and working) */}
                                  {!isExpanded && !isAgentComplete && lastLog && (
                                    <p className="text-[10px] font-mono truncate" style={{ color: 'hsl(0 0% 55%)' }}>
                                      {lastLog.icon} {lastLog.message}
                                    </p>
                                  )}
                                </div>
                                <div className="flex-shrink-0">
                                  {isAgentComplete ? (
                                    <div className="flex items-center gap-1.5" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                        <path d="M3 8L6.5 11.5L13 5" stroke="hsl(142 76% 36%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      <span className="text-[11px] font-medium" style={{ color: 'hsl(142 76% 30%)' }}>Done</span>
                                    </div>
                                  ) : (
                                    <div className="linear-spinner" style={{ width: '16px', height: '16px' }}></div>
                                  )}
                                </div>
                              </button>

                              {/* Per-file progress */}
                              {files.length > 0 && (
                                <div className="px-4 pb-2" style={{ borderTop: `1px solid ${isAgentComplete ? 'hsl(142 76% 90%)' : 'hsl(0 0% 93%)'}` }}>
                                  <div className="pt-2 space-y-1">
                                    {files.map((file) => (
                                      <div key={file.name} className="flex items-center gap-2">
                                        {file.complete ? (
                                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                                            <path d="M3 8L6.5 11.5L13 5" stroke="hsl(142 76% 36%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                        ) : (
                                          <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(0 0% 70%)' }}></div>
                                          </div>
                                        )}
                                        <span className="text-[11px]" style={{ color: file.complete ? 'hsl(142 76% 30%)' : 'hsl(0 0% 50%)' }}>
                                          {file.label}
                                        </span>
                                        <span className="text-[10px] font-mono" style={{ color: 'hsl(0 0% 70%)' }}>
                                          {file.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Expandable streaming log */}
                              {isExpanded && !isAgentComplete && logs.length > 0 && (
                                <div
                                  className="overflow-hidden text-left"
                                  style={{ backgroundColor: 'hsl(220 13% 10%)', borderTop: '1px solid hsl(220 13% 20%)' }}
                                >
                                  <div
                                    className="p-3 max-h-[140px] overflow-y-auto"
                                    style={{ scrollBehavior: 'smooth' }}
                                    ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                                  >
                                    <div className="space-y-1">
                                      {logs.slice(-20).map((log, index, arr) => (
                                        <div
                                          key={log.id}
                                          className="flex items-start gap-2"
                                          style={{
                                            opacity: index === arr.length - 1 ? 1 : 0.6,
                                            animation: 'fadeIn 0.2s ease-out'
                                          }}
                                        >
                                          <span className="text-[11px] flex-shrink-0 w-4 text-center">{log.icon}</span>
                                          <span className="text-[11px] font-mono leading-relaxed" style={{ color: 'hsl(220 10% 75%)' }}>
                                            {log.message}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })() : (() => {
                  const getDocumentsForPhase = () => {
                    switch (triggeringPhase) {
                      case 'pm-questions-generate':
                        return ['pm_questions.json'];
                      case 'pm-prd-generate':
                        return ['prd.md', 'acceptance_criteria.json'];
                      case 'ux-questions-generate':
                        return ['ux_questions.json'];
                      case 'ux-design-brief-generate':
                        return ['design_brief.md', 'screens.json'];
                      case 'engineer-questions-generate':
                        return ['engineer_questions.json'];
                      case 'engineer-spec-generate':
                        return ['technical_specification.md', 'technology_choices.json'];
                      default:
                        return ['document'];
                    }
                  };
                  const documents = getDocumentsForPhase();
                  return (
                    <div className="flex flex-wrap justify-center gap-2 relative">
                      {documents.map((doc) => (
                        <div
                          key={doc}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                          style={{ backgroundColor: 'hsl(235 69% 97%)', border: '1px solid hsl(235 69% 90%)' }}
                        >
                          <div className="linear-spinner" style={{ width: '14px', height: '14px' }}></div>
                          <span className="text-[12px] font-mono font-medium" style={{ color: 'hsl(235 69% 50%)' }}>
                            {doc}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Headless Streaming Log Display (single-agent mode only, not docs-generate) */}
                {triggeringPhase !== 'docs-generate' && isHeadlessMode && headlessLogs.length > 0 && (
                  <div
                    className="rounded-lg mt-6 overflow-hidden text-left relative"
                    style={{ backgroundColor: 'hsl(220 13% 10%)', border: '1px solid hsl(220 13% 20%)' }}
                  >
                    <div
                      className="px-4 py-2 flex items-center gap-2"
                      style={{ backgroundColor: 'hsl(220 13% 14%)', borderBottom: '1px solid hsl(220 13% 20%)' }}
                    >
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(142 76% 46%)' }} />
                      <span className="text-[11px] font-medium" style={{ color: 'hsl(220 10% 60%)' }}>
                        {activeToolName}
                      </span>
                    </div>
                    <div
                      className="p-3 max-h-[200px] overflow-y-auto"
                      style={{ scrollBehavior: 'smooth' }}
                      ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                    >
                      <div className="space-y-1.5">
                        {headlessLogs.map((log, index) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-2 animate-fadeIn"
                            style={{
                              opacity: index === headlessLogs.length - 1 ? 1 : 0.7,
                              animation: 'fadeIn 0.2s ease-out'
                            }}
                          >
                            <span className="text-[12px] flex-shrink-0 w-5 text-center">{log.icon}</span>
                            <span
                              className="text-[12px] font-mono leading-relaxed"
                              style={{ color: 'hsl(220 10% 75%)' }}
                            >
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

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
                  @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>

                <p className="text-[11px] mt-4 relative" style={{ color: 'hsl(0 0% 60%)' }}>
                  {isHeadlessMode ? `${activeToolName} is executing the task automatically.` : 'This may take a minute. The page will update automatically.'}
                </p>

                {/* Cancel button */}
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="relative mt-4 px-4 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                  style={{
                    color: 'hsl(0 0% 46%)',
                    backgroundColor: 'transparent',
                    border: '1px solid hsl(0 0% 88%)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(0 72% 97%)';
                    e.currentTarget.style.borderColor = 'hsl(0 72% 80%)';
                    e.currentTarget.style.color = 'hsl(0 72% 45%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'hsl(0 0% 88%)';
                    e.currentTarget.style.color = 'hsl(0 0% 46%)';
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel'}
                </button>

                {lastPrompt && (
                  <div className="mt-6 pt-6" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                    <p className="text-[12px] mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                      If {activeToolName} didn't open correctly:
                    </p>
                    <CopyPromptButton prompt={lastPrompt} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Document Review state
  if (status.needsReview && status.reviewDocument) {
    const getDocumentType = (): 'prd' | 'design' | 'tech-spec' | 'technology-choices' | 'wireframes' => {
      if (status.reviewDocument?.includes('prd')) return 'prd';
      if (status.reviewDocument?.includes('design_brief')) return 'design';
      if (status.reviewDocument?.includes('ux_designer_wireframes')) return 'wireframes';
      if (status.reviewDocument?.includes('technology_choices')) return 'technology-choices';
      if (status.reviewDocument?.includes('technical_specification')) return 'tech-spec';
      return 'prd';
    };
    
    if (loadingDocument) {
      return (
        <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="linear-spinner"></div>
              <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Loading document...</span>
            </div>
          </main>
        </div>
      );
    }
    
    // Determine current agent for session lookup
    const getCurrentAgent = (): 'pm' | 'ux' | 'engineer' => {
      if (status.currentPhase.startsWith('pm-')) return 'pm';
      if (status.currentPhase.startsWith('ux-')) return 'ux';
      return 'engineer';
    };
    const currentAgent = getCurrentAgent();
    const currentSessionId = sessions[currentAgent];

    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1">
          <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-[13px] no-underline hover:underline transition-colors"
                style={{ color: 'hsl(0 0% 46%)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(0 0% 20%)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 46%)'; }}
              >
                Specification
              </Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <Link
                to={`/project/${projectId}`}
                className="text-[13px] font-medium no-underline hover:underline transition-colors"
                style={{ color: 'hsl(0 0% 9%)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(235 69% 50%)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 9%)'; }}
              >
                {projectId}
              </Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Review</span>
            </div>
          </header>

          <div className="p-6">
            {/* Main content - full width without flex squeeze */}
            <div className="max-w-4xl">
              <DocumentReview
                projectId={projectId!}
                documentPath={status.reviewDocument}
                documentContent={reviewDocumentContent}
                documentType={getDocumentType()}
                onApprove={handleApproveDocument}
                isBreakdownComplete={hasTasks}
                sessionId={currentSessionId}
                phase={currentAgent}
                onRefineComplete={() => {
                  // Refresh sessions after refinement
                  fetch(`/api/sessions/${projectId}`)
                    .then(res => res.json())
                    .then(data => {
                      if (data.sessions) setSessions(data.sessions);
                    })
                    .catch(() => {});
                  // Reload the document
                  if (status.reviewDocument) {
                    fetchDocumentForReview(status.reviewDocument);
                  }
                }}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Question Form state
  if (showQuestionForm && questionPhase && projectId) {
    return (
      <QuestionForm
        projectId={projectId}
        phase={questionPhase}
        onComplete={() => fetchStatus()}
        onCancel={() => navigate('/')}
      />
    );
  }

  // Ready to Generate state
  if (!triggeringPhase && !status.needsReview && !showQuestionForm && nextActionPhase) {
    const info = getReadyInfo(nextActionPhase);

    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1">
          <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-[13px] no-underline hover:underline transition-colors"
                style={{ color: 'hsl(0 0% 46%)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(0 0% 20%)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 46%)'; }}
              >
                Specification
              </Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <Link
                to={`/project/${projectId}`}
                className="text-[13px] font-medium no-underline hover:underline transition-colors"
                style={{ color: 'hsl(0 0% 9%)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(235 69% 50%)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 9%)'; }}
              >
                {projectId}
              </Link>
            </div>
          </header>

          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {/* Progress indicator */}
              <div className="rounded-lg p-5 mb-6" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                <div className="flex items-center justify-center gap-4">
                  <PhaseIndicator name="PM Questions" status={pmStatus} phaseType="pm" />
                  <ConnectorLine complete={pmStatus === 'complete'} />
                  <PhaseIndicator name="Design Questions" status={uxStatus} phaseType="ux" />
                  <ConnectorLine complete={uxStatus === 'complete'} />
                  <PhaseIndicator name="Engineer Questions" status={engineerStatus} phaseType="engineer" />
                  <ConnectorLine complete={engineerStatus === 'complete'} />
                  <PhaseIndicator name="Documents" status={docsStatus} phaseType="documents" />
                </div>
              </div>

              {/* Ready card */}
              <div className="rounded-lg p-6" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                <h2 className="text-[17px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                  {info.title}
                </h2>
                <p className="text-[13px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
                  {info.description}
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <AIActionSplitButton
                    label={info.buttonText}
                    onRun={(toolOverride) => triggerPhase(nextActionPhase, toolOverride)}
                  />
                  
                  <button
                    onClick={() => navigate('/')}
                    className="px-5 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                    style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 32%)', border: '1px solid hsl(0 0% 90%)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="rounded-md p-4 mt-4" style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}>
                  <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>{error}</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Default/Complete state
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      <Sidebar />
      <main className="flex-1">
        <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-[13px] no-underline hover:underline transition-colors"
              style={{ color: 'hsl(0 0% 46%)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(0 0% 20%)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 46%)'; }}
            >
              Specification
            </Link>
            <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
            <Link
              to={`/project/${projectId}`}
              className="text-[13px] font-medium no-underline hover:underline transition-colors"
              style={{ color: 'hsl(0 0% 9%)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(235 69% 50%)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(0 0% 9%)'; }}
            >
              {projectId}
            </Link>
          </div>
        </header>

        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Progress indicator */}
            <div className="rounded-lg p-5 mb-6" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
              <div className="flex items-center justify-center gap-4">
                <PhaseIndicator name="Product Manager" status={pmStatus} phaseType="pm" />
                <ConnectorLine complete={pmStatus === 'complete'} />
                <PhaseIndicator name="Designer" status={uxStatus} phaseType="ux" />
                <ConnectorLine complete={uxStatus === 'complete'} />
                <PhaseIndicator name="Engineer" status={engineerStatus} phaseType="engineer" />
              </div>
            </div>

            {/* Issue Creation */}
            {status.isComplete && !hasTasks && !breakingDown && (
              <div className="rounded-lg p-6" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                <h2 className="text-[17px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                  Create Implementation Issues
                </h2>
                <p className="text-[13px] mb-4" style={{ color: 'hsl(0 0% 46%)' }}>
                  SpecWright will analyze your specification and break it down into actionable implementation issues.
                </p>
                
                <div className="p-4 rounded-md mb-5" style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: 'hsl(0 0% 32%)' }}>This will create:</p>
                  <ul className="text-[12px] space-y-1" style={{ color: 'hsl(0 0% 46%)' }}>
                    <li>• Individual implementation issues (ENG-001, ENG-002, etc.)</li>
                    <li>• Task dependencies and complexity estimates</li>
                    <li>• Acceptance criteria for each task</li>
                  </ul>
                </div>
                
                <div className="flex gap-3">
                  <AIActionSplitButton
                    label="Generate Issues"
                    onRun={triggerBreakdown}
                    fullWidth
                    className="flex-1"
                  />
                  <button
                    onClick={() => navigate(`/project/${projectId}`)}
                    className="px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                    style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 32%)', border: '1px solid hsl(0 0% 90%)' }}
                  >
                    View Project
                  </button>
                </div>
              </div>
            )}

            {/* Breakdown in Progress */}
            {status.isComplete && breakingDown && (
              <div className="rounded-lg p-6 text-center relative overflow-hidden" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                {/* Animated background gradient */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'radial-gradient(circle at 50% 0%, hsl(235 69% 61% / 0.15) 0%, transparent 50%)',
                    animation: 'pulse 3s ease-in-out infinite'
                  }}
                />

                {/* Agent icon with animated rings */}
                <div className="relative mx-auto mb-6" style={{ width: '80px', height: '80px' }}>
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
                      inset: '8px',
                      border: '2px solid hsl(235 69% 61% / 0.3)',
                      animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s'
                    }}
                  />
                  {/* Inner icon container */}
                  <div
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                      inset: '16px',
                      backgroundColor: 'hsl(235 69% 61%)',
                      color: 'white',
                      boxShadow: '0 4px 20px hsl(235 69% 61% / 0.4)'
                    }}
                  >
                    <IssuesIcon />
                  </div>
                </div>

                <h2 className="text-[17px] font-semibold mb-2 relative" style={{ color: 'hsl(0 0% 9%)' }}>
                  Generating Issues...
                </h2>
                <p className="text-[13px] mb-4 relative" style={{ color: 'hsl(0 0% 46%)' }}>
                  Breaking down the specification into implementation tasks
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
                <div className="flex justify-center gap-2 relative mb-4">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{ backgroundColor: 'hsl(235 69% 97%)', border: '1px solid hsl(235 69% 90%)' }}
                  >
                    <div className="linear-spinner" style={{ width: '14px', height: '14px' }}></div>
                    <span className="text-[12px] font-mono font-medium" style={{ color: 'hsl(235 69% 50%)' }}>
                      issues.json
                    </span>
                  </div>
                </div>

                {/* Headless Streaming Log Display */}
                {isHeadlessMode && headlessLogs.length > 0 && (
                  <div
                    className="rounded-lg mt-4 overflow-hidden text-left relative"
                    style={{ backgroundColor: 'hsl(220 13% 10%)', border: '1px solid hsl(220 13% 20%)' }}
                  >
                    {/* Header */}
                    <div
                      className="px-4 py-2 flex items-center gap-2"
                      style={{ backgroundColor: 'hsl(220 13% 14%)', borderBottom: '1px solid hsl(220 13% 20%)' }}
                    >
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(142 76% 46%)' }} />
                      <span className="text-[11px] font-medium" style={{ color: 'hsl(220 10% 60%)' }}>
                        {activeToolName}
                      </span>
                    </div>
                    {/* Log entries */}
                    <div
                      className="p-3 max-h-[200px] overflow-y-auto"
                      style={{ scrollBehavior: 'smooth' }}
                      ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                    >
                      <div className="space-y-1.5">
                        {headlessLogs.map((log, index) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-2 animate-fadeIn"
                            style={{
                              opacity: index === headlessLogs.length - 1 ? 1 : 0.7,
                              animation: 'fadeIn 0.2s ease-out'
                            }}
                          >
                            <span className="text-[12px] flex-shrink-0 w-5 text-center">{log.icon}</span>
                            <span
                              className="text-[12px] font-mono leading-relaxed"
                              style={{ color: 'hsl(220 10% 75%)' }}
                            >
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

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
                  @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>

                <p className="text-[11px] mt-4 relative" style={{ color: 'hsl(0 0% 60%)' }}>
                  {isHeadlessMode ? `${activeToolName} is executing the task automatically.` : 'This typically takes 2-3 minutes.'}
                </p>

                {/* Cancel button */}
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="relative mt-4 px-4 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                  style={{
                    color: 'hsl(0 0% 46%)',
                    backgroundColor: 'transparent',
                    border: '1px solid hsl(0 0% 88%)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(0 72% 97%)';
                    e.currentTarget.style.borderColor = 'hsl(0 72% 80%)';
                    e.currentTarget.style.color = 'hsl(0 72% 45%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'hsl(0 0% 88%)';
                    e.currentTarget.style.color = 'hsl(0 0% 46%)';
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            )}

            {/* Complete with Tasks */}
            {status.isComplete && hasTasks && (
              <div className="rounded-lg p-6" style={{ backgroundColor: 'hsl(142 76% 97%)', border: '1px solid hsl(142 76% 90%)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                  >
                    <CheckIcon />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                      Specification Complete
                    </h2>
                    <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                      {taskCount} implementation issues created
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/issues')}
                    className="flex-1 px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                    style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                  >
                    View Issues Board
                  </button>
                  <button
                    onClick={() => navigate(`/project/${projectId}`)}
                    className="px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                    style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 32%)', border: '1px solid hsl(0 0% 90%)' }}
                  >
                    Project Details
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md p-4 mt-4" style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}>
                <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>{error}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
