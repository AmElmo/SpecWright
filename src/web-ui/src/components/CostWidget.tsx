/**
 * Cost Widget Component
 * 
 * A hoverable widget that shows token cost estimates for a project.
 * Displayed in the sidebar during the specification process.
 */

import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

interface CostSummary {
  enabled: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tier: 'budget' | 'standard' | 'premium';
  tierName: string;
  formatted: {
    inputTokens: string;
    outputTokens: string;
    inputCost: string;
    outputCost: string;
    totalCost: string;
  };
}

interface CostWidgetProps {
  projectId: string;
  refreshTrigger?: number; // Increment to force refresh
}

// Tier badge colors
const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  budget: { bg: 'hsl(142 76% 94%)', text: 'hsl(142 76% 30%)', border: 'hsl(142 76% 80%)' },
  standard: { bg: 'hsl(235 69% 95%)', text: 'hsl(235 69% 50%)', border: 'hsl(235 69% 80%)' },
  premium: { bg: 'hsl(280 69% 95%)', text: 'hsl(280 69% 40%)', border: 'hsl(280 69% 80%)' }
};

// Human writing speed estimate (tokens per hour)
// Accounts for thinking, writing, and editing time for technical documentation
const TOKENS_PER_HUMAN_HOUR = 750;

/**
 * Estimate human hours saved based on output tokens
 * Uses ~750 tokens/hour for thoughtful technical writing (specs, PRDs, architecture docs)
 */
function estimateHumanHours(outputTokens: number): number {
  return outputTokens / TOKENS_PER_HUMAN_HOUR;
}

/**
 * Format human time in a readable way
 */
function formatHumanTime(hours: number): string {
  if (hours < 1) {
    return '< 1h';
  }
  return `${Math.round(hours)}h`;
}

// Dollar sign icon
const DollarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function CostWidget({ projectId, refreshTrigger = 0 }: CostWidgetProps) {
  const [costData, setCostData] = useState<CostSummary | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCost = async () => {
      try {
        const response = await fetch(`/api/specification/cost/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setCostData(data);
        }
      } catch (error) {
        logger.error('Failed to fetch cost data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCost();
    
    // Refresh every 10 seconds while visible
    const interval = setInterval(fetchCost, 10000);
    return () => clearInterval(interval);
  }, [projectId, refreshTrigger]);

  // Don't render if cost estimation is disabled or no data
  if (loading || !costData || !costData.enabled) {
    return null;
  }

  // Don't show if no cost recorded yet
  if (costData.totalInputTokens === 0 && costData.totalOutputTokens === 0) {
    return null;
  }

  const tierColors = TIER_COLORS[costData.tier] || TIER_COLORS.standard;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Compact badge */}
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-default transition-all"
        style={{ 
          backgroundColor: 'hsl(0 0% 97%)',
          border: '1px solid hsl(0 0% 90%)',
          color: 'hsl(0 0% 46%)'
        }}
      >
        <DollarIcon />
        <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 32%)' }}>
          {costData.formatted.totalCost}
        </span>
      </div>

      {/* Expanded tooltip on hover */}
      {isHovered && (
        <div 
          className="absolute bottom-full left-0 mb-2 z-50 min-w-[260px] animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div 
            className="rounded-lg shadow-lg overflow-hidden"
            style={{ 
              backgroundColor: 'hsl(0 0% 100%)',
              border: '1px solid hsl(0 0% 90%)'
            }}
          >
            {/* Header */}
            <div 
              className="px-3 py-2 border-b"
              style={{ borderColor: 'hsl(0 0% 92%)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                  Token Cost Estimate
                </span>
                <span 
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ 
                    backgroundColor: tierColors.bg,
                    color: tierColors.text,
                    border: `1px solid ${tierColors.border}`
                  }}
                >
                  {costData.tier.charAt(0).toUpperCase() + costData.tier.slice(1)}
                </span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: 'hsl(0 0% 60%)' }}>
                Based on {costData.tierName.replace(' Models', '')} tier API pricing
              </p>
            </div>

            {/* Stats */}
            <div className="px-3 py-2">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[10px] font-medium mb-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                    Input Tokens
                  </div>
                  <div className="text-[13px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                    {costData.formatted.inputTokens}
                  </div>
                  <div className="text-[10px]" style={{ color: 'hsl(0 0% 60%)' }}>
                    {costData.formatted.inputCost}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium mb-0.5" style={{ color: 'hsl(0 0% 46%)' }}>
                    Output Tokens
                  </div>
                  <div className="text-[13px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                    {costData.formatted.outputTokens}
                  </div>
                  <div className="text-[10px]" style={{ color: 'hsl(0 0% 60%)' }}>
                    {costData.formatted.outputCost}
                  </div>
                </div>
              </div>

              {/* Total */}
              <div 
                className="flex items-center justify-between py-2 border-t"
                style={{ borderColor: 'hsl(0 0% 92%)' }}
              >
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'hsl(0 0% 46%)' }}>
                    <path d="M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 46%)' }}>
                    Total Estimate
                  </span>
                </div>
                <span className="text-[14px] font-bold" style={{ color: 'hsl(235 69% 50%)' }}>
                  {costData.formatted.totalCost}
                </span>
              </div>

              {/* Human time saved */}
              {costData.totalOutputTokens > 0 && (
                <div 
                  className="flex items-center justify-between py-2 border-t"
                  style={{ borderColor: 'hsl(0 0% 92%)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'hsl(0 0% 46%)' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[11px] font-medium" style={{ color: 'hsl(0 0% 46%)' }}>
                      Human Time Saved
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold" style={{ color: 'hsl(142 76% 30%)' }}>
                    ~{formatHumanTime(estimateHumanHours(costData.totalOutputTokens))}
                  </span>
                </div>
              )}
            </div>

            {/* Footer note */}
            <div 
              className="px-3 py-1.5 text-[9px]"
              style={{ backgroundColor: 'hsl(0 0% 98%)', color: 'hsl(0 0% 60%)' }}
            >
              Actual costs may vary based on your AI tool's pricing
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CostWidget;

