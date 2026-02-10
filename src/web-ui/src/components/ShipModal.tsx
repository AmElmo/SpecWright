import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AI_TOOL_NAMES, useAIToolName, type AITool } from '../lib/use-ai-tool';
import { useRealtimeUpdates, waitForWebSocketConnection, type WebSocketEvent } from '../lib/use-realtime';
import { logger } from '../utils/logger';

// MODULE-LEVEL guard - survives component remounts (React Strict Mode)
// Maps issueId -> timestamp of when ship started
const activeShipRequests = new Map<string, number>();
const SHIP_REQUEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes - match headless timeout

// Log entry for streaming progress
interface HeadlessLogEntry {
  id: number;
  message: string;
  icon: string;
  timestamp: Date;
}

// MODULE-LEVEL streaming state - survives component remounts
// This is critical because parent components cause ShipModal to remount during streaming
interface StreamingState {
  isHeadlessMode: boolean;
  logs: HeadlessLogEntry[];
  logIdCounter: number;
  forIssueId: string | null;
}

const streamingState: StreamingState = {
  isHeadlessMode: false,
  logs: [],
  logIdCounter: 0,
  forIssueId: null,
};

// Helper to get icon from status message
function getIconFromStatus(status: string): string {
  if (status.includes('✅')) return '✅';
  if (status.includes('❌')) return '❌';
  if (status.includes('📖')) return '📖';
  if (status.includes('✏️')) return '✏️';
  if (status.includes('📝')) return '📝';
  if (status.includes('💻')) return '💻';
  if (status.includes('🔍')) return '🔍';
  if (status.includes('🔎')) return '🔎';
  if (status.includes('🔧')) return '🔧';
  if (status.includes('💭')) return '💭';
  return '⚙️';
}

interface ShipModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiToolOverride?: AITool | null;
  issue: {
    issueId: string;
    title: string;
    projectId: string;
    projectName: string;
  } | null;
}

// Message to show while AI is working
const BREAK_MESSAGE = "☕ Time for a coffee, a quick walk in the sun, or writing a new spec!";

export function ShipModal({ isOpen, onClose, issue, aiToolOverride = null }: ShipModalProps) {
  const aiToolName = useAIToolName();
  const activeToolName = aiToolOverride ? AI_TOOL_NAMES[aiToolOverride] : aiToolName;
  const [status, setStatus] = useState<'loading' | 'working' | 'success' | 'error'>('loading');
  const [prompt, setPrompt] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Force update counter to trigger re-renders when module-level state changes
  const [, forceUpdate] = useState(0);
  const triggerUpdate = () => forceUpdate(n => n + 1);

  // Read from module-level state (survives remounts)
  const isHeadlessMode = streamingState.isHeadlessMode;
  const headlessLogs = streamingState.logs;

  // Listen for WebSocket events for streaming progress
  useRealtimeUpdates((event: WebSocketEvent) => {
    // Only handle events for the 'ship' phase
    if (event.phase !== 'ship') {
      return;
    }

    if (event.type === 'headless_started') {
      // Update module-level state
      streamingState.isHeadlessMode = true;
      streamingState.logs = [{
        id: 0,
        message: `Starting ${activeToolName}...`,
        icon: '🚀',
        timestamp: new Date()
      }];
      streamingState.logIdCounter = 1;
      streamingState.forIssueId = issue?.issueId || null;
      triggerUpdate();
    }

    if (event.type === 'headless_progress' && event.status) {
      // Update module-level state
      const newEntry: HeadlessLogEntry = {
        id: streamingState.logIdCounter,
        message: event.status,
        icon: getIconFromStatus(event.status),
        timestamp: new Date()
      };
      streamingState.logs = [...streamingState.logs, newEntry];
      streamingState.logIdCounter++;
      triggerUpdate();
    }

    if (event.type === 'headless_completed') {
      // Update module-level state
      const message = event.success ? 'Task completed successfully!' : 'Task failed';
      const finalEntry: HeadlessLogEntry = {
        id: streamingState.logIdCounter,
        message,
        icon: event.success ? '✅' : '❌',
        timestamp: new Date()
      };
      streamingState.logs = [...streamingState.logs, finalEntry];
      streamingState.logIdCounter++;

      // Update status based on completion
      if (event.success) {
        setStatus('success');
      }
      triggerUpdate();
    }
  }, false); // Disable tab notifications for ship events

  useEffect(() => {
    const issueId = issue?.issueId;

    if (isOpen && issue && issueId) {
      // Check module-level guard
      const existingRequest = activeShipRequests.get(issueId);
      const now = Date.now();

      if (existingRequest && (now - existingRequest) < SHIP_REQUEST_TIMEOUT) {
        // Don't call shipIssue, just show loading state
        return;
      }

      shipIssue();
    } else {
      // Reset state when modal closes
      setStatus('loading');
      setPrompt('');
      setCopied(false);
      setErrorMessage('');
      // Reset module-level headless streaming state
      streamingState.isHeadlessMode = false;
      streamingState.logs = [];
      streamingState.logIdCounter = 0;
      streamingState.forIssueId = null;
      // Note: We do NOT clear activeShipRequests here - let them expire naturally
    }
  }, [isOpen, issue?.issueId, aiToolOverride]);

  const shipIssue = async () => {
    const issueId = issue?.issueId;

    if (!issue || !issueId) {
      return;
    }

    // Double-check module-level guard (in case of race condition)
    const existingRequest = activeShipRequests.get(issueId);
    const now = Date.now();
    if (existingRequest && (now - existingRequest) < SHIP_REQUEST_TIMEOUT) {
      return;
    }

    // Set the module-level guard
    activeShipRequests.set(issueId, now);

    setStatus('loading');

    try {
      // Wait for WebSocket connection before making ship request
      // This ensures we receive streaming events
      try {
        await waitForWebSocketConnection(3000);
      } catch {
        // WebSocket connection timeout - proceed anyway (streaming may not work)
      }

      const url = `/api/issues/${issue.projectId}/${issue.issueId}/ship`;

      // Use the combined ship endpoint for speed (single network call)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(aiToolOverride ? { aiTool: aiToolOverride } : {})
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to ship issue: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setPrompt(data.prompt);

      if (data.success) {
        setErrorMessage('');
        setStatus('success');
      } else {
        // Automation didn't work, but we have the prompt
        setErrorMessage(data.message || data.error || '');
        setStatus('working');
      }

      // Mark shipping as complete - remove from active requests
      activeShipRequests.delete(issueId);
    } catch (err) {
      logger.error('Failed to ship issue:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to ship issue');
      setStatus('error');
      // Remove from active requests on error so retry works
      activeShipRequests.delete(issueId);
    }
  };

  const copyPromptToClipboard = async () => {
    if (!prompt) return;
    
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      logger.error('Failed to copy prompt:', err);
    }
  };

  if (!isOpen || !issue) {
    return null;
  }

  // Use portal to render modal directly into document.body
  // This isolates the modal from parent re-renders that cause flickering
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'white' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - More prominent */}
        <div 
          className="px-6 py-5 border-b"
          style={{ 
            borderColor: 'hsl(0 0% 92%)',
            backgroundColor: 'hsl(235 69% 98%)'
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🤖</span>
                <span 
                  className="text-[13px] font-semibold uppercase tracking-wide"
                  style={{ color: 'hsl(235 69% 50%)' }}
                >
                  AI is working on
                </span>
              </div>
              <div 
                className="text-[12px] font-mono px-2 py-1 rounded inline-block mb-1.5"
                style={{ 
                  backgroundColor: 'hsl(235 69% 94%)',
                  color: 'hsl(235 69% 45%)'
                }}
              >
                {issue.issueId}
              </div>
              <h2 
                className="text-[17px] font-semibold leading-tight"
                style={{ color: 'hsl(0 0% 9%)' }}
              >
                {issue.title}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors hover:bg-white/50 flex-shrink-0"
              style={{ color: 'hsl(0 0% 46%)' }}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {status === 'loading' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div
                  className="w-12 h-12 border-3 rounded-full animate-spin"
                  style={{
                    borderColor: 'hsl(0 0% 92%)',
                    borderTopColor: 'hsl(235 69% 61%)',
                    borderWidth: '3px'
                  }}
                />
              </div>
              <p className="text-[14px] font-medium mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                {isHeadlessMode ? `Running via ${activeToolName}...` : `Sending to ${activeToolName}...`}
              </p>
              {isHeadlessMode && (
                <p className="text-[11px] mb-4" style={{ color: 'hsl(0 0% 46%)' }}>
                  Executing in headless mode - no action needed
                </p>
              )}

              {/* Streaming Log Display */}
              {isHeadlessMode && headlessLogs.length > 0 && (
                <div
                  className="rounded-lg mt-4 overflow-hidden text-left relative"
                  style={{ backgroundColor: 'hsl(220 13% 10%)', border: '1px solid hsl(220 13% 20%)' }}
                >
                  <div
                    className="px-3 py-2 flex items-center justify-between"
                    style={{ backgroundColor: 'hsl(220 13% 15%)', borderBottom: '1px solid hsl(220 13% 20%)' }}
                  >
                    <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 60%)' }}>
                      LIVE OUTPUT
                    </span>
                    <span className="text-[10px] animate-pulse" style={{ color: 'hsl(142 70% 50%)' }}>
                      ● Running
                    </span>
                  </div>
                  <div
                    className="p-3 max-h-40 overflow-y-auto font-mono text-[11px]"
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
                          <span>{log.icon}</span>
                          <span style={{ color: 'hsl(0 0% 80%)' }}>
                            {log.message.replace(/^[^\s]+\s*/, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(status === 'working' || status === 'success') && (
            <div className="text-center">
              {/* Success indicator */}
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'hsl(142 76% 94%)' }}
              >
                {status === 'success' ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="hsl(142 76% 36%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="text-2xl">🚀</span>
                )}
              </div>

              <h3 
                className="text-[16px] font-semibold mb-2"
                style={{ color: 'hsl(0 0% 9%)' }}
              >
                {status === 'success' ? 'Sent to ' + activeToolName + '!' : 'Prompt Ready!'}
              </h3>

              <p 
                className="text-[13px] mb-4"
                style={{ color: 'hsl(0 0% 46%)' }}
              >
                {status === 'success' 
                  ? `The prompt has been pasted into ${activeToolName}. Check your editor!`
                  : `The prompt is ready. Paste it into ${activeToolName} to start.`
                }
              </p>

              {status === 'working' && errorMessage && (
                <p className="text-[12px] mb-4" style={{ color: 'hsl(0 84% 45%)' }}>
                  {errorMessage}
                </p>
              )}

              {/* Break message */}
              <div 
                className="rounded-lg p-3 mb-4"
                style={{ backgroundColor: 'hsl(45 100% 96%)' }}
              >
                <p 
                  className="text-[14px]"
                  style={{ color: 'hsl(45 80% 30%)' }}
                >
                  {BREAK_MESSAGE}
                </p>
              </div>

              {/* Important notice - Made bigger and more obvious */}
              <div 
                className="rounded-lg p-4 mb-5"
                style={{ 
                  backgroundColor: 'hsl(235 69% 97%)',
                  border: '1px solid hsl(235 69% 90%)'
                }}
              >
                <p 
                  className="text-[14px] font-medium"
                  style={{ color: 'hsl(235 69% 45%)' }}
                >
                  ✨ The AI will update the issue to <strong>"In Review"</strong> when done.
                </p>
                <p 
                  className="text-[12px] mt-1"
                  style={{ color: 'hsl(235 69% 55%)' }}
                >
                  You'll see it move to the In Review column automatically.
                </p>
              </div>

              {/* Fallback copy section */}
              <div className="pt-4 border-t" style={{ borderColor: 'hsl(0 0% 94%)' }}>
                <p 
                  className="text-[12px] mb-2"
                  style={{ color: 'hsl(0 0% 50%)' }}
                >
                  If the prompt didn't open in {activeToolName}:
                </p>
                <button
                  onClick={copyPromptToClipboard}
                  className="w-full px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: copied ? 'hsl(142 76% 94%)' : 'hsl(0 0% 96%)',
                    color: copied ? 'hsl(142 76% 36%)' : 'hsl(0 0% 32%)',
                    border: copied ? '1px solid hsl(142 76% 80%)' : '1px solid hsl(0 0% 90%)'
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
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'hsl(0 84% 95%)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4M12 17h.01" stroke="hsl(0 84% 45%)" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="10" stroke="hsl(0 84% 45%)" strokeWidth="2"/>
                </svg>
              </div>
              <h3 
                className="text-[16px] font-semibold mb-2"
                style={{ color: 'hsl(0 0% 9%)' }}
              >
                Something went wrong
              </h3>
              <p 
                className="text-[13px] mb-4"
                style={{ color: 'hsl(0 84% 45%)' }}
              >
                {errorMessage}
              </p>
              <button
                onClick={shipIssue}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: 'hsl(235 69% 61%)',
                  color: 'white'
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 border-t"
          style={{ 
            borderColor: 'hsl(0 0% 92%)',
            backgroundColor: 'hsl(0 0% 99%)'
          }}
        >
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: 'hsl(235 69% 61%)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
