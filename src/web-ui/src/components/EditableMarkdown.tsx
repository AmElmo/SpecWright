import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { MarkdownViewer } from './MarkdownViewer';

interface EditableMarkdownProps {
  content: string;
  projectId: string;
  documentType: 'prd' | 'design' | 'tech' | 'screen-inventory' | 'wireframes' | 'tech-spec';
  onSave?: (content: string) => void;
}

export function EditableMarkdown({ content, projectId, documentType, onSave }: EditableMarkdownProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Update local content when prop changes
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  // Focus textarea and restore scroll position when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Restore window scroll position after DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current);
      });
    } else if (!isEditing) {
      // Restore window scroll position when exiting edit mode
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current);
      });
    }
  }, [isEditing]);

  const saveContent = async () => {
    // Capture window scroll position before exiting edit mode
    scrollPositionRef.current = window.scrollY;
    
    if (editedContent === content) {
      setIsEditing(false);
      return; // No changes
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/document/${documentType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent })
      });

      if (!response.ok) throw new Error('Failed to save');

      setLastSaved(new Date());
      if (onSave) {
        onSave(editedContent);
      }
      
      setIsEditing(false);
    } catch (error) {
      logger.error('Failed to save document:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Capture window scroll position before canceling
    scrollPositionRef.current = window.scrollY;
    setEditedContent(content); // Revert changes
    setIsEditing(false);
  };

  const handleClick = () => {
    if (!isEditing) {
      // Capture current window scroll position before entering edit mode
      scrollPositionRef.current = window.scrollY;
      setIsEditing(true);
    }
  };

  const handleClickOutside = async (e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      await saveContent();
    }
  };

  // Set up click outside listener
  useEffect(() => {
    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditing, editedContent, content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save and exit on Cmd+Enter or Ctrl+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveContent();
    }
    // Cancel edit mode on Escape (revert changes)
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        position: 'relative',
        cursor: isEditing ? 'text' : 'pointer',
        transition: 'all 0.2s'
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!isEditing) {
          e.currentTarget.style.borderColor = '#3b82f6';
        }
      }}
      onMouseLeave={(e) => {
        if (!isEditing) {
          e.currentTarget.style.borderColor = '#e2e8f0';
        }
      }}
    >
      {/* Edit hint */}
      {!isEditing && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          fontSize: '0.75rem',
          color: '#94a3b8',
          backgroundColor: '#f8fafc',
          padding: '0.25rem 0.5rem',
          borderRadius: '0.25rem',
          opacity: 0,
          transition: 'opacity 0.2s'
        }}
        className="edit-hint"
        >
          Click to edit
        </div>
      )}

      {/* Floating save button when editing */}
      {isEditing && (
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          right: '1rem',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 10
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}
            disabled={isSaving}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#64748b',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.5 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            Cancel (Esc)
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              saveContent();
            }}
            disabled={isSaving || editedContent === content}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'white',
              backgroundColor: editedContent === content ? '#94a3b8' : '#3b82f6',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: (isSaving || editedContent === content) ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isSaving && editedContent !== content) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (editedContent !== content) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            {isSaving ? (
              <>
                <span className="animate-pulse">●</span>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Save</span>
                <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>(⌘↵)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Saved indicator - only show when not editing */}
      {!isEditing && lastSaved && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          fontSize: '0.75rem',
          color: '#22c55e',
          backgroundColor: '#f8fafc',
          padding: '0.25rem 0.75rem',
          borderRadius: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          border: '1px solid #dcfce7'
        }}>
          <span>✓</span>
          <span>Saved {getTimeAgo(lastSaved)}</span>
        </div>
      )}

      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            minHeight: '500px',
            padding: '1rem',
            paddingBottom: '4rem', // Extra space for floating button
            fontSize: '0.875rem',
            lineHeight: '1.6',
            border: '1px solid #3b82f6',
            borderRadius: '0.5rem',
            outline: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            backgroundColor: '#fefefe',
            resize: 'vertical'
          }}
        />
      ) : (
        <div style={{ position: 'relative' }}>
          <MarkdownViewer content={content} />
        </div>
      )}

      <style>{`
        div:hover .edit-hint {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return 'recently';
}

