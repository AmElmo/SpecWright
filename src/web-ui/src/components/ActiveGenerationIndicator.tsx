import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveGenerations } from '../lib/active-generations-context';

const PHASE_LABELS: Record<string, string> = {
  scoping: 'Scoping',
  'pm-questions': 'PM Questions',
  'pm-prd': 'Writing PRD',
  'ux-questions': 'UX Questions',
  'ux-design-brief': 'Design Brief',
  'engineer-questions': 'Engineer Questions',
  'engineer-spec': 'Tech Spec',
  'issue-breakdown': 'Breakdown',
  'docs-generate': 'Generating Docs',
};

export function ActiveGenerationIndicator() {
  const { activeGenerations, hasActiveGenerations } = useActiveGenerations();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasActiveGenerations) return null;

  const primary = activeGenerations[0];
  const hasMultiple = activeGenerations.length > 1;
  const phaseLabel = PHASE_LABELS[primary.phase] || primary.phase;

  const handlePillClick = () => {
    if (hasMultiple) {
      setIsExpanded(!isExpanded);
    } else if (primary.projectId) {
      navigate(`/specification/${primary.projectId}`);
    }
  };

  const handleItemClick = (gen: (typeof activeGenerations)[0]) => {
    setIsExpanded(false);
    if (gen.phase === 'issue-breakdown' && gen.projectId) {
      navigate(`/breakdown/${gen.projectId}`);
    } else if (gen.projectId) {
      navigate(`/specification/${gen.projectId}`);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {/* Expanded list */}
      {isExpanded && hasMultiple && (
        <div
          className="rounded-lg shadow-xl overflow-hidden"
          style={{
            backgroundColor: 'hsl(0 0% 12%)',
            border: '1px solid hsl(0 0% 22%)',
            minWidth: '260px',
          }}
        >
          <div
            className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'hsl(0 0% 50%)', borderBottom: '1px solid hsl(0 0% 20%)' }}
          >
            {activeGenerations.length} Active Generations
          </div>
          {activeGenerations.map((gen) => (
            <button
              key={gen.key}
              onClick={() => handleItemClick(gen)}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors"
              style={{ color: 'white' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(0 0% 18%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Pulsing dot */}
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: 'hsl(142 76% 50%)' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: 'hsl(142 76% 50%)' }}
                />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {gen.projectName || 'Workspace'}
                </div>
                <div className="text-[11px]" style={{ color: 'hsl(0 0% 50%)' }}>
                  {PHASE_LABELS[gen.phase] || gen.phase}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pill button */}
      <button
        onClick={handlePillClick}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg transition-all hover:scale-105"
        style={{
          backgroundColor: 'hsl(0 0% 9%)',
          color: 'white',
          border: '1px solid hsl(0 0% 20%)',
        }}
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: 'hsl(142 76% 50%)' }}
          />
          <span
            className="relative inline-flex rounded-full h-2.5 w-2.5"
            style={{ backgroundColor: 'hsl(142 76% 50%)' }}
          />
        </span>

        <span className="text-[13px] font-medium whitespace-nowrap">
          AI Working
          {!hasMultiple && primary.projectName && (
            <span className="opacity-70"> &middot; {primary.projectName}</span>
          )}
          {!hasMultiple && <span className="opacity-50 ml-1">{phaseLabel}</span>}
        </span>

        {hasMultiple && (
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'hsl(0 0% 25%)', color: 'hsl(0 0% 70%)' }}
          >
            {activeGenerations.length}
          </span>
        )}

        {hasMultiple && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="transition-transform"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path
              d="M3 5L6 8L9 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
