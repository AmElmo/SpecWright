import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import { useRealtimeUpdates, type WebSocketEvent } from '@/lib/use-realtime';
import { useAIToolName, type AITool } from '@/lib/use-ai-tool';
import { RefinePanel } from './RefinePanel';
import { AIActionSplitButton } from './AIActionSplitButton';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

type BreakdownLevel = 'one-shot' | 'few' | 'moderate' | 'detailed';
type BreakdownState = 'select' | 'generating' | 'preview';

// Issue type from issues.json
interface Issue {
  issue_id: string;
  title: string;
  status: string;
  estimated_hours?: number;
  description: string;
  acceptance_criteria?: string[];
  dependencies?: string[];
}

// Icons
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

const ProjectsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IssueBreakdownIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13 3V8C13 8.55228 13.4477 9 14 9H19" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

// Sidebar component
const Sidebar = () => (
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
  </aside>
);

export function Breakdown() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const aiToolName = useAIToolName();

  const [breakdownLevel, setBreakdownLevel] = useState<BreakdownLevel>('moderate');
  const [showTooltip, setShowTooltip] = useState(false);
  const [breakdownState, setBreakdownState] = useState<BreakdownState>('select');
  const [error, setError] = useState<string>('');
  const [issueCount, setIssueCount] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Computed state for backward compatibility
  const creatingIssues = breakdownState === 'generating';
  
  // Use realtime hook to listen for file changes and headless events
  useRealtimeUpdates((event: WebSocketEvent) => {
    logger.debug('\n🔔 [Frontend] Realtime update received from WebSocket');

    // Capture session ID from headless completion
    if (event.type === 'headless_completed' && event.sessionId) {
      setSessionId(event.sessionId);
    }

    // Check if breakdown completed
    if (creatingIssues) {
      checkBreakdownStatus();
    }
  });
  
  // Poll for breakdown completion
  useEffect(() => {
    if (creatingIssues) {
      const interval = setInterval(() => {
        checkBreakdownStatus();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [creatingIssues]);
  
  const checkBreakdownStatus = async () => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/specification/breakdown-status/${projectId}`);
      if (!response.ok) return;

      const data = await response.json();

      if (data.isComplete && data.issueCount > 0) {
        // Breakdown complete! Transition to preview state
        setIssueCount(data.issueCount);

        // Fetch the generated issues for preview
        await fetchIssues();

        // Transition to preview state
        setBreakdownState('preview');
      }
    } catch (err) {
      logger.error('Error checking breakdown status:', err);
    }
  };

  const fetchIssues = async () => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/specification/document/${projectId}/issues/issues.json`);
      if (response.ok) {
        const data = await response.json();
        const content = JSON.parse(data.content);
        setIssues(content.issues || []);
      }
    } catch (err) {
      logger.error('Error fetching issues:', err);
    }
  };

  const handleConfirmIssues = () => {
    // Navigate to issues page with project filter
    const numericId = projectId?.split('-')[0] || projectId;
    window.open(`/issues?project=${numericId}`, '_blank');
  };
  
  const handleCreateIssues = async (toolOverride?: AITool) => {
    if (!projectId) return;

    try {
      setBreakdownState('generating');
      setError('');

      const response = await fetch(`/api/specification/breakdown/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          breakdownLevel,
          ...(toolOverride ? { aiTool: toolOverride } : {})
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || data.error || 'Failed to create issues');
        setBreakdownState('select');
        return;
      }

      // Handle one-shot: instant issue creation, go directly to issues
      if (data.isOneShot) {
        setIssueCount(data.issueCount || 1);
        // Navigate to issues page with project filter
        const numericId = projectId?.split('-')[0] || projectId;
        window.open(`/issues?project=${numericId}`, '_blank');
        setBreakdownState('select');
        return;
      }

      // Keep generating state for AI breakdown - will be transitioned by checkBreakdownStatus
    } catch (err) {
      setError('Failed to create issues');
      setBreakdownState('select');
      logger.error(err);
    }
  };
  
  const getBreakdownDescription = (level: BreakdownLevel) => {
    switch (level) {
      case 'one-shot':
        return {
          title: '⚡ One-Shot',
          subtitle: '1 issue',
          description: 'Implement entire spec as a single issue',
          whatHappens: [
            'Issue created instantly (no AI wait)',
            'References all spec documents',
            'Best for simple features or quick iterations',
            'Start coding immediately'
          ]
        };
      case 'few':
        return {
          title: '⚡️ Few Issues',
          subtitle: '2-3 issues',
          description: 'High-level milestones for rapid iteration',
          whatHappens: [
            `${aiToolName} opens with a prompt`,
            'AI analyzes the technical spec',
            'Creates 2-3 broad implementation issues',
            'Each issue covers major feature areas',
            'Best for small projects or MVPs'
          ]
        };
      case 'moderate':
        return {
          title: '⚖️ Moderate Breakdown',
          subtitle: '4-6 issues',
          description: 'Balanced detail for most projects',
          whatHappens: [
            `${aiToolName} opens with a prompt`,
            'AI analyzes the technical spec',
            'Creates 4-6 well-scoped issues',
            'Good balance of detail and manageability',
            'Recommended for typical features'
          ]
        };
      case 'detailed':
        return {
          title: '🔬 Detailed Breakdown',
          subtitle: '6-10+ issues',
          description: 'Granular issues for complex projects',
          whatHappens: [
            `${aiToolName} opens with a prompt`,
            'AI analyzes the technical spec',
            'Creates 6-10+ detailed issues',
            'Each issue is a small, focused task',
            'Best for complex features or team collaboration'
          ]
        };
    }
  };
  
  const info = getBreakdownDescription(breakdownLevel);
  
  // Show creating overlay when issues are being created - now with light theme
  if (creatingIssues) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1">
          <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
            <div className="flex items-center gap-2">
              <Link to="/" className="text-[13px] no-underline" style={{ color: 'hsl(0 0% 46%)' }}>Projects</Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>{projectId}</span>
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
                  This may take a minute. The page will redirect automatically when complete.
                </p>
                
                {issueCount > 0 && (
                  <p className="text-[13px] mt-4 relative" style={{ color: 'hsl(142 76% 36%)' }}>
                    ✓ Created {issueCount} issues. Loading preview...
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Preview state - show generated issues with RefinePanel
  if (breakdownState === 'preview') {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1">
          <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
            <div className="flex items-center gap-2">
              <Link to="/" className="text-[13px] no-underline" style={{ color: 'hsl(0 0% 46%)' }}>Projects</Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <Link to={`/project/${projectId}`} className="text-[13px] no-underline" style={{ color: 'hsl(0 0% 46%)' }}>{projectId}</Link>
              <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
              <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>Review Issues</span>
            </div>
          </header>

          <div className="p-6">
            {/* Main content - full width without flex squeeze */}
            <div className="max-w-4xl">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'hsl(142 76% 94%)', color: 'hsl(142 76% 36%)' }}
                    >
                      ✓
                    </div>
                    <div>
                      <h1 className="text-[20px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                        {issueCount} Issues Generated
                      </h1>
                      <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                        Review the proposed issues before confirming
                      </p>
                    </div>
                  </div>
                </div>

                {/* Issue cards */}
                <div className="space-y-3 mb-6">
                  {issues.map((issue, index) => (
                    <div
                      key={issue.issue_id}
                      className="rounded-lg p-4"
                      style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ backgroundColor: 'hsl(235 69% 97%)', color: 'hsl(235 69% 50%)' }}
                        >
                          #{index + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="text-[14px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                            {issue.title}
                          </h3>
                          <p className="text-[12px] mb-2" style={{ color: 'hsl(0 0% 46%)' }}>
                            {issue.description}
                          </p>
                          {issue.acceptance_criteria && issue.acceptance_criteria.length > 0 && (
                            <div>
                              <p className="text-[11px] font-medium mb-1" style={{ color: 'hsl(0 0% 32%)' }}>
                                Acceptance Criteria:
                              </p>
                              <ul className="space-y-0.5">
                                {issue.acceptance_criteria.slice(0, 3).map((criteria, i) => (
                                  <li key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: 'hsl(0 0% 46%)' }}>
                                    <span style={{ color: 'hsl(142 76% 36%)' }}>✓</span>
                                    {criteria}
                                  </li>
                                ))}
                                {issue.acceptance_criteria.length > 3 && (
                                  <li className="text-[11px]" style={{ color: 'hsl(0 0% 60%)' }}>
                                    +{issue.acceptance_criteria.length - 3} more...
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Confirm button */}
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmIssues}
                    className="flex-1 px-4 py-3 rounded-md text-[14px] font-medium transition-colors"
                    style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(142 76% 30%)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'hsl(142 76% 36%)'; }}
                  >
                    ✅ Confirm & View Issues
                  </button>
                  <button
                    onClick={() => setBreakdownState('select')}
                    className="px-4 py-3 rounded-md text-[13px] font-medium transition-colors"
                    style={{
                      backgroundColor: 'transparent',
                      color: 'hsl(0 0% 32%)',
                      border: '1px solid hsl(0 0% 90%)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Start Over
                  </button>
                </div>
            </div>

            {/* Floating RefinePanel - Right Margin */}
            {sessionId && (
              <RefinePanel
                phase="breakdown"
                projectId={projectId}
                sessionId={sessionId}
                floatingMode={true}
                onRefineComplete={() => {
                  // Refresh issues after refinement
                  fetchIssues();
                }}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  // Select state - default
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      <Sidebar />
      <main className="flex-1">
        <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-[13px] no-underline" style={{ color: 'hsl(0 0% 46%)' }}>Projects</Link>
            <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
            <Link to={`/project/${projectId}`} className="text-[13px] no-underline" style={{ color: 'hsl(0 0% 46%)' }}>{projectId}</Link>
            <span style={{ color: 'hsl(0 0% 80%)' }}>/</span>
            <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 9%)' }}>Create Issues</span>
          </div>
        </header>
        
        <div className="p-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-[20px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                Create Implementation Issues
              </h1>
              <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                Choose how you want to break down the work into implementation issues
              </p>
            </div>
            
            {/* Error Display */}
            {error && (
              <div 
                className="rounded-md p-4 mb-6"
                style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}
              >
                <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>⚠️ {error}</p>
              </div>
            )}
            
            {/* Breakdown Level Selector */}
            <div className="rounded-lg p-6 mb-4" style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                  Select Breakdown Level
                </h3>
                {/* Tooltip Icon */}
                <div 
                  className="relative inline-block"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold cursor-help"
                    style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                  >
                    ?
                  </div>
                  {/* Tooltip Content */}
                  {showTooltip && (
                    <div 
                      className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-72 rounded-lg p-4 shadow-lg"
                      style={{ backgroundColor: 'hsl(0 0% 9%)', color: 'white' }}
                    >
                      <div className="font-semibold mb-2 text-[12px]">What Happens Next:</div>
                      <ul className="space-y-1">
                        {info.whatHappens.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-[11px]">
                            <span style={{ color: 'hsl(235 69% 70%)' }}>{index + 1}.</span>
                            <span style={{ color: 'hsl(0 0% 80%)' }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                      {/* Arrow pointing to the icon */}
                      <div className="absolute right-full top-1/2 -translate-y-1/2">
                        <div style={{ borderWidth: '8px', borderStyle: 'solid', borderColor: 'transparent hsl(0 0% 9%) transparent transparent' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Breakdown Level Options */}
              <div className="space-y-2 mb-6">
                {(['one-shot', 'few', 'moderate', 'detailed'] as BreakdownLevel[]).map((level) => {
                  const desc = getBreakdownDescription(level);
                  const isSelected = breakdownLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setBreakdownLevel(level)}
                      className="w-full text-left p-4 rounded-lg transition-all"
                      style={{
                        backgroundColor: isSelected ? 'hsl(235 69% 97%)' : 'hsl(0 0% 100%)',
                        border: isSelected ? '2px solid hsl(235 69% 61%)' : '1px solid hsl(0 0% 92%)'
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[13px] font-semibold mb-0.5" style={{ color: 'hsl(0 0% 9%)' }}>
                            {desc.title}
                            {level === 'moderate' && (
                              <span className="text-[11px] font-medium ml-2" style={{ color: 'hsl(235 69% 61%)' }}>(Recommended)</span>
                            )}
                          </div>
                          <div className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                            {desc.subtitle}
                          </div>
                          <div className="text-[11px] mt-1" style={{ color: 'hsl(0 0% 60%)' }}>
                            {desc.description}
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ color: 'hsl(235 69% 61%)' }}>
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <AIActionSplitButton
                label="Create Issues Now"
                onRun={handleCreateIssues}
                fullWidth
              />
            </div>
            
            <button
              onClick={() => navigate(`/project/${projectId}`)}
              className="w-full px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors"
              style={{ 
                backgroundColor: 'transparent', 
                color: 'hsl(0 0% 32%)', 
                border: '1px solid hsl(0 0% 90%)' 
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
