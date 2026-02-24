# Design Brief: AI Prompt Playground

## Design Goals

1. **Editor-first** - The prompt editor is the hero; everything else supports it
2. **Comparison-friendly** - Make it effortless to see differences between providers and versions
3. **Fast iteration** - Minimize clicks between writing a prompt and seeing results

## User Flows

### Flow 1: Write and Run a Prompt

```
New Prompt → Editor appears
    |
Type prompt with {{variables}}
  - Variable inputs auto-appear below
  - Provider checkboxes on the right
    |
Click "Run" (or Cmd+Enter)
    |
Responses stream side-by-side
  - Token count + latency per provider
  - Rate each response (thumbs up/down)
```

### Flow 2: Compare and Iterate

```
View responses from Run #1
    |
Edit prompt → Run again
    |
Version history sidebar shows Run #1 and #2
    |
Select both → Diff view shows prompt changes
    |
Quality trend sparkline shows improvement
```

### Flow 3: Browse and Use Templates

```
Click "Templates" in sidebar
    |
Browse by category (Extraction, Classification, Generation, etc.)
    |
Preview template with sample variables
    |
Click "Use Template" → loads into editor
    |
Customize and run
```

## Key Screens

1. **Prompt Editor** - Split view: editor left, response panels right
2. **Version History** - Sidebar with version list, diff view on select
3. **Template Library** - Grid of template cards by category
4. **Settings** - Provider API keys, default model selection, preferences

## Visual Guidelines

- Clean, minimal interface — the content (prompts and responses) is the focus
- Monospace font in editor, proportional in responses (with code blocks monospace)
- Provider colors: Claude (orange), GPT-4 (green), Gemini (blue)
- Quality indicators: High (green), Medium (yellow), Low (red)
- Dark mode default with light mode option

## Accessibility

- Full keyboard navigation (Tab between panels, Cmd+Enter to run)
- Screen reader announces response completion and quality scores
- Sufficient contrast for diff highlighting (not just color-dependent)
- Focus management: after Run, focus moves to first response panel

---
*Document generated as part of SpecWright specification*
