# Technical Specification: AI Code Review Assistant

## Architecture Overview

The code review system uses a client-server architecture with AI processing on the backend. Code is sent to our API, which orchestrates calls to Claude for analysis, then returns structured suggestions.

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   React Client  │────▶│   API Server │────▶│   Claude    │
│  (Monaco Editor)│     │   (Express)  │     │   (AI API)  │
└─────────────────┘     └──────┬───────┘     └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  PostgreSQL │
                        │  (History)  │
                        └─────────────┘
```

## Database Schema

### Table: `code_reviews`

```sql
CREATE TABLE code_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  code_content  TEXT NOT NULL,
  language      VARCHAR(50) NOT NULL,
  suggestions   JSONB NOT NULL DEFAULT '[]',
  stats         JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_user ON code_reviews(user_id, created_at DESC);
```

### Table: `review_preferences`

```sql
CREATE TABLE review_preferences (
  user_id              UUID PRIMARY KEY REFERENCES users(id),
  check_security       BOOLEAN DEFAULT true,
  check_bugs           BOOLEAN DEFAULT true,
  check_performance    BOOLEAN DEFAULT true,
  check_style          BOOLEAN DEFAULT false,
  updated_at           TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### POST /api/code-reviews
Submit code for AI analysis.

**Request:**
```json
{
  "code": "function add(a, b) { return a + b }",
  "language": "javascript"
}
```

**Response:** `200 OK`
```json
{
  "reviewId": "uuid",
  "suggestions": [
    {
      "id": "sug_1",
      "category": "bug",
      "severity": "warning",
      "title": "Missing type validation",
      "line": 1,
      "explanation": "Function doesn't validate input types...",
      "hasFix": true,
      "suggestedFix": "function add(a, b) {\n  if (typeof a !== 'number') throw...\n}"
    }
  ],
  "stats": {
    "linesAnalyzed": 1,
    "issuesFound": 1,
    "fixesAvailable": 1
  }
}
```

### GET /api/code-reviews
List user's review history.

### GET /api/code-reviews/:id
Get a specific review.

### PUT /api/code-reviews/:id/suggestions/:sugId
Update suggestion status (applied/dismissed).

### GET/PUT /api/users/review-preferences
Get or update review preferences.

## AI Integration

### Prompt Structure

Separate prompts for each category for better accuracy:

```typescript
const SECURITY_PROMPT = `Analyze this code for security vulnerabilities.
Return JSON array of issues found. For each issue include:
- line number
- severity (critical/warning/info)
- title (brief description)
- explanation (why this is a problem)
- suggestedFix (corrected code, only if confident)
...`;
```

### Response Parsing

AI responses are parsed and validated:

```typescript
interface AISuggestion {
  category: 'security' | 'bug' | 'performance' | 'style';
  severity: 'critical' | 'warning' | 'info';
  line: number;
  title: string;
  explanation: string;
  suggestedFix?: string;
  confidence: number;
}
```

## Error Handling

| Error | HTTP Status | User Message |
|-------|-------------|--------------|
| Code too large (>50KB) | 413 | "Code exceeds 50KB limit" |
| Rate limited | 429 | "Please wait before submitting again" |
| AI service unavailable | 503 | "Analysis service temporarily unavailable" |
| Invalid language | 400 | "Language not supported" |

## Performance Considerations

- **Caching**: Cache identical code hashes for 24 hours
- **Streaming**: Use SSE for real-time progress updates
- **Timeout**: 30-second max for AI response
- **Token limit**: 8K input tokens (~500 lines of code)

---
*Document generated as part of SpecWright example project*
