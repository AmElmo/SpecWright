/**
 * RefinePanel - Reusable right-side panel for providing feedback to refine AI outputs
 *
 * Features:
 * - Textarea for feedback text
 * - Image upload (max 5 images)
 * - Streaming log display during refinement
 * - Collapsible design
 */

import { useState, useRef, useCallback } from 'react';
import { useRealtimeUpdates, type WebSocketEvent } from '../lib/use-realtime';

// Log entry for streaming progress
interface HeadlessLogEntry {
  id: number;
  message: string;
  icon: string;
  timestamp: Date;
}

// Map action types to icons
function getActionIcon(message: string): string {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('reading') || lowerMessage.includes('read file')) return '📖';
  if (lowerMessage.includes('writing') || lowerMessage.includes('write file') || lowerMessage.includes('wrote')) return '✏️';
  if (lowerMessage.includes('searching') || lowerMessage.includes('search') || lowerMessage.includes('glob') || lowerMessage.includes('grep')) return '🔍';
  if (lowerMessage.includes('running') || lowerMessage.includes('command') || lowerMessage.includes('bash') || lowerMessage.includes('execute')) return '⚡';
  if (lowerMessage.includes('thinking') || lowerMessage.includes('analyzing') || lowerMessage.includes('processing')) return '🧠';
  if (lowerMessage.includes('starting') || lowerMessage.includes('resuming')) return '🚀';
  if (lowerMessage.includes('completed') || lowerMessage.includes('success') || lowerMessage.includes('✅')) return '✅';
  if (lowerMessage.includes('failed') || lowerMessage.includes('error') || lowerMessage.includes('⚠️')) return '⚠️';
  if (lowerMessage.includes('initialized') || lowerMessage.includes('init')) return '⚙️';
  return '💭';
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

type RefinePhase = 'scoping' | 'pm' | 'designer' | 'ux' | 'engineer' | 'breakdown';

interface RefinePanelProps {
  phase: RefinePhase;
  projectId?: string;
  sessionId?: string;
  onRefineComplete?: () => void;
  disabled?: boolean;
  floatingMode?: boolean; // If true, renders as a floating panel in the margin
}

export function RefinePanel({
  phase,
  projectId,
  sessionId,
  onRefineComplete,
  disabled = false,
  floatingMode = false
}: RefinePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [headlessLogs, setHeadlessLogs] = useState<HeadlessLogEntry[]>([]);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logIdCounter = useRef(0);

  const MAX_IMAGES = 5;

  // Listen for headless progress updates - only for this phase's refinement
  useRealtimeUpdates((event: WebSocketEvent) => {
    // Only process events when we're actively refining AND this is a refinement event
    if (!isRefining || !event.isRefinement) return;

    if (event.type === 'headless_started' && event.phase === phase) {
      setHeadlessLogs([{
        id: logIdCounter.current++,
        message: 'Resuming conversation...',
        icon: '🔄',
        timestamp: new Date()
      }]);
    }
    // Only listen to progress events for our specific phase
    if (event.type === 'headless_progress' && event.status && event.phase === phase) {
      const newEntry: HeadlessLogEntry = {
        id: logIdCounter.current++,
        message: event.status,
        icon: getActionIcon(event.status),
        timestamp: new Date()
      };
      setHeadlessLogs(prev => [...prev, newEntry]);
    }
    // Only listen to completion events for our specific phase
    if (event.type === 'headless_completed' && event.phase === phase) {
      const message = event.success ? 'Refinement complete' : 'Refinement failed';
      setHeadlessLogs(prev => [...prev, {
        id: logIdCounter.current++,
        message,
        icon: event.success ? '✅' : '⚠️',
        timestamp: new Date()
      }]);

      setTimeout(() => {
        setIsRefining(false);
        setHeadlessLogs([]);
        if (event.success) {
          setFeedbackText('');
          setUploadedImages([]);
          onRefineComplete?.();
        }
      }, 2000);
    }
  });

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = MAX_IMAGES - uploadedImages.length;
    const filesToAdd = files.slice(0, remainingSlots);

    const newImages: UploadedImage[] = filesToAdd.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file)
    }));

    setUploadedImages(prev => [...prev, ...newImages]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadedImages.length]);

  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  }, []);

  const handleRefine = async () => {
    if (!feedbackText.trim() || disabled) return;

    setIsRefining(true);
    setError('');
    logIdCounter.current = 0;

    try {
      // Convert images to base64
      const imageData: string[] = [];
      for (const img of uploadedImages) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(img.file);
        });
        imageData.push(base64);
      }

      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          projectId,
          sessionId,
          feedback: feedbackText,
          images: imageData
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to start refinement');
        setIsRefining(false);
      }
      // If successful, we'll get updates via WebSocket
    } catch (err) {
      setError('Failed to connect to server');
      setIsRefining(false);
    }
  };

  const canRefine = feedbackText.trim().length > 0 && !disabled && !isRefining;

  // Floating mode: fixed position in right margin
  if (floatingMode) {
    return (
      <div className="fixed right-8 top-1/3 z-50">
        {/* Collapsed state: just a button */}
        {!isExpanded && !isRefining && (
          <button
            onClick={() => setIsExpanded(true)}
            className="px-4 py-3 rounded-xl shadow-lg bg-purple-600 text-white border border-purple-700 cursor-pointer"
          >
            <span className="text-sm font-semibold">
              ✨ Provide feedback
            </span>
          </button>
        )}

        {/* Expanded state: full panel */}
        {(isExpanded || isRefining) && (
          <div
            className="w-[300px] rounded-lg shadow-xl overflow-hidden bg-white border border-gray-200"
          >
            {/* Header with close button */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: 'hsl(0 0% 99%)', borderBottom: '1px solid hsl(0 0% 92%)' }}
            >
              <div>
                <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'hsl(0 0% 9%)' }}>
                  💬 Refine
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                  Provide feedback to improve the output
                </p>
              </div>
              {!isRefining && (
                <button
                  onClick={() => setIsExpanded(false)}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ color: 'hsl(0 0% 46%)' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {isRefining ? (
                // Streaming logs during refinement
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ backgroundColor: 'hsl(220 13% 10%)', border: '1px solid hsl(220 13% 20%)' }}
                >
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{ backgroundColor: 'hsl(220 13% 14%)', borderBottom: '1px solid hsl(220 13% 20%)' }}
                  >
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(142 76% 46%)' }} />
                    <span className="text-[10px] font-medium" style={{ color: 'hsl(220 10% 60%)' }}>
                      Refining...
                    </span>
                  </div>
                  <div
                    className="p-2 max-h-[250px] overflow-y-auto"
                    ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                  >
                    <div className="space-y-1">
                      {headlessLogs.map((log, index) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-1.5"
                          style={{ opacity: index === headlessLogs.length - 1 ? 1 : 0.7 }}
                        >
                          <span className="text-[11px] flex-shrink-0">{log.icon}</span>
                          <span
                            className="text-[11px] font-mono leading-relaxed"
                            style={{ color: 'hsl(220 10% 75%)' }}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full p-3 rounded-md text-[12px] mb-3 min-h-[80px] resize-y focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: 'hsl(0 0% 100%)',
                      border: '1px solid hsl(0 0% 90%)',
                      color: 'hsl(0 0% 9%)',
                    }}
                    placeholder="Describe what you'd like changed..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    disabled={disabled}
                    autoFocus
                  />

                  {/* Image upload */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 46%)' }}>
                        📎 Attach ({uploadedImages.length}/{MAX_IMAGES})
                      </span>
                    </div>

                    {uploadedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {uploadedImages.map(img => (
                          <div
                            key={img.id}
                            className="relative w-10 h-10 rounded-md overflow-hidden group"
                            style={{ border: '1px solid hsl(0 0% 90%)' }}
                          >
                            <img src={img.preview} alt="Upload preview" className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeImage(img.id)}
                              className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <span className="text-white text-[12px]">✕</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {uploadedImages.length < MAX_IMAGES && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="w-8 h-8 rounded-md flex items-center justify-center transition-all disabled:opacity-50"
                        style={{
                          backgroundColor: 'hsl(0 0% 100%)',
                          border: '1px dashed hsl(0 0% 85%)',
                          color: 'hsl(0 0% 46%)'
                        }}
                      >
                        <span className="text-[14px]">+</span>
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>

                  {error && (
                    <div
                      className="rounded-md p-2 mb-3"
                      style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}
                    >
                      <p className="text-[11px]" style={{ color: 'hsl(0 84% 45%)' }}>
                        ⚠️ {error}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer with button */}
            {!isRefining && (
              <div
                className="px-4 py-3"
                style={{ borderTop: '1px solid hsl(0 0% 92%)' }}
              >
                <button
                  onClick={handleRefine}
                  disabled={!canRefine}
                  className="w-full px-3 py-2 rounded-md text-[12px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: canRefine ? 'hsl(235 69% 61%)' : 'hsl(0 0% 90%)',
                    color: canRefine ? 'white' : 'hsl(0 0% 46%)',
                  }}
                >
                  🔄 Refine
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Standard inline mode (original behavior)
  return (
    <div
      className="w-[280px] flex-shrink-0 border-l flex flex-col h-full"
      style={{ borderColor: 'hsl(0 0% 92%)', backgroundColor: 'hsl(0 0% 99%)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'hsl(0 0% 92%)' }}
      >
        <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'hsl(0 0% 9%)' }}>
          💬 Refine
        </h3>
        <p className="text-[11px] mt-1" style={{ color: 'hsl(0 0% 46%)' }}>
          Provide feedback to improve the output
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isRefining ? (
          // Streaming logs during refinement
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: 'hsl(220 13% 10%)', border: '1px solid hsl(220 13% 20%)' }}
          >
            {/* Log header */}
            <div
              className="px-3 py-2 flex items-center gap-2"
              style={{ backgroundColor: 'hsl(220 13% 14%)', borderBottom: '1px solid hsl(220 13% 20%)' }}
            >
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(142 76% 46%)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'hsl(220 10% 60%)' }}>
                Refining...
              </span>
            </div>
            {/* Log entries */}
            <div
              className="p-2 max-h-[300px] overflow-y-auto"
              ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
            >
              <div className="space-y-1">
                {headlessLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-1.5"
                    style={{ opacity: index === headlessLogs.length - 1 ? 1 : 0.7 }}
                  >
                    <span className="text-[11px] flex-shrink-0">{log.icon}</span>
                    <span
                      className="text-[11px] font-mono leading-relaxed"
                      style={{ color: 'hsl(220 10% 75%)' }}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Feedback input form
          <>
            {/* Textarea */}
            <textarea
              className="w-full p-3 rounded-md text-[12px] mb-3 min-h-[100px] resize-y focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: 'hsl(0 0% 100%)',
                border: '1px solid hsl(0 0% 90%)',
                color: 'hsl(0 0% 9%)',
              }}
              placeholder="Describe what you'd like changed...&#10;&#10;e.g., 'Make project 1 more focused on mobile UX'"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              disabled={disabled}
            />

            {/* Image upload */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 46%)' }}>
                  📎 Attach ({uploadedImages.length}/{MAX_IMAGES})
                </span>
              </div>

              {/* Image previews */}
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {uploadedImages.map(img => (
                    <div
                      key={img.id}
                      className="relative w-12 h-12 rounded-md overflow-hidden group"
                      style={{ border: '1px solid hsl(0 0% 90%)' }}
                    >
                      <img
                        src={img.preview}
                        alt="Upload preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="text-white text-[14px]">✕</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add image button */}
              {uploadedImages.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="w-10 h-10 rounded-md flex items-center justify-center transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: 'hsl(0 0% 100%)',
                    border: '1px dashed hsl(0 0% 85%)',
                    color: 'hsl(0 0% 46%)'
                  }}
                >
                  <span className="text-[16px]">+</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                className="rounded-md p-2 mb-3"
                style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}
              >
                <p className="text-[11px]" style={{ color: 'hsl(0 84% 45%)' }}>
                  ⚠️ {error}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with button */}
      {!isRefining && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'hsl(0 0% 92%)' }}
        >
          <button
            onClick={handleRefine}
            disabled={!canRefine}
            className="w-full px-3 py-2 rounded-md text-[12px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              backgroundColor: canRefine ? 'hsl(235 69% 61%)' : 'hsl(0 0% 90%)',
              color: canRefine ? 'white' : 'hsl(0 0% 46%)',
            }}
          >
            🔄 Refine
          </button>
          {!sessionId && (
            <p className="text-[10px] mt-2 text-center" style={{ color: 'hsl(0 0% 56%)' }}>
              Session not available for refinement
            </p>
          )}
        </div>
      )}
    </div>
  );
}
