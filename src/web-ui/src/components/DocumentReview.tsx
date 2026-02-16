import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { MarkdownViewer } from './MarkdownViewer';
import { TechnologyChoicesEditor } from './TechnologyChoicesEditor';
import { AcceptanceCriteriaEditor } from './AcceptanceCriteriaEditor';
import { ScreensRenderer } from './ScreensRenderer';
import { RefinePanel } from './RefinePanel';

type RefinePhase = 'pm' | 'ux' | 'engineer';

interface DocumentReviewProps {
  projectId: string;
  documentPath: string;
  documentContent: string;
  documentType: 'prd' | 'wireframes' | 'tech-spec' | 'technology-choices' | 'design';
  onApprove: () => void;
  onReject?: () => void;
  isBreakdownComplete?: boolean;
  sessionId?: string;
  phase?: RefinePhase;
  onRefineComplete?: () => void;
}

export function DocumentReview({
  projectId,
  documentContent,
  documentType,
  onApprove,
  isBreakdownComplete = false,
  sessionId,
  phase,
  onRefineComplete,
}: DocumentReviewProps) {
  const [approving, setApproving] = useState(false);
  const [editedContent, setEditedContent] = useState(documentContent);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(documentContent);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Edit with AI state
  const [showEditWithAI, setShowEditWithAI] = useState(false);

  // Edit dropdown state
  const [showEditDropdown, setShowEditDropdown] = useState(false);
  const editDropdownRef = useRef<HTMLDivElement>(null);

  // Per-tab approval tracking
  const [approvedTabs, setApprovedTabs] = useState<Set<string>>(new Set());

  // Restore active tab from sessionStorage
  const [activeTab, setActiveTab] = useState<'main' | 'technology' | 'screens' | 'criteria'>(() => {
    const storageKey = `activeTab_${projectId}_${documentType}`;
    const stored = sessionStorage.getItem(storageKey);
    return (stored as 'main' | 'technology' | 'screens' | 'criteria') || 'main';
  });

  const [technologyChoicesContent, setTechnologyChoicesContent] = useState<string>('');
  const [screensContent, setScreensContent] = useState<string>('');
  const [acceptanceCriteriaContent, setAcceptanceCriteriaContent] = useState<string>('');
  const [loadingTechChoices, setLoadingTechChoices] = useState(false);
  const [loadingScreens, setLoadingScreens] = useState(false);
  const [loadingAcceptanceCriteria, setLoadingAcceptanceCriteria] = useState(false);
  const [allTechChoicesMade, setAllTechChoicesMade] = useState(true);

  // Update content when props change
  useEffect(() => {
    setEditedContent(documentContent);
    setEditingContent(documentContent);
  }, [documentContent]);

  // Save active tab to sessionStorage
  useEffect(() => {
    const storageKey = `activeTab_${projectId}_${documentType}`;
    sessionStorage.setItem(storageKey, activeTab);
  }, [activeTab, projectId, documentType]);

  // Close edit dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editDropdownRef.current && !editDropdownRef.current.contains(event.target as Node)) {
        setShowEditDropdown(false);
      }
    };
    if (showEditDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEditDropdown]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Check if all technology choices have been made
  useEffect(() => {
    if (documentType === 'tech-spec' && technologyChoicesContent) {
      try {
        const data = JSON.parse(technologyChoicesContent);
        if (data.technology_decisions && data.technology_decisions.length > 0) {
          const allSelected = data.technology_decisions.every((decision: any) =>
            decision.user_choice || decision.final_decision
          );
          setAllTechChoicesMade(allSelected);
        } else {
          setAllTechChoicesMade(true);
        }
      } catch {
        setAllTechChoicesMade(true);
      }
    } else {
      setAllTechChoicesMade(true);
    }
  }, [technologyChoicesContent, documentType]);

  // Fetch related content
  useEffect(() => {
    if (documentType === 'tech-spec') fetchTechnologyChoices();
    if (documentType === 'design') fetchScreens();
    if (documentType === 'prd') fetchAcceptanceCriteria();
  }, [documentType, projectId]);

  const fetchTechnologyChoices = async () => {
    setLoadingTechChoices(true);
    try {
      const response = await fetch(`/api/specification/document/${projectId}/documents/technology_choices.json`);
      if (response.ok) {
        const data = await response.json();
        setTechnologyChoicesContent(data.content);
      }
    } catch (err) {
      logger.error('Error fetching technology choices:', err);
    } finally {
      setLoadingTechChoices(false);
    }
  };

  const fetchScreens = async () => {
    setLoadingScreens(true);
    try {
      const response = await fetch(`/api/specification/document/${projectId}/documents/screens.json`);
      if (response.ok) {
        const data = await response.json();
        setScreensContent(data.content);
      }
    } catch (err) {
      logger.error('Error fetching screens:', err);
    } finally {
      setLoadingScreens(false);
    }
  };

  const fetchAcceptanceCriteria = async () => {
    setLoadingAcceptanceCriteria(true);
    try {
      const response = await fetch(`/api/specification/document/${projectId}/documents/acceptance_criteria.json`);
      if (response.ok) {
        const data = await response.json();
        setAcceptanceCriteriaContent(data.content);
      }
    } catch (err) {
      logger.error('Error fetching acceptance criteria:', err);
    } finally {
      setLoadingAcceptanceCriteria(false);
    }
  };

  const getDocumentInfo = () => {
    switch (documentType) {
      case 'prd':
        return { title: 'Product Requirements Document (PRD)', icon: '📋', description: 'Review the product requirements and acceptance criteria' };
      case 'design':
        return { title: 'Design Brief', icon: '🎨', description: 'Review screens, user flows, and wireframes' };
      case 'wireframes':
        return { title: 'Wireframes & Design Specifications', icon: '🖼️', description: 'Review the wireframes and design details for each screen' };
      case 'tech-spec':
        return { title: 'Technical Specification', icon: '⚙️', description: 'Review the technical architecture and implementation plan' };
      case 'technology-choices':
        return { title: 'Technology Choices', icon: '⚡', description: 'Review and select your preferred technologies for each category' };
    }
  };

  const docInfo = getDocumentInfo();

  // Determine tab structure
  const hasTechnologyChoices = documentType === 'tech-spec' && technologyChoicesContent;
  const hasScreens = documentType === 'design' && screensContent;
  const hasAcceptanceCriteria = documentType === 'prd' && acceptanceCriteriaContent;
  const hasTabs = !!(hasTechnologyChoices || hasScreens || hasAcceptanceCriteria);

  // Get the list of tabs for this document type
  const getTabList = (): string[] => {
    if (hasTechnologyChoices) return ['main', 'technology'];
    if (hasAcceptanceCriteria) return ['main', 'criteria'];
    if (hasScreens) return ['main', 'screens'];
    return ['main'];
  };

  // The current tab is the "main" (.MD) tab
  const isMainTab = activeTab === 'main';

  // Whether editing is allowed (not after breakdown)
  const canEdit = !isBreakdownComplete;

  // Save inline edits
  const saveInlineEdit = async () => {
    if (editingContent === editedContent) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/document/${documentType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingContent }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setEditedContent(editingContent);
      setIsEditing(false);
    } catch (error) {
      logger.error('Failed to save document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelInlineEdit = () => {
    setEditingContent(editedContent);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveInlineEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineEdit();
    }
  };

  // Per-document approval handler
  const handleApproveDocument = async () => {
    const tabs = getTabList();

    if (tabs.length <= 1) {
      // Single document — approve directly
      setApproving(true);
      try {
        await onApprove();
        const storageKey = `activeTab_${projectId}_${documentType}`;
        sessionStorage.removeItem(storageKey);
      } catch (err) {
        logger.error('Error approving:', err);
      } finally {
        setApproving(false);
      }
      return;
    }

    // Multi-tab: mark current tab as approved
    const newApproved = new Set(approvedTabs);
    newApproved.add(activeTab);
    setApprovedTabs(newApproved);

    // Find next unapproved tab
    const nextUnapproved = tabs.find((t) => !newApproved.has(t));

    if (nextUnapproved) {
      // Switch to next unapproved tab
      setActiveTab(nextUnapproved as 'main' | 'technology' | 'screens' | 'criteria');
    } else {
      // All tabs approved — advance phase
      setApproving(true);
      try {
        await onApprove();
        const storageKey = `activeTab_${projectId}_${documentType}`;
        sessionStorage.removeItem(storageKey);
      } catch (err) {
        logger.error('Error approving:', err);
      } finally {
        setApproving(false);
      }
    }
  };

  // Render the markdown content (with optional inline edit)
  const renderMarkdownContent = () => {
    if (isEditing) {
      return (
        <Card className="bg-white border-slate-200 p-6">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full min-h-[500px] p-4 rounded-md text-[14px] leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
              style={{
                border: '1px solid hsl(235 69% 61%)',
                backgroundColor: '#fefefe',
              }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={cancelInlineEdit}
                disabled={isSaving}
                className="px-4 py-2 text-[13px] font-medium rounded-md transition-colors"
                style={{ color: 'hsl(0 0% 46%)', border: '1px solid hsl(0 0% 90%)' }}
              >
                Cancel (Esc)
              </button>
              <button
                onClick={saveInlineEdit}
                disabled={isSaving || editingContent === editedContent}
                className="px-4 py-2 text-[13px] font-medium rounded-md text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'hsl(235 69% 61%)' }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <Card className="bg-white border-slate-200 p-6">
        <MarkdownViewer content={editedContent} />
      </Card>
    );
  };

  // Determine the approve button label
  const getApproveLabel = () => {
    const tabs = getTabList();
    if (tabs.length <= 1) return 'Approve Document';

    const tabNames: Record<string, string> = {
      main: documentType === 'prd' ? 'PRD' : documentType === 'design' ? 'Design Brief' : 'Technical Specification',
      technology: 'Technology Choices',
      criteria: 'Acceptance Criteria',
      screens: 'Screens',
    };

    const currentTabName = tabNames[activeTab] || 'Document';
    const remaining = tabs.filter((t) => !approvedTabs.has(t) && t !== activeTab).length;

    if (remaining === 0) {
      return `Approve ${currentTabName} & Continue`;
    }
    return `Approve ${currentTabName}`;
  };

  return (
    <div className="space-y-6 pb-52">
      {/* Header */}
      <div
        className="flex flex-col space-y-1 p-4 rounded-lg"
        style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{docInfo.icon}</span>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>{docInfo.title}</h2>
              <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>{docInfo.description}</p>
            </div>
          </div>
          <span
            className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'hsl(45 93% 94%)', color: 'hsl(45 93% 35%)' }}
          >
            Pending
          </span>
        </div>
      </div>

      {/* Tabs for Engineer Review */}
      {hasTechnologyChoices && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'main' | 'technology')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-white">
            <TabsTrigger value="main">
              <span>📄</span>
              <span className="ml-2">Technical Specification</span>
              {approvedTabs.has('main') && <span className="ml-1.5 text-green-600">✓</span>}
            </TabsTrigger>
            <TabsTrigger value="technology">
              <span>⚡</span>
              <span className="ml-2">Technology Choices</span>
              {approvedTabs.has('technology') && <span className="ml-1.5 text-green-600">✓</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main">
            {renderMarkdownContent()}
          </TabsContent>

          <TabsContent value="technology">
            {loadingTechChoices ? (
              <Card className="bg-white border-slate-200 p-8 text-center">
                <div className="animate-pulse">
                  <div className="text-4xl mb-4">⚡</div>
                  <p className="text-slate-600">Loading technology choices...</p>
                </div>
              </Card>
            ) : (
              <TechnologyChoicesEditor
                content={technologyChoicesContent}
                projectId={projectId}
                onSave={(content) => setTechnologyChoicesContent(content)}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Tabs for PM Review (PRD + Acceptance Criteria) */}
      {hasAcceptanceCriteria && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'main' | 'criteria')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-white">
            <TabsTrigger value="main">
              <span>📋</span>
              <span className="ml-2">PRD</span>
              {approvedTabs.has('main') && <span className="ml-1.5 text-green-600">✓</span>}
            </TabsTrigger>
            <TabsTrigger value="criteria">
              <span>✅</span>
              <span className="ml-2">Acceptance Criteria</span>
              {approvedTabs.has('criteria') && <span className="ml-1.5 text-green-600">✓</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main">
            {renderMarkdownContent()}
          </TabsContent>

          <TabsContent value="criteria">
            {loadingAcceptanceCriteria ? (
              <Card className="bg-white border-slate-200 p-8 text-center">
                <div className="animate-pulse">
                  <div className="text-4xl mb-4">✅</div>
                  <p className="text-slate-600">Loading acceptance criteria...</p>
                </div>
              </Card>
            ) : (
              <AcceptanceCriteriaEditor
                content={acceptanceCriteriaContent}
                projectId={projectId}
                onSave={(content) => setAcceptanceCriteriaContent(content)}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Tabs for Designer Review */}
      {hasScreens && !hasTechnologyChoices && !hasAcceptanceCriteria && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'main' | 'screens')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-white">
            <TabsTrigger value="main">
              <span>📋</span>
              <span className="ml-2">Design Brief</span>
              {approvedTabs.has('main') && <span className="ml-1.5 text-green-600">✓</span>}
            </TabsTrigger>
            <TabsTrigger value="screens">
              <span>📱</span>
              <span className="ml-2">Screens</span>
              {approvedTabs.has('screens') && <span className="ml-1.5 text-green-600">✓</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main">
            {renderMarkdownContent()}
          </TabsContent>

          <TabsContent value="screens">
            {loadingScreens ? (
              <Card className="bg-white border-slate-200 p-8 text-center">
                <div className="animate-pulse">
                  <div className="text-4xl mb-4">📱</div>
                  <p className="text-slate-600">Loading screens...</p>
                </div>
              </Card>
            ) : screensContent ? (
              <ScreensRenderer content={screensContent} projectId={projectId} />
            ) : (
              <Card className="bg-white border-slate-200 p-8 text-center">
                <div className="text-4xl mb-4">📱</div>
                <p className="text-slate-500">No screens data available</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Document Content for cases without tabs */}
      {!hasTechnologyChoices && !hasScreens && !hasAcceptanceCriteria && (
        documentType === 'technology-choices' ? (
          <TechnologyChoicesEditor
            content={editedContent}
            projectId={projectId}
            onSave={(content) => setEditedContent(content)}
          />
        ) : (
          renderMarkdownContent()
        )
      )}

      {/* Edit with AI panel — rendered inline below the document */}
      {showEditWithAI && sessionId && phase && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(0 0% 92%)' }}>
          <RefinePanel
            phase={phase}
            projectId={projectId}
            sessionId={sessionId}
            onRefineComplete={() => {
              setShowEditWithAI(false);
              onRefineComplete?.();
            }}
            disabled={false}
          />
        </div>
      )}

      {/* Unified Action Bar — Sticky Footer */}
      {!isBreakdownComplete && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
          <div className="max-w-4xl mx-auto">
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col gap-3">
                {/* Warning message when tech choices not complete */}
                {!allTechChoicesMade && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                    <span className="text-yellow-600 text-lg">⚠️</span>
                    <p className="text-sm text-yellow-800">
                      <strong>Action Required:</strong> Select the technology you want to use in the &quot;Technology Choices&quot; tab before continuing.
                    </p>
                  </div>
                )}

                {/* Approved tabs indicator */}
                {hasTabs && approvedTabs.size > 0 && (
                  <p className="text-[12px]" style={{ color: 'hsl(142 76% 36%)' }}>
                    {approvedTabs.size} of {getTabList().length} tabs approved
                  </p>
                )}

                <div className="flex items-center gap-3">
                  {/* Edit dropdown — only show when editing is possible */}
                  {canEdit && !isEditing && (
                    <div className="relative" ref={editDropdownRef}>
                      <button
                        onClick={() => setShowEditDropdown(!showEditDropdown)}
                        className="px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'hsl(0 0% 32%)',
                          border: '1px solid hsl(0 0% 90%)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span>Edit</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {showEditDropdown && (
                        <div
                          className="absolute bottom-full mb-1 left-0 rounded-md shadow-lg py-1 min-w-[180px]"
                          style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 90%)' }}
                        >
                          {/* Edit manually — only for .MD tabs */}
                          {isMainTab && (
                            <button
                              onClick={() => {
                                setIsEditing(true);
                                setEditingContent(editedContent);
                                setShowEditDropdown(false);
                                setShowEditWithAI(false);
                              }}
                              className="w-full text-left px-4 py-2 text-[13px] transition-colors flex items-center gap-2"
                              style={{ color: 'hsl(0 0% 20%)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Edit manually
                            </button>
                          )}

                          {/* Edit with AI */}
                          {sessionId && phase && (
                            <button
                              onClick={() => {
                                setShowEditWithAI(!showEditWithAI);
                                setShowEditDropdown(false);
                                setIsEditing(false);
                              }}
                              className="w-full text-left px-4 py-2 text-[13px] transition-colors flex items-center gap-2"
                              style={{ color: 'hsl(0 0% 20%)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <span>✨</span>
                              Edit with AI
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Approve Document button */}
                  <Button
                    onClick={handleApproveDocument}
                    disabled={approving || !allTechChoicesMade || isEditing}
                    variant="success"
                    title={!allTechChoicesMade ? 'Select technologies in the "Technology Choices" tab first' : ''}
                  >
                    {approving ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Approving...
                      </>
                    ) : (
                      <>
                        ✅ {getApproveLabel()}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        </div>
      )}
    </div>
  );
}
