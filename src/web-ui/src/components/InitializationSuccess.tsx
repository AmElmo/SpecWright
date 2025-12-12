import { useNavigate } from 'react-router-dom';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';

export function InitializationSuccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
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

      {/* Main Content */}
      <main style={{ 
        flex: 1,
        maxWidth: '800px', 
        width: '100%',
        margin: '0 auto', 
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        {/* Success Message */}
        <div style={{ 
          textAlign: 'center',
          marginBottom: '1.5rem'
        }}>
          <div style={{ 
            fontSize: '3rem',
            marginBottom: '0.75rem'
          }}>🎉</div>
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '700', 
            color: '#0f172a',
            marginBottom: '0.5rem'
          }}>
            SpecWright is Ready!
          </h2>
          <p style={{ 
            fontSize: '1rem', 
            color: '#64748b'
          }}>
            Your project has been initialized with the following structure
          </p>
        </div>

        {/* Folder Structure - Tree View */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ 
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            color: '#475569',
            backgroundColor: '#f8fafc',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ color: '#3b82f6', fontWeight: '600', marginBottom: '0.5rem' }}>📂 specwright/</div>
            <div style={{ paddingLeft: '1.25rem' }}>
              <div style={{ color: '#64748b' }}>├── agents/</div>
              <div style={{ color: '#64748b', marginTop: '0.25rem' }}>├── templates/</div>
              <div style={{ color: '#64748b', marginTop: '0.25rem' }}>└── outputs/</div>
              <div style={{ paddingLeft: '1.5rem', marginTop: '0.125rem' }}>
                <div style={{ color: '#94a3b8' }}>├── projects/</div>
                <div style={{ color: '#94a3b8', marginTop: '0.125rem' }}>└── issues/</div>
              </div>
            </div>
          </div>
          
          {/* Folder descriptions */}
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ color: '#3b82f6', fontWeight: '600', fontFamily: 'monospace', fontSize: '0.8125rem', minWidth: '5.5rem' }}>agents/</span>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>AI agent prompts for Product Manager, Designer, and Engineer</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ color: '#3b82f6', fontWeight: '600', fontFamily: 'monospace', fontSize: '0.8125rem', minWidth: '5.5rem' }}>templates/</span>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Document templates for PRDs, wireframes, and technical specifications</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ color: '#3b82f6', fontWeight: '600', fontFamily: 'monospace', fontSize: '0.8125rem', minWidth: '5.5rem' }}>outputs/</span>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Your projects, issues, and all generated specification documents</span>
            </div>
          </div>
        </div>

        {/* Next Steps - Compact */}
        <div style={{ 
          backgroundColor: '#ecfdf5',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          border: '1px solid #a7f3d0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>✨</span>
          <p style={{ color: '#065f46', fontSize: '0.875rem', margin: 0 }}>
            You're all set! Click below to go to your dashboard and start your first project.
          </p>
        </div>

        {/* Go to Homepage Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigate('/')}
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
            <span>Go to Homepage</span>
            <span>→</span>
          </button>
        </div>
      </main>
    </div>
  );
}
