# Design Brief: Context-Aware Autocomplete

## Design Goals

1. **Invisible when working** - Suggestions appear naturally without disrupting flow
2. **Confidence at a glance** - Color-coded indicators show suggestion quality
3. **Zero configuration** - Works out of the box, learns from the codebase

## User Flows

### Flow 1: Accept Inline Completion

```
Developer types code
    |
Ghost text appears (gray, inline)
    |
Tab to accept / Escape to dismiss / Alt+] for alternatives
    |
If accepted:
  - Code inserted at cursor
  - Import added if needed
  - Suggestion logged for learning
```

### Flow 2: Initial Codebase Indexing

```
Open project for first time
    |
Status bar shows "Indexing: 0/1,247 files..."
    |
Progress bar fills as files are parsed
    |
"Indexing complete" notification
    |
Status bar shows green dot (index ready)
```

### Flow 3: Configure Preferences

```
Settings > Autocomplete
    |
Toggle: Ghost text, suggestion list, auto-import
    |
Keybindings: Accept, dismiss, cycle alternatives
    |
Language-specific settings per workspace
```

## Key Screens

1. **Editor with Suggestions** - Ghost text inline, optional dropdown list
2. **Indexing Progress** - Status bar indicator with expandable detail panel
3. **Settings Panel** - Feature toggles, keybindings, language settings

## Visual Guidelines

- Ghost text: 50% opacity of the editor text color
- Confidence colors: Green (high), Yellow (medium), Gray (low)
- Status bar: Small dot indicator — green (ready), yellow (indexing), red (error)
- Suggestion list: Follows editor theme, max 5 items visible

## Accessibility

- All interactions keyboard-accessible
- Screen reader announces suggestion availability
- Ghost text distinguishable from real code (opacity + optional underline)
- High contrast mode uses distinct borders instead of opacity

---
*Document generated as part of SpecWright specification*
