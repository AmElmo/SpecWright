# Explorer Stories

This folder contains story files generated for previewing components and pages.

## Structure

```
.explorer/
├── templates/                    # Template files for reference
│   ├── component.stories.template.json
│   └── page.stories.template.json
├── stories/
│   ├── components/              # Component story files
│   │   └── Button.stories.json
│   └── pages/                   # Page story files
│       └── dashboard.stories.json
└── README.md
```

## How It Works

1. **Generate Stories**: Click "Generate Stories" in the Explorer to get an AI prompt
2. **Run AI**: Paste the prompt into your AI coding tool (Cursor, Claude, etc.)
3. **AI Creates File**: The AI will create the story file in the correct location
4. **Preview**: Select a story to preview the component/page with mock data

## Story Format

Each story file contains:
- **stories**: Array of different states/variations to preview
- **mockApi**: Mock responses for API calls
- **mockContext**: Mock context values
- **themeVariants**: Supported themes (light/dark)
- **viewports**: Supported screen sizes

See the template files for the full schema.
