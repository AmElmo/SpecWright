import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import { CursorLogo, ClaudeCodeLogo, GitHubCopilotLogo, WindsurfLogo } from './AIToolLogos';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

type AITool = 'cursor' | 'windsurf' | 'github-copilot' | 'claude-code';

interface HeadlessStatus {
  available: boolean;
  reason?: string;
}

interface AIToolOption {
  id: AITool;
  name: string;
  logo: ReactNode;
  description: string;
  color: string;
}

const AI_TOOLS: AIToolOption[] = [
  {
    id: 'cursor',
    name: 'Cursor',
    logo: <CursorLogo size={48} />,
    description: 'Standalone AI IDE',
    color: '#000000'
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    logo: <ClaudeCodeLogo size={48} />,
    description: 'VS Code Extension',
    color: '#D97757'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    logo: <GitHubCopilotLogo size={48} />,
    description: 'VS Code Extension',
    color: '#1F2328'
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    logo: <WindsurfLogo size={48} />,
    description: 'AI-powered IDE',
    color: '#0EA5E9'
  }
];

type OnboardingStep = 'tool-selection' | 'projects-issues' | 'ai-squad' | 'magic' | 'initialize';

const STEPS: OnboardingStep[] = ['tool-selection', 'projects-issues', 'ai-squad', 'magic', 'initialize'];

export function Onboarding() {
  const [step, setStep] = useState<OnboardingStep>('tool-selection');
  const [selectedTool, setSelectedTool] = useState<AITool>('cursor');
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string>('');
  const [repositoryName, setRepositoryName] = useState<string>('');
  const [headlessStatus, setHeadlessStatus] = useState<Record<AITool, HeadlessStatus> | null>(null);
  const navigate = useNavigate();

  const currentStepIndex = STEPS.indexOf(step);

  useEffect(() => {
    fetch('/api/initialization-status')
      .then(res => res.json())
      .then(data => {
        if (data.isInitialized) {
          navigate('/');
          return;
        }
        setRepositoryName(data.repositoryName || 'your project');
      })
      .catch(err => {
        logger.error('Failed to check initialization:', err);
      });

    // Fetch headless CLI status
    fetch('/api/settings/headless-status')
      .then(res => res.json())
      .then(data => {
        setHeadlessStatus(data);
      })
      .catch(err => {
        logger.error('Failed to check headless status:', err);
      });
  }, [navigate]);

  const handleToolSelect = (tool: AITool) => {
    setSelectedTool(tool);
  };

  const goToStep = (newStep: OnboardingStep) => {
    setStep(newStep);
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex]);
    }
  };

  const handleInitialize = async () => {
    try {
      setInitializing(true);
      setError('');

      const response = await fetch('/api/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initialize');
      }

      const aiToolResponse = await fetch('/api/settings/ai-tool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: selectedTool })
      });

      if (!aiToolResponse.ok) {
        logger.warn('Failed to save AI tool preference, but initialization succeeded');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate('/initialization-success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setInitializing(false);
    }
  };

  // Progress indicator component
  const ProgressDots = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      gap: '0.5rem',
      marginBottom: '2rem'
    }}>
      {STEPS.map((s, i) => (
        <button
          key={s}
          onClick={() => i < currentStepIndex && goToStep(s)}
          disabled={i > currentStepIndex}
          style={{
            width: i === currentStepIndex ? '2rem' : '0.625rem',
            height: '0.625rem',
            borderRadius: '0.5rem',
            backgroundColor: i <= currentStepIndex ? '#3b82f6' : '#e2e8f0',
            border: 'none',
            cursor: i < currentStepIndex ? 'pointer' : 'default',
            transition: 'all 0.3s ease',
            opacity: i > currentStepIndex ? 0.4 : 1
          }}
        />
      ))}
    </div>
  );

  // Header component
  const Header = () => (
    <header style={{ 
      backgroundColor: 'white',
      borderBottom: '1px solid #e2e8f0',
      padding: '1rem 0'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={specwrightLogo} alt="SpecWright" style={{ width: '2rem', height: '2rem' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
            SpecWright
          </span>
        </div>
      </div>
    </header>
  );

  // Navigation buttons
  const NavigationButtons = ({ showBack = true, nextLabel = 'Continue', onNext = goNext }: { 
    showBack?: boolean; 
    nextLabel?: string;
    onNext?: () => void;
  }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: showBack ? 'space-between' : 'center',
      alignItems: 'center',
      marginTop: 'auto',
      paddingTop: '2rem'
    }}>
      {showBack && (
        <button
          onClick={goBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9375rem',
            color: '#64748b',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.75rem 1rem'
          }}
        >
          <span>←</span>
          <span>Back</span>
        </button>
      )}
      <button
        onClick={onNext}
        style={{
          padding: '0.875rem 2.5rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          borderRadius: '0.75rem',
          fontWeight: '600',
          fontSize: '1rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2563eb';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#3b82f6';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <span>{nextLabel}</span>
        <span>→</span>
      </button>
    </div>
  );

  // Step 1: Tool Selection
  if (step === 'tool-selection') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ 
          flex: 1,
          maxWidth: '800px', 
          width: '100%',
          margin: '0 auto', 
          padding: '2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ProgressDots />
          
          {/* Centered content wrapper */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Which AI coding tool do you use?
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b' }}>
              SpecWright will work directly with your preferred tool, pasting the relevant prompts automatically in your AI coding tool of choice.
            </p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            {AI_TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                style={{
                  backgroundColor: selectedTool === tool.id ? '#eff6ff' : 'white',
                  border: selectedTool === tool.id ? `2px solid #3b82f6` : '2px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (selectedTool !== tool.id) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTool !== tool.id) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {selectedTool === tool.id && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    borderRadius: '50%',
                    width: '1.5rem',
                    height: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '700'
                  }}>
                    ✓
                  </div>
                )}
                
                <div style={{ marginBottom: '0.5rem' }}>
                  {tool.logo}
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0f172a' }}>
                  {tool.name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  {tool.description}
                </div>
                {/* Headless CLI indicator */}
                {headlessStatus && headlessStatus[tool.id] && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem'
                  }}>
                    {headlessStatus[tool.id].available ? (
                      <>
                        <span style={{ color: '#10b981' }}>✓</span>
                        <span style={{ color: '#10b981' }}>CLI detected - Headless mode</span>
                      </>
                    ) : (tool.id === 'claude-code' || tool.id === 'cursor') ? (
                      <>
                        <span style={{ color: '#94a3b8' }}>○</span>
                        <span style={{ color: '#94a3b8' }}>Keyboard automation</span>
                      </>
                    ) : null}
                  </div>
                )}
              </button>
            ))}
          </div>

          <p style={{ 
            textAlign: 'center', 
            fontSize: '0.8125rem', 
            color: '#94a3b8'
          }}>
            You can change this later in Settings
          </p>
          
          </div>
          {/* End centered content wrapper */}

          <NavigationButtons showBack={false} />
        </main>
      </div>
    );
  }

  // Step 2: Projects & Issues Concept
  if (step === 'projects-issues') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ 
          flex: 1,
          maxWidth: '800px', 
          width: '100%',
          margin: '0 auto', 
          padding: '2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ProgressDots />
          
          {/* Centered content wrapper */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Projects & Issues
            </h2>
            <p style={{ fontSize: '1rem', color: '#475569', marginBottom: '0.5rem' }}>
              Everything in SpecWright is either a project or an issue.
            </p>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              These are the building blocks of specification-driven development.
            </p>
          </div>

          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            {/* Projects */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                fontSize: '1.5rem'
              }}>
                📦
              </div>
              <h3 style={{ color: '#0f172a', fontWeight: '600', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                Projects
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9375rem', lineHeight: '1.6', margin: 0 }}>
                A complete feature or capability. Projects have full specs: PRD, designs, architecture.
              </p>
            </div>

            {/* Issues */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                fontSize: '1.5rem'
              }}>
                ✓
              </div>
              <h3 style={{ color: '#0f172a', fontWeight: '600', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                Issues
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9375rem', lineHeight: '1.6', margin: 0 }}>
                Small, focused tasks. Each issue is worked on by your AI coding tool, one at a time.
              </p>
            </div>
          </div>

          {/* How projects are created */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              How projects are created
            </h4>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🤖</span>
                  <span style={{ color: '#0f172a', fontWeight: '500' }}>AI Scoping</span>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                  Describe what you want to build — AI determines if it needs one project, multiple projects, or can be done directly.
                </p>
              </div>
              <div style={{ width: '1px', backgroundColor: '#e2e8f0' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>✍️</span>
                  <span style={{ color: '#0f172a', fontWeight: '500' }}>Manual Creation</span>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                  Create projects manually when you already know the scope and structure needed.
                </p>
              </div>
            </div>
          </div>
          
          </div>
          {/* End centered content wrapper */}

          <NavigationButtons />
        </main>
      </div>
    );
  }

  // Step 3: AI Squad
  if (step === 'ai-squad') {
    const squadMembers = [
      {
        emoji: '📋',
        title: 'Product Manager',
        color: '#3b82f6',
        description: 'Defines the "what" — requirements, user stories, and acceptance criteria'
      },
      {
        emoji: '🎨',
        title: 'Designer',
        color: '#8b5cf6',
        description: 'Defines the "look" — user experience, screens, and wireframes'
      },
      {
        emoji: '⚙️',
        title: 'Engineer',
        color: '#f59e0b',
        description: 'Defines the "how" — technical architecture and technology choices'
      },
    ];

    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ 
          flex: 1,
          maxWidth: '800px', 
          width: '100%',
          margin: '0 auto', 
          padding: '2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ProgressDots />
          
          {/* Centered content wrapper */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Your AI Squad
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b' }}>
              Three specialized agents work together to create complete specifications
            </p>
          </div>

          {/* Squad flow visualization */}
          <div style={{ 
            display: 'flex',
            alignItems: 'stretch',
            marginBottom: '1.5rem'
          }}>
            {squadMembers.map((member, index) => (
              <div key={member.title} style={{ 
                display: 'flex', 
                alignItems: 'center',
                flex: 1
              }}>
                {/* Card */}
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderTop: `3px solid ${member.color}`,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '100%'
                }}>
                  <div style={{
                    fontSize: '1.75rem',
                    marginBottom: '0.5rem'
                  }}>
                    {member.emoji}
                  </div>
                  <div style={{ 
                    color: '#0f172a', 
                    fontWeight: '600', 
                    fontSize: '0.875rem',
                    marginBottom: '0.375rem'
                  }}>
                    {member.title}
                  </div>
                  <p style={{ 
                    color: '#64748b', 
                    fontSize: '0.8125rem', 
                    margin: 0,
                    lineHeight: '1.5',
                    flex: 1
                  }}>
                    {member.description}
                  </p>
                </div>
                
                {/* Arrow between items */}
                {index < squadMembers.length - 1 && (
                  <div style={{
                    padding: '0 0.5rem',
                    color: '#94a3b8',
                    fontSize: '1.25rem',
                    flexShrink: 0
                  }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Result */}
          <div style={{
            backgroundColor: '#ecfdf5',
            borderRadius: '1rem',
            padding: '1.25rem',
            border: '1px solid #a7f3d0',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '2.5rem', 
              height: '2.5rem', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem'
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 10L8 14L16 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ color: '#065f46', fontSize: '0.9375rem', margin: 0, fontWeight: '500' }}>
              Result: A complete specification with clear, actionable issues ready for implementation
            </p>
          </div>
          
          </div>
          {/* End centered content wrapper */}

          <NavigationButtons />
        </main>
      </div>
    );
  }

  // Step 4: The Magic (No API keys, automation)
  if (step === 'magic') {
    const selectedToolInfo = AI_TOOLS.find(t => t.id === selectedTool);
    
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ 
          flex: 1,
          maxWidth: '800px', 
          width: '100%',
          margin: '0 auto', 
          padding: '2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ProgressDots />
          
          {/* Centered content wrapper */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              The Magic ✨
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b' }}>
              SpecWright works differently than other AI tools
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* No API Keys */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '1.25rem 1.5rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem'
            }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                🔑
              </div>
              <div>
                <h3 style={{ color: '#0f172a', fontWeight: '600', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                  No API Keys Required
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                  Use whatever AI model you want. SpecWright generates prompts — your AI tool does the thinking.
                </p>
              </div>
            </div>

            {/* Smart Automation */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '1.25rem 1.5rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem'
            }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                ⚡
              </div>
              <div>
                <h3 style={{ color: '#0f172a', fontWeight: '600', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                  Smart Automation
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                  SpecWright automatically opens {selectedToolInfo?.name}, creates a new chat, and pastes the perfect prompt with all context.
                </p>
              </div>
            </div>

            {/* Context-Aware */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '1.25rem 1.5rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem'
            }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                🎯
              </div>
              <div>
                <h3 style={{ color: '#0f172a', fontWeight: '600', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                  Perfect Context Every Time
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                  Each agent prompt includes exactly the right specs, history, and references for the task at hand.
                </p>
              </div>
            </div>
          </div>

          {/* Visual representation */}
          <div style={{
            backgroundColor: '#eff6ff',
            borderRadius: '1rem',
            padding: '1rem 1.5rem',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem'
          }}>
            <img src={specwrightLogo} alt="SpecWright" style={{ width: '2rem', height: '2rem' }} />
            <span style={{ color: '#94a3b8', fontSize: '1.25rem' }}>→</span>
            <span style={{ color: '#3b82f6', fontSize: '0.875rem', fontWeight: '500' }}>generates prompt</span>
            <span style={{ color: '#94a3b8', fontSize: '1.25rem' }}>→</span>
            <div style={{ transform: 'scale(0.6)', transformOrigin: 'center' }}>
              {selectedToolInfo?.logo}
            </div>
            <span style={{ color: '#94a3b8', fontSize: '1.25rem' }}>→</span>
            <span style={{ fontSize: '1.5rem' }}>✨</span>
          </div>
          
          </div>
          {/* End centered content wrapper */}

          <NavigationButtons />
        </main>
      </div>
    );
  }

  // Step 5: Initialize
  if (step === 'initialize') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ 
          flex: 1,
          maxWidth: '800px', 
          width: '100%',
          margin: '0 auto', 
          padding: '2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ProgressDots />
          
          {/* Centered content wrapper */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Let's Get Started
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b' }}>
              Initialize SpecWright for <span style={{ color: '#3b82f6', fontWeight: '500' }}>{repositoryName}</span>
            </p>
          </div>

          {/* What will be created */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ 
              color: '#64748b', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              marginBottom: '1rem', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em' 
            }}>
              This will create
            </h3>
            
            <div style={{ 
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#475569'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#3b82f6' }}>📁</span>
                <span style={{ color: '#3b82f6', fontWeight: '600' }}>specwright/</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>— Your specifications home</span>
              </div>
              <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>├─ agents/</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>AI agent prompts</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>├─ templates/</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Document templates</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>└─ outputs/</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Projects & issues</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div style={{
            backgroundColor: '#fffbeb',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            border: '1px solid #fcd34d',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
              <p style={{ color: '#92400e', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                Don't manually modify the folder structure — SpecWright needs it intact to work correctly.
              </p>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div style={{ 
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem'
            }}>
              <p style={{ color: '#dc2626', fontWeight: '500', margin: 0 }}>
                ❌ {error}
              </p>
            </div>
          )}
          
          </div>
          {/* End centered content wrapper */}

          {/* Initialize button */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '2rem'
          }}>
            <button
              onClick={goBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.9375rem',
                color: '#64748b',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.75rem 1rem'
              }}
            >
              <span>←</span>
              <span>Back</span>
            </button>
            
            <button
              onClick={handleInitialize}
              disabled={initializing}
              style={{
                padding: '0.875rem 2.5rem',
                backgroundColor: initializing ? '#334155' : '#10b981',
                color: 'white',
                borderRadius: '0.75rem',
                fontWeight: '600',
                fontSize: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                border: 'none',
                cursor: initializing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: initializing ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!initializing) {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!initializing) {
                  e.currentTarget.style.backgroundColor = '#10b981';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {initializing ? (
                <>
                  <div style={{ 
                    width: '1.25rem',
                    height: '1.25rem',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Initializing...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Initialize SpecWright</span>
                </>
              )}
            </button>
          </div>
        </main>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
