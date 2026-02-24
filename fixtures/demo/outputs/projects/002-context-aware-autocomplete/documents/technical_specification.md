# Technical Specification: Context-Aware Autocomplete

## Architecture Overview

The autocomplete engine uses a hybrid indexing approach: AST parsing for structural understanding and embeddings for semantic similarity. It runs as a Language Server (LSP) process communicating with the editor via stdio.

```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Editor/IDE  │────▶│   LSP Server (Node)  │────▶│  Local Index │
│  (VS Code)   │◀────│   + Completion Engine │◀────│  (SQLite)    │
└──────────────┘     └──────────┬───────────┘     └──────────────┘
                                │
                     ┌──────────▼───────────┐
                     │   Embedding Model    │
                     │   (ONNX Runtime)     │
                     └──────────────────────┘
```

## Indexing Pipeline

### Phase 1: AST Parsing
- Parse each file with tree-sitter for language-agnostic AST
- Extract symbols: functions, classes, types, variables, imports/exports
- Build symbol table with source locations and dependency graph

### Phase 2: Semantic Embedding
- Chunk code into semantic units (function bodies, class definitions)
- Generate embeddings using a small local model (all-MiniLM-L6-v2)
- Store in SQLite with vector extension for similarity search

### Phase 3: Convention Detection
- Analyze naming patterns per directory (camelCase, snake_case)
- Detect architectural patterns (service classes, factory functions)
- Build import preference graph (barrel files, path aliases)

## Completion Algorithm

1. Extract cursor context: current line, surrounding code, file imports
2. Query symbol table for structural matches (prefix matching)
3. Query embedding index for semantic matches (similar code contexts)
4. Rank results by: convention match + semantic relevance + recency + user history
5. Return top-5 suggestions with confidence scores

## API / LSP Methods

### `textDocument/completion`
Standard LSP completion with extended metadata for confidence scoring.

### `custom/indexStatus`
Returns current indexing progress and health status.

### `custom/acceptSuggestion`
Records suggestion acceptance for learning model.

## Storage

All data stored locally in `~/.autocomplete/{workspace-hash}/`:
- `symbols.db` — SQLite with AST symbol table
- `embeddings.db` — SQLite with vector embeddings
- `preferences.json` — User keybindings and feature toggles
- `learning.db` — Accept/reject history for personalization

## Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Ghost text display | <100ms | Pre-computed prefix cache |
| Suggestion list | <300ms | Parallel symbol + embedding query |
| Full reindex | <60s for 5K files | Incremental with parallelism |
| Incremental update | <2s per file | AST diff, re-embed changed chunks |

---
*Document generated as part of SpecWright specification*
