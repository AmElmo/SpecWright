<!--
Sync Impact Report
- Version change: N/A → 1.0.0
- Modified principles: Added [NUMBER] core principles (new)
- Added sections: [LIST_SECTIONS]
- Removed sections: None
- Templates requiring updates: [TEMPLATES_TO_UPDATE]
- Follow-up TODOs: [ANY_FOLLOWUP_ITEMS]
-->

# [PROJECT_NAME] Playbook
<!-- Example: Spec Playbook, TaskFlow Playbook, MyApp Playbook, etc. -->

## Core Principles

### I. [PRINCIPLE_1_NAME]
<!-- Example: Library-First, Monorepo Architecture, API-First Design, etc. -->
[PRINCIPLE_1_DESCRIPTION]
<!-- Example: Every project starts as a standalone library; Libraries must be self-contained, independently testable, documented; Clear purpose required - no organizational-only libraries -->

Rationale: [PRINCIPLE_1_RATIONALE]
<!-- Example: Starting with libraries ensures modular, reusable code and prevents tight coupling between components. -->

### II. [PRINCIPLE_2_NAME]
<!-- Example: CLI Interface, REST API Standards, Database-First Design, etc. -->
[PRINCIPLE_2_DESCRIPTION]
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

Rationale: [PRINCIPLE_2_RATIONALE]
<!-- Example: CLI-first design ensures debuggability and enables automation without complex integrations. -->

### III. [PRINCIPLE_3_NAME] (NON-NEGOTIABLE)
<!-- Example: Test-First, Code Review Mandatory, Security-First, etc. -->
[PRINCIPLE_3_DESCRIPTION]
<!-- Example: TDD mandatory: Tests written → User approved → Tests fail → Then implement; Red-Green-Refactor cycle strictly enforced -->

Rationale: [PRINCIPLE_3_RATIONALE]
<!-- Example: Test-first development prevents regressions and ensures all code is testable from the start. -->

### IV. [PRINCIPLE_4_NAME]
<!-- Example: Integration Testing, Performance Standards, Accessibility Requirements, etc. -->
[PRINCIPLE_4_DESCRIPTION]
<!-- Example: Focus areas requiring integration tests: New library contract tests, Contract changes, Inter-service communication, Shared schemas -->

Rationale: [PRINCIPLE_4_RATIONALE]
<!-- Example: Integration tests catch issues that unit tests miss and validate real-world usage patterns. -->

### V. [PRINCIPLE_5_NAME]
<!-- Example: Observability, Versioning & Breaking Changes, Simplicity, Documentation Standards, etc. -->
[PRINCIPLE_5_DESCRIPTION]
<!-- Example: Text I/O ensures debuggability; Structured logging required; Or: MAJOR.MINOR.BUILD format; Or: Start simple, YAGNI principles -->

Rationale: [PRINCIPLE_5_RATIONALE]
<!-- Example: Observable systems are debuggable systems; structured logs enable rapid diagnosis in production. -->

<!-- OPTIONAL: Additional principles VI-XII. Include as many as needed for your project (typically 5-8, up to 12 max). Delete unused sections. -->

### VI. [PRINCIPLE_6_NAME]
<!-- Optional - include if needed -->
[PRINCIPLE_6_DESCRIPTION]

Rationale: [PRINCIPLE_6_RATIONALE]

### VII. [PRINCIPLE_7_NAME]
<!-- Optional - include if needed -->
[PRINCIPLE_7_DESCRIPTION]

Rationale: [PRINCIPLE_7_RATIONALE]

### VIII. [PRINCIPLE_8_NAME]
<!-- Optional - include if needed -->
[PRINCIPLE_8_DESCRIPTION]

Rationale: [PRINCIPLE_8_RATIONALE]

### IX. [PRINCIPLE_9_NAME]
<!-- Optional - include if needed -->
[PRINCIPLE_9_DESCRIPTION]

Rationale: [PRINCIPLE_9_RATIONALE]

### X. [PRINCIPLE_10_NAME]
<!-- Optional - include if needed -->
[PRINCIPLE_10_DESCRIPTION]

Rationale: [PRINCIPLE_10_RATIONALE]

### XI. [PRINCIPLE_11_NAME]
<!-- Optional - include if needed -->
[PRINCIPLE_11_DESCRIPTION]

Rationale: [PRINCIPLE_11_RATIONALE]

### XII. [PRINCIPLE_12_NAME]
<!-- Optional - include if needed -->
[PRINCIPLE_12_DESCRIPTION]

Rationale: [PRINCIPLE_12_RATIONALE]

## Stack & Project Structure
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

- **Language/Runtime**: [PRIMARY_LANGUAGE] ([FRAMEWORK_IF_ANY])
- **Additional Languages**: [OTHER_LANGUAGES_IF_ANY]
- **Database**: [DATABASE_SYSTEM]
- **Frontend**: [FRONTEND_STACK] (if applicable)
- **Build/Tooling**: [BUILD_TOOLS]
- **Testing**: [TEST_FRAMEWORKS]

### Project Layout
<!-- Example: Monorepo structure, microservices layout, standard app structure, etc. -->

```
[PROJECT_ROOT]/
  [DIRECTORY_1]/           # [DESCRIPTION]
    [SUBDIRECTORY]/
      [FILES]
  [DIRECTORY_2]/           # [DESCRIPTION]
  [DIRECTORY_3]/           # [DESCRIPTION]
```

### Architecture Constraints
<!-- Example: Single deployment unit, separate services, shared packages policy, etc. -->

[ARCHITECTURE_CONSTRAINTS]
<!-- Example: One production service: `apps/web`. Additional services (e.g., workers) must document rationale in the plan and pass Complexity Tracking. -->

## Development Workflow & Review
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

### Branching & Commits
[BRANCHING_STRATEGY]
<!-- Example: project branches named `[###-project-name]` linked to specs; conventional commits enforced -->

### Code Review
[REVIEW_REQUIREMENTS]
<!-- Example: At least one reviewer confirms Playbook Check gates are satisfied in the plan before approving implementation; All PRs require approval before merge -->

### CI/CD Gates
[CI_CD_GATES]
<!-- Example: lint, tests (server + client), type checks (if TS), security scans must pass; Deploys: zero-downtime with backwards-compatible migrations -->

### Testing Requirements
[TESTING_REQUIREMENTS]
<!-- Example: Unit tests for all business logic; Integration tests for API endpoints; E2E tests for critical user flows -->

### Documentation
[DOCUMENTATION_STANDARDS]
<!-- Example: plans/specs/tasks kept in `specs/[###-project]/` and updated during implementation; Quickstart instructions maintained for new devs; API documentation auto-generated from code -->

## Governance
<!-- Example: Playbook supersedes all other practices; Amendments require documentation, approval, migration plan -->

### Authority
This Playbook supersedes all other practice documents when in conflict. In cases where specific implementation details are not covered here, team members should follow established conventions and seek clarification through the amendment process.

### Amendments
Amendments are proposed via pull request updating this file with a Sync Impact Report. Amendments require [APPROVAL_REQUIREMENTS]. Material changes to principles or governance must update version accordingly.

### Versioning Policy
- **MAJOR**: Backward-incompatible governance or principle removals/redefinitions
- **MINOR**: New principle/section or materially expanded guidance
- **PATCH**: Clarifications, wording, and non-semantic refinements

### Compliance
[COMPLIANCE_REQUIREMENTS]
<!-- Example: Reviewers verify Playbook Check in plans; CI enforces gates; Exceptions must be documented in Complexity Tracking with explicit rationale -->

### Dispute Resolution
[DISPUTE_RESOLUTION_PROCESS]
<!-- Example: If team members disagree on interpretation, escalate to tech lead; If tech lead is unavailable, default to more conservative interpretation -->

**Version**: 1.0.0 | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [RATIFICATION_DATE]
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->

