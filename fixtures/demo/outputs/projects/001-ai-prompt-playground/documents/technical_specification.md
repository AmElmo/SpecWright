# Technical Specification: AI Prompt Playground

## Architecture Overview

The playground uses a React SPA frontend with an Express API backend. Provider calls are made server-side to protect API keys. Responses stream via Server-Sent Events (SSE).

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  React SPA   │────▶│  Express API │────▶│  Claude API  │
│  (Vite)      │◀SSE─│  (Node.js)   │────▶│  OpenAI API  │
└──────────────┘     └──────┬───────┘────▶│  Gemini API  │
                            │             └──────────────┘
                     ┌──────▼───────┐
                     │  PostgreSQL  │
                     │  (versions)  │
                     └──────────────┘
```

## Provider Abstraction

Each provider implements the `LLMProvider` interface:

```typescript
interface LLMProvider {
  name: string;
  streamCompletion(prompt: string, options: ProviderOptions): AsyncIterable<StreamChunk>;
  countTokens(text: string): number;
  estimateCost(inputTokens: number, outputTokens: number): number;
}
```

Providers are registered in a `ProviderRegistry` and called in parallel during a test run.

## API Endpoints

### POST /api/playground/run
Execute a prompt against selected providers. Returns SSE stream.

**Request:**
```json
{
  "prompt": "You are a...",
  "variables": { "language": "TypeScript", "code": "..." },
  "providers": ["claude", "gpt4"]
}
```

**SSE Events:**
- `provider:start` — Provider begins processing
- `provider:chunk` — Token chunk from provider
- `provider:complete` — Provider finished, includes metadata
- `provider:error` — Provider failed

### GET /api/playground/versions/:promptId
List all versions of a prompt.

### GET /api/playground/diff/:versionA/:versionB
Compute diff between two prompt versions.

### POST /api/playground/rate
Submit quality rating for a response.

### GET /api/playground/templates
List available templates with optional category filter.

## Database Schema

### Table: `prompts`
Stores prompt definitions with metadata.

### Table: `prompt_versions`
Stores each version of a prompt with full text and computed quality score.

### Table: `test_runs`
Stores results from each run including provider responses, tokens, latency.

### Table: `templates`
Stores reusable prompt templates with categories and variable schemas.

## Quality Scoring

Automated scoring checks:
- **Format compliance** — Does the response match requested format (JSON, list, etc.)?
- **Length appropriateness** — Is the response within expected length bounds?
- **Variable coverage** — Does the response reference all provided context?

Manual scoring: thumbs up/down per response, aggregated as acceptance rate.

Final score: weighted average of automated (60%) and manual (40%) scores, 0-10 scale.

## Performance Targets

| Operation | Target |
|-----------|--------|
| Stream first token | <500ms |
| Full response (avg) | <5s |
| Version diff computation | <100ms |
| Template search | <200ms |

---
*Document generated as part of SpecWright specification*
