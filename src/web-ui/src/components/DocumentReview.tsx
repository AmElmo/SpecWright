import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { MarkdownViewer } from './MarkdownViewer';
import { TechnologyChoicesEditor } from './TechnologyChoicesEditor';
import { AcceptanceCriteriaEditor } from './AcceptanceCriteriaEditor';
import { ScreensRenderer } from './ScreensRenderer';

interface DocumentReviewProps {
  projectId: string;
  documentPath: string;
  documentContent: string;
  documentType: 'prd' | 'wireframes' | 'tech-spec' | 'technology-choices' | 'design';
  onApprove: () => void;
  onReject?: () => void;
}

export function DocumentReview({ 
  projectId, 
  documentContent, 
  documentType,
  onApprove,
  onReject 
}: DocumentReviewProps) {
  const [approving, setApproving] = useState(false);
  const [editedContent, setEditedContent] = useState(documentContent);
  
  // Restore active tab from sessionStorage (persists across page reloads during same session)
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
  const [allTechChoicesMade, setAllTechChoicesMade] = useState(true); // Track if all choices are made

  // Save active tab to sessionStorage when it changes
  useEffect(() => {
    const storageKey = `activeTab_${projectId}_${documentType}`;
    sessionStorage.setItem(storageKey, activeTab);
  }, [activeTab, projectId, documentType]);

  // Check if all technology choices have been made
  useEffect(() => {
    if (documentType === 'tech-spec' && technologyChoicesContent) {
      try {
        const data = JSON.parse(technologyChoicesContent);
        if (data.technology_decisions && data.technology_decisions.length > 0) {
          // Check if all decisions have a selection
          const allSelected = data.technology_decisions.every((decision: any) => 
            decision.user_choice || decision.final_decision
          );
          setAllTechChoicesMade(allSelected);
        } else {
          // No decisions needed, allow approval
          setAllTechChoicesMade(true);
        }
      } catch (err) {
        // If can't parse, allow approval
        setAllTechChoicesMade(true);
      }
    } else {
      // Not a tech-spec document, allow approval
      setAllTechChoicesMade(true);
    }
  }, [technologyChoicesContent, documentType]);

  // Check if this is engineer review and fetch technology_choices.json
  useEffect(() => {
    if (documentType === 'tech-spec') {
      fetchTechnologyChoices();
    }
    if (documentType === 'design') {
      fetchScreens();
    }
    if (documentType === 'prd') {
      fetchAcceptanceCriteria();
    }
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
        return {
          title: 'Product Requirements Document (PRD)',
          icon: '📋',
          description: 'Review the product requirements and acceptance criteria',
          color: 'from-blue-900 to-indigo-900 border-blue-700'
        };
      case 'design':
        return {
          title: 'Design Brief',
          icon: '🎨',
          description: 'Review screens, user flows, and wireframes',
          color: 'from-purple-900 to-pink-900 border-purple-700'
        };
      case 'wireframes':
        return {
          title: 'Wireframes & Design Specifications',
          icon: '🖼️',
          description: 'Review the wireframes and design details for each screen',
          color: 'from-purple-900 to-pink-900 border-purple-700'
        };
      case 'tech-spec':
        return {
          title: 'Technical Specification',
          icon: '⚙️',
          description: 'Review the technical architecture and implementation plan',
          color: 'from-slate-900 to-gray-900 border-slate-700'
        };
      case 'technology-choices':
        return {
          title: 'Technology Choices',
          icon: '⚡',
          description: 'Review and select your preferred technologies for each category',
          color: 'from-slate-900 to-gray-900 border-slate-700'
        };
    }
  };

  const docInfo = getDocumentInfo();

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
      // Clear the tab state from sessionStorage when moving to next phase
      const storageKey = `activeTab_${projectId}_${documentType}`;
      sessionStorage.removeItem(storageKey);
    } catch (err) {
      logger.error('Error approving:', err);
    } finally {
      setApproving(false);
    }
  };

  const hasTechnologyChoices = documentType === 'tech-spec' && technologyChoicesContent;
  const hasScreens = documentType === 'design' && screensContent;
  const hasAcceptanceCriteria = documentType === 'prd' && acceptanceCriteriaContent;

  return (
    <div className="space-y-6 pb-32">
      {/* Header - Clean, minimal style aligned with UI */}
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'main' | 'technology' | 'screens')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="main">
              <span>📄</span>
              <span className="ml-2">Technical Specification</span>
            </TabsTrigger>
            <TabsTrigger value="technology">
              <span>⚡</span>
              <span className="ml-2">Technology Choices</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="main">
            {/* Tech spec is read-only, technology choices are editable */}
            <Card className="bg-white border-slate-200 p-6">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600">ℹ️</span>
                  <p className="text-sm text-blue-800">
                    This document is generated by AI. Make your technology selections in the other tab.
                  </p>
                </div>
              </div>
              <MarkdownViewer content={editedContent} />
            </Card>
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'main' | 'technology' | 'screens' | 'criteria')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="main">
              <span>📋</span>
              <span className="ml-2">PRD</span>
            </TabsTrigger>
            <TabsTrigger value="criteria">
              <span>✅</span>
              <span className="ml-2">Acceptance Criteria</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="main">
            {/* PRD is read-only during review */}
            <Card className="bg-white border-slate-200 p-6">
              <MarkdownViewer content={editedContent} />
            </Card>
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'main' | 'technology' | 'screens')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="main">
              <span>📋</span>
              <span className="ml-2">Design Brief</span>
            </TabsTrigger>
            <TabsTrigger value="screens">
              <span>📱</span>
              <span className="ml-2">Screens</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="main">
            {/* Design Brief is read-only during review */}
            <Card className="bg-white border-slate-200 p-6">
              <MarkdownViewer content={editedContent} />
            </Card>
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
              <ScreensRenderer
                content={screensContent}
                projectId={projectId}
              />
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
          /* All markdown documents are now read-only during review */
          <Card className="bg-white border-slate-200 p-6">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-blue-600">ℹ️</span>
                <p className="text-sm text-blue-800">
                  This document is generated by AI. Request changes by rejecting the review.
                </p>
              </div>
            </div>
            <MarkdownViewer content={editedContent} />
          </Card>
        )
      )}

      {/* Review Actions - Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white border-0 shadow-none rounded-none">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col gap-4">
                <div className="text-slate-900">
                  <h3 className="font-semibold mb-2">Ready to proceed?</h3>
                  <p className="text-slate-600 text-sm">
                    {hasAcceptanceCriteria
                      ? 'Review both tabs above. The PRD is read-only, but you can edit acceptance criteria (add, edit, delete). All changes are automatically saved. Once you approve, we\'ll move to the Designer phase.'
                      : hasTechnologyChoices 
                      ? 'Review both tabs above. The technical specification is read-only, but you can make technology choices. All changes are automatically saved. Once you approve, we\'ll complete the specification.'
                      : hasScreens
                      ? 'Review both tabs above: Design Brief and Screens. The design documents are read-only. The Screens tab shows the component structure for implementation. Once you approve, we\'ll move to the Engineer phase.'
                      : documentType === 'technology-choices' 
                      ? 'You can edit the content above. All changes are automatically saved. Once you approve, we\'ll move to the next phase.'
                      : 'Review the document above. Once you approve, we\'ll move to the next phase of the specification process.'
                    }
                  </p>
                </div>
                
                {/* Warning message when tech choices not complete */}
                {!allTechChoicesMade && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                    <span className="text-yellow-600 text-lg">⚠️</span>
                    <p className="text-sm text-yellow-800">
                      <strong>Action Required:</strong> Select the technology you want to use in the "Technology Choices" tab before continuing.
                    </p>
                  </div>
                )}
                
                <div className="flex gap-4">
                  <Button
                    onClick={handleApprove}
                    disabled={approving || !allTechChoicesMade}
                    variant="success"
                    className="flex-1"
                    title={!allTechChoicesMade ? 'Select the technology you want to use in the "Technology Choices" tab' : ''}
                  >
                    {approving ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Approving...
                      </>
                    ) : (
                      <>
                        ✅ Approve & Continue to Next Phase
                      </>
                    )}
                  </Button>
                  
                  {onReject && (
                    <Button
                      onClick={onReject}
                      variant="outline"
                      disabled={approving}
                    >
                      🔄 Request Changes
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
