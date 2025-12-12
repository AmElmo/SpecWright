import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { WireframeRenderer, WireframeFrame, WireframeElement } from './WireframeRenderer';

interface ComponentReference {
  name: string;
  path?: string;
  reason?: string;
}

interface Screen {
  id: string;
  name: string;
  route: string;
  description: string;
  wireframe: WireframeElement;
  notes?: string;
  components_to_reuse?: ComponentReference[];
  components_to_create?: ComponentReference[];
}

interface UserFlowStep {
  step: number;
  screen: string;
  action: string;
}

interface UserFlow {
  id: string;
  name: string;
  steps: UserFlowStep[];
}

interface ScreensData {
  project_id: string;
  project_name: string;
  screens: Screen[];
  user_flows: UserFlow[];
}

interface ScreensRendererProps {
  content: string;
  projectId: string;
  onSave?: () => void;
}

// Chevron icon for dropdown
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function ScreensRenderer({ content }: ScreensRendererProps) {
  const [data, setData] = useState<ScreensData | null>(null);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      setData(parsed);
      setError(null);
    } catch (e) {
      setError('Failed to parse screens.json');
      logger.error('Error parsing screens.json:', e);
    }
  }, [content]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (error || !data) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <span>⚠️</span>
            <span>{error || 'No screen data available'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle case where screens array is empty or has placeholders
  if (!data.screens || data.screens.length === 0 || data.screens[0]?.id?.includes('PLACEHOLDER')) {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-yellow-700">
            <span>⏳</span>
            <span>Screens data is not yet populated. The AI will generate wireframes during the design phase.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeScreen = data.screens[activeScreenIndex];
  const screenCount = data.screens.length;

  return (
    <div className="space-y-6">
      {/* Header with Screen Selector Dropdown */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">
          {data.project_name} - Screens
        </h3>
        
        {/* Screen Selector Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all"
            style={{
              backgroundColor: 'hsl(0 0% 100%)',
              border: '1px solid hsl(0 0% 88%)',
              color: 'hsl(0 0% 9%)',
              boxShadow: dropdownOpen ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!dropdownOpen) {
                e.currentTarget.style.borderColor = 'hsl(235 69% 70%)';
              }
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen) {
                e.currentTarget.style.borderColor = 'hsl(0 0% 88%)';
              }
            }}
          >
            <span className="text-[13px] font-medium truncate max-w-[200px]">
              {activeScreen?.name}
            </span>
            <span 
              className="text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'hsl(235 69% 95%)', color: 'hsl(235 69% 50%)' }}
            >
              {activeScreenIndex + 1} / {screenCount}
            </span>
            <ChevronDownIcon />
          </button>
          
          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div 
              className="absolute right-0 top-full mt-1 w-72 max-h-80 overflow-y-auto rounded-lg z-50"
              style={{
                backgroundColor: 'hsl(0 0% 100%)',
                border: '1px solid hsl(0 0% 90%)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
              }}
            >
              <div className="p-1">
                {data.screens.map((screen, index) => {
                  const isActive = index === activeScreenIndex;
                  return (
                    <button
                      key={screen.id}
                      onClick={() => {
                        setActiveScreenIndex(index);
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors"
                      style={{
                        backgroundColor: isActive ? 'hsl(235 69% 97%)' : 'transparent',
                        color: isActive ? 'hsl(235 69% 45%)' : 'hsl(0 0% 32%)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span 
                        className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[11px] font-medium"
                        style={{ 
                          backgroundColor: isActive ? 'hsl(235 69% 61%)' : 'hsl(0 0% 92%)',
                          color: isActive ? 'white' : 'hsl(0 0% 46%)'
                        }}
                      >
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p 
                          className="text-[13px] font-medium truncate"
                          style={{ color: isActive ? 'hsl(235 69% 45%)' : 'hsl(0 0% 9%)' }}
                        >
                          {screen.name}
                        </p>
                        <p 
                          className="text-[11px] truncate"
                          style={{ color: 'hsl(0 0% 56%)' }}
                        >
                          {screen.route}
                        </p>
                      </div>
                      {isActive && (
                        <span style={{ color: 'hsl(235 69% 61%)' }}>
                          <CheckIcon />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active screen display */}
      {activeScreen && (
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{activeScreen.name}</CardTitle>
                <Badge variant="outline" className="text-xs mt-1">
                  📍 {activeScreen.route}
                </Badge>
              </div>
              <span className="text-xs text-slate-400">{activeScreen.id}</span>
            </div>
            <p className="text-sm text-slate-600 mt-2">{activeScreen.description}</p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Wireframe View */}
            <div className="flex justify-center bg-gray-100 rounded-lg p-6">
              {activeScreen.wireframe ? (
                <WireframeFrame title={activeScreen.name}>
                  <WireframeRenderer element={activeScreen.wireframe} />
                </WireframeFrame>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <div className="text-6xl mb-4">🖼️</div>
                  <p>No wireframe defined for this screen.</p>
                  <p className="text-sm text-gray-400 mt-2">The AI will generate a visual wireframe structure.</p>
                </div>
              )}
            </div>

            {/* Components List (simple inline display) */}
            {(activeScreen.components_to_reuse?.length || activeScreen.components_to_create?.length) && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3">Components</h4>
                <div className="flex flex-wrap gap-2">
                  {activeScreen.components_to_reuse?.map((comp, i) => (
                    <Badge key={`reuse-${i}`} variant="secondary" className="text-xs bg-green-100 text-green-700">
                      ♻️ {comp.name}
                    </Badge>
                  ))}
                  {activeScreen.components_to_create?.map((comp, i) => (
                    <Badge key={`create-${i}`} variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                      🆕 {comp.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Screen notes */}
            {activeScreen.notes && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500">💡</span>
                  <p className="text-sm text-blue-700">{activeScreen.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Flows - Vertical Layout */}
      {data.user_flows && data.user_flows.length > 0 && !data.user_flows[0]?.id?.includes('PLACEHOLDER') && (
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <span>🔄</span> User Flows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data.user_flows.map(flow => (
                <div key={flow.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <h5 className="font-medium text-slate-700 mb-4">{flow.name}</h5>
                  <div className="flex flex-col items-start gap-0">
                    {flow.steps.map((step, i) => (
                      <div key={i} className="flex flex-col items-start">
                        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-slate-200 w-full max-w-md">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                            {step.step}
                          </div>
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">{step.screen}</span>
                            <span className="text-slate-400 mx-2">→</span>
                            <span className="text-slate-700">{step.action}</span>
                          </div>
                        </div>
                        {i < flow.steps.length - 1 && (
                          <div className="ml-3 py-1">
                            <span className="text-slate-400 text-lg">↓</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
