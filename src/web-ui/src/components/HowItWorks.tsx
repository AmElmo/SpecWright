import { Link } from 'react-router-dom';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';
import { CursorLogo, ClaudeCodeLogo, CodexLogo, GeminiLogo, GitHubCopilotLogo, WindsurfLogo } from './AIToolLogos';

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

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function HowItWorks() {
  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/' },
    { label: 'Issues', icon: IssuesIcon, path: '/issues' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  const agents = [
    {
      emoji: '✍️',
      title: 'Product Manager',
      color: '#8b5cf6',
      documents: [
        { name: 'PRD', icon: '📄' },
        { name: 'Acceptance Criteria', icon: '✅' }
      ],
      description: 'Defines requirements, user stories, and success criteria for the feature.'
    },
    {
      emoji: '🎨',
      title: 'Designer',
      color: '#06b6d4',
      documents: [
        { name: 'Design Brief', icon: '🎯' },
        { name: 'Wireframes', icon: '🖼️' }
      ],
      description: 'Creates user experience flows, screen layouts, and visual specifications.'
    },
    {
      emoji: '🔧',
      title: 'Engineer',
      color: '#f59e0b',
      documents: [
        { name: 'Technical Spec', icon: '⚙️' },
        { name: 'Technology Choices', icon: '🔩' }
      ],
      description: 'Defines architecture, tech stack decisions, and implementation approach.'
    },
  ];

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
          className="sticky top-0 z-10 px-6 py-3 border-b flex items-center gap-3"
          style={{ 
            backgroundColor: 'white',
            borderColor: 'hsl(0 0% 92%)'
          }}
        >
          <Link
            to="/settings"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[13px] transition-colors no-underline"
            style={{ color: 'hsl(0 0% 46%)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(0 0% 96%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <BackIcon />
          </Link>
          <span className="text-lg">📖</span>
          <h1 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
            How does SpecWright work?
          </h1>
        </header>

        {/* Content */}
        <div className="p-8 max-w-4xl mx-auto">
          
          {/* Section 1: What is SpecWright */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
              >
                ✨
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'hsl(0 0% 9%)' }}>
                What is SpecWright?
              </h2>
            </div>
            
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
            >
              <p className="text-[15px] leading-relaxed mb-4" style={{ color: 'hsl(0 0% 32%)' }}>
                SpecWright is a <strong style={{ color: 'hsl(0 0% 9%)' }}>specification engine</strong> that helps you build software the right way — by creating clear, comprehensive specs <em>before</em> you write code.
              </p>
              <p className="text-[15px] leading-relaxed" style={{ color: 'hsl(0 0% 32%)' }}>
                Instead of jumping straight into coding, SpecWright guides AI through a structured process: defining requirements, designing the experience, planning the architecture, and breaking work into small, focused tasks.
              </p>
              
              <div 
                className="mt-5 p-4 rounded-lg flex items-center gap-4"
                style={{ backgroundColor: 'hsl(210 100% 97%)', border: '1px solid hsl(210 100% 92%)' }}
              >
                <span className="text-2xl">💡</span>
                <p className="text-[13px] m-0" style={{ color: 'hsl(210 80% 35%)' }}>
                  <strong>The result:</strong> Better outcomes with fewer rewrites. Your AI coding tool gets clear instructions instead of vague requests.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: The Automation System */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
              >
                ⚡
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'hsl(0 0% 9%)' }}>
                The Automation System
              </h2>
            </div>
            
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
            >
              <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'hsl(0 0% 32%)' }}>
                SpecWright is a <strong style={{ color: 'hsl(0 0% 9%)' }}>prompt orchestrator</strong> — it automatically injects the right prompt at the right time into your AI coding tool of choice.
              </p>
              
              {/* Visual flow */}
              <div 
                className="p-5 rounded-xl mb-5"
                style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
              >
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'white', border: '2px solid hsl(0 0% 88%)' }}
                    >
                      <img src={specwrightLogo} alt="SpecWright" className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 46%)' }}>SpecWright</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: '500' }}>generates</span>
                    <span style={{ color: '#94a3b8', fontSize: '1.5rem' }}>→</span>
                    <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: '500' }}>prompt</span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'white', border: '2px solid hsl(0 0% 88%)' }}
                    >
                      <span className="text-2xl">📋</span>
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 46%)' }}>Perfect Prompt</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '500' }}>pastes into</span>
                    <span style={{ color: '#94a3b8', fontSize: '1.5rem' }}>→</span>
                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '500' }}>your tool</span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center gap-1"
                      style={{ backgroundColor: 'white', border: '2px solid hsl(0 0% 88%)' }}
                    >
                      <div className="transform scale-75"><CursorLogo size={20} /></div>
                      <div className="transform scale-75"><ClaudeCodeLogo size={20} /></div>
                      <div className="transform scale-75"><CodexLogo size={20} /></div>
                      <div className="transform scale-75"><GeminiLogo size={20} /></div>
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 46%)' }}>AI Tool</span>
                  </div>
                </div>
              </div>
              
              {/* Key points */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'hsl(142 76% 97%)', border: '1px solid hsl(142 76% 90%)' }}>
                  <div className="text-lg mb-2">🔑</div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>No API Keys</div>
                  <p className="text-[12px] m-0" style={{ color: 'hsl(0 0% 46%)' }}>
                    Use whatever AI model you want. Your AI tool does the thinking.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'hsl(235 69% 97%)', border: '1px solid hsl(235 69% 90%)' }}>
                  <div className="text-lg mb-2">🎯</div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>Perfect Context</div>
                  <p className="text-[12px] m-0" style={{ color: 'hsl(0 0% 46%)' }}>
                    Each prompt includes exactly the right specs and history.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'hsl(25 95% 97%)', border: '1px solid hsl(25 95% 90%)' }}>
                  <div className="text-lg mb-2">⚡</div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'hsl(0 0% 9%)' }}>One Click</div>
                  <p className="text-[12px] m-0" style={{ color: 'hsl(0 0% 46%)' }}>
                    Opens your AI tool, creates a new chat, pastes the prompt.
                  </p>
                </div>
              </div>
              
              {/* Supported tools */}
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid hsl(0 0% 92%)' }}>
                <div className="text-[11px] uppercase tracking-wide font-medium mb-3" style={{ color: 'hsl(0 0% 46%)' }}>
                  Works with
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
                    <CursorLogo size={18} />
                    <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Cursor</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
                    <ClaudeCodeLogo size={18} />
                    <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Claude Code</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
                    <GitHubCopilotLogo size={18} />
                    <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Copilot</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
                    <CodexLogo size={18} />
                    <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Codex</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
                    <GeminiLogo size={18} />
                    <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Gemini</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
                    <WindsurfLogo size={18} />
                    <span className="text-[12px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>Windsurf</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: How it Works */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
              >
                🔄
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'hsl(0 0% 9%)' }}>
                How it Works
              </h2>
            </div>

            {/* Projects & Issues */}
            <div 
              className="rounded-xl p-6 mb-4"
              style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-[15px] font-semibold m-0" style={{ color: 'hsl(0 0% 9%)' }}>
                  Projects & Issues
                </h3>
              </div>
              
              <p className="text-[13px] mb-5" style={{ color: 'hsl(0 0% 46%)' }}>
                If you've used <a href="https://linear.app/" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(235 69% 55%)', fontWeight: '500', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>Linear</a>, this will feel familiar. SpecWright uses the same proven concept: Projects contain Issues.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div 
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                    >
                      📦
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>Projects</div>
                      <div className="text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>Features & Capabilities</div>
                    </div>
                  </div>
                  <p className="text-[13px] m-0" style={{ color: 'hsl(0 0% 46%)', lineHeight: '1.6' }}>
                    A complete feature that needs specification. Projects go through the full spec workflow with all four agents.
                  </p>
                </div>
                
                <div 
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: 'hsl(0 0% 98%)', border: '1px solid hsl(0 0% 92%)' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                      style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
                    >
                      ✓
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>Issues</div>
                      <div className="text-[11px]" style={{ color: 'hsl(0 0% 46%)' }}>Implementation Tasks</div>
                    </div>
                  </div>
                  <p className="text-[13px] m-0" style={{ color: 'hsl(0 0% 46%)', lineHeight: '1.6' }}>
                    Small, focused tasks that your AI coding tool can implement. Each issue has all the context it needs.
                  </p>
                </div>
              </div>
              
              <div 
                className="p-4 rounded-lg flex items-center gap-4"
                style={{ backgroundColor: 'hsl(270 60% 97%)', border: '1px solid hsl(270 60% 92%)' }}
              >
                <span className="text-xl">🔗</span>
                <p className="text-[13px] m-0" style={{ color: 'hsl(270 50% 35%)' }}>
                  Projects contain Issues. When a project is fully specified, SpecWright breaks it into issues for implementation.
                </p>
              </div>
            </div>

            {/* The Agents */}
            <div 
              className="rounded-xl p-6 mb-4"
              style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
            >
              <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'hsl(0 0% 9%)' }}>
                The AI Agents
              </h3>
              
              <p className="text-[13px] mb-5" style={{ color: 'hsl(0 0% 46%)' }}>
                Three specialized agents work in sequence to create comprehensive specifications:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent, index) => (
                  <div 
                    key={agent.title}
                    className="p-4 rounded-xl relative"
                    style={{ 
                      backgroundColor: 'hsl(0 0% 98%)', 
                      border: '1px solid hsl(0 0% 92%)',
                      borderLeft: `3px solid ${agent.color}`
                    }}
                  >
                    <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: agent.color }}>
                      {index + 1}
                    </div>
                    
                    {/* Agent header */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-2xl">{agent.emoji}</span>
                      <div className="text-[14px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>{agent.title}</div>
                    </div>
                    
                    {/* Description */}
                    <p className="text-[12px] mb-3" style={{ color: 'hsl(0 0% 46%)', lineHeight: '1.5' }}>
                      {agent.description}
                    </p>
                    
                    {/* Documents created */}
                    <div 
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 90%)' }}
                    >
                      <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'hsl(0 0% 50%)' }}>
                        Creates
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {agent.documents.map((doc) => (
                          <div 
                            key={doc.name}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
                            style={{ backgroundColor: `${agent.color}12`, color: agent.color, border: `1px solid ${agent.color}25` }}
                          >
                            <span>{doc.icon}</span>
                            <span>{doc.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Flow arrow */}
              <div className="flex justify-center mt-5">
                <div 
                  className="px-4 py-2 rounded-full text-[12px] font-medium"
                  style={{ backgroundColor: 'hsl(142 76% 97%)', color: 'hsl(142 76% 36%)', border: '1px solid hsl(142 76% 90%)' }}
                >
                  → Each agent builds on the previous agent's work
                </div>
              </div>
            </div>

            {/* Files & Folder Structure */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: 'white', border: '1px solid hsl(0 0% 92%)' }}
            >
              <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'hsl(0 0% 9%)' }}>
                Files & Folder Structure
              </h3>
              
              <p className="text-[13px] mb-5" style={{ color: 'hsl(0 0% 46%)' }}>
                All specifications are stored in your repository under the <code className="px-1.5 py-0.5 rounded text-[12px]" style={{ backgroundColor: 'hsl(235 69% 97%)', color: 'hsl(235 69% 50%)' }}>specwright/</code> folder:
              </p>
              
              <div 
                className="p-4 rounded-xl font-mono text-[13px]"
                style={{ backgroundColor: 'hsl(220 20% 14%)', color: 'hsl(0 0% 80%)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: '#3b82f6' }}>📁</span>
                  <span style={{ color: '#60a5fa', fontWeight: '600' }}>specwright/</span>
                </div>
                <div className="pl-5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'hsl(0 0% 50%)' }}>├─</span>
                    <span style={{ color: '#fbbf24' }}>📁 agents/</span>
                    <span className="text-[11px]" style={{ color: 'hsl(0 0% 50%)' }}>— AI agent prompts (customizable)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'hsl(0 0% 50%)' }}>├─</span>
                    <span style={{ color: '#a78bfa' }}>📁 templates/</span>
                    <span className="text-[11px]" style={{ color: 'hsl(0 0% 50%)' }}>— Document templates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'hsl(0 0% 50%)' }}>└─</span>
                    <span style={{ color: '#34d399' }}>📁 outputs/</span>
                    <span className="text-[11px]" style={{ color: 'hsl(0 0% 50%)' }}>— Your projects & specs</span>
                  </div>
                  <div className="pl-6 space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'hsl(0 0% 50%)' }}>└─</span>
                      <span style={{ color: '#67e8f9' }}>📁 projects/</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'hsl(0 0% 50%)' }}>└─</span>
                        <span style={{ color: 'hsl(0 0% 70%)' }}>📁 001-your-project/</span>
                      </div>
                      <div className="pl-6 space-y-1 text-[11px]" style={{ color: 'hsl(0 0% 50%)' }}>
                        <div>├─ pm/prd.md</div>
                        <div>├─ ux/design_brief.md</div>
                        <div>├─ architect/technical_specification.md</div>
                        <div>└─ issues/issues.json</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div 
                className="mt-5 p-4 rounded-lg flex items-start gap-3"
                style={{ backgroundColor: 'hsl(48 96% 96%)', border: '1px solid hsl(48 96% 85%)' }}
              >
                <span className="text-lg">⚠️</span>
                <div>
                  <div className="text-[13px] font-medium mb-1" style={{ color: 'hsl(35 92% 33%)' }}>
                    Don't manually modify the folder structure
                  </div>
                  <p className="text-[12px] m-0" style={{ color: 'hsl(35 60% 45%)' }}>
                    SpecWright manages these files automatically. You can view and edit content through the UI or your editor.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Start CTA */}
          <section>
            <div 
              className="rounded-xl p-6 text-center"
              style={{ 
                background: 'linear-gradient(135deg, hsl(235 69% 97%) 0%, hsl(210 100% 97%) 100%)',
                border: '1px solid hsl(235 69% 90%)'
              }}
            >
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                Ready to build something?
              </h3>
              <p className="text-[14px] mb-4" style={{ color: 'hsl(0 0% 46%)' }}>
                Create your first project and let SpecWright guide you through the spec process.
              </p>
              <Link
                to="/create-project"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-medium no-underline transition-all"
                style={{ backgroundColor: '#3b82f6', color: 'white' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>✨</span>
                <span>Create a Project</span>
              </Link>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
