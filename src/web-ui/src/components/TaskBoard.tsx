import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useRealtimeUpdates } from '../lib/use-realtime';
import { useShipModal } from '../lib/ship-modal-context';
import { IssueModal } from './IssueModal';
import { AIActionSplitButton } from './AIActionSplitButton';
import type { AITool } from '../lib/use-ai-tool';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

interface AcceptanceCriterion {
  id: string;
  description: string;
}

interface Issue {
  issueId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-review' | 'approved';
  estimatedHours: number;
  dependencies: string[];
  // Traceability fields
  screensAffected?: string[];
  // Issue content
  keyDecisions?: string[];
  acceptanceCriteria?: AcceptanceCriterion[];  // Objects with id and description
  technicalDetails?: string;
  testStrategy?: {
    automated_tests?: string;
    manual_verification?: string;
  };
  humanInTheLoop?: string[];
  // Legacy fields (deprecated)
  implementationNotes?: string;
  filePath?: string;
  projectId: string;
  projectName: string;
}

interface TaskCounts {
  blocked: number;
  ready: number;
  inReview: number;
  approved: number;
  total: number;
}

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

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const BoardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 4.5V8L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="7.5" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 7.5V5C5 3.34315 6.34315 2 8 2C9.65685 2 11 3.34315 11 5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export function TaskBoard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = searchParams.get('project');
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [repositoryName, setRepositoryName] = useState<string>('');

  // Use context for ShipModal - modal is rendered at App level
  const { openShipModal } = useShipModal();

  useRealtimeUpdates(() => {
    fetchIssues();
  });

  const fetchWorkspaceInfo = async () => {
    try {
      const res = await fetch('/api/workspace-info');
      if (res.ok) {
        const data = await res.json();
        setRepositoryName(data.repositoryName);
      }
    } catch (err) {
      logger.error('Failed to fetch workspace info:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchIssues();
    fetchWorkspaceInfo();
  }, []);

  useEffect(() => {
    if (projectFilter) {
      setSelectedProject(projectFilter);
    }
  }, [projectFilter]);

  const handleProjectFilterChange = (projectId: string) => {
    setSelectedProject(projectId);
    setShowProjectDropdown(false);
    
    if (projectId === 'all') {
      searchParams.delete('project');
    } else {
      searchParams.set('project', projectId);
    }
    setSearchParams(searchParams);
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data.map((p: any) => ({
        id: p.id,
        name: p.name || p.description
      })));
    } catch (err) {
      logger.error('Failed to fetch projects:', err);
    }
  };

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/issues');
      if (!response.ok) throw new Error('Failed to fetch issues');
      
      const data = await response.json();
      setIssues(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = selectedProject === 'all' 
    ? issues 
    : issues.filter(i => i.projectId === selectedProject);

  const getIssueDependenciesMet = (issue: Issue): boolean => {
    if (issue.dependencies.length === 0) return true;
    return issue.dependencies.every(depId => {
      const depIssue = issues.find(i => i.issueId === depId);
      return depIssue?.status === 'approved';
    });
  };

  const categorizedIssues = {
    blocked: filteredIssues.filter(i => i.status === 'pending' && !getIssueDependenciesMet(i)),
    ready: filteredIssues.filter(i => i.status === 'pending' && getIssueDependenciesMet(i)),
    inReview: filteredIssues.filter(i => i.status === 'in-review'),
    approved: filteredIssues.filter(i => i.status === 'approved')
  };

  const counts: TaskCounts = {
    blocked: categorizedIssues.blocked.length,
    ready: categorizedIssues.ready.length,
    inReview: categorizedIssues.inReview.length,
    approved: categorizedIssues.approved.length,
    total: filteredIssues.length
  };

  const handleShip = (issue: Issue, aiToolOverride?: AITool) => {
    openShipModal(issue, aiToolOverride);
    setSelectedIssue(null); // Close issue detail modal if open
  };

  const handleApprove = async (issue: Issue) => {
    try {
      const response = await fetch(`/api/issues/${issue.projectId}/${issue.issueId}/approve`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to approve');
      
      await fetchIssues();
      setSelectedIssue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  // Sidebar nav items
  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/', active: location.pathname === '/' },
    { label: 'Issues', icon: IssuesIcon, path: '/issues', active: location.pathname === '/issues' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings', active: location.pathname === '/settings' },
  ];

  // Status configuration
  const statusConfig = {
    blocked: { label: 'Blocked', color: 'hsl(0 0% 46%)', bgColor: 'hsl(0 0% 94%)' },
    ready: { label: 'Ready', color: 'hsl(44 100% 42%)', bgColor: 'hsl(44 100% 94%)' },
    inReview: { label: 'In Review', color: 'hsl(210 100% 45%)', bgColor: 'hsl(210 100% 95%)' },
    approved: { label: 'Completed', color: 'hsl(142 76% 36%)', bgColor: 'hsl(142 76% 94%)' }
  };

  const renderIssueCard = (issue: Issue, columnType: keyof typeof statusConfig) => {
    const project = projects.find(p => p.id === issue.projectId);
    const isBlocked = columnType === 'blocked';
    const isReady = columnType === 'ready';
    const config = statusConfig[columnType];
    
    return (
      <div 
        key={issue.issueId}
        className="rounded-lg p-4 cursor-pointer transition-all duration-150"
        style={{
          backgroundColor: 'white',
          border: '1px solid hsl(0 0% 92%)',
        }}
        onClick={() => setSelectedIssue(issue)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'hsl(0 0% 99%)';
          e.currentTarget.style.borderColor = 'hsl(0 0% 85%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'white';
          e.currentTarget.style.borderColor = 'hsl(0 0% 92%)';
        }}
      >
        {/* Title */}
        <h3 className="text-[13px] font-semibold mb-2 line-clamp-2" style={{ color: 'hsl(0 0% 9%)' }}>
          {issue.title}
        </h3>
        
        {/* Project Tag */}
        {project && (
          <div 
            className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full mb-3"
            style={{ 
              backgroundColor: 'hsl(235 69% 95%)',
              color: 'hsl(235 69% 45%)'
            }}
          >
            <span className="font-medium">Project</span>
            <span className="font-mono opacity-80">{project.id}</span>
            <span>·</span>
            <span className="truncate max-w-[120px]">{project.name}</span>
          </div>
        )}
        
        {/* Blocked indicator */}
        {isBlocked && issue.dependencies.length > 0 && (
          <div 
            className="text-[11px] px-2 py-1.5 rounded mb-3 flex items-center gap-1.5"
            style={{ 
              backgroundColor: 'hsl(25 95% 94%)',
              color: 'hsl(25 95% 40%)'
            }}
          >
            <LockIcon />
            <span>Blocked by {issue.dependencies.length} {issue.dependencies.length === 1 ? 'issue' : 'issues'}</span>
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid hsl(0 0% 94%)' }}>
          <span className="font-mono text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>
            {issue.issueId}
          </span>
          <div className="flex items-center gap-1" style={{ color: 'hsl(0 0% 46%)' }}>
            <ClockIcon />
            <span className="text-[11px]">{issue.estimatedHours}h</span>
          </div>
        </div>
        
        {/* Ship button */}
        {isReady && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <AIActionSplitButton
              label="Ship"
              onRun={(toolOverride) => handleShip(issue, toolOverride)}
              fullWidth
              size="sm"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      {/* Sidebar */}
      <aside 
        className="w-[220px] h-screen flex flex-col border-r sticky top-0"
        style={{ 
          backgroundColor: 'white',
          borderColor: 'hsl(0 0% 92%)'
        }}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <img src={specwrightLogo} alt="SpecWright" className="w-7 h-7" />
            <span className="font-semibold text-[18px]" style={{ color: 'hsl(0 0% 9%)' }}>
              SpecWright
            </span>
          </Link>
          <div 
            className="mt-2 text-[11px] font-mono truncate"
            style={{ color: 'hsl(0 0% 46%)' }}
          >
            <span style={{ color: 'hsl(0 0% 60%)' }}>Repo:</span> {repositoryName || 'Loading...'}
          </div>
        </div>

        {/* New Project Button */}
        <div className="p-3 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <button
            onClick={() => navigate('/create-project')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all"
            style={{
              backgroundColor: 'hsl(235 69% 61%)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>New Project</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-0.5">
            {navItems.filter(item => item.label !== 'Settings').map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                  style={{
                    backgroundColor: item.active ? 'hsl(0 0% 96%)' : 'transparent',
                    color: item.active ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                  }}
                  onMouseEnter={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <item.icon />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* Settings at bottom */}
        {(() => {
          const settingsItem = navItems.find(item => item.label === 'Settings');
          if (!settingsItem) return null;
          return (
            <div className="p-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
              <Link
                to={settingsItem.path}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                style={{
                  backgroundColor: settingsItem.active ? 'hsl(0 0% 96%)' : 'transparent',
                  color: settingsItem.active ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                }}
                onMouseEnter={(e) => {
                  if (!settingsItem.active) {
                    e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!settingsItem.active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <settingsItem.icon />
                <span className="text-[13px] font-medium">{settingsItem.label}</span>
              </Link>
            </div>
          );
        })()}
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header 
          className="sticky top-0 z-10 px-6 py-3 border-b flex items-center justify-between"
          style={{ 
            backgroundColor: 'white',
            borderColor: 'hsl(0 0% 92%)'
          }}
        >
          <div className="flex items-center gap-3">
            <IssuesIcon />
            <h1 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
              Issues
            </h1>
            <span 
              className="text-[12px] px-1.5 py-0.5 rounded"
              style={{ 
                backgroundColor: 'hsl(0 0% 96%)',
                color: 'hsl(0 0% 46%)'
              }}
            >
              {counts.total}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Project Filter */}
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors"
                style={{
                  backgroundColor: selectedProject !== 'all' ? 'hsl(0 0% 96%)' : 'transparent',
                  color: 'hsl(0 0% 32%)',
                  border: '1px solid hsl(0 0% 90%)'
                }}
              >
                <FilterIcon />
                <span>
                  {selectedProject === 'all' ? 'All projects' : projects.find(p => p.id === selectedProject)?.name || 'Filter'}
                </span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={`transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`}>
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              {showProjectDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowProjectDropdown(false)} />
                  <div 
                    className="absolute top-full left-0 mt-1 w-56 rounded-md shadow-lg z-20 py-1"
                    style={{ 
                      backgroundColor: 'white',
                      border: '1px solid hsl(0 0% 92%)'
                    }}
                  >
                    <button
                      onClick={() => handleProjectFilterChange('all')}
                      className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                      style={{
                        backgroundColor: selectedProject === 'all' ? 'hsl(0 0% 96%)' : 'transparent',
                        color: 'hsl(0 0% 9%)',
                      }}
                    >
                      All projects
                    </button>
                    {projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectFilterChange(project.id)}
                        className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                        style={{
                          backgroundColor: selectedProject === project.id ? 'hsl(0 0% 96%)' : 'transparent',
                          color: 'hsl(0 0% 9%)',
                        }}
                      >
                        {project.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View Toggle */}
            <div 
              className="flex rounded-md overflow-hidden"
              style={{ border: '1px solid hsl(0 0% 90%)' }}
            >
              <button
                onClick={() => setViewMode('board')}
                className="px-2.5 py-1.5 flex items-center gap-1.5 text-[13px] transition-colors"
                style={{
                  backgroundColor: viewMode === 'board' ? 'hsl(0 0% 96%)' : 'transparent',
                  color: viewMode === 'board' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                }}
              >
                <BoardIcon />
                Board
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="px-2.5 py-1.5 flex items-center gap-1.5 text-[13px] transition-colors"
                style={{
                  backgroundColor: viewMode === 'list' ? 'hsl(0 0% 96%)' : 'transparent',
                  color: viewMode === 'list' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)',
                  borderLeft: '1px solid hsl(0 0% 90%)'
                }}
              >
                <ListIcon />
                List
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="linear-spinner"></div>
                <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                  Loading issues...
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div 
              className="rounded-md p-4 mb-4"
              style={{ 
                backgroundColor: 'hsl(0 84% 97%)',
                border: '1px solid hsl(0 84% 90%)'
              }}
            >
              <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>
                {error}
              </p>
            </div>
          )}

          {/* Board View - Always show columns */}
          {!loading && !error && viewMode === 'board' && (
            <>
              {/* Kanban columns - always visible */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {/* Blocked */}
                <div className="min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusConfig.blocked.color }} />
                    <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Blocked</span>
                    <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}>
                      {counts.blocked}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {categorizedIssues.blocked.length > 0 ? (
                      categorizedIssues.blocked.map(issue => renderIssueCard(issue, 'blocked'))
                    ) : (
                      <div 
                        className="rounded-lg p-4 text-center"
                        style={{ 
                          backgroundColor: 'hsl(0 0% 100%)',
                          border: '1px dashed hsl(0 0% 88%)'
                        }}
                      >
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 60%)' }}>
                          No blocked issues
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ready */}
                <div className="min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusConfig.ready.color }} />
                    <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Ready</span>
                    <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}>
                      {counts.ready}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {categorizedIssues.ready.length > 0 ? (
                      categorizedIssues.ready.map(issue => renderIssueCard(issue, 'ready'))
                    ) : (
                      <div 
                        className="rounded-lg p-4 text-center"
                        style={{ 
                          backgroundColor: 'hsl(0 0% 100%)',
                          border: '1px dashed hsl(0 0% 88%)'
                        }}
                      >
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 60%)' }}>
                          No issues ready
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* In Review */}
                <div className="min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusConfig.inReview.color }} />
                    <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>In Review</span>
                    <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}>
                      {counts.inReview}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {categorizedIssues.inReview.length > 0 ? (
                      categorizedIssues.inReview.map(issue => renderIssueCard(issue, 'inReview'))
                    ) : (
                      <div 
                        className="rounded-lg p-4 text-center"
                        style={{ 
                          backgroundColor: 'hsl(0 0% 100%)',
                          border: '1px dashed hsl(0 0% 88%)'
                        }}
                      >
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 60%)' }}>
                          No issues in review
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Completed */}
                <div className="min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusConfig.approved.color }} />
                    <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Completed</span>
                    <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}>
                      {counts.approved}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {categorizedIssues.approved.length > 0 ? (
                      categorizedIssues.approved.map(issue => renderIssueCard(issue, 'approved'))
                    ) : (
                      <div 
                        className="rounded-lg p-4 text-center"
                        style={{ 
                          backgroundColor: 'hsl(0 0% 100%)',
                          border: '1px dashed hsl(0 0% 88%)'
                        }}
                      >
                        <p className="text-[12px]" style={{ color: 'hsl(0 0% 60%)' }}>
                          No completed issues
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Empty State Message - Below columns when no issues */}
              {filteredIssues.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'hsl(0 0% 96%)' }}
                  >
                    <IssuesIcon />
                  </div>
                  <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                    No issues yet
                  </h2>
                  <p className="text-[13px] mb-4 text-center max-w-md" style={{ color: 'hsl(0 0% 46%)' }}>
                    Issues are generated after completing a project specification. Create a project and run through the spec workflow.
                  </p>
                  <button
                    onClick={() => navigate('/create-project')}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-colors"
                    style={{
                      backgroundColor: 'hsl(235 69% 61%)',
                      color: 'white',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)';
                    }}
                  >
                    Create project
                  </button>
                </div>
              )}
            </>
          )}

          {/* List View */}
          {!loading && !error && viewMode === 'list' && (
            <div className="space-y-2">
              {filteredIssues.length === 0 && (
                <div 
                  className="rounded-lg p-8 text-center"
                  style={{ 
                    backgroundColor: 'hsl(0 0% 100%)',
                    border: '1px dashed hsl(0 0% 88%)'
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: 'hsl(0 0% 96%)' }}
                  >
                    <IssuesIcon />
                  </div>
                  <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                    No issues yet
                  </h3>
                  <p className="text-[12px] mb-4" style={{ color: 'hsl(0 0% 46%)' }}>
                    Issues are generated after completing a project specification.
                  </p>
                  <button
                    onClick={() => navigate('/create-project')}
                    className="px-4 py-2 rounded-md text-[13px] font-medium transition-colors"
                    style={{
                      backgroundColor: 'hsl(235 69% 61%)',
                      color: 'white',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)';
                    }}
                  >
                    Create project
                  </button>
                </div>
              )}
              {filteredIssues.map(issue => {
                const project = projects.find(p => p.id === issue.projectId);
                const isBlocked = issue.status === 'pending' && !getIssueDependenciesMet(issue);
                const isReady = issue.status === 'pending' && getIssueDependenciesMet(issue);
                const status = issue.status === 'approved' ? 'approved' : issue.status === 'in-review' ? 'inReview' : isBlocked ? 'blocked' : 'ready';
                const config = statusConfig[status as keyof typeof statusConfig];
                
                return (
                  <div
                    key={issue.issueId}
                    className="flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid hsl(0 0% 92%)',
                    }}
                    onClick={() => setSelectedIssue(issue)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 99%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }} />
                    <span className="font-mono text-[11px] flex-shrink-0" style={{ color: 'hsl(0 0% 46%)' }}>{issue.issueId}</span>
                    <span className="text-[13px] flex-1 truncate" style={{ color: 'hsl(0 0% 9%)' }}>{issue.title}</span>
                    {project && (
                      <span className="text-[11px] px-2 py-0.5 rounded flex-shrink-0 flex items-center gap-1" style={{ backgroundColor: 'hsl(235 69% 95%)', color: 'hsl(235 69% 45%)' }}>
                        <span className="font-mono opacity-80">{project.id}</span>
                        <span>·</span>
                        <span>{project.name}</span>
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.bgColor, color: config.color }}>
                      {config.label}
                    </span>
                    <span className="text-[11px] flex-shrink-0 flex items-center gap-1" style={{ color: 'hsl(0 0% 46%)' }}>
                      <ClockIcon /> {issue.estimatedHours}h
                    </span>
                    {isReady && (
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <AIActionSplitButton
                          label="Ship"
                          onRun={(toolOverride) => handleShip(issue, toolOverride)}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Issue Detail Modal */}
        {selectedIssue && (
          <IssueModal
            issue={selectedIssue}
            onClose={() => setSelectedIssue(null)}
            onShip={handleShip}
            onApprove={handleApprove}
            canShip={getIssueDependenciesMet(selectedIssue)}
            statusConfig={statusConfig}
          />
        )}
      </main>
    </div>
  );
}
