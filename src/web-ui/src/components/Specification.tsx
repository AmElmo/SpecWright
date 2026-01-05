import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { useRealtimeUpdates } from '../lib/use-realtime';
import { useAIToolName } from '../lib/use-ai-tool';
import { QuestionForm } from './QuestionForm';
import { DocumentReview } from './DocumentReview';
import { CostWidget } from './CostWidget';
import { RefinePanel } from './RefinePanel';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

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
  
  const showQuestionForm = status?.currentPhase === 'pm-questions-answer' || 
                           status?.currentPhase === 'ux-questions-answer' || 
                           status?.currentPhase === 'engineer-questions-answer';
  const questionPhase: 'pm' | 'ux' | 'engineer' | null = 
    status?.currentPhase === 'pm-questions-answer' ? 'pm' :
    status?.currentPhase === 'ux-questions-answer' ? 'ux' :
    status?.currentPhase === 'engineer-questions-answer' ? 'engineer' : null;
  
  useRealtimeUpdates(() => {
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
  
  const fetchStatus = async (skipDocumentReload = false) => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/specification/status/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      
      setStatus(data);
      setError('');
      
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
      }
    } catch (err) {
      logger.error('Error checking breakdown status:', err);
    }
  };
  
  const triggerBreakdown = async () => {
    if (!projectId) return;
    
    try {
      setBreakingDown(true);
      setError('');
      
      const response = await fetch(`/api/specification/breakdown/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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
      } else if (triggeringPhase === 'pm-prd-generate' && (data.currentPhase === 'pm-prd-review' || data.phases.pm.complete)) {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'ux-questions-generate' && data.currentPhase === 'ux-questions-answer') {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'ux-design-brief-generate' && data.currentPhase === 'ux-design-brief-review') {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'ux-wireframes-generate' && (data.currentPhase === 'ux-wireframes-review' || data.phases.ux.complete)) {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'engineer-questions-generate' && data.currentPhase === 'engineer-questions-answer') {
        setTriggeringPhase(null);
      } else if (triggeringPhase === 'engineer-spec-generate' && (data.currentPhase === 'engineer-spec-review' || data.phases.engineer.complete)) {
        setTriggeringPhase(null);
      }
    } catch (err) {
      logger.error('Error checking work completion:', err);
    }
  };
  
  const triggerPhase = async (phase: string) => {
    if (!projectId) return;
    
    try {
      setTriggeringPhase(phase);
      setAutomationStatus('sending');
      setError('');
      
      const response = await fetch(`/api/specification/continue/${projectId}/${phase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.prompt) {
        setLastPrompt(data.prompt);
      }
      
      if (data.success) {
        // Automation succeeded - keep "sent" visible at the top
        setAutomationStatus('sent');
      } else {
        // Automation failed - show copy prompt button prominently
        setAutomationStatus('failed');
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
    
    if (phaseName === 'pm') {
      if (status.phases.pm.complete) return 'complete';
      if (status.currentPhase.startsWith('pm')) return 'in-progress';
      return 'pending';
    }
    
    if (phaseName === 'ux') {
      if (status.phases.ux.complete) return 'complete';
      if (status.currentPhase === 'ux') return 'in-progress';
      if (status.phases.pm.complete) return 'pending';
      return 'pending';
    }
    
    if (phaseName === 'engineer') {
      if (status.phases.engineer.complete) return 'complete';
      if (status.currentPhase === 'engineer') return 'in-progress';
      if (status.phases.pm.complete && status.phases.ux.complete) return 'pending';
      return 'pending';
    }
    
    return 'pending';
  };
  
  const getPhaseInfo = (phase: string) => {
    const phases: Record<string, { agent: string; action: string; description: string }> = {
      'pm-questions-generate': { agent: 'Product Manager', action: 'Generating Questions', description: 'Creating strategic questions about requirements' },
      'pm-prd-generate': { agent: 'Product Manager', action: 'Writing PRD', description: 'Creating the Product Requirements Document' },
      'ux-questions-generate': { agent: 'Designer', action: 'Generating Questions', description: 'Creating UX and design questions' },
      'ux-design-brief-generate': { agent: 'Designer', action: 'Creating Design Brief', description: 'Designing screens and user flows' },
      'engineer-questions-generate': { agent: 'Engineer', action: 'Generating Questions', description: 'Creating technical architecture questions' },
      'engineer-spec-generate': { agent: 'Engineer', action: 'Writing Tech Spec', description: 'Creating technical specification' },
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

  // Phase indicator component - keeps original icon, changes color when complete
  const PhaseIndicator = ({ name, status: phaseStatus, phaseType }: { name: string; status: PhaseStatus; phaseType: 'pm' | 'ux' | 'engineer' }) => {
    const getIcon = () => {
      // Always show the agent's icon, never replace with checkmark
      switch (phaseType) {
        case 'pm': return <ProductManagerIcon />;
        case 'ux': return <DesignerIcon />;
        case 'engineer': return <EngineerIcon />;
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

  // Sidebar component
  const Sidebar = () => {
    const mainNavItems = navItems.filter(item => item.label !== 'Settings');
    const settingsItem = navItems.find(item => item.label === 'Settings');
    
    return (
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
            {mainNavItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                  style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <settingsItem.icon />
                <span className="text-[13px] font-medium">{settingsItem.label}</span>
              </Link>
            </div>
          )}
        </div>
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
              <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Specification</span>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{projectId}</span>
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
                    Sending to {aiToolName}...
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
                      Sent to {aiToolName}!
                    </p>
                    <p className="text-[11px]" style={{ color: 'hsl(142 50% 40%)' }}>
                      Check your editor - the prompt is ready
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
                    {aiToolName} didn't open automatically
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
                    {!['Product Manager', 'Designer', 'Engineer'].includes(phaseInfo.agent) && (
                      <div className="linear-spinner" style={{ width: '24px', height: '24px' }}></div>
                    )}
                  </div>
                </div>
                
                <h2 className="text-[18px] font-semibold mb-2 relative" style={{ color: 'hsl(0 0% 9%)' }}>
                  {phaseInfo.agent} is working...
                </h2>
                <p className="text-[14px] font-medium mb-1 relative" style={{ color: 'hsl(235 69% 61%)' }}>
                  {phaseInfo.action}
                </p>
                <p className="text-[13px] mb-4 relative" style={{ color: 'hsl(0 0% 46%)' }}>
                  {phaseInfo.description}
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
                
                {/* Documents being generated - show all documents for each phase */}
                {(() => {
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
                      {documents.map((doc, index) => (
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
                
                <p className="text-[11px] mt-4" style={{ color: 'hsl(0 0% 60%)' }}>
                  This may take a minute. The page will update automatically.
                </p>
                
                {lastPrompt && (
                  <div className="mt-6 pt-6" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                    <p className="text-[12px] mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                      If {aiToolName} didn't open correctly:
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
              <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Specification</span>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{projectId}</span>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Review</span>
            </div>
          </header>

          <div className="p-6">
            <div className="flex gap-6">
              {/* Main content */}
              <div className="flex-1 max-w-4xl">
                <DocumentReview
                  projectId={projectId!}
                  documentPath={status.reviewDocument}
                  documentContent={reviewDocumentContent}
                  documentType={getDocumentType()}
                  onApprove={handleApproveDocument}
                />
              </div>

              {/* RefinePanel for feedback */}
              {currentSessionId && (
                <RefinePanel
                  phase={currentAgent}
                  sessionId={currentSessionId}
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
              )}
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
              <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Specification</span>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{projectId}</span>
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

              {/* Ready card */}
              <div className="rounded-lg p-6" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                <h2 className="text-[17px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                  {info.title}
                </h2>
                <p className="text-[13px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
                  {info.description}
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => triggerPhase(nextActionPhase)}
                    className="px-5 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                    style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)'; }}
                  >
                    {info.buttonText}
                  </button>
                  
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
            <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Specification</span>
            <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
            <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{projectId}</span>
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
                  <button
                    onClick={triggerBreakdown}
                    className="flex-1 px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                    style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                  >
                    Generate Issues
                  </button>
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
              <div className="rounded-lg p-6 text-center" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
                <div className="linear-spinner mx-auto mb-4" style={{ width: '28px', height: '28px' }}></div>
                <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                  Generating Issues...
                </h2>
                <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                  SpecWright is breaking down the specification into implementation tasks.
                </p>
                <p className="text-[11px] mt-3" style={{ color: 'hsl(0 0% 60%)' }}>
                  This typically takes 2-3 minutes.
                </p>
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
