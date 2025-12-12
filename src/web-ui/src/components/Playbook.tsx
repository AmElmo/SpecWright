import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';
import { MarkdownViewer } from './MarkdownViewer';
import { useRealtimeUpdates } from '../lib/use-realtime';
import { useAIToolName } from '../lib/use-ai-tool';

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

const PlaybookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2.5C3 1.94772 3.44772 1.5 4 1.5H12C12.5523 1.5 13 1.94772 13 2.5V13.5C13 14.0523 12.5523 14.5 12 14.5H4C3.44772 14.5 3 14.0523 3 13.5V2.5Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5.5 5H10.5M5.5 8H10.5M5.5 11H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 8C2.5 4.96243 4.96243 2.5 8 2.5C10.2504 2.5 12.1654 3.87659 12.9329 5.83333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M13.5 8C13.5 11.0376 11.0376 13.5 8 13.5C5.74962 13.5 3.83462 12.1234 3.06709 10.1667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10.5 5.5H13.5V2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.5 10.5H2.5V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Magic wand icon for generate button
const WandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.5 2L11.5 4L13.5 5L11.5 6L10.5 8L9.5 6L7.5 5L9.5 4L10.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M3 13L9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5.5 1.5L6 2.5L7 3L6 3.5L5.5 4.5L5 3.5L4 3L5 2.5L5.5 1.5Z" fill="currentColor"/>
    <path d="M2.5 5.5L3 6.5L4 7L3 7.5L2.5 8.5L2 7.5L1 7L2 6.5L2.5 5.5Z" fill="currentColor"/>
  </svg>
);

// Governance Architect icon for AI working state
const GovernanceArchitectIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 21V19C3 17.9 3.9 17 5 17H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.5 7C8.5 8.93 10.07 10.5 12 10.5C13.93 10.5 15.5 8.93 15.5 7C15.5 5.07 13.93 3.5 12 3.5C10.07 3.5 8.5 5.07 8.5 7Z" stroke="currentColor" strokeWidth="2"/>
    <path d="M17 14L19 16L23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface PlaybookStatus {
  exists: boolean;
  content?: string;
}

export function Playbook() {
  const [status, setStatus] = useState<PlaybookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repositoryName, setRepositoryName] = useState<string>('');
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
  const aiToolName = useAIToolName();

  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/', active: location.pathname === '/' },
    { label: 'Issues', icon: IssuesIcon, path: '/issues', active: location.pathname === '/issues' },
    { label: 'Playbook', icon: PlaybookIcon, path: '/playbook', active: location.pathname === '/playbook' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings', active: location.pathname === '/settings' },
  ];

  const fetchPlaybookStatus = async () => {
    try {
      const res = await fetch('/api/playbook/status');
      if (!res.ok) throw new Error('Failed to fetch playbook status');
      const data = await res.json();
      setStatus(data);
      setError(null);
      
      // If we were generating and now the file exists, we're done
      if (isGenerating && data.exists) {
        setIsGenerating(false);
      }
      if (isUpdating && data.exists) {
        setIsUpdating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbook');
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    fetchPlaybookStatus();
    fetchWorkspaceInfo();
  }, []);

  // Real-time file watching
  useRealtimeUpdates(() => {
    logger.debug('File change detected, refreshing playbook status...');
    fetchPlaybookStatus();
  });

  // Polling while generating
  useEffect(() => {
    if (isGenerating || isUpdating) {
      const interval = setInterval(() => {
        fetchPlaybookStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isGenerating, isUpdating]);

  // Parse version and date from playbook content
  const parseMetadata = (content: string) => {
    const versionMatch = content.match(/\*\*Version\*\*:\s*([^\s|]+)/);
    const dateMatch = content.match(/\*\*Last Amended\*\*:\s*([^\s|*]+)/);
    return {
      version: versionMatch?.[1] || 'Unknown',
      lastAmended: dateMatch?.[1] || 'Unknown'
    };
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Call API WITHOUT X-Integrated-Browser header to trigger automation
      const res = await fetch('/api/playbook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.prompt) {
        setLastPrompt(data.prompt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate playbook');
      setIsGenerating(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      
      const res = await fetch('/api/playbook/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.prompt) {
        setLastPrompt(data.prompt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update playbook');
      setIsUpdating(false);
    }
  };

  const handleAudit = async () => {
    try {
      setIsAuditing(true);
      setError(null);
      
      const res = await fetch('/api/playbook/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.prompt) {
        // For audit, just copy to clipboard - no file watching needed
        await navigator.clipboard.writeText(data.prompt);
        alert('✅ Audit prompt copied to clipboard!\n\nPaste it in ' + aiToolName + ' to check codebase compliance.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to audit playbook');
    } finally {
      setIsAuditing(false);
    }
  };

  // Copy button with feedback animation
  const CopyPromptButton = ({ prompt }: { prompt: string }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        logger.error('Failed to copy prompt:', err);
      }
    };
    
    return (
      <button
        onClick={handleCopy}
        className="px-4 py-2 rounded-md text-[12px] font-medium transition-all"
        style={{ 
          backgroundColor: copied ? 'hsl(142 76% 36%)' : 'transparent', 
          color: copied ? 'white' : 'hsl(0 0% 32%)', 
          border: copied ? '1px solid hsl(142 76% 36%)' : '1px solid hsl(0 0% 90%)' 
        }}
      >
        {copied ? (
          <span className="flex items-center gap-2">
            <CheckIcon />
            Copied to Clipboard
          </span>
        ) : (
          'Copy Prompt to Clipboard'
        )}
      </button>
    );
  };

  const metadata = status?.content ? parseMetadata(status.content) : null;

  // AI Working state
  if (isGenerating || isUpdating) {
    const action = isGenerating ? 'Generating' : 'Updating';
    const description = isGenerating 
      ? 'Analyzing your codebase to create a comprehensive governance document...'
      : 'Syncing playbook with your current codebase state...';
    
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        {/* Sidebar */}
        <aside 
          className="w-[220px] h-screen flex flex-col border-r sticky top-0"
          style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
        >
          {/* Logo */}
          <div className="px-4 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
            <Link to="/" className="flex items-center gap-2.5 no-underline">
              <img src={specwrightLogo} alt="SpecWright" className="w-7 h-7" />
              <span className="font-semibold text-[18px]" style={{ color: 'hsl(0 0% 9%)' }}>SpecWright</span>
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

        <main className="flex-1">
          <header className="sticky top-0 z-10 px-6 py-3 border-b" style={{ backgroundColor: 'white', borderColor: 'hsl(0 0% 92%)' }}>
            <div className="flex items-center gap-3">
              <span className="text-lg">📜</span>
              <h1 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>Project Playbook</h1>
            </div>
          </header>
          
          <div className="p-6">
            <div className="max-w-3xl mx-auto">
              {/* Working card with animation */}
              <div className="rounded-lg p-8 text-center relative overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}>
                {/* Animated background gradient */}
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'radial-gradient(circle at 50% 0%, hsl(25 95% 53% / 0.15) 0%, transparent 50%)',
                    animation: 'pulse 3s ease-in-out infinite'
                  }}
                />
                
                {/* Agent icon with animated rings */}
                <div className="relative mx-auto mb-6" style={{ width: '100px', height: '100px' }}>
                  {/* Outer pulsing ring */}
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{ 
                      border: '2px solid hsl(25 95% 53% / 0.2)',
                      animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                    }}
                  />
                  {/* Middle ring */}
                  <div 
                    className="absolute rounded-full"
                    style={{ 
                      inset: '10px',
                      border: '2px solid hsl(25 95% 53% / 0.3)',
                      animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s'
                    }}
                  />
                  {/* Inner icon container */}
                  <div 
                    className="absolute rounded-full flex items-center justify-center"
                    style={{ 
                      inset: '20px',
                      backgroundColor: 'hsl(25 95% 53%)',
                      color: 'white',
                      boxShadow: '0 4px 20px hsl(25 95% 53% / 0.4)'
                    }}
                  >
                    <GovernanceArchitectIcon />
                  </div>
                </div>
                
                <h2 className="text-[18px] font-semibold mb-2 relative" style={{ color: 'hsl(0 0% 9%)' }}>
                  Governance Architect is working...
                </h2>
                <p className="text-[14px] font-medium mb-1 relative" style={{ color: 'hsl(25 95% 53%)' }}>
                  {action} Playbook
                </p>
                <p className="text-[13px] mb-4 relative" style={{ color: 'hsl(0 0% 46%)' }}>
                  {description}
                </p>
                
                {/* Animated progress bar */}
                <div 
                  className="w-48 h-1 mx-auto rounded-full mb-4 overflow-hidden relative"
                  style={{ backgroundColor: 'hsl(0 0% 92%)' }}
                >
                  <div 
                    className="h-full rounded-full absolute"
                    style={{ 
                      width: '30%',
                      backgroundColor: 'hsl(25 95% 53%)',
                      animation: 'shimmer 1.5s ease-in-out infinite'
                    }}
                  />
                </div>
                
                {/* File being generated */}
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full relative"
                  style={{ backgroundColor: 'hsl(25 95% 97%)', border: '1px solid hsl(25 95% 90%)' }}
                >
                  <div className="linear-spinner" style={{ width: '14px', height: '14px' }}></div>
                  <span className="text-[12px] font-mono font-medium" style={{ color: 'hsl(25 95% 40%)' }}>
                    PLAYBOOK.md
                  </span>
                </div>
                
                {/* CSS animations */}
                <style>{`
                  @keyframes ping {
                    0% { transform: scale(1); opacity: 1; }
                    75%, 100% { transform: scale(1.3); opacity: 0; }
                  }
                  @keyframes shimmer {
                    0% { left: -30%; }
                    100% { left: 100%; }
                  }
                  @keyframes pulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.5; }
                  }
                `}</style>
                
                <p className="text-[11px] mt-4" style={{ color: 'hsl(0 0% 60%)' }}>
                  This may take a minute. The page will update automatically.
                </p>
                
                {lastPrompt && (
                  <div className="mt-6 pt-6 relative" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                    <p className="text-[12px] mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                      If {aiToolName} didn't open correctly:
                    </p>
                    <CopyPromptButton prompt={lastPrompt} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
            <span className="text-lg">📜</span>
            <h1 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
              Project Playbook
            </h1>
            {status?.exists && metadata && (
              <span 
                className="text-[11px] px-2 py-0.5 rounded-full font-mono"
                style={{ 
                  backgroundColor: 'hsl(142 76% 94%)',
                  color: 'hsl(142 76% 36%)'
                }}
              >
                v{metadata.version}
              </span>
            )}
          </div>

          {status?.exists && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: 'hsl(235 69% 50%)',
                  border: '1px solid hsl(235 69% 85%)',
                  opacity: isUpdating ? 0.6 : 1,
                  cursor: isUpdating ? 'wait' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isUpdating) {
                    e.currentTarget.style.backgroundColor = 'hsl(235 69% 97%)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <RefreshIcon />
                {isUpdating ? 'Updating...' : 'Update'}
              </button>
              <button
                onClick={handleAudit}
                disabled={isAuditing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: 'hsl(142 76% 36%)',
                  border: '1px solid hsl(142 76% 85%)',
                  opacity: isAuditing ? 0.6 : 1,
                  cursor: isAuditing ? 'wait' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isAuditing) {
                    e.currentTarget.style.backgroundColor = 'hsl(142 76% 97%)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <CheckIcon />
                {isAuditing ? 'Preparing...' : 'Audit'}
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="linear-spinner"></div>
                <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                  Checking playbook...
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

          {/* No Playbook State */}
          {!loading && !error && !status?.exists && (
            <div className="max-w-3xl mx-auto">
              {/* What is a Playbook */}
              <section className="mb-8">
                <div 
                  className="rounded-xl p-6"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
                    >
                      📜
                    </div>
                    <h2 className="text-xl font-bold" style={{ color: 'hsl(0 0% 9%)' }}>
                      What is a Project Playbook?
                    </h2>
                  </div>
                  
                  <p className="text-[15px] leading-relaxed mb-4" style={{ color: 'hsl(0 0% 32%)' }}>
                    A <strong style={{ color: 'hsl(0 0% 9%)' }}>Playbook</strong> is your project's constitution — it defines the core principles, technical standards, and governance rules that guide all development.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'hsl(270 60% 97%)', border: '1px solid hsl(270 60% 92%)' }}>
                      <div className="text-lg mb-2">🎯</div>
                      <div className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>Core Principles</div>
                      <p className="text-[12px] m-0" style={{ color: 'hsl(0 0% 46%)' }}>
                        Up to 12 key rules that define how code should be written in this project.
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'hsl(235 69% 97%)', border: '1px solid hsl(235 69% 92%)' }}>
                      <div className="text-lg mb-2">🔧</div>
                      <div className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>Stack & Structure</div>
                      <p className="text-[12px] m-0" style={{ color: 'hsl(0 0% 46%)' }}>
                        Documents your tech stack, project layout, and architecture.
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'hsl(142 76% 97%)', border: '1px solid hsl(142 76% 92%)' }}>
                      <div className="text-lg mb-2">📋</div>
                      <div className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>Governance</div>
                      <p className="text-[12px] m-0" style={{ color: 'hsl(0 0% 46%)' }}>
                        Review requirements, testing standards, and how to amend the playbook.
                      </p>
                    </div>
                  </div>
                  
                  <div 
                    className="p-4 rounded-lg flex items-center gap-4"
                    style={{ backgroundColor: 'hsl(210 100% 97%)', border: '1px solid hsl(210 100% 92%)' }}
                  >
                    <span className="text-2xl">💡</span>
                    <p className="text-[13px] m-0" style={{ color: 'hsl(210 80% 35%)' }}>
                      <strong>Why it matters:</strong> When AI generates code, it can reference the playbook to ensure consistency with your project's standards and conventions.
                    </p>
                  </div>
                </div>
              </section>

              {/* Generate CTA */}
              <section>
                <div 
                  className="rounded-xl p-8 text-center"
                  style={{ 
                    background: 'linear-gradient(135deg, hsl(25 95% 97%) 0%, hsl(45 93% 97%) 100%)',
                    border: '1px solid hsl(25 95% 90%)'
                  }}
                >
                  <div className="text-4xl mb-4">📜</div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                    No Playbook Found
                  </h3>
                  <p className="text-[14px] mb-6 max-w-md mx-auto" style={{ color: 'hsl(0 0% 46%)' }}>
                    Generate a playbook by analyzing your codebase. AI will discover your tech stack, infer development practices, and create a comprehensive governance document.
                  </p>
                  <button
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-medium no-underline transition-all"
                    style={{ 
                      backgroundColor: '#f59e0b', 
                      color: 'white',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#d97706';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f59e0b';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <WandIcon />
                    <span>Generate Playbook</span>
                  </button>
                  <p className="text-[12px] mt-4" style={{ color: 'hsl(0 0% 60%)' }}>
                    Creates <code className="px-1.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 90%)' }}>PLAYBOOK.md</code> in your project root
                  </p>
                </div>
              </section>
            </div>
          )}

          {/* Playbook Exists - Show Content */}
          {!loading && !error && status?.exists && status.content && (
            <div className="max-w-4xl mx-auto">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div 
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="text-[11px] uppercase tracking-wide font-medium mb-1" style={{ color: 'hsl(0 0% 46%)' }}>
                    Version
                  </div>
                  <div className="text-[18px] font-semibold font-mono" style={{ color: 'hsl(0 0% 9%)' }}>
                    {metadata?.version || 'Unknown'}
                  </div>
                </div>
                <div 
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="text-[11px] uppercase tracking-wide font-medium mb-1" style={{ color: 'hsl(0 0% 46%)' }}>
                    Last Amended
                  </div>
                  <div className="text-[18px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                    {metadata?.lastAmended || 'Unknown'}
                  </div>
                </div>
                <div 
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="text-[11px] uppercase tracking-wide font-medium mb-1" style={{ color: 'hsl(0 0% 46%)' }}>
                    Location
                  </div>
                  <div className="text-[14px] font-mono truncate" style={{ color: 'hsl(235 69% 50%)' }}>
                    PLAYBOOK.md
                  </div>
                </div>
              </div>

              {/* Actions Info */}
              <div 
                className="p-4 rounded-xl mb-6 flex items-start gap-3"
                style={{ backgroundColor: 'hsl(210 100% 97%)', border: '1px solid hsl(210 100% 92%)' }}
              >
                <span className="text-lg">💡</span>
                <div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(210 80% 35%)' }}>
                    Keep your playbook in sync
                  </div>
                  <p className="text-[12px] m-0" style={{ color: 'hsl(210 60% 45%)' }}>
                    <span>
                      <strong>Update</strong> syncs the playbook with your current codebase (new dependencies, structure changes).
                    </span>
                    <br />
                    <span>
                      <strong>Audit</strong> checks if your code follows the playbook principles.
                    </span>
                  </p>
                </div>
              </div>

              {/* Playbook Content */}
              <div 
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
              >
                <div 
                  className="px-5 py-3 border-b flex items-center justify-between"
                  style={{ borderColor: 'hsl(0 0% 92%)', backgroundColor: 'hsl(0 0% 99%)' }}
                >
                  <div className="flex items-center gap-2">
                    <PlaybookIcon />
                    <span className="text-[13px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>
                      PLAYBOOK.md
                    </span>
                  </div>
                  <button
                    onClick={() => fetchPlaybookStatus()}
                    className="text-[12px] px-2 py-1 rounded transition-colors"
                    style={{ color: 'hsl(0 0% 46%)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Refresh
                  </button>
                </div>
                <div className="p-6">
                  <MarkdownViewer content={status.content} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
