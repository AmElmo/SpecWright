import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import specwrightLogo from '@/assets/logos/specwright_logo.svg';
import { useSidebarWidth } from '../hooks/use-sidebar-width';
import { SidebarResizeHandle } from './SidebarResizeHandle';

interface Question {
  question: string;
  options: string[];
  answer: string;
}

interface QuestionData {
  project_request: string;
  questions: Question[];
}

interface QuestionFormProps {
  projectId: string;
  phase: 'pm' | 'ux' | 'engineer';
  onComplete: () => void;
  onCancel?: () => void;
}

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

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function QuestionForm({ projectId, phase, onComplete, onCancel }: QuestionFormProps) {
  const [data, setData] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [customAnswers, setCustomAnswers] = useState<{ [key: number]: boolean }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const questionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const submitSectionRef = useRef<HTMLDivElement | null>(null);
  const hasAutoFocused = useRef(false);
  const isManualScrolling = useRef(false);
  const { sidebarWidth, handleResizeStart } = useSidebarWidth();

  useEffect(() => {
    fetchQuestions();
  }, [projectId, phase]);
  
  const scrollToQuestion = (index: number, instant = false) => {
    const questionElement = questionRefs.current[index];
    if (questionElement) {
      isManualScrolling.current = true;
      setCurrentQuestionIndex(index);
      questionElement.scrollIntoView({ 
        behavior: instant ? 'auto' : 'smooth', 
        block: 'center'
      });
      setTimeout(() => {
        isManualScrolling.current = false;
      }, instant ? 0 : 800);
    }
  };
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualScrolling.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-question-index') || '0');
            setCurrentQuestionIndex(index);
          }
        });
      },
      { threshold: 0.5 }
    );

    Object.values(questionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [data]);
  
  useEffect(() => {
    if (data && data.questions.length > 0 && !hasAutoFocused.current) {
      hasAutoFocused.current = true;
      const firstUnansweredIndex = data.questions.findIndex(q => !q.answer || !q.answer.trim());
      setTimeout(() => {
        if (firstUnansweredIndex !== -1) {
          scrollToQuestion(firstUnansweredIndex);
        } else {
          if (submitSectionRef.current) {
            submitSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 300);
    }
  }, [data]);
  
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/questions/${projectId}/${phase}`);
      
      if (!response.ok) {
        throw new Error('Failed to load questions');
      }
      
      const questionData = await response.json();
      
      if (!questionData.questions || !Array.isArray(questionData.questions)) {
        throw new Error('Invalid question data format');
      }
      
      const validQuestions = questionData.questions.filter((q: Question) => {
        return q && 
               q.question && 
               typeof q.question === 'string' && 
               q.question.trim().length > 0 &&
               !q.question.includes('Waiting for') &&
               !q.question.includes('placeholder');
      });
      
      if (validQuestions.length === 0) {
        throw new Error('No valid questions found. Please regenerate questions.');
      }
      
      const questionsWithAnswers = validQuestions.map((q: Question) => ({
        ...q,
        answer: q.answer || '',
        options: q.options || []
      }));
      
      setData({
        ...questionData,
        questions: questionsWithAnswers
      });
      
      const customAnswersState: { [key: number]: boolean } = {};
      questionsWithAnswers.forEach((q: Question, index: number) => {
        if (q.answer && q.options && q.options.length > 0) {
          if (!q.options.includes(q.answer)) {
            customAnswersState[index] = true;
          }
        }
      });
      setCustomAnswers(customAnswersState);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAnswerChange = (index: number, answer: string, shouldAutoAdvance = true) => {
    if (!data) return;
    
    const updatedQuestions = [...data.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], answer };
    
    setData({
      ...data,
      questions: updatedQuestions
    });

    if (shouldAutoAdvance) {
      setTimeout(() => {
        if (index < data.questions.length - 1) {
          scrollToQuestion(index + 1);
        } else {
          if (submitSectionRef.current) {
            isManualScrolling.current = true;
            submitSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { isManualScrolling.current = false; }, 800);
          }
        }
      }, 500);
    }
  };
  
  const handleSave = async () => {
    if (!data) return;
    
    try {
      setSaving(true);
      setError('');
      
      const response = await fetch(`/api/questions/${projectId}/${phase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save answers');
      }
      
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save answers');
      setSaving(false);
    }
  };
  
  const allQuestionsAnswered = () => {
    if (!data) return false;
    return data.questions.every(q => q.answer && q.answer.trim() !== '');
  };
  
  const getPhaseName = () => {
    switch (phase) {
      case 'pm': return 'Product Manager';
      case 'ux': return 'Designer';
      case 'engineer': return 'Engineer';
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      scrollToQuestion(currentQuestionIndex - 1);
    }
  };

  const goToNextQuestion = () => {
    if (data && currentQuestionIndex < data.questions.length - 1) {
      scrollToQuestion(currentQuestionIndex + 1);
    }
  };

  // Sidebar nav items
  const navItems = [
    { label: 'Projects', icon: ProjectsIcon, path: '/' },
    { label: 'Issues', icon: IssuesIcon, path: '/issues' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  // Sidebar component
  const Sidebar = () => {
    const mainNavItems = navItems.filter(item => item.label !== 'Settings');
    const settingsItem = navItems.find(item => item.label === 'Settings');
    
    return (
      <aside
        className="h-screen flex flex-col border-r sticky top-0 flex-shrink-0 relative"
        style={{ width: sidebarWidth, backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
      >
        <div className="px-4 py-4 border-b" style={{ borderColor: 'hsl(0 0% 92%)' }}>
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <img src={specwrightLogo} alt="SpecWright" className="w-7 h-7" />
            <span className="font-semibold text-[18px]" style={{ color: 'hsl(0 0% 9%)' }}>SpecWright</span>
          </Link>
        </div>
        <nav className="flex-1 p-2">
          <ul className="space-y-0.5">
            {mainNavItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
                  style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <item.icon />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Settings at bottom */}
        {settingsItem && (
          <div className="p-2 border-t" style={{ borderColor: 'hsl(0 0% 92%)' }}>
            <Link
              to={settingsItem.path}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md no-underline transition-colors"
              style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 46%)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(0 0% 97%)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <settingsItem.icon />
              <span className="text-[13px] font-medium">{settingsItem.label}</span>
            </Link>
          </div>
        )}
        <SidebarResizeHandle onMouseDown={handleResizeStart} />
      </aside>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="linear-spinner"></div>
            <span className="text-[13px]" style={{ color: 'hsl(0 0% 46%)' }}>Loading questions...</span>
          </div>
        </main>
      </div>
    );
  }
  
  if (error && !data) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-lg p-6 text-center" style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}>
              <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'hsl(0 84% 35%)' }}>
                Unable to Load Questions
              </h2>
              <p className="text-[13px] mb-4" style={{ color: 'hsl(0 84% 45%)' }}>{error}</p>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-md text-[13px] font-medium"
                  style={{ backgroundColor: 'hsl(0 0% 9%)', color: 'white' }}
                >
                  Refresh Page
                </button>
                {onCancel && (
                  <button 
                    onClick={onCancel}
                    className="px-4 py-2 rounded-md text-[13px] font-medium"
                    style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 32%)', border: '1px solid hsl(0 0% 90%)' }}
                  >
                    Go Back
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  if (!data) return null;

  const progress = ((currentQuestionIndex + 1) / data.questions.length) * 100;
  const answeredCount = data.questions.filter(q => q.answer && q.answer.trim()).length;
  
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(0 0% 98%)' }}>
      <Sidebar />
      
      <main className="flex-1 flex flex-col">
        {/* Fixed Header */}
        <header 
          className="sticky top-0 z-50 border-b"
          style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
        >
          {/* Progress Bar */}
          <div className="w-full h-1" style={{ backgroundColor: 'hsl(0 0% 92%)' }}>
            <div 
              className="h-1 transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, backgroundColor: 'hsl(235 69% 61%)' }}
            />
          </div>
          
          <div className="px-6 py-3">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold" style={{ color: 'hsl(0 0% 9%)' }}>
                    {getPhaseName()} Questions
                  </h2>
                  <p className="text-[12px]" style={{ color: 'hsl(0 0% 46%)' }}>
                    Question {currentQuestionIndex + 1} of {data.questions.length}
                  </p>
                </div>
              </div>
              <span 
                className="text-[12px] font-medium px-2.5 py-1 rounded-full"
                style={{ backgroundColor: 'hsl(235 69% 95%)', color: 'hsl(235 69% 50%)' }}
              >
                {answeredCount} / {data.questions.length} answered
              </span>
            </div>
          </div>
        </header>

        {/* Questions Container */}
        <div className="flex-1 overflow-y-auto pb-24 scroll-smooth">
          <div className="max-w-3xl mx-auto px-6">
            {data.questions.map((question, index) => (
              <div
                key={index}
                ref={(el) => (questionRefs.current[index] = el)}
                data-question-index={index}
                className="min-h-[calc(100vh-10rem)] flex flex-col justify-center py-10 transition-opacity duration-300"
                style={{ opacity: Math.abs(index - currentQuestionIndex) <= 1 ? 1 : 0.3 }}
              >
                {/* Question Header */}
                <div className="mb-6 flex items-start gap-4">
                  <span 
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold"
                    style={{ 
                      backgroundColor: index === currentQuestionIndex 
                        ? 'hsl(235 69% 61%)' 
                        : question.answer 
                          ? 'hsl(142 76% 36%)' 
                          : 'hsl(0 0% 90%)',
                      color: index === currentQuestionIndex || question.answer ? 'white' : 'hsl(0 0% 46%)'
                    }}
                  >
                    {question.answer && index !== currentQuestionIndex ? <CheckIcon /> : index + 1}
                  </span>
                  <h1 
                    className="text-[17px] font-semibold leading-relaxed flex-1"
                    style={{ color: index === currentQuestionIndex ? 'hsl(0 0% 9%)' : 'hsl(0 0% 46%)' }}
                  >
                    {question.question}
                  </h1>
                </div>

                {/* Answer Options */}
                <div className="space-y-2 pl-11">
                  {question.options && question.options.length > 0 ? (
                    <>
                      {question.options.map((option, optIndex) => (
                        <button
                          key={optIndex}
                          onClick={() => {
                            handleAnswerChange(index, option);
                            setCustomAnswers({...customAnswers, [index]: false});
                          }}
                          className="w-full text-left flex items-start gap-3 p-4 rounded-lg transition-all"
                          style={{
                            backgroundColor: question.answer === option && !customAnswers[index] 
                              ? 'hsl(235 69% 61%)' 
                              : 'hsl(0 0% 100%)',
                            color: question.answer === option && !customAnswers[index] 
                              ? 'white' 
                              : 'hsl(0 0% 20%)',
                            border: `1px solid ${question.answer === option && !customAnswers[index] 
                              ? 'hsl(235 69% 61%)' 
                              : 'hsl(0 0% 90%)'}`
                          }}
                          onMouseEnter={(e) => {
                            if (question.answer !== option || customAnswers[index]) {
                              e.currentTarget.style.borderColor = 'hsl(235 69% 80%)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (question.answer !== option || customAnswers[index]) {
                              e.currentTarget.style.borderColor = 'hsl(0 0% 90%)';
                            }
                          }}
                        >
                          <div 
                            className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5"
                            style={{
                              borderColor: question.answer === option && !customAnswers[index] 
                                ? 'white' 
                                : 'hsl(0 0% 80%)',
                              backgroundColor: question.answer === option && !customAnswers[index] 
                                ? 'white' 
                                : 'transparent'
                            }}
                          >
                            {question.answer === option && !customAnswers[index] && (
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(235 69% 61%)' }} />
                            )}
                          </div>
                          <span className="text-[13px] leading-relaxed">{option}</span>
                        </button>
                      ))}
                      
                      {/* Custom Answer Option */}
                      <button
                        onClick={() => {
                          setCustomAnswers({...customAnswers, [index]: true});
                          handleAnswerChange(index, '', false);
                          setTimeout(() => {
                            const questionElement = questionRefs.current[index];
                            if (questionElement) {
                              const textarea = questionElement.querySelector('textarea');
                              if (textarea) {
                                isManualScrolling.current = true;
                                textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                textarea.focus();
                                setTimeout(() => { isManualScrolling.current = false; }, 800);
                              }
                            }
                          }, 300);
                        }}
                        className="w-full text-left flex items-start gap-3 p-4 rounded-lg transition-all"
                        style={{
                          backgroundColor: customAnswers[index] ? 'hsl(235 69% 61%)' : 'hsl(0 0% 100%)',
                          color: customAnswers[index] ? 'white' : 'hsl(0 0% 20%)',
                          border: `1px solid ${customAnswers[index] ? 'hsl(235 69% 61%)' : 'hsl(0 0% 90%)'}`
                        }}
                      >
                        <div 
                          className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5"
                          style={{
                            borderColor: customAnswers[index] ? 'white' : 'hsl(0 0% 80%)',
                            backgroundColor: customAnswers[index] ? 'white' : 'transparent'
                          }}
                        >
                          {customAnswers[index] && (
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(235 69% 61%)' }} />
                          )}
                        </div>
                        <span className="text-[13px] font-medium">Write my own answer</span>
                      </button>
                      
                      {/* Custom Answer Textarea */}
                      {customAnswers[index] && (
                        <div className="mt-3">
                          <textarea
                            value={question.answer || ''}
                            onChange={(e) => handleAnswerChange(index, e.target.value, false)}
                            placeholder="Type your answer here..."
                            rows={4}
                            className="w-full rounded-lg p-4 text-[13px] resize-none focus:outline-none focus:ring-2"
                            style={{
                              backgroundColor: 'hsl(0 0% 100%)',
                              border: '1px solid hsl(235 69% 80%)',
                              color: 'hsl(0 0% 9%)'
                            }}
                            autoFocus
                          />
                          {question.answer && question.answer.trim() && (
                            <button
                              onClick={() => {
                                if (index < data.questions.length - 1) {
                                  scrollToQuestion(index + 1);
                                } else {
                                  if (submitSectionRef.current) {
                                    isManualScrolling.current = true;
                                    submitSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    setTimeout(() => { isManualScrolling.current = false; }, 800);
                                  }
                                }
                              }}
                              className="mt-3 px-4 py-2 rounded-md text-[13px] font-medium"
                              style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                            >
                              Continue
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Text Input for open-ended questions */
                    <div>
                      <textarea
                        value={question.answer || ''}
                        onChange={(e) => handleAnswerChange(index, e.target.value, false)}
                        placeholder="Type your answer here..."
                        rows={5}
                        className="w-full rounded-lg p-4 text-[13px] resize-none focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'hsl(0 0% 100%)',
                          border: '1px solid hsl(0 0% 90%)',
                          color: 'hsl(0 0% 9%)'
                        }}
                        autoFocus={index === currentQuestionIndex}
                      />
                      {question.answer && question.answer.trim() && (
                        <button
                          onClick={() => {
                            if (index < data.questions.length - 1) {
                              scrollToQuestion(index + 1);
                            } else {
                              if (submitSectionRef.current) {
                                isManualScrolling.current = true;
                                submitSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => { isManualScrolling.current = false; }, 800);
                              }
                            }
                          }}
                          className="mt-3 px-4 py-2 rounded-md text-[13px] font-medium"
                          style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                        >
                          Continue
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Submit Section */}
            <div 
              ref={submitSectionRef}
              className="min-h-[50vh] flex flex-col justify-center py-10"
            >
              <div className="text-center pl-11">
                {allQuestionsAnswered() ? (
                  <>
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: 'hsl(142 76% 36%)', color: 'white' }}
                    >
                      <CheckIcon />
                    </div>
                    <h2 className="text-[17px] font-semibold mb-2" style={{ color: 'hsl(0 0% 9%)' }}>
                      All Questions Answered
                    </h2>
                    <p className="text-[13px] mb-6" style={{ color: 'hsl(0 0% 46%)' }}>
                      Ready to submit your answers?
                    </p>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-6 py-3 rounded-md text-[13px] font-medium transition-colors"
                      style={{ backgroundColor: 'hsl(235 69% 61%)', color: 'white' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(235 69% 55%)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'hsl(235 69% 61%)'; }}
                    >
                      {saving ? 'Submitting...' : 'Submit Answers'}
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'hsl(0 0% 32%)' }}>
                      Almost there
                    </h2>
                    <p className="text-[13px] mb-4" style={{ color: 'hsl(0 0% 46%)' }}>
                      {data.questions.length - answeredCount} question{data.questions.length - answeredCount !== 1 ? 's' : ''} remaining
                    </p>
                    <button
                      onClick={() => {
                        const firstUnanswered = data.questions.findIndex(q => !q.answer || !q.answer.trim());
                        if (firstUnanswered !== -1) {
                          scrollToQuestion(firstUnanswered);
                        }
                      }}
                      className="px-4 py-2 rounded-md text-[13px] font-medium"
                      style={{ backgroundColor: 'transparent', color: 'hsl(0 0% 32%)', border: '1px solid hsl(0 0% 90%)' }}
                    >
                      Go to first unanswered
                    </button>
                  </>
                )}

                {error && (
                  <div className="mt-6 rounded-md p-4" style={{ backgroundColor: 'hsl(0 84% 97%)', border: '1px solid hsl(0 84% 90%)' }}>
                    <p className="text-[13px]" style={{ color: 'hsl(0 84% 45%)' }}>{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Navigation Controls */}
        <footer 
          className="fixed bottom-0 left-[220px] right-0 z-50 border-t"
          style={{ backgroundColor: 'hsl(0 0% 100%)', borderColor: 'hsl(0 0% 92%)' }}
        >
          <div className="max-w-3xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-40"
                style={{ color: 'hsl(0 0% 46%)' }}
              >
                <span>↑</span> Previous
              </button>

              {/* Question Dots */}
              <div className="flex items-center gap-1.5">
                {data.questions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToQuestion(idx)}
                    className="transition-all rounded-full"
                    style={{
                      width: idx === currentQuestionIndex ? '24px' : '8px',
                      height: '8px',
                      backgroundColor: idx === currentQuestionIndex 
                        ? 'hsl(235 69% 61%)' 
                        : q.answer 
                          ? 'hsl(142 76% 50%)' 
                          : 'hsl(0 0% 85%)'
                    }}
                  />
                ))}
              </div>

              <button
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === data.questions.length - 1}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-40"
                style={{ color: 'hsl(0 0% 46%)' }}
              >
                Next <span>↓</span>
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
