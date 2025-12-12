# OpenSpec: How It Works

## Core Concept

OpenSpec is a **spec-driven development system** for working with AI coding assistants. It separates:

- **`specs/`** = Current reality (what IS deployed)
- **`changes/`** = Proposed updates (what SHOULD change)

This separation keeps AI assistants aligned on requirements before any code is written.

## The Workflow

```
1. PROPOSE → Create change with proposal.md, tasks.md, spec deltas
2. REVIEW  → Human and AI agree on specs
3. IMPLEMENT → AI writes code following approved tasks
4. DEPLOY   → Ship to production
5. ARCHIVE  → Move change to archive/, update main specs
```

## Quick Start

### Install
```bash
npm install -g @fission-ai/openspec@latest
cd my-project
openspec init
```

During init, select your AI tool (Claude Code, Cursor, etc.). This creates:
- `openspec/` directory structure
- AI assistant configuration files (CLAUDE.md, slash commands, etc.)
- `AGENTS.md` at project root

### Create Your First Change

**With slash commands** (Claude Code, Cursor, OpenCode, etc.):
```
You: /openspec:proposal Add user profile search filters
```

**With any AI assistant**:
```
You: Create an OpenSpec change proposal for adding profile search filters
```

The AI creates:
```
openspec/changes/add-profile-filters/
├── proposal.md       # Why, what, impact
├── tasks.md          # Implementation checklist
└── specs/
    └── profile/
        └── spec.md   # Delta showing what changes
```

### Review & Implement

```bash
# Validate the proposal
openspec validate add-profile-filters --strict

# View the change
openspec show add-profile-filters

# After approval, implement
You: Let's implement this change
AI: [works through tasks.md, marking items complete]
```

### After Deployment

```bash
# Archive completes the cycle
openspec archive add-profile-filters --yes
```

This:
1. Moves change to `changes/archive/2025-01-15-add-profile-filters/`
2. Updates main specs with the deployed changes
3. Keeps your specs as the source of truth

## Key Commands

```bash
openspec list              # View active changes
openspec list --specs      # View specifications
openspec show <item>       # Display change or spec
openspec validate <item>   # Check formatting
openspec view              # Dashboard overview
openspec archive <change>  # Complete the cycle
```

## File Structure

```
openspec/
├── project.md           # Your project conventions
├── AGENTS.md            # Instructions for AI assistants
├── specs/               # Current truth (what IS)
│   └── [capability]/
│       └── spec.md      # Requirements & scenarios
└── changes/             # Proposed changes (what SHOULD change)
    ├── [change-name]/
    │   ├── proposal.md  # Why & what
    │   ├── tasks.md     # Implementation steps
    │   └── specs/       # Delta changes
    │       └── [capability]/
    │           └── spec.md  # ADDED/MODIFIED/REMOVED requirements
    └── archive/         # Completed changes
```

## Delta Format (How Changes Work)

Instead of storing complete files, changes use **deltas**:

```markdown
## ADDED Requirements
### Requirement: Two-Factor Authentication
Users MUST provide a second factor during login.

#### Scenario: OTP required
- **WHEN** valid credentials are provided
- **THEN** an OTP challenge is required

## MODIFIED Requirements
### Requirement: Session Management
Sessions SHALL expire after 30 minutes (was 60 minutes)
```

The `archive` command applies these deltas to update main specs.

## Supported AI Tools

**Native slash commands**: Claude Code, CodeBuddy, Cursor, Cline, Crush, RooCode, Factory Droid, and more

**AGENTS.md compatible**: Any tool that reads AGENTS.md (Amp, Jules, Codex, etc.)

## Example Interaction

```
You: Add two-factor authentication to our app

AI: I'll create an OpenSpec change proposal.
    [Creates openspec/changes/add-2fa/]
    
    Proposal created. Key points:
    - Adds OTP requirement to login flow
    - Affects auth and notification specs
    - 8 implementation tasks defined
    
    Should I proceed with validation?

You: Yes, validate it

AI: [Runs openspec validate add-2fa --strict]
    ✓ All checks passed. Ready for your review.

You: Looks good, implement it

AI: [Works through tasks.md, implementing each step]
    ✓ Task 1.1: Add OTP secret column
    ✓ Task 1.2: Create verification logs table
    ...
    All tasks complete!

You: Please archive the change

AI: [Runs openspec archive add-2fa --yes]
    ✓ Archived successfully. Specs updated.
```

## Why This Approach?

**For humans**: Clear proposals, reviewable specs, explicit scope

**For AI**: Deterministic requirements, no ambiguity, validated structure

**For teams**: Shared understanding, predictable outputs, living documentation

The magic is that **specs stay in sync with code** because the workflow forces updates during archive, not as an afterthought.