# SpecWright Architecture

This document provides a technical overview of SpecWright's architecture, design decisions, and implementation details.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [File Structure](#file-structure)
- [Key Design Decisions](#key-design-decisions)
- [Technology Stack](#technology-stack)

## Overview

SpecWright is a CLI and web-based tool that implements Specification-Driven Development (SDD). It uses AI agents to transform project ideas into detailed, structured specifications through a multi-phase workflow.

### Core Principles

1. **Agent-Based Workflow**: Specialized AI agents (PM, Designer, Engineer, Tech Lead) handle different aspects
2. **Phase Validation**: Each phase validates prerequisites before execution
3. **Structured Output**: All specifications follow consistent JSON/Markdown schemas
4. **Resilience**: Auto-recovery from invalid states
5. **Template-Driven**: Prompts and outputs use reusable templates

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interface                       │
├──────────────────────┬──────────────────────────────────────┤
│   Terminal CLI       │         Web UI (React)               │
│   (Inquirer-based)   │    (Vite + TailwindCSS)              │
└──────────┬───────────┴──────────────┬───────────────────────┘
           │                          │
           ├──────────────────────────┤
           │                          │
┌──────────▼──────────────────────────▼───────────────────────┐
│                     Core Services Layer                      │
├──────────────────────────────────────────────────────────────┤
│  • WorkflowService    • StatusService                        │
│  • PhaseValidation    • PromptGenerator                      │
│  • ScanService        • PlaybookService                      │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│                    AI Agent Layer                            │
├──────────────────────────────────────────────────────────────┤
│  • Product Manager    • UX Designer                          │
│  • Engineer           • Tech Lead                            │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│                    Storage Layer                             │
├──────────────────────────────────────────────────────────────┤
│  File System (outputs/, templates/, agents/)                 │
└──────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. CLI Layer (`src/specwright.ts`)

**Purpose**: Main entry point for terminal-based interaction

**Key Features**:
- Interactive menu system using Inquirer
- Command routing
- Logo and welcome screens
- Debug mode support

**Flow**:
```
User → CLI Menu → Command Handler → Service Layer → Agent/Template → Output Files
```

### 2. Web UI (`src/web-ui/`)

**Purpose**: Browser-based interface for visual interaction

**Components**:
- **Scoping View**: Interactive work classification
- **Project Browser**: Navigate all projects and issues
- **Technology Viewer**: Display tech choices and dependencies
- **Preview Pane**: Render Markdown specifications

**Tech Stack**:
- React 18 with TypeScript
- Vite for bundling
- TailwindCSS + Radix UI
- React Router for navigation

### 3. Services (`src/services/`)

#### WorkflowService (`workflow-service.ts`)
- Manages workflow definitions
- Maps commands to templates
- Handles prompt generation with context

#### StatusService (`status-service.ts`)
- Tracks project and agent phases
- Validates phase transitions
- Auto-recovery from invalid states

#### PhaseValidationService (`phase-validation-service.ts`)
- Validates prerequisites for each phase
- Checks for required files
- Suggests corrective actions

#### ScanService (`scan-service.ts`)
- Scans `outputs/` directory
- Builds project and issue inventory
- Status aggregation

#### PlaybookService (`playbook-service.ts`)
- Generates project playbooks
- Audits compliance with principles
- Updates existing playbooks

### 4. Agent System (`agents/`)

Each agent has:
- `system_prompt.md`: Agent identity and role
- `questioning_prompt.md`: How to gather requirements
- `analysis_prompt.md`: How to generate specifications

**Agent Workflow**:
```
Question Generation → User Answers → Analysis → Specification Output
```

### 5. Template System (`templates/`)

Templates define:
- Output structure (JSON schemas)
- Example formats
- Field descriptions
- Validation rules

**Key Templates**:
- `scoping_plan_template.json`: Work classification
- `prd_template.md`: Product requirements
- `technology_choices_template.json`: Tech stack decisions
- `project_summary_template.json`: Task breakdowns

## Data Flow

### Project Creation Flow

```
1. User Request
   ↓
2. Scoping Analysis
   - AI classifies work type
   - Creates scoping_plan.json
   ↓
3. User Approval
   ↓
4. CLI finalize-scope
   - Creates project folders
   - Initializes project_status.json
   ↓
5. Phase Execution (PM → UX → Engineer → Tech Lead)
   - Each phase validates prerequisites
   - Generates structured outputs
   - Updates status
   ↓
6. Output Files
   - Markdown specifications
   - JSON data files
   - Implementation-ready tasks
```

### Phase Validation Flow

```
1. Command Execution Request
   ↓
2. Phase Validation Service
   - Check current phase
   - Validate required files exist
   - Check file content validity
   ↓
3a. Valid → Execute Command
   ↓
3b. Invalid → Auto-Recovery
   - Detect last valid phase
   - Update status
   - Notify user
   ↓
4. Status Update
```

## File Structure

```
specwright/
├── src/                          # TypeScript source
│   ├── commands/                 # CLI command handlers
│   ├── services/                 # Business logic
│   ├── ui/                       # Terminal UI components
│   ├── utils/                    # Utilities (logger, paths)
│   ├── web-ui/                   # React application
│   ├── specwright.ts             # CLI entry point
│   └── web-server.ts             # Dev server for Web UI
│
├── agents/                       # AI agent definitions
│   ├── product_manager/
│   ├── ux_designer/
│   ├── engineer/
│   └── tech_lead/
│
├── templates/                    # Output templates
│   ├── *_template.json           # JSON schemas
│   ├── *_template.md             # Markdown templates
│   └── example-project/          # Reference example
│
├── outputs/                      # Generated specifications
│   ├── project_plan.json         # Overall plan
│   └── projects/                 # Individual projects
│       └── 001-project-name/
│           ├── project_request.md
│           ├── pm/
│           ├── ux/
│           ├── architect/
│           └── tech_lead/
│
└── dist/                         # Compiled JavaScript
```

## Key Design Decisions

### 1. TypeScript Over JavaScript

**Rationale**: Type safety, better IDE support, catch errors at compile time

**Impact**: 
- Reduced runtime errors
- Better maintainability
- Self-documenting code

### 2. File-Based State Management

**Rationale**: 
- Simple to understand
- Version controllable
- No database dependency
- Works in any project

**Trade-offs**:
- Not suitable for concurrent users
- Manual conflict resolution in git
- File I/O overhead

### 3. Template-Based Prompts

**Rationale**:
- Consistency across CLI and Cursor
- Easy to customize
- Clear separation of concerns

**Benefits**:
- Users can modify prompts
- Version control for prompt evolution
- Reusable across projects

### 4. Phase-Based Workflow

**Rationale**:
- Clear progression
- Validation points
- Easy to resume

**Structure**:
```
PM (Requirements) → UX (Design) → Engineer (Architecture) → Tech Lead (Tasks)
```

Each phase builds on the previous, with validation to ensure prerequisites exist.

### 5. Dual Interface (CLI + Web)

**Rationale**:
- CLI for automation and scripting
- Web UI for visual exploration

**Implementation**:
- Shared services layer
- Consistent data formats
- Both use same templates

## Technology Stack

### Runtime
- **Node.js 18+**: Modern JavaScript runtime
- **TypeScript 5.x**: Type-safe development

### CLI
- **Inquirer**: Interactive prompts
- **Chalk**: Terminal colors
- **Consola**: Structured logging
- **cli-table3**: Table formatting

### Web UI
- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **TailwindCSS**: Utility-first CSS
- **Radix UI**: Accessible components
- **React Router**: Client-side routing
- **React Markdown**: Markdown rendering

### Build & Development
- **tsx**: TypeScript execution
- **Vite**: Fast bundling
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS compatibility

## Extension Points

### Adding a New Agent

1. Create agent directory in `agents/`
2. Define system_prompt.md
3. Add questioning_prompt.md and analysis_prompt.md
4. Create output template in `templates/`
5. Register in WorkflowService
6. Add command handler in CLI

### Adding a New Command

1. Create command file in `src/commands/`
2. Add to CLI routing in `specwright.ts`
3. Add menu option if needed
4. Update documentation

### Customizing Templates

Templates can be modified directly in `templates/` directory. Changes take effect immediately.

## Performance Considerations

1. **File I/O**: Cached where possible, batched writes
2. **AI Calls**: Token counts displayed, prompts optimized
3. **Web UI**: Lazy loading, code splitting
4. **Scanning**: Incremental updates, ignore patterns

## Security

1. **No API Keys in Code**: Users provide their own
2. **File System Sandboxing**: Operations limited to project directory
3. **Input Validation**: All user inputs validated
4. **Template Injection**: Templates use safe substitution

## Future Considerations

- Database option for multi-user scenarios
- Real-time collaboration features
- Plugin system for custom agents
- CI/CD integration helpers
- API for programmatic access

---

**Last Updated**: December 11, 2024  
**Version**: 3.0.0
