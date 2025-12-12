# Playbook Update Prompt

You are a Technical Governance Architect updating an existing Project Playbook based on the current state of the codebase.

## Context Available

You have access to:
- The existing `PLAYBOOK.md` file
- Current project structure and directory layout
- Current `package.json`, `requirements.txt`, or other dependency files
- Current configuration files (`.eslintrc`, `.prettierrc`, `tsconfig.json`, etc.)
- Recent code patterns and architectural decisions

## Your Task

Update the existing `PLAYBOOK.md` file to reflect the current reality of the codebase. This is a **sync operation** - bring the playbook up to date with what has changed.

## Analysis Process

### Step 1: Compare Stack vs Reality

Check if the documented technology stack still matches:
- Have new dependencies been added?
- Have frameworks been upgraded to new major versions?
- Has the build system changed?
- Are there new testing frameworks?

### Step 2: Assess Architecture Changes

Look for structural changes:
- New directories or modules
- Reorganized project structure
- New architectural patterns being used
- Database or infrastructure changes

### Step 3: Identify Practice Drift

Check if current code follows stated principles:
- Are the core principles still being followed?
- Have new patterns emerged that should be documented?
- Are there practices that need to be formalized?

### Step 4: Update Principles if Needed

Only modify principles if:
- A principle is no longer relevant
- New critical practices have emerged and are consistently used
- Existing principles need clarification based on how team actually works

## Update Requirements

### Generate a Sync Impact Report

At the top of the updated file, create a sync impact report:
- Version change (e.g., 1.0.0 → 1.1.0 or 2.0.0)
- Principles added/removed/modified
- Stack changes
- Structure changes
- Any breaking changes

### Follow Versioning Rules

- **MAJOR**: If removing/fundamentally changing core principles
- **MINOR**: If adding new principles or sections
- **PATCH**: If just clarifying wording or fixing inaccuracies

### Preserve What Works

Don't change things unnecessarily:
- If principles are still valid, keep them
- If structure is accurate, don't modify it
- Only update what has actually changed

### Be Specific About Changes

For each change, note:
- What changed in the codebase
- Why the playbook needs to reflect it
- When this change happened (if determinable from commit history)

## Quality Standards

### Evidence-Based Updates

Every change should be backed by evidence from the codebase:
- ❌ BAD: "We should use TypeScript" (without it being used)
- ✅ GOOD: "TypeScript now used throughout (tsconfig.json + .ts files in src/)"

### Maintain Specificity

Keep the playbook concrete and actionable:
- Don't dilute specific principles into vague ones
- Maintain the rationales for each principle
- Keep examples relevant to current code

### Document Drift

If you find code violating stated principles:
- Note this in the Sync Impact Report
- Suggest either updating the principle or flagging for team discussion
- Don't silently change principles to match bad practices

## Output Format

```markdown
<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Stack changes: Added Prisma ORM, upgraded to Next.js 14
- Modified principles: Updated Principle III to reflect new testing approach
- Added sections: None
- Removed sections: None
- Noted drift: Some components not following server-first pattern
- Follow-up TODOs: Team discussion needed on Principle III enforcement
-->

# [PROJECT_NAME] Playbook

[Updated content...]

**Version**: 1.1.0 | **Ratified**: [ORIGINAL_DATE] | **Last Amended**: [TODAY]
```

## Final Checks

Before submitting:
- [ ] Sync Impact Report documents all changes
- [ ] Version number updated appropriately
- [ ] Last Amended date set to today
- [ ] All changes backed by evidence from codebase
- [ ] Core principles still specific and actionable
- [ ] Rationales still make sense
- [ ] Project structure matches actual directories

Remember: Update to reflect reality, but don't compromise on quality. If the codebase has drifted from good practices, flag it rather than lowering standards.




