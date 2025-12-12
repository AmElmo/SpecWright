import { useState, useMemo } from 'react';
import { logger } from '../utils/logger';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

// Icons - slightly larger for better visibility
const BookIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const GitHubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
  </svg>
);

const CheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ExternalLinkIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const StarIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

interface TechnologyOption {
  name: string;
  description: string;
  version?: string;
  documentation_url?: string;
  github_url?: string;
  pros?: string[];
  cons?: string[];
  trade_offs?: string[];
  maturity?: string;
  community_size?: string;
  last_updated?: string;
  implementation_complexity?: string;
  estimated_time?: string;
  recommended?: boolean;
  recommendation_reason?: string;
}

interface TechnologyDecision {
  category: string;
  description?: string;
  decision_needed?: boolean;
  options: TechnologyOption[];
  user_choice?: string;
  user_choice_description?: string;
  user_choice_version?: string;
  user_reason?: string;
  final_decision?: string;
}

interface TechnologyChoicesData {
  project_name: string;
  project_id?: string;
  technology_decisions?: TechnologyDecision[];
  technology_stack?: any;
  new_dependencies?: any[];
  existing_dependencies_used?: any[];
  infrastructure_requirements?: any;
  deployment_notes?: any;
  security_considerations?: any;
  summary?: {
    total_decisions?: number;
    decisions_made?: number;
    estimated_setup_time?: string;
    overall_complexity?: string;
  };
}

interface TechnologyChoicesEditorProps {
  content: string;
  projectId: string;
  onSave: (content: string) => void;
}

// Helper to get complexity color
const getComplexityColor = (complexity: string) => {
  const lower = complexity.toLowerCase();
  if (lower.includes('low') || lower.includes('simple')) return 'text-emerald-600 bg-emerald-50';
  if (lower.includes('medium') || lower.includes('moderate')) return 'text-amber-600 bg-amber-50';
  if (lower.includes('high') || lower.includes('complex')) return 'text-rose-600 bg-rose-50';
  return 'text-slate-600 bg-slate-100';
};

// Helper to get maturity color
const getMaturityColor = (maturity: string) => {
  const lower = maturity.toLowerCase();
  if (lower.includes('stable') || lower.includes('mature')) return 'text-emerald-600 bg-emerald-50';
  if (lower.includes('growing') || lower.includes('emerging')) return 'text-sky-600 bg-sky-50';
  if (lower.includes('beta') || lower.includes('experimental')) return 'text-amber-600 bg-amber-50';
  return 'text-slate-600 bg-slate-100';
};

export function TechnologyChoicesEditor({ content, projectId, onSave }: TechnologyChoicesEditorProps) {
  const [data, setData] = useState<TechnologyChoicesData>(() => {
    try {
      return JSON.parse(content);
    } catch {
      return { project_name: '', technology_decisions: [] };
    }
  });
  
  const [saving, setSaving] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

  const hasDecisions = data.technology_decisions && data.technology_decisions.length > 0;
  const hasStack = data.technology_stack && Object.keys(data.technology_stack).length > 0;

  const progress = useMemo(() => {
    if (!data.technology_decisions || data.technology_decisions.length === 0) {
      return { made: 0, total: 0 };
    }
    const total = data.technology_decisions.length;
    const made = data.technology_decisions.filter(d => d.user_choice || d.final_decision).length;
    return { made, total };
  }, [data]);

  const saveData = async (newData: TechnologyChoicesData) => {
    setSaving(true);
    try {
      const jsonString = JSON.stringify(newData, null, 2);
      await fetch(`/api/specification/document/${projectId}/documents/technology_choices.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: jsonString })
      });
      setData(newData);
      onSave(jsonString);
    } catch (err) {
      logger.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectOption = (categoryIndex: number, optionName: string) => {
    if (!data.technology_decisions || !data.technology_decisions[categoryIndex]) return;
    
    const option = data.technology_decisions[categoryIndex].options.find(opt => opt.name === optionName);
    if (!option) return;

    const newDecisions = data.technology_decisions.map((decision, idx) => {
      if (idx !== categoryIndex) return decision;
      return {
        ...decision,
        user_choice: option.name,
        user_choice_description: option.description,
        user_choice_version: option.version || '',
        final_decision: option.name,
      };
    });

    const newData = { ...data, technology_decisions: newDecisions };
    saveData(newData);
  };

  const toggleOptionExpand = (optionKey: string) => {
    setExpandedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(optionKey)) {
        newSet.delete(optionKey);
      } else {
        newSet.add(optionKey);
      }
      return newSet;
    });
  };

  // Technology Stack format (finalized)
  if (!hasDecisions && hasStack) {
    return (
      <Card className="bg-white border-slate-200 p-8">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-900">Technology Stack</h3>
            <Badge className="bg-emerald-600 text-white px-4 py-1.5 text-sm">Finalized</Badge>
          </div>

          {Object.entries(data.technology_stack).map(([category, stack]: [string, any]) => (
            <div key={category} className="border-b border-slate-200 pb-6 last:border-b-0">
              <h4 className="text-lg font-semibold text-slate-800 capitalize mb-4">
                {category.replace(/_/g, ' ')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(stack).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex items-start gap-3">
                    <div className="text-slate-500 font-medium min-w-[160px] text-base">
                      {key.replace(/_/g, ' ')}:
                    </div>
                    <div className="text-slate-900 font-mono text-base font-medium">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {data.new_dependencies && data.new_dependencies.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4">New Dependencies</h4>
              <div className="space-y-4">
                {data.new_dependencies.map((dep: any, idx: number) => (
                  <Card key={idx} className="bg-slate-50 border-slate-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-900 text-lg">{dep.name}</span>
                        <span className="text-slate-500 bg-slate-200 px-2 py-0.5 rounded text-sm font-mono">{dep.version}</span>
                      </div>
                    </div>
                    <p className="text-base text-slate-700 mb-2">{dep.purpose}</p>
                    <p className="text-sm text-slate-500 italic">{dep.justification}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  const activeDecision = hasDecisions ? data.technology_decisions![activeTabIndex] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Technology Choices</h3>
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
          progress.made === progress.total 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-amber-100 text-amber-700'
        }`}>
          {progress.made}/{progress.total} selected
        </div>
      </div>

      {/* Category Tabs */}
      {hasDecisions && (
        <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200">
          {data.technology_decisions!.map((decision, index) => {
            const hasChoice = !!decision.user_choice || !!decision.final_decision;
            const isActive = index === activeTabIndex;
            
            return (
              <button
                key={index}
                onClick={() => setActiveTabIndex(index)}
                className={`px-5 py-3 text-base font-medium transition-all relative whitespace-nowrap ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {hasChoice ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <CheckIcon className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                  )}
                  {decision.category}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Category Content */}
      {activeDecision && (
        <div className="space-y-5">
          {/* Context */}
          {activeDecision.description && (
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl p-5 text-base text-slate-600 leading-relaxed">
              {activeDecision.description}
            </div>
          )}

          {/* Options */}
          <div className="space-y-4">
            {activeDecision.options.map((option, optionIndex) => {
              const optionKey = `${activeTabIndex}-${optionIndex}`;
              const isSelected = option.name === (activeDecision.user_choice || activeDecision.final_decision);
              const isRecommended = option.recommended;
              const isExpanded = expandedOptions.has(optionKey);

              return (
                <div
                  key={optionIndex}
                  className={`rounded-xl border-2 transition-all overflow-hidden ${
                    isSelected
                      ? 'border-emerald-400 bg-gradient-to-br from-emerald-50/80 to-white shadow-lg shadow-emerald-100'
                      : isRecommended
                        ? 'border-sky-200 bg-gradient-to-br from-sky-50/30 to-white hover:border-sky-300'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Recommended Banner */}
                  {isRecommended && !isSelected && (
                    <div className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-5 py-2 flex items-center gap-2 text-sm font-medium">
                      <StarIcon className="w-4 h-4" />
                      Recommended Option
                    </div>
                  )}
                  
                  {/* Selected Banner */}
                  {isSelected && (
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2 flex items-center gap-2 text-sm font-medium">
                      <CheckIcon className="w-4 h-4" />
                      Selected Technology
                    </div>
                  )}

                  {/* Header */}
                  <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="text-xl font-bold text-slate-900">{option.name}</h4>
                          {option.version && (
                            <span className="text-sm text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-md">
                              v{option.version}
                            </span>
                          )}
                        </div>
                        {/* Description always visible */}
                        <p className="mt-3 text-base text-slate-600 leading-relaxed">
                          {option.description}
                        </p>
                      </div>
                    </div>

                    {/* Quick Stats Row */}
                    <div className="flex flex-wrap gap-3 mt-4">
                      {option.maturity && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${getMaturityColor(option.maturity)}`}>
                          <span className="opacity-60">Maturity:</span>
                          {option.maturity}
                        </span>
                      )}
                      {option.implementation_complexity && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${getComplexityColor(option.implementation_complexity)}`}>
                          <span className="opacity-60">Complexity:</span>
                          {option.implementation_complexity}
                        </span>
                      )}
                      {option.estimated_time && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-violet-600 bg-violet-50">
                          <span className="opacity-60">Setup:</span>
                          {option.estimated_time}
                        </span>
                      )}
                    </div>

                    {/* Resource Links - Now Prominent */}
                    {(option.documentation_url || option.github_url) && (
                      <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-slate-100">
                        {option.documentation_url && (
                          <a
                            href={option.documentation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-sm font-medium transition-colors group"
                          >
                            <BookIcon className="w-4 h-4" />
                            View Documentation
                            <ExternalLinkIcon className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                          </a>
                        )}
                        {option.github_url && (
                          <a
                            href={option.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors group"
                          >
                            <GitHubIcon className="w-4 h-4" />
                            View on GitHub
                            <ExternalLinkIcon className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pros & Cons - Always Visible Preview */}
                  {((option.pros && option.pros.length > 0) || (option.cons && option.cons.length > 0)) && (
                    <div className="px-6 pb-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Pros */}
                        {option.pros && option.pros.length > 0 && (
                          <div className="bg-emerald-50/70 rounded-xl p-4">
                            <h5 className="flex items-center gap-2 text-sm font-bold text-emerald-700 uppercase tracking-wide mb-3">
                              <CheckIcon className="w-4 h-4" />
                              Advantages
                            </h5>
                            <ul className="space-y-2.5">
                              {(isExpanded ? option.pros : option.pros.slice(0, 3)).map((pro, i) => (
                                <li key={i} className="flex items-start gap-3 text-base">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center mt-0.5">
                                    <CheckIcon className="w-3 h-3 text-emerald-700" />
                                  </span>
                                  <span className="text-slate-700">{pro}</span>
                                </li>
                              ))}
                              {!isExpanded && option.pros.length > 3 && (
                                <li className="text-sm text-emerald-600 font-medium pl-8">
                                  +{option.pros.length - 3} more advantage{option.pros.length - 3 > 1 ? 's' : ''}
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Cons */}
                        {option.cons && option.cons.length > 0 && (
                          <div className="bg-rose-50/70 rounded-xl p-4">
                            <h5 className="flex items-center gap-2 text-sm font-bold text-rose-700 uppercase tracking-wide mb-3">
                              <XIcon className="w-4 h-4" />
                              Considerations
                            </h5>
                            <ul className="space-y-2.5">
                              {(isExpanded ? option.cons : option.cons.slice(0, 3)).map((con, i) => (
                                <li key={i} className="flex items-start gap-3 text-base">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-200 flex items-center justify-center mt-0.5">
                                    <XIcon className="w-3 h-3 text-rose-700" />
                                  </span>
                                  <span className="text-slate-700">{con}</span>
                                </li>
                              ))}
                              {!isExpanded && option.cons.length > 3 && (
                                <li className="text-sm text-rose-600 font-medium pl-8">
                                  +{option.cons.length - 3} more consideration{option.cons.length - 3 > 1 ? 's' : ''}
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-6 pb-5 space-y-5">
                      {/* Trade-offs */}
                      {option.trade_offs && option.trade_offs.length > 0 && (
                        <div className="bg-amber-50/70 rounded-xl p-4">
                          <h5 className="flex items-center gap-2 text-sm font-bold text-amber-700 uppercase tracking-wide mb-3">
                            ⚖️ Trade-offs
                          </h5>
                          <ul className="space-y-2">
                            {option.trade_offs.map((t, i) => (
                              <li key={i} className="flex items-start gap-3 text-base text-slate-700">
                                <span className="text-amber-500 mt-1">•</span>
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendation Reason */}
                      {isRecommended && option.recommendation_reason && (
                        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 rounded-xl p-5 border border-sky-200">
                          <h5 className="flex items-center gap-2 text-sm font-bold text-sky-700 uppercase tracking-wide mb-2">
                            <StarIcon className="w-4 h-4" />
                            Why We Recommend This
                          </h5>
                          <p className="text-base text-slate-700 leading-relaxed">{option.recommendation_reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="px-6 pb-5 flex items-center justify-between">
                    {/* Expand/Collapse Button */}
                    {((option.trade_offs && option.trade_offs.length > 0) || 
                      (option.pros && option.pros.length > 3) || 
                      (option.cons && option.cons.length > 3) ||
                      (isRecommended && option.recommendation_reason)) ? (
                      <button
                        onClick={() => toggleOptionExpand(optionKey)}
                        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors group"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUpIcon />
                            <span>Show less details</span>
                          </>
                        ) : (
                          <>
                            <ChevronDownIcon />
                            <span>Show all details</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div />
                    )}
                    
                    {/* Select Button */}
                    <Button
                      onClick={() => selectOption(activeTabIndex, option.name)}
                      disabled={isSelected || saving}
                      variant={isSelected ? 'success' : 'default'}
                      size="default"
                      className={`px-6 py-2.5 text-base font-semibold ${
                        isSelected 
                          ? '' 
                          : isRecommended 
                            ? 'bg-sky-600 hover:bg-sky-700 text-white'
                            : ''
                      }`}
                    >
                      {saving ? 'Saving...' : isSelected ? '✓ Selected' : 'Select This Option'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
