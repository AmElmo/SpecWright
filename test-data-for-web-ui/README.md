# SpecWright Test Data

This directory contains comprehensive test data for the SpecWright Web UI.

## Test Projects Overview

### 1. **001-google-sign-in** (Complete Project)
- ✅ Full specification workflow complete
- Contains: Request, PRD, Design Brief, Engineer Output
- **18 issues** in various states (completed, in-progress, pending)
- Tests: Complex dependencies, all issue statuses, all categories
- Best for: Testing complete project view and issue management

### 2. **002-video-upload-system** (Partial - PM & Designer Phase)
- ✅ Request and PRD complete
- ❌ No Design Brief, Engineer Output, or Issues
- Tests: Projects in early specification phase

### 3. **003-dashboard-analytics** (Early Stage)
- ✅ Request only
- ❌ No other specifications
- Tests: Newly created projects

### 4. **004-notification-system** (No Issues)
- ✅ Request, PRD, Design Brief, Engineer Output complete
- ❌ No tech lead breakdown / issues
- Tests: Complete specs but no implementation tasks yet

### 5. **005-super-long-project-name-to-test-ui-wrapping** (UI Edge Case)
- ✅ Request only
- Tests: Long text wrapping, truncation, and overflow handling

### 6. **006-edge-case-empty-project** (Minimal)
- ✅ Request only (very short)
- Tests: Minimal content edge case

### 7. **007-minimal-issues** (Single Issue)
- ✅ Request + 1 issue with minimal data
- Tests: Projects with very few issues, minimal issue metadata

### 8. **008-all-completed-issues** (All Done)
- ✅ Request + 3 completed issues
- Tests: Projects where all work is finished

### 9. **009-special-characters-test** (Character Handling)
- ✅ Request and PRD with special characters: & " ' < > / @ # $ % etc.
- Tests: HTML/XML escaping, code blocks, markdown with special chars

### 10. **010-unicode-emoji-test** (Internationalization)
- ✅ Request with emojis and unicode: 🚀 你好 مرحبا Привет
- Tests: Emoji rendering, CJK characters, RTL text, Cyrillic

## Usage

### For Testing SpecWright Web UI:
```bash
# Copy test data to your outputs folder
cp -r test-data/outputs/* specwright/outputs/

# Or create a symlink
ln -s $(pwd)/test-data/outputs $(pwd)/specwright/outputs
```

### For Manual Testing:
```bash
# Start the web UI
npm run build
node dist/specwright.js ui
```

## What Each Project Tests

| Project | Request | PRD | Design | Engineer | Issues | Special Feature |
|---------|---------|-----|--------|----------|--------|----------------|
| 001     | ✓       | ✓   | ✓      | ✓        | 18     | Complete workflow |
| 002     | ✓       | ✓   | ✗      | ✗        | 0      | PM phase only |
| 003     | ✓       | ✗   | ✗      | ✗        | 0      | Scoping phase |
| 004     | ✓       | ✓   | ✓      | ✓        | 0      | No issues |
| 005     | ✓       | ✗   | ✗      | ✗        | 0      | Long name |
| 006     | ✓       | ✗   | ✗      | ✗        | 0      | Minimal content |
| 007     | ✓       | ✗   | ✗      | ✗        | 1      | Minimal issue |
| 008     | ✓       | ✗   | ✗      | ✗        | 3      | All completed |
| 009     | ✓       | ✓   | ✗      | ✗        | 0      | Special chars |
| 010     | ✓       | ✗   | ✗      | ✗        | 0      | Unicode/emoji |

## Edge Cases Covered

✅ **Data States:**
- Complete projects with all specs
- Partial projects (early/mid workflow)
- Projects with no issues
- Projects with all completed issues
- Projects with minimal data

✅ **UI Edge Cases:**
- Long project names (text wrapping)
- Short/minimal content
- Special characters (HTML escaping)
- Unicode and emojis
- Empty/missing sections

✅ **Issue Variations:**
- All statuses: **pending**, **in-review**, **approved** (these are the only valid statuses)
- All priorities: critical, high, medium, low
- All categories: frontend, backend, database, testing, devops
- Complex dependencies
- Minimal metadata
- Missing optional fields

## Data Structure

Each project follows the standard SpecWright structure:
```
projects/{project-id}/
├── project_request.md                    # Initial request
├── product_requirements_document.md      # PM output (in project root)
├── design_brief.md                       # Designer output (in project root)
├── pm/                                   # PM working files
│   ├── pm_questions.json
│   └── product_manager_output.md
├── ux/                                   # UX working files
│   ├── ux_questions.json
│   ├── screen_inventory.json
│   └── ux_designer_output.md
├── engineer/                             # Engineer working files
│   ├── engineer_output.md
│   └── technology_choices.json
└── tech_lead/                     # Issue breakdown (Tech Lead phase)
    └── project_summary.json              # Contains all issues with metadata
```

## Notes

- All markdown files test various markdown features (headings, lists, code blocks, tables)
- `project_summary.json` contains all issues in a structured format with metadata
- Issue statuses are **pending** (not started), **in-review** (AI completed, needs human review), or **approved** (human verified)
- Project IDs use numbered prefixes (001, 002, etc.) for easy sorting
- Content is realistic but dummy data
- The folder structure must match exactly what the code creates and expects

