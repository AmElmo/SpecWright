import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Textarea } from './ui/textarea';

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

// Flow-based configuration showing inputs → prompts → outputs
const AGENT_FLOWS: AgentFlow[] = [
  {
    id: 'product_manager',
    name: 'Product Manager',
    emoji: '✍️',
    role: 'Requirements & Behavior',
    color: '#8b5cf6', // Purple
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
    color: '#06b6d4', // Cyan
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
    color: '#f59e0b', // Amber
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
    color: '#10b981', // Emerald
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

// Rough token estimation (1 token ≈ 4 characters for English text)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Format token count with K suffix for thousands
function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Get token count color based on size
function getTokenColor(count: number): string {
  if (count < 500) return '#22c55e'; // Green - small
  if (count < 1500) return '#f59e0b'; // Amber - medium
  if (count < 3000) return '#f97316'; // Orange - large
  return '#ef4444'; // Red - very large
}

// Check if content has file references (these should NOT be edited)
function findNonEditableRanges(content: string): { pattern: string; count: number; examples: string[] }[] {
  const found: { pattern: string; count: number; examples: string[] }[] = [];
  
  // Match file references like (project_request.md), (questions.json), etc.
  // Looks for filenames with extensions in parentheses or standalone
  const fileRefsInParens = content.match(/\([a-zA-Z0-9_\-]+\.(md|json|txt|ts|tsx|js|jsx|py|yml|yaml)\)/g);
  if (fileRefsInParens && fileRefsInParens.length > 0) {
    const unique = [...new Set(fileRefsInParens)];
    found.push({ 
      pattern: 'File references in parentheses', 
      count: fileRefsInParens.length,
      examples: unique.slice(0, 5) // Show first 5 unique examples
    });
  }
  
  // Also catch standalone file references that look like: filename.extension
  // But avoid matching URLs and paths, focus on simple filenames
  const standaloneFiles = content.match(/\b([a-zA-Z0-9_\-]+\.(md|json))\b/g);
  if (standaloneFiles && standaloneFiles.length > 0) {
    // Filter out those already caught in parentheses
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
  
  // Match @${...} template variables (used in generated prompts)
  const templateVars = content.match(/@\$\{[^}]+\}/g);
  if (templateVars && templateVars.length > 0) {
    const unique = [...new Set(templateVars)];
    found.push({ 
      pattern: 'Template variables', 
      count: templateVars.length,
      examples: unique.slice(0, 3)
    });
  }
  
  // Match {{...}} placeholders (path variables)
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

export function CustomizeAgents() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<CustomizableFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Load file content when file is selected
  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile.path);
    }
  }, [selectedFile]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedFile) {
        setSelectedFile(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedFile]);

  // Handle CMD+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
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
    setLoading(true);
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
      setLoading(false);
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

  // Real-time token count
  const tokenCount = useMemo(() => estimateTokens(editedContent), [editedContent]);
  const originalTokenCount = useMemo(() => estimateTokens(fileContent), [fileContent]);
  const tokenDiff = tokenCount - originalTokenCount;
  
  // Non-editable pattern warnings
  const nonEditableWarnings = useMemo(() => findNonEditableRanges(editedContent), [editedContent]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.25rem 1.5rem' }}>
          <button
            onClick={() => navigate('/settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              color: '#64748b',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0',
              marginBottom: '0.5rem'
            }}
          >
            <span>←</span>
            <span>Back to Settings</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a' }}>
              ⚙️ Customize Prompts & Templates
            </h1>
            <button
              onClick={() => setShowHelp(!showHelp)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}
              title="How does it work?"
            >
              ?
            </button>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
            Edit prompts and templates to customize AI behavior • Click any <span style={{ color: '#22c55e' }}>✏️</span> to edit
          </p>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '2rem'
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a' }}>
                How Does It Work?
              </h2>
            </div>
            <div style={{ padding: '1.5rem', color: '#475569', lineHeight: '1.7' }}>
              <p style={{ marginBottom: '1rem' }}>
                SpecWright uses <strong>AI agents</strong> (Product Manager, Designer, Engineer) to create specifications. Each agent follows a workflow:
              </p>
              
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#8b5cf6' }}>⚡ System Prompt</strong>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Defines the agent's role, expertise, and personality. Sets the foundation for how they think and respond.
                  </p>
                </div>
                
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#3b82f6' }}>🔹 Phase Prompts</strong>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Instructions for each phase of work (e.g., asking questions, analyzing requirements). Controls what the agent does and how.
                  </p>
                </div>
                
                <div>
                  <strong style={{ color: '#22c55e' }}>📄 Output Templates</strong>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Structure for documents the agent creates (PRD, Design Brief, etc.). Defines sections and format.
                  </p>
                </div>
              </div>
              
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                <strong>💡 You can edit prompts and templates</strong> to change how agents behave, what questions they ask, and what documents they produce. Changes take effect on the next workflow run.
              </p>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Flow Diagrams */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        
        {/* Scoping Prompt Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎯</span>
            <span>Project Scoping</span>
          </h2>
          <Card>
            <CardHeader style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e2e8f0' }}>
              <CardTitle className="text-base">Scoping Analysis Prompt</CardTitle>
              <CardDescription className="text-sm">
                Controls how SpecWright analyzes user requests and decides between "Work Directly" vs "Create Project"
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div 
                onClick={() => setSelectedFile({
                  path: 'specwright/templates/scoping_prompt.md',
                  displayName: 'Scoping Prompt',
                  description: 'Determines work classification and project breakdown logic',
                  type: 'prompt',
                  editable: true
                })}
                style={{
                  padding: '1rem 1.25rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a' }}>
                    scoping_prompt.md
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Edit classification rules, decision guidelines, and examples
                  </div>
                </div>
                <Badge style={{ 
                  backgroundColor: '#3b82f620', 
                  color: '#3b82f6', 
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem'
                }}>
                  ✏️ Edit
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Agent Workflows Section */}
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.75rem' }}>
          Agent Workflows
        </h2>
        
        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          gap: '2rem', 
          marginBottom: '2rem',
          padding: '1rem 1.5rem',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#a855f7' }}></div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>System Prompt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#3b82f6' }}></div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Phase Prompt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#22c55e' }}></div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Output Template</span>
          </div>
        </div>

        {/* Agent Flow Diagrams */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {AGENT_FLOWS.map((agent) => (
            <AgentFlowDiagram
              key={agent.id}
              agent={agent}
              onEditFile={setSelectedFile}
            />
          ))}
        </div>
      </main>

      {/* File Editor Modal */}
      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 text-white border-slate-700">
          {selectedFile && (
            <>
              <DialogHeader className="border-b border-slate-700 pb-4 pr-12">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="text-slate-50">{selectedFile.displayName}</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1">
                      {selectedFile.description}
                    </DialogDescription>
                    <code className="text-xs text-indigo-400 bg-slate-800 px-2 py-1 rounded mt-2 inline-block font-mono">
                      {selectedFile.path}
                    </code>
                  </div>
                  
                  {/* Token Counter */}
                  <div className="flex flex-col items-end min-w-[100px]">
                    <div 
                      className="text-xl font-bold font-mono"
                      style={{ color: getTokenColor(tokenCount) }}
                    >
                      ~{formatTokenCount(tokenCount)}
                    </div>
                    <div className="text-xs text-slate-500">tokens</div>
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
                
                {/* Warnings for file references */}
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
              
              {/* Editor Content */}
              <div className="flex-1 overflow-auto p-6">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 mt-4">Loading file...</p>
                  </div>
                ) : (
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-full min-h-[450px] font-mono text-sm bg-slate-950 text-slate-200 border-slate-700 focus-visible:ring-blue-500"
                  />
                )}
              </div>
              
              {/* Footer */}
              <DialogFooter className="border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between w-full">
                  <div className="text-xs text-slate-500">
                    💡 Tip: Changes take effect on next workflow run
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setSelectedFile(null)}
                      disabled={saving}
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveFileContent}
                      disabled={saving || editedContent === fileContent}
                      variant={editedContent === fileContent ? "secondary" : "default"}
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
    </div>
  );
}

// Flow Diagram Component for each Agent
function AgentFlowDiagram({ 
  agent, 
  onEditFile 
}: { 
  agent: AgentFlow; 
  onEditFile: (file: CustomizableFile) => void;
}) {
  return (
    <Card className="overflow-hidden">
      {/* Agent Header */}
      <CardHeader 
        style={{ 
          background: `linear-gradient(135deg, ${agent.color}20 0%, ${agent.color}05 100%)`,
          borderBottom: `2px solid ${agent.color}40`
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.emoji}</span>
          <div>
            <CardTitle className="text-lg">{agent.name}</CardTitle>
            <CardDescription className="text-xs">{agent.role}</CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Flow Content */}
      <CardContent className="p-5 relative">
        {/* Vertical line connector */}
        <div className="absolute left-8 top-5 bottom-5 w-0.5 bg-slate-200" />

        {/* System Prompt (if exists) */}
        {agent.systemPrompt && (
          <FlowNode
            icon="⚡"
            color="#a855f7"
            file={agent.systemPrompt}
            onEdit={onEditFile}
          />
        )}

        {/* Phase Prompts */}
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

        {/* Separator */}
        <div className="ml-10 my-4 border-t border-dashed border-slate-300 relative">
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-slate-600">
            OUTPUTS
          </span>
        </div>

        {/* Output Templates */}
        {agent.outputTemplates.map((template, idx) => (
          <FlowNode
            key={idx}
            icon="📄"
            color={template.editable ? '#22c55e' : '#64748b'}
            file={template}
            onEdit={onEditFile}
          />
        ))}
      </CardContent>
    </Card>
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
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        gap: '0.75rem',
        marginBottom: '0.75rem',
        position: 'relative'
      }}
    >
      {/* Node indicator */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: isNumber ? '6px' : '50%',
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isNumber ? '0.75rem' : '0.875rem',
        fontWeight: isNumber ? '700' : '400',
        color: 'white',
        flexShrink: 0,
        zIndex: 1,
        boxShadow: `0 0 0 3px white`
      }}>
        {icon}
      </div>

      {/* Content */}
      <div 
        onClick={file.editable ? () => onEdit(file) : undefined}
        style={{
          flex: 1,
          padding: '0.625rem 0.875rem',
          backgroundColor: file.editable ? '#f8fafc' : '#f1f5f9',
          border: `1px solid ${file.editable ? '#e2e8f0' : '#cbd5e1'}`,
          borderRadius: '0.5rem',
          cursor: file.editable ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
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
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.backgroundColor = '#f8fafc';
          }
        }}
      >
        {label && (
          <div style={{ 
            fontSize: '0.65rem', 
            color: '#64748b', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.25rem'
          }}>
            {label}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#0f172a' }}>
            {file.displayName}
          </span>
          {file.editable ? (
            <Badge style={{ 
              backgroundColor: `${color}20`, 
              color: color, 
              fontSize: '0.7rem',
              padding: '0.125rem 0.375rem'
            }}>
              ✏️
            </Badge>
          ) : (
            <Badge style={{ 
              backgroundColor: '#475569', 
              color: '#94a3b8', 
              fontSize: '0.7rem',
              padding: '0.125rem 0.375rem'
            }}>
              🔒
            </Badge>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
          {file.description}
        </div>
      </div>
    </div>
  );
}
