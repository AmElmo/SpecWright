# Product Requirements Document: Context-Aware Autocomplete

## Overview

An AI-powered code completion engine that understands the full codebase — not just the current file. It indexes project structure, learns naming conventions and architecture patterns, and offers completions that feel like they were written by a senior team member who knows the codebase inside out.

## Problem Statement

Existing autocomplete tools operate with limited context — typically the current file and its direct imports. This leads to suggestions that are technically valid but don't match the project's conventions, import from wrong modules, or miss established patterns. Developers waste time editing suggestions to fit their codebase style.

## Goals

1. **Codebase-aware** - Suggestions reflect the project's actual patterns, not generic completions
2. **Sub-100ms latency** - Ghost text appears instantly, ranked list within 300ms
3. **Privacy-first** - All indexing runs locally, code never leaves the developer's machine
4. **Convention learning** - Automatically detects and applies naming, structure, and import patterns

## User Stories

### US-1: Get Context-Aware Code Completion
**As a** developer, **I want to** receive code completions that understand my project's conventions, **so that** I spend less time editing suggestions to match existing code.

**Acceptance Criteria:**
- Ghost text appears as I type with the top suggestion
- Suggestions use the project's naming conventions (camelCase, snake_case, etc.)
- Completions import from correct modules based on project structure
- Tab accepts, Escape dismisses, Alt+] cycles alternatives

### US-2: Auto-Import from Correct Modules
**As a** developer, **I want to** get auto-import suggestions that know my project's module structure, **so that** imports are always from the right paths.

**Acceptance Criteria:**
- When completing a symbol, the correct import statement is auto-added
- Prefers project-local modules over node_modules when both export same name
- Follows the project's import style (relative vs absolute, barrel files vs direct)

### US-3: Learn and Apply Project Conventions
**As a** developer, **I want to** the tool to learn my project's patterns over time, **so that** suggestions improve as it understands the codebase better.

**Acceptance Criteria:**
- Detects naming conventions per folder/module
- Learns from accepted/rejected suggestions
- Applies architectural patterns (service layer, repository pattern, etc.)

## Scope

### In Scope
- Codebase indexing with AST + semantic embeddings
- Inline ghost text and ranked suggestion list
- TypeScript, Python, Go language support
- Local-only indexing (privacy-first)
- LSP integration for VS Code

### Out of Scope
- JetBrains IDE support (v2)
- Multi-repo context (v2)
- Natural language to code completion
- Vim/Neovim support (community contribution)

## Success Metrics

| Metric | Target |
|--------|--------|
| Suggestion acceptance rate | >35% |
| Correct import rate | >90% |
| Convention match rate | >85% |
| Latency (ghost text) | <100ms p95 |

---
*Document generated as part of SpecWright specification*
