import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import { useRealtimeUpdates } from '../lib/use-realtime';
import { useAIToolName, AI_TOOL_NAMES, type AITool } from '../lib/use-ai-tool';
import { getActionIcon } from '../lib/action-icons';
import { RefinePanel } from './RefinePanel';
import { AIActionSplitButton } from './AIActionSplitButton';

type ScopingStatus = 'ready' | 'classifying' | 'generating' | 'complete';

interface ScopingPlan {
  type: 'direct' | 'project' | 'multi-project';
  scope_analysis?: string;
  direct_work_suggestion?: string;
  projects?: any[];
}

// Log entry for streaming progress
interface HeadlessLogEntry {
  id: number;
  message: string;
  icon: string;
  timestamp: Date;
}

interface ScopingProps {
  prefillDescription?: string;
  embedded?: boolean; // If true, don't render page-level wrapper
  onStatusChange?: (status: ScopingStatus) => void; // Callback when status changes
}

export function Scoping({ prefillDescription, embedded = false, onStatusChange }: ScopingProps = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestFromUrl = searchParams.get('request') || '';
  const aiToolName = useAIToolName();
  
  const [userRequest, setUserRequest] = useState<string>(prefillDescription || requestFromUrl);
  const [status, setStatus] = useState<ScopingStatus>('ready');
  const [scopingPlan, setScopingPlan] = useState<ScopingPlan | null>(null);
  const [error, setError] = useState<string>('');
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [creatingProjects, setCreatingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const [automationStatus, setAutomationStatus] = useState<'sending' | 'sent' | 'failed' | null>(null);
  const [copied, setCopied] = useState(false);
  const [headlessLogs, setHeadlessLogs] = useState<HeadlessLogEntry[]>([]);
  const [isHeadlessMode, setIsHeadlessMode] = useState(false);
  const [logIdCounter, setLogIdCounter] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastProgressTime, setLastProgressTime] = useState<number | null>(null);
  const [currentRunTool, setCurrentRunTool] = useState<AITool | null>(null);

  const activeToolName = currentRunTool ? AI_TOOL_NAMES[currentRunTool] : aiToolName;

  // Track if we've ever reached 'complete' status - once complete, don't switch back for WebSocket events
  const hasReachedComplete = useRef(false);

  // Use realtime hook to listen for file changes
  useRealtimeUpdates((event) => {
    // Check if scoping plan was updated
    if (event.type === 'file_changed' || event.type === 'file_added') {
      checkScopingStatus();
    }

    // Handle headless progress updates - but IGNORE refinement events
    // Refinement events have isRefinement=true and are handled by RefinePanel
    const isRefinementEvent = event.isRefinement === true;

    // CRITICAL: Once we've reached 'complete' status, NEVER switch back to 'generating' from WebSocket events
    // This prevents flickering when: 1) refinement runs, 2) old/stale headless events arrive
    // Only the user clicking "Scope with AI" should reset this
    if (hasReachedComplete.current && !isRefinementEvent) {
      // Still capture session IDs, but don't change status or show headless mode
      if (event.type === 'session_captured' && event.sessionId) {
        logger.debug('Session captured (post-complete):', event.sessionId);
        setSessionId(event.sessionId);
      }
      return;
    }

    if (event.type === 'headless_started' && !isRefinementEvent) {
      // Only handle initial scoping execution, not refinement
      setIsHeadlessMode(true);
      setHeadlessLogs([]); // Clear previous logs
      setLogIdCounter(0);
      setLastProgressTime(Date.now());
      // Add initial log entry
      const startEntry: HeadlessLogEntry = {
        id: 0,
        message: `Starting ${activeToolName}...`,
        icon: '🚀',
        timestamp: new Date()
      };
      setHeadlessLogs([startEntry]);
      setLogIdCounter(1);
      // Transition to generating state immediately when headless starts
      setStatus('generating');
      setAutomationStatus('sent');
      onStatusChange?.('generating');
    }
    if (event.type === 'headless_progress' && event.status && !isRefinementEvent) {
      // Only handle initial scoping execution progress, not refinement
      const message = event.status;
      const newEntry: HeadlessLogEntry = {
        id: logIdCounter,
        message,
        icon: getActionIcon(message),
        timestamp: new Date()
      };
      setHeadlessLogs(prev => [...prev, newEntry]);
      setLogIdCounter(prev => prev + 1);
      // Reset thinking indicator timer
      setLastProgressTime(Date.now());
    }
    // Handle early session capture - enables RefinePanel immediately
    if (event.type === 'session_captured' && event.sessionId) {
      logger.debug('Session captured early:', event.sessionId);
      setSessionId(event.sessionId);
    }
    if (event.type === 'headless_completed' && !isRefinementEvent) {
      // Only handle initial scoping execution completion, not refinement
      const message = event.success ? 'Task completed successfully' : 'Task failed, retrying...';
      const finalEntry: HeadlessLogEntry = {
        id: logIdCounter,
        message,
        icon: event.success ? '✅' : '⚠️',
        timestamp: new Date()
      };
      setHeadlessLogs(prev => [...prev, finalEntry]);
      setLastProgressTime(null);
      // Capture session ID for refinement support (fallback if early capture didn't work)
      if (event.sessionId && !sessionId) {
        setSessionId(event.sessionId);
      }
      // Clear after a moment
      setTimeout(() => {
        setHeadlessLogs([]);
        setIsHeadlessMode(false);
      }, 3000);
    }
  });
  
  // Initialize from URL params
  useEffect(() => {
    // Just set to ready on mount
  }, []);

  // Fetch persisted session ID on mount (survives page reloads)
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/sessions/_scoping_active');
        const data = await response.json();
        if (data.sessions?.scoping) {
          setSessionId(data.sessions.scoping);
          logger.debug('Restored scoping session:', data.sessions.scoping);
        }
      } catch (err) {
        logger.error('Failed to fetch session:', err);
      }
    };
    fetchSession();
  }, []);
  
  // Poll for status updates when generating
  useEffect(() => {
    if (status === 'generating') {
      const interval = setInterval(() => {
        checkScopingStatus();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [status]);

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
  
  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerClassification();
  };
  
  const triggerClassification = async (toolOverride?: AITool) => {
    if (!userRequest.trim()) {
      setError('Please enter a request');
      return;
    }
    
    try {
      setCurrentRunTool(toolOverride || null);
      setStatus('classifying');
      setAutomationStatus('sending');
      onStatusChange?.('classifying');
      setError('');
      
      const response = await fetch('/api/scoping/classify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userRequest,
          ...(toolOverride ? { aiTool: toolOverride } : {})
        })
      });
      
      const data = await response.json();
      
      // Store the prompt for the copy button
      if (data.prompt) {
        setLastPrompt(data.prompt);
      }

      // Capture session ID if returned
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.success) {
        // Automation succeeded - keep "sent" visible at the top while showing generating
        setAutomationStatus('sent');
        setStatus('generating');
        onStatusChange?.('generating');
      } else {
        // Automation failed - show copy prompt button prominently
        if (data.message || data.error) {
          setError(data.message || data.error);
        }
        setAutomationStatus('failed');
        setStatus('generating'); // Still go to generating state, just show failed automation
        onStatusChange?.('generating');
      }
    } catch (err) {
      setError('Failed to trigger classification');
      setAutomationStatus(null);
      setStatus('ready');
      onStatusChange?.('ready');
      logger.error(err);
    }
  };
  
  const checkScopingStatus = async () => {
    try {
      const response = await fetch('/api/scoping/status');
      const data = await response.json();

      logger.debug('Status check:', data);

      if (data.status === 'complete' && data.plan) {
        // Double-check that plan doesn't have placeholders
        const planStr = JSON.stringify(data.plan);
        if (!planStr.includes('[ANALYSIS_PLACEHOLDER]') &&
            !planStr.includes('[SUGGESTION_PLACEHOLDER]') &&
            !planStr.includes('PLACEHOLDER')) {
          setScopingPlan(data.plan);
          setStatus('complete');
          hasReachedComplete.current = true; // Lock status to prevent flickering
          onStatusChange?.('complete');
        }
        // else: Still has placeholders, keep generating state
      } else if (data.status === 'generating') {
        // IMPORTANT: Don't switch back to 'generating' if we're already 'complete'
        // This prevents flickering during refinement when files are being updated
        if (status !== 'complete') {
          setStatus('generating');
          onStatusChange?.('generating');

          // Restore "working" state if generation is in progress (for page reload)
          // Only restore if API confirms isGenerating is true
          if (data.isGenerating && status === 'ready') {
            logger.debug('Restoring scoping generation state from server');
            setAutomationStatus('sent');
            setIsHeadlessMode(true);
          }
        }
      }
    } catch (err) {
      logger.error('Failed to check status:', err);
    }
  };
  
  // Content to render
  const content = (
    <>
      {/* Header */}
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
            🔬 Project Scoping
          </h1>
          <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
            Analyzing your request to determine the best approach
          </p>
        </div>
      )}
      
      {/* User Request Input with Scope Button */}
      {status === 'ready' && (
        <div 
          className="rounded-lg p-6"
          style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
        >
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: 'hsl(0 0% 9%)' }}>
            What would you like to build?
          </h2>
          <form onSubmit={handleRequestSubmit}>
            <textarea
              className="w-full p-3 rounded-md text-[13px] mb-4 min-h-[100px] focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: 'hsl(0 0% 100%)',
                border: '1px solid hsl(0 0% 90%)',
                color: 'hsl(0 0% 9%)',
              }}
              placeholder="Describe what you want to build... (e.g., 'Add Google Sign-in to my app')"
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              autoFocus
            />
            <AIActionSplitButton
              label="✨ Scope with AI"
              onRun={triggerClassification}
              disabled={!userRequest.trim()}
              fullWidth
            />
            <p className="text-[12px] mt-3 text-center" style={{ color: 'hsl(0 0% 46%)' }}>
              Default tool: {aiToolName}. Use the arrow to run with another tool.
            </p>
          </form>
        </div>
      )}
      
      {/* Show request while processing */}
      {(status === 'classifying' || status === 'generating') && (
        <div 
          className="rounded-lg p-5 mb-5"
          style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
        >
          <h2 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
            Your Request
          </h2>
          <p className="text-[13px]" style={{ color: 'hsl(0 0% 32%)' }}>
            "{userRequest}"
          </p>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div 
          className="rounded-md p-4 mb-5"
          style={{ 
            backgroundColor: 'hsl(0 84% 97%)',
            border: '1px solid hsl(0 84% 90%)'
          }}
        >
          <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>
            ⚠️ {error}
          </p>
        </div>
      )}
      
      {/* Classifying State - Sending Animation */}
      {status === 'classifying' && automationStatus === 'sending' && (
        <div 
          className="rounded-lg p-8 text-center"
          style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
        >
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
          <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
            Sending to {activeToolName}...
          </h2>
          <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
            Preparing the prompt and opening your AI tool
          </p>
        </div>
      )}
      
      {/* Generating State */}
      {status === 'generating' && (
        <div 
          className="rounded-lg p-8"
          style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
        >
          <div className="text-center">
            {/* Automation Success Status - Show at top */}
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

            {/* Automation Failed Status */}
            {automationStatus === 'failed' && (
              <div 
                className="rounded-lg p-5 mb-6 text-center"
                style={{ backgroundColor: 'hsl(45 100% 96%)', border: '1px solid hsl(45 100% 88%)' }}
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'hsl(45 100% 90%)' }}
                >
                  <span className="text-xl">📋</span>
                </div>
                <p className="text-[13px] font-medium mb-2" style={{ color: 'hsl(45 80% 25%)' }}>
                  {activeToolName} didn't open automatically
                </p>
                <p className="text-[12px] mb-3" style={{ color: 'hsl(45 60% 35%)' }}>
                  Copy the prompt and paste it manually
                </p>
                {lastPrompt && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(lastPrompt);
                      setCopied(true);
                      setTimeout(() => {
                        setCopied(false);
                        setAutomationStatus(null);
                      }, 2000);
                    }}
                    className="px-4 py-2 rounded-md text-[13px] font-medium transition-all flex items-center justify-center gap-2 mx-auto"
                    style={{
                      backgroundColor: copied ? 'hsl(142 76% 94%)' : 'hsl(0 0% 100%)',
                      color: copied ? 'hsl(142 76% 36%)' : 'hsl(0 0% 32%)',
                      border: copied ? '1px solid hsl(142 76% 80%)' : '1px solid hsl(0 0% 85%)'
                    }}
                  >
                    {copied ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                        Copy Prompt to Clipboard
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            
            <div className="text-4xl mb-4 animate-pulse">⏳</div>
            <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
              {isHeadlessMode ? `${activeToolName} is Working...` : 'AI is Analyzing...'}
            </h2>
            <p className="text-[13px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
              {isHeadlessMode
                ? 'Running in headless mode - no manual intervention needed'
                : `Waiting for ${activeToolName} to complete the classification...`}
            </p>

            {/* Headless Streaming Log Display */}
            {isHeadlessMode && headlessLogs.length > 0 && (
              <div
                className="rounded-lg mb-6 overflow-hidden"
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

            <div className="flex justify-center mb-6">
              <div className="linear-spinner" style={{ width: '28px', height: '28px' }}></div>
            </div>
            <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
              {isHeadlessMode
                ? `${activeToolName} is executing the task automatically.`
                : 'This may take a minute. The page will update automatically when complete.'}
            </p>
            
            {/* Fallback: Copy Prompt Button (only show if automation status is null - meaning it succeeded before) */}
            {lastPrompt && !automationStatus && (
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                <p className="text-[12px] mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                  If {activeToolName} didn't open correctly:
                </p>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lastPrompt);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      logger.error('Failed to copy prompt:', err);
                    }
                  }}
                  className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: copied ? 'hsl(142 76% 94%)' : 'transparent',
                    color: copied ? 'hsl(142 76% 36%)' : 'hsl(0 0% 32%)',
                    border: copied ? '1px solid hsl(142 76% 80%)' : '1px solid hsl(0 0% 90%)'
                  }}
                >
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    '📋 Copy Prompt to Clipboard'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Complete State - Show Results */}
      {status === 'complete' && scopingPlan && (
        <div className="space-y-5">
          {/* Scoping Complete Header */}
          <div 
            className="rounded-lg p-6"
            style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="text-2xl">✅</div>
              <div>
                <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                  Scoping Complete
                </h2>
                <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                  Your request has been analyzed and classified
                </p>
              </div>
            </div>
            
            {/* Classification Type Badge */}
            <div className="pt-5" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
              <p className="text-[12px] font-medium mb-2" style={{ color: 'hsl(0 0% 46%)' }}>
                Classification Type:
              </p>
              <span 
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium"
                style={{
                  backgroundColor: scopingPlan.type === 'direct' ? 'hsl(210 100% 95%)' : 
                                   scopingPlan.type === 'project' ? 'hsl(270 100% 95%)' : 
                                   'hsl(25 100% 95%)',
                  color: scopingPlan.type === 'direct' ? 'hsl(210 100% 45%)' : 
                         scopingPlan.type === 'project' ? 'hsl(270 100% 40%)' : 
                         'hsl(25 100% 40%)',
                  border: `1px solid ${scopingPlan.type === 'direct' ? 'hsl(210 100% 88%)' : 
                                       scopingPlan.type === 'project' ? 'hsl(270 100% 88%)' : 
                                       'hsl(25 100% 88%)'}`
                }}
              >
                {scopingPlan.type === 'direct' ? '💡 Simple Change' : 
                 scopingPlan.type === 'project' ? '🎯 Full Project' : 
                 '🎪 Multi-Project Initiative'}
              </span>
              
              {/* Show project count for multi-project */}
              {scopingPlan.type === 'multi-project' && scopingPlan.projects && (
                <p className="text-[12px] mt-3" style={{ color: 'hsl(0 0% 46%)' }}>
                  {scopingPlan.projects.length} projects identified
                </p>
              )}
            </div>
          </div>
          
          {/* Analysis */}
          <div 
            className="rounded-lg p-6"
            style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
          >
            <h3 className="text-[15px] font-semibold mb-3" style={{ color: 'hsl(0 0% 9%)' }}>
              📊 Analysis
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'hsl(0 0% 32%)' }}>
              {scopingPlan.scope_analysis || 'No analysis provided'}
            </p>
            
            {/* Show projects if available */}
            {scopingPlan.projects && scopingPlan.projects.length > 0 && (
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                <h4 className="text-[12px] font-semibold mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                  {scopingPlan.type === 'project' && scopingPlan.projects.length === 1 
                    ? '📦 Project Identified:' 
                    : '📦 Projects Identified:'}
                </h4>
                <div className="space-y-2">
                  {scopingPlan.projects.map((project: any, index: number) => (
                    <div 
                      key={index}
                      className="p-3 rounded-md"
                      style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                    >
                      <h5 className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                        {project.name || `Project ${index + 1}`}
                      </h5>
                      {project.testable_outcome && (
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                          {project.testable_outcome}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Action Based on Type */}
          {scopingPlan.type === 'direct' && scopingPlan.direct_work_suggestion && (
            <div 
              className="rounded-lg p-6"
              style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
            >
              <h3 className="text-[15px] font-semibold mb-3" style={{ color: 'hsl(0 0% 9%)' }}>
                💡 Suggestion
              </h3>
              <p className="text-[13px] leading-relaxed mb-5" style={{ color: 'hsl(0 0% 32%)' }}>
                {scopingPlan.direct_work_suggestion}
              </p>
              <div className="flex gap-3">
                <button
                  disabled={creatingIssue}
                  onClick={async () => {
                    try {
                      setCreatingIssue(true);
                      setError('');
                      
                      const response = await fetch('/api/issues/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          description: userRequest,
                          analysis: scopingPlan.scope_analysis || 'This work can be implemented directly without a full project specification.',
                          suggestion: scopingPlan.direct_work_suggestion || 'Implement this change directly in your code editor.'
                        })
                      });
                      
                      const data = await response.json();
                      
                      if (data.success) {
                        // Redirect to homepage
                        navigate('/');
                      } else {
                        setError(data.error || 'Failed to create issue');
                      }
                    } catch (err) {
                      setError('Failed to create issue');
                      logger.error(err);
                    } finally {
                      setCreatingIssue(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md text-[13px] font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: 'hsl(235 69% 61%)',
                    color: 'white',
                  }}
                >
                  {creatingIssue ? 'Creating...' : 'Create Issue for Later'}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 rounded-md text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'hsl(0 0% 32%)',
                    border: '1px solid hsl(0 0% 90%)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Got It - Will Work on It Now
                </button>
              </div>
            </div>
          )}
          
          {scopingPlan.type === 'project' && scopingPlan.projects && scopingPlan.projects.length > 0 && (
            <div 
              className="rounded-lg p-6"
              style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
            >
              <h3 className="text-[15px] font-semibold mb-3" style={{ color: 'hsl(0 0% 9%)' }}>
                🎯 Next Steps
              </h3>
              <p className="text-[13px] mb-5" style={{ color: 'hsl(0 0% 32%)' }}>
                This requires a full specification process with PM → Designer → Engineer workflow.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={creatingProjects}
                  onClick={async () => {
                    try {
                      setCreatingProjects(true);
                      setError('');
                      
                      // Call API to finalize scope and create projects
                      const response = await fetch('/api/scoping/finalize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      const data = await response.json();
                      
                      if (data.success) {
                        // Projects created successfully - redirect to dashboard with highlights
                        if (data.projectIds && data.projectIds.length > 0) {
                          const highlights = data.projectIds.join(',');
                          navigate(`/?highlight=${highlights}`);
                        } else {
                          // Fallback to dashboard
                          navigate('/');
                        }
                      } else {
                        setError(data.error || 'Failed to create projects');
                      }
                    } catch (err) {
                      setError('Failed to create projects');
                      logger.error(err);
                    } finally {
                      setCreatingProjects(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md text-[13px] font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: 'hsl(235 69% 61%)',
                    color: 'white',
                  }}
                >
                  {creatingProjects ? 'Creating Projects...' : 'Create Projects'}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 rounded-md text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'hsl(0 0% 32%)',
                    border: '1px solid hsl(0 0% 90%)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
          
          {scopingPlan.type === 'multi-project' && scopingPlan.projects && scopingPlan.projects.length > 1 && (
            <div 
              className="rounded-lg p-6"
              style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
            >
              <h3 className="text-[15px] font-semibold mb-3" style={{ color: 'hsl(0 0% 9%)' }}>
                🎯 Create All Projects
              </h3>
              <p className="text-[13px] mb-5" style={{ color: 'hsl(0 0% 32%)' }}>
                Multiple projects were identified. All projects will be created, and you can work on them individually:
              </p>
              <div className="space-y-2 mb-5">
                {scopingPlan.projects.map((project: any, index: number) => (
                  <div 
                    key={index}
                    className="p-3 rounded-md"
                    style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[13px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                          {project.name}
                        </h4>
                        <p className="text-[12px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                          {project.testable_outcome}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  disabled={creatingProjects}
                  onClick={async () => {
                    try {
                      setCreatingProjects(true);
                      setError('');
                      
                      // Call API to finalize scope and create all projects
                      const response = await fetch('/api/scoping/finalize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      const data = await response.json();
                      
                      if (data.success) {
                        // Projects created successfully - redirect to dashboard with highlights
                        if (data.projectIds && data.projectIds.length > 0) {
                          const highlights = data.projectIds.join(',');
                          navigate(`/?highlight=${highlights}`);
                        } else {
                          // Fallback to dashboard
                          navigate('/');
                        }
                      } else {
                        setError(data.error || 'Failed to create projects');
                      }
                    } catch (err) {
                      setError('Failed to create projects');
                      logger.error(err);
                    } finally {
                      setCreatingProjects(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md text-[13px] font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: 'hsl(235 69% 61%)',
                    color: 'white',
                  }}
                >
                  {creatingProjects ? 'Creating Projects...' : 'Create All Projects'}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 rounded-md text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'hsl(0 0% 32%)',
                    border: '1px solid hsl(0 0% 90%)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // RefinePanel component - rendered in both embedded and standalone modes
  const refinePanelElement = status === 'complete' && sessionId && (
    <RefinePanel
      phase="scoping"
      sessionId={sessionId}
      floatingMode={true}
      onRefineComplete={() => {
        checkScopingStatus();
      }}
    />
  );

  // Return with or without wrapper based on embedded prop
  if (embedded) {
    return (
      <>
        {content}
        {refinePanelElement}
      </>
    );
  }

  return (
    <div className="min-h-screen p-8 relative" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      <div className="mx-auto max-w-3xl">
        {content}
      </div>
      {refinePanelElement}
    </div>
  );
}
