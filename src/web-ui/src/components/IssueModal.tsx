import React, { useState } from 'react';

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 5V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export interface AcceptanceCriterion {
  id: string;
  description: string;
}

export interface IssueData {
  issueId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-review' | 'approved';
  estimatedHours: number;
  dependencies: string[];
  projectId: string;
  projectName: string;
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
}

interface StatusConfig {
  bgColor: string;
  color: string;
}

interface IssueModalProps {
  issue: IssueData;
  onClose: () => void;
  onShip?: (issue: IssueData, e: React.MouseEvent) => void;
  onApprove?: (issue: IssueData) => void;
  canShip?: boolean;
  statusConfig: {
    ready: StatusConfig;
    inReview: StatusConfig;
    approved: StatusConfig;
  };
}

export function IssueModal({ 
  issue, 
  onClose, 
  onShip, 
  onApprove, 
  canShip = true,
  statusConfig 
}: IssueModalProps) {
  const [showFullDetails, setShowFullDetails] = useState(false);

  const getStatusStyle = () => {
    if (issue.status === 'approved') return statusConfig.approved;
    if (issue.status === 'in-review') return statusConfig.inReview;
    return statusConfig.ready;
  };

  const statusStyle = getStatusStyle();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-h-[90vh] flex flex-col rounded-lg overflow-hidden"
        style={{ backgroundColor: 'white', maxWidth: '1024px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>{issue.issueId}</span>
              <h2 className="text-[17px] font-semibold mt-1" style={{ color: 'hsl(0 0% 9%)' }}>{issue.title}</h2>
              <div 
                className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full mt-2"
                style={{ 
                  backgroundColor: 'hsl(235 69% 95%)',
                  color: 'hsl(235 69% 45%)'
                }}
              >
                <span className="font-medium">Project</span>
                <span className="font-mono opacity-80">{issue.projectId}</span>
                <span>·</span>
                <span>{issue.projectName}</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded transition-colors"
              style={{ color: 'hsl(0 0% 46%)' }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <span 
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ 
                backgroundColor: statusStyle.bgColor,
                color: statusStyle.color
              }}
            >
              {issue.status}
            </span>
            <span 
              className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}
            >
              <ClockIcon /> {issue.estimatedHours}h
            </span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showFullDetails ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Description</h3>
                <p className="text-[13px] whitespace-pre-wrap" style={{ color: 'hsl(0 0% 46%)' }}>{issue.description}</p>
              </div>

              {issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Acceptance Criteria</h3>
                  <ul className="space-y-1.5">
                    {issue.acceptanceCriteria.map((ac) => (
                      <li key={ac.id} className="flex items-start gap-2 text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                        <span style={{ color: 'hsl(142 76% 36%)' }}>✓</span>
                        <div>
                          <span className="font-mono text-[10px] px-1 py-0.5 rounded mr-2" style={{ backgroundColor: 'hsl(142 76% 94%)', color: 'hsl(142 76% 30%)' }}>{ac.id}</span>
                          <span>{ac.description}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {issue.dependencies.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Dependencies</h3>
                  <div className="flex flex-wrap gap-2">
                    {issue.dependencies.map(dep => (
                      <span 
                        key={dep}
                        className="text-[11px] px-2 py-1 rounded font-mono"
                        style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Description */}
              <div>
                <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Description</h3>
                <p className="text-[13px] whitespace-pre-wrap" style={{ color: 'hsl(0 0% 46%)' }}>{issue.description}</p>
              </div>

              {/* Screens Affected */}
              {issue.screensAffected && issue.screensAffected.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'hsl(0 0% 46%)' }}>Screens Affected</h3>
                  <div className="flex flex-wrap gap-1">
                    {issue.screensAffected.map(screen => (
                      <span 
                        key={screen}
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ backgroundColor: 'hsl(235 69% 94%)', color: 'hsl(235 69% 40%)' }}
                      >
                        {screen}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Decisions */}
              {issue.keyDecisions && issue.keyDecisions.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Key Decisions</h3>
                  <ul className="space-y-1.5">
                    {issue.keyDecisions.map((decision, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                        <span style={{ color: 'hsl(235 69% 61%)' }}>→</span>
                        <span className="font-mono text-[12px]">{decision}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Acceptance Criteria */}
              {issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Acceptance Criteria</h3>
                  <ul className="space-y-1.5">
                    {issue.acceptanceCriteria.map((ac) => (
                      <li key={ac.id} className="flex items-start gap-2 text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                        <span style={{ color: 'hsl(142 76% 36%)' }}>✓</span>
                        <div>
                          <span className="font-mono text-[10px] px-1 py-0.5 rounded mr-2" style={{ backgroundColor: 'hsl(142 76% 94%)', color: 'hsl(142 76% 30%)' }}>{ac.id}</span>
                          <span>{ac.description}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technical Details */}
              {issue.technicalDetails && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Technical Details</h3>
                  <p className="text-[13px] whitespace-pre-wrap" style={{ color: 'hsl(0 0% 46%)' }}>{issue.technicalDetails}</p>
                </div>
              )}

              {/* Testing Strategy */}
              {issue.testStrategy && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Testing Strategy</h3>
                  <div className="space-y-2 text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                    {issue.testStrategy.automated_tests && (
                      <div>
                        <span className="font-medium" style={{ color: 'hsl(0 0% 30%)' }}>Automated Tests: </span>
                        <span>{issue.testStrategy.automated_tests}</span>
                      </div>
                    )}
                    {issue.testStrategy.manual_verification && (
                      <div>
                        <span className="font-medium" style={{ color: 'hsl(0 0% 30%)' }}>Manual Verification: </span>
                        <span>{issue.testStrategy.manual_verification}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Human-in-the-Loop Verification */}
              {issue.humanInTheLoop && issue.humanInTheLoop.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Human Verification Steps</h3>
                  <ol className="space-y-1.5">
                    {issue.humanInTheLoop.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>
                        <span className="font-mono text-[11px] flex-shrink-0 w-5 text-right" style={{ color: 'hsl(0 0% 60%)' }}>{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Dependencies */}
              {issue.dependencies.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>Dependencies</h3>
                  <div className="flex flex-wrap gap-2">
                    {issue.dependencies.map(dep => (
                      <span 
                        key={dep}
                        className="text-[11px] px-2 py-1 rounded font-mono"
                        style={{ backgroundColor: 'hsl(0 0% 96%)', color: 'hsl(0 0% 46%)' }}
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <button
            onClick={() => setShowFullDetails(!showFullDetails)}
            className="text-[13px] transition-colors"
            style={{ color: 'hsl(235 69% 61%)' }}
          >
            {showFullDetails ? 'Show Summary' : 'View Full Details'}
          </button>
          
          <div className="flex gap-2">
            {issue.status === 'in-review' && onApprove && (
              <button 
                className="px-3 py-1.5 rounded-md text-[13px] font-medium border"
                style={{ backgroundColor: 'white', color: 'hsl(0 0% 32%)', borderColor: 'hsl(0 0% 90%)' }}
                onClick={() => onApprove(issue)}
              >
                ✓ Approve
              </button>
            )}
            {issue.status === 'pending' && canShip && onShip && (
              <button 
                className="px-3 py-1.5 rounded-md text-[13px] font-medium"
                style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                onClick={(e) => onShip(issue, e)}
              >
                Ship
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

