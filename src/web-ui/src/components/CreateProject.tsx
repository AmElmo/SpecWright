import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Scoping } from './Scoping';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

// Icons as inline SVGs for Linear-style aesthetic
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

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export function CreateProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'manual' | 'ai'>('ai');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [scopingInProgress, setScopingInProgress] = useState(false);

  const handleCreateManual = async () => {
    if (!name.trim() || !description.trim()) {
      setError('Both name and description are required');
      return;
    }

    try {
      setCreating(true);
      setError('');

      const response = await fetch('/api/projects/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to dashboard with highlight
        navigate(`/?highlight=${data.projectId}`);
      } else {
        setError(data.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Failed to create project');
      logger.error(err);
    } finally {
      setCreating(false);
    }
  };

  // Sidebar nav items (Settings is handled separately at bottom)
  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/', active: location.pathname === '/' },
    { label: 'Issues', icon: IssuesIcon, path: '/issues', active: location.pathname === '/issues' },
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
        </div>

        {/* New Project Button */}
        <div className="p-3 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all"
            style={{
              backgroundColor: 'hsl(235 69% 61%)',
              color: 'white',
            }}
            disabled
          >
            <PlusIcon />
            <span>New Project</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
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
        <div className="p-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <Link
            to="/settings"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
            style={{
              backgroundColor: 'transparent',
              color: 'hsl(0 0% 46%)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <SettingsIcon />
            <span className="text-[13px] font-medium">Settings</span>
          </Link>
        </div>
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
            <PlusIcon />
            <h1 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
              ✨ Create New Project
            </h1>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          <div className="max-w-3xl mx-auto">
            {/* Subtitle */}
            <p className="text-[13px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
              Create a project manually or use AI to help scope it
            </p>

            {/* Toggle Switch - hide when scoping is in progress */}
            {!scopingInProgress && (
              <div 
                className="mb-6 flex items-center justify-center gap-4 p-4 rounded-lg"
                style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
              >
                <span 
                  className="text-[13px] font-medium"
                  style={{ color: mode === 'ai' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)' }}
                >
                  🤖 AI-Assisted
                </span>
                <button
                  onClick={() => setMode(mode === 'manual' ? 'ai' : 'manual')}
                  className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: mode === 'ai' ? 'hsl(235 69% 61%)' : 'hsl(0 0% 80%)'
                  }}
                  aria-label="Toggle project creation mode"
                >
                  <span
                    className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm"
                    style={{
                      transform: mode === 'manual' ? 'translateX(26px)' : 'translateX(4px)'
                    }}
                  />
                </button>
                <span 
                  className="text-[13px] font-medium"
                  style={{ color: mode === 'manual' ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)' }}
                >
                  📝 Manual
                </span>
              </div>
            )}

            {/* Manual Mode */}
            {mode === 'manual' && (
              <div 
                className="rounded-lg p-6"
                style={{ backgroundColor: 'hsl(0 0% 100%)', border: '1px solid hsl(0 0% 92%)' }}
              >
                <h2 className="text-[15px] font-semibold mb-5" style={{ color: 'hsl(0 0% 9%)' }}>
                  Create Project Manually
                </h2>

                {error && (
                  <div 
                    className="rounded-md p-3 mb-5"
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

                <div className="space-y-5">
                  <div>
                    <Label 
                      htmlFor="project-name" 
                      className="text-[13px] font-medium mb-2 block"
                      style={{ color: 'hsl(0 0% 9%)' }}
                    >
                      Project Name *
                    </Label>
                    <Input
                      id="project-name"
                      type="text"
                      placeholder="e.g., Google Sign-in Integration"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-[13px]"
                      style={{
                        backgroundColor: 'hsl(0 0% 100%)',
                        borderColor: 'hsl(0 0% 90%)',
                        color: 'hsl(0 0% 9%)'
                      }}
                      disabled={creating}
                    />
                    <p className="text-[12px] mt-1.5" style={{ color: 'hsl(0 0% 46%)' }}>
                      A clear, concise name for your project
                    </p>
                  </div>

                  <div>
                    <Label 
                      htmlFor="project-description" 
                      className="text-[13px] font-medium mb-2 block"
                      style={{ color: 'hsl(0 0% 9%)' }}
                    >
                      Description *
                    </Label>
                    <Textarea
                      id="project-description"
                      placeholder="Describe what you want to build... (e.g., 'Add Google Sign-in to allow users to authenticate with their Google accounts')"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full min-h-[120px] text-[13px]"
                      style={{
                        backgroundColor: 'hsl(0 0% 100%)',
                        borderColor: 'hsl(0 0% 90%)',
                        color: 'hsl(0 0% 9%)'
                      }}
                      disabled={creating}
                    />
                    <p className="text-[12px] mt-1.5" style={{ color: 'hsl(0 0% 46%)' }}>
                      Detailed description of what this project should accomplish
                    </p>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button
                      onClick={handleCreateManual}
                      disabled={creating || !name.trim() || !description.trim()}
                      className="flex-1 px-4 py-2.5 rounded-md text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: 'hsl(235 69% 61%)',
                        color: 'white',
                      }}
                      onMouseEnter={(e) => {
                        if (!creating && name.trim() && description.trim()) {
                          e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)';
                      }}
                    >
                      {creating ? 'Creating...' : '✨ Create Project'}
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      disabled={creating}
                      className="px-4 py-2.5 rounded-md text-[13px] font-medium transition-all"
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
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI-Assisted Mode */}
            {mode === 'ai' && (
              <div>
                <Scoping 
                  prefillDescription={description} 
                  embedded={true}
                  onStatusChange={(status) => {
                    // Hide toggle once scoping starts and keep it hidden throughout
                    if (status !== 'ready') {
                      setScopingInProgress(true);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
