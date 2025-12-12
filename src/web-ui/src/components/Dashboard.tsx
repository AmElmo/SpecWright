import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { ProjectCard } from './ProjectCard';
import { useRealtimeUpdates } from '@/lib/use-realtime';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select-new';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

interface Project {
  id: string;
  fullId: string;
  folderName: string;
  name: string | null;
  description: string;
  path: string;
  status?: string;
  progressData?: {
    completed: number;
    total: number;
    percent: number;
  };
}

// Icons as inline SVGs for Linear-style aesthetic
const ProjectsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 3.5C1.5 2.94772 1.94772 2.5 2.5 2.5H5.58579C5.851 2.5 6.10536 2.60536 6.29289 2.79289L7.5 4H13.5C14.0523 4 14.5 4.44772 14.5 5V12.5C14.5 13.0523 14.0523 13.5 13.5 13.5H2.5C1.94772 13.5 1.5 13.0523 1.5 12.5V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

const PlaybookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2.5C3 1.94772 3.44772 1.5 4 1.5H12C12.5523 1.5 13 1.94772 13 2.5V13.5C13 14.0523 12.5523 14.5 12 14.5H4C3.44772 14.5 3 14.0523 3 13.5V2.5Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5.5 5H10.5M5.5 8H10.5M5.5 11H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [repositoryName, setRepositoryName] = useState<string>('');
  const [generatingExample, setGeneratingExample] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const highlightParam = searchParams.get('highlight');
  const highlightedProjectIds = highlightParam ? highlightParam.split(',') : [];

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStatuses = (): string[] => {
    const statuses = new Set(projects.map(p => p.status).filter((s): s is string => Boolean(s)));
    return Array.from(statuses);
  };

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

  const checkInitialization = async () => {
    try {
      const res = await fetch('/api/initialization-status');
      if (res.ok) {
        const data = await res.json();
        if (!data.isInitialized) {
          navigate('/onboarding');
        }
      }
    } catch (err) {
      logger.error('Failed to check initialization:', err);
    }
  };

  const generateExampleProject = async () => {
    try {
      setGeneratingExample(true);
      setError(null);
      
      const res = await fetch('/api/generate-example-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Refresh projects list and highlight the new project
        await fetchProjects();
        navigate(`/?highlight=${data.projectId}`);
      } else if (res.status === 409) {
        // Example already exists
        setError('Example project already exists');
        await fetchProjects();
      } else {
        setError(data.error || 'Failed to generate example project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate example project');
    } finally {
      setGeneratingExample(false);
    }
  };

  useEffect(() => {
    checkInitialization();
    fetchProjects();
    fetchWorkspaceInfo();
    
    if (highlightedProjectIds.length > 0) {
      setTimeout(() => {
        const firstHighlighted = highlightedProjectIds[0];
        const element = document.getElementById(`project-${firstHighlighted}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, []);

  useRealtimeUpdates(() => {
    logger.debug('Refreshing projects due to file change...');
    fetchProjects();
  });

  const statusLabels: Record<string, string> = {
    'ready_to_spec': 'Backlog',
    'pm_complete': 'PM Complete',
    'ux_in_progress': 'UX in Progress',
    'engineer_in_progress': 'Engineer in Progress',
    'ready_to_break': 'Ready to Break',
    'ready_to_ship': 'Ready to Ship',
    'implementing': 'Implementing',
    'completed': 'Completed'
  };

  const filteredProjects = statusFilter === 'all' 
    ? projects 
    : projects.filter(p => p.status === statusFilter);

  // Sidebar nav items
  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/', active: location.pathname === '/' },
    { label: 'Issues', icon: IssuesIcon, path: '/issues', active: location.pathname === '/issues' },
    { label: 'Playbook', icon: PlaybookIcon, path: '/playbook', active: location.pathname === '/playbook' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings', active: location.pathname === '/settings' },
  ];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      {/* Sidebar */}
      <aside 
        className="w-[220px] h-screen flex flex-col border-r sticky top-0"
        style={{ 
          backgroundColor: 'hsl(0 0% 100%)',
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
            <PlusIcon />
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
            backgroundColor: 'hsl(0 0% 100%)',
            borderColor: 'hsl(0 0% 92%)'
          }}
        >
          <div className="flex items-center gap-3">
            <FolderIcon />
            <h1 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
              Projects
            </h1>
            <span 
              className="text-[12px] px-1.5 py-0.5 rounded"
              style={{ 
                backgroundColor: 'hsl(0 0% 96%)',
                color: 'hsl(0 0% 46%)'
              }}
            >
              {projects.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter */}
            {projects.length > 0 && (
              <div className="flex items-center">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger 
                    className="h-8 text-[13px] gap-1.5 border-0 bg-transparent hover:bg-[hsl(0_0%_96%)] focus:ring-0"
                    style={{ minWidth: '140px' }}
                  >
                    <FilterIcon />
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {getAvailableStatuses().map(status => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status] || status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="linear-spinner"></div>
                <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                  Loading projects...
                </span>
              </div>
            </div>
          )}

          {/* Error State */}
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

          {/* Empty State */}
          {!loading && !error && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'hsl(0 0% 96%)' }}
              >
                <FolderIcon />
              </div>
              <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                No projects yet
              </h2>
              <p className="text-[13px] mb-4 text-center max-w-md" style={{ color: 'hsl(0 0% 46%)' }}>
                Create your first project or explore an example to see what a complete specification looks like
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/create-project')}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all"
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
                  <PlusIcon />
                  <span>Create project</span>
                </button>
                <span className="text-[13px]" style={{ color: 'hsl(0 0% 60%)' }}>or</span>
                <button
                  onClick={generateExampleProject}
                  disabled={generatingExample}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'hsl(235 69% 61%)',
                    border: '1px solid hsl(235 69% 61%)',
                    opacity: generatingExample ? 0.6 : 1,
                    cursor: generatingExample ? 'wait' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!generatingExample) {
                      e.currentTarget.style.backgroundColor = 'hsl(235 69% 97%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {generatingExample ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <svg width="16"   height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 3.5C2 2.67157 2.67157 2 3.5 2H6.37868C6.77565 2 7.15659 2.15804 7.43726 2.43934L8.5 3.5H12.5C13.3284 3.5 14 4.17157 14 5V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V3.5Z" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M8 7V10M6.5 8.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span>View example project</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[12px] mt-6 text-center max-w-sm" style={{ color: 'hsl(0 0% 60%)' }}>
                The example shows a complete "AI Code Review Assistant" with PRD, design brief, tech spec, and 6 implementation issues
              </p>
            </div>
          )}

          {/* No Results for Filter */}
          {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'hsl(0 0% 96%)' }}
              >
                <SearchIcon />
              </div>
              <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>
                No projects found
              </h2>
              <p className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                No projects match the selected filter
              </p>
            </div>
          )}

          {/* Projects Grid */}
          {!loading && !error && filteredProjects.length > 0 && (
            <div 
              className="grid gap-4"
              style={{ 
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))'
              }}
            >
              {filteredProjects.map((project) => {
                const isHighlighted = highlightedProjectIds.includes(project.folderName || project.fullId || project.id);
                return (
                  <div
                    key={project.id}
                    id={`project-${project.folderName || project.fullId || project.id}`}
                    className={isHighlighted ? 'ring-2 ring-offset-2 rounded-lg' : ''}
                    style={isHighlighted ? { 
                      '--tw-ring-color': 'hsl(235 69% 61%)',
                    } as React.CSSProperties : {}}
                  >
                    <ProjectCard project={project} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
