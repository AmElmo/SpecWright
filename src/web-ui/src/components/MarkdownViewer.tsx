import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewerProps {
  content: string;
  hideReadTime?: boolean;
}

function calculateReadingTime(content: string): { minutes: number; wordCount: number } {
  // Remove markdown syntax for accurate word count
  const plainText = content
    .replace(/[#*`_~\[\]()]/g, '') // Remove markdown formatting characters
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
    .trim();
  
  // Count words (split by whitespace)
  const words = plainText.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Calculate reading time at 300 words per minute
  const wordsPerMinute = 300;
  const totalMinutes = wordCount / wordsPerMinute;
  const minutes = Math.ceil(totalMinutes); // Round up to nearest minute
  
  return { minutes, wordCount };
}

function formatReadingTime(minutes: number): string {
  if (minutes === 0) {
    return 'Less than 1 min read';
  } else if (minutes === 1) {
    return '1 min read';
  } else {
    return `${minutes} min read`;
  }
}

export function MarkdownViewer({ content, hideReadTime = false }: MarkdownViewerProps) {
  const { minutes, wordCount } = calculateReadingTime(content);
  const readingTimeText = formatReadingTime(minutes);
  
  return (
    <div style={{
      maxWidth: '100%',
      color: '#334155',
      lineHeight: '1.75'
    }}>
      {/* Reading Time Banner - Only show if hideReadTime is false */}
      {!hideReadTime && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{
            fontSize: '1rem',
            color: '#64748b'
          }}>📖</span>
          <span style={{
            fontSize: '0.875rem',
            color: '#475569',
            fontWeight: '500'
          }}>
            {readingTimeText}
          </span>
          <span style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginLeft: '0.25rem'
          }}>
            • {wordCount.toLocaleString()} words
          </span>
        </div>
      )}
      
      <style>{`
        .markdown-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 1.5rem 0 1rem 0;
          color: #0f172a;
        }
        .markdown-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.25rem 0 0.75rem 0;
          color: #0f172a;
        }
        .markdown-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem 0;
          color: #0f172a;
        }
        .markdown-content p {
          margin: 0 0 1rem 0;
          line-height: 1.75;
        }
        .markdown-content ul, .markdown-content ol {
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        .markdown-content li {
          margin: 0.5rem 0;
        }
        .markdown-content code {
          background-color: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-family: 'Courier New', monospace;
        }
        .markdown-content pre {
          background-color: #f1f5f9;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .markdown-content blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1rem;
          font-style: italic;
          color: #64748b;
          margin: 1rem 0;
        }
        .markdown-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .markdown-content th {
          border: 1px solid #e2e8f0;
          background-color: #f8fafc;
          padding: 0.5rem;
          font-weight: 600;
          text-align: left;
        }
        .markdown-content td {
          border: 1px solid #e2e8f0;
          padding: 0.5rem;
        }
        .markdown-content a {
          color: #3b82f6;
          text-decoration: underline;
          font-weight: 500;
        }
        .markdown-content strong {
          font-weight: 700;
        }
        .markdown-content em {
          font-style: italic;
        }
      `}</style>
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

