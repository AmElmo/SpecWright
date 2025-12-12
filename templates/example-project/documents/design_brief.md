# Design Brief: AI Code Review Assistant

## Design Goals

1. **IDE-familiar** - Feel like a native code editor experience
2. **Non-intrusive** - Suggestions enhance, not interrupt the flow
3. **Confidence-building** - Clear explanations help developers learn

## User Flows

### Flow 1: Submit Code for Review

```
Dashboard → "New Review" button
    ↓
Code editor appears (Monaco-based)
  - Paste or type code
  - Language auto-detected
  - "Analyze Code" button
    ↓
Loading state:
  - Skeleton suggestions panel
  - "Analyzing your code..." message
  - Progress indicator
    ↓
Results appear in side panel
```

### Flow 2: Review and Apply Suggestions

```
Suggestions panel shows categorized issues
    ↓
Click on a suggestion:
  - Card expands with explanation
  - Code line highlighted in editor
  - "Apply Fix" or "Dismiss" buttons
    ↓
Click "Apply Fix":
  - Diff modal shows before/after
  - "Apply" confirms change
  - Code updates in editor
  - Suggestion marked as resolved ✓
```

### Flow 3: Configure Review Preferences

```
Settings → Code Review section
    ↓
Toggle categories:
  ☑ Security issues
  ☑ Potential bugs
  ☑ Performance suggestions
  ☐ Style improvements (disabled)
    ↓
Save persists to user profile
Applied to all future reviews
```

## Key Screens

1. **Review Editor** - Split view: code editor left, suggestions right
2. **Suggestion Card** - Expandable card with severity, explanation, actions
3. **Diff Modal** - Side-by-side or inline diff view
4. **Review History** - List of past reviews with outcome summary
5. **Settings Panel** - Category toggles and preferences

## Visual Guidelines

- Dark theme default (developer preference)
- Syntax highlighting matches VS Code "Dark+"
- Severity colors: Critical (red), Warning (amber), Info (blue)
- Applied fixes: Green checkmark
- Monospace font for all code: JetBrains Mono or Fira Code

## Accessibility

- All interactive elements keyboard accessible
- Suggestions announced to screen readers
- High contrast mode available
- Focus indicators visible

---
*Document generated as part of SpecWright example project*
