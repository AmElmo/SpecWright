# SpecWright Quick Start

Get up and running with SpecWright in 5 minutes.

## Installation

### Global Installation (Recommended)

```bash
# Install globally
npm install -g specwright

# Initialize in your project
cd /path/to/your/project
specwright init
```

This creates all necessary files (`templates/`, `agents/`, `outputs/`).

### Local Development

```bash
git clone <your-repo>
cd specwright
npm install
```

## Understanding SpecWright

SpecWright classifies work into **2 types**:

1. **Work Directly** → Small fix/change (just implement, no spec needed)
2. **Project** → New capability (needs full specification)

Examples:
- "Change login validation" → **Work Directly** ✨
- "Add Google Sign-in" → **Project** 📋
- "Build a video editor" → **Project** 🎯

## Your First Project

### Step 1: Scope Your Work

```bash
specwright new
# Opens web UI where you can enter: "Build a task management app with user auth"

# Or use interactive menu:
specwright
# Then select "scope"
```

This will:
- Analyze your request
- **Classify it**: Work Directly or Project
- If **Work Directly**: SpecWright tells you to just implement it → start coding
- If **Project**: Creates `project_plan.json` → continue to specs

For projects with multiple projects (e.g., Project 001: User Authentication, Project 002: Task Management), you'll get a breakdown to spec each one individually.

### Step 1b: If It's "Work Directly" (Just Start Coding!)

If SpecWright classifies your request as **Work Directly**, it means the change is small enough that you don't need a full specification.

**That's it!** No further specification needed. Just start implementing the change directly in your code editor.

### Step 2: Work Through Specifications (For Projects Only)

**Skip this if it's "Work Directly" - just go code!**

For projects, simply ask the AI agent to help with each phase. The agent understands the project structure and will create the right files:

**Product Manager Phase:**
```
Help me create the PRD and user stories for the User Authentication project
```

**Designer Phase:**
```
Design the screens and wireframes for the authentication flow
```

**Engineer Phase:**
```
Create the technical architecture for authentication with JWT
```

**Tech Lead Phase:**
```
Break down the authentication project into implementation tasks
```

The AI will automatically:
- Reference the correct project directory
- Create outputs in the right locations
- Follow the proper templates
- Build on previous phases

Files created in `outputs/projects/001-user-authentication/`:
- `pm/product_manager_output.md` (contains PRD with Job Stories)
- `ux/ux_designer_output.md`, `screen_inventory.json`
- `architect/engineer_output.md`, `technology_choices.json`
- `tech_lead/project_summary.json`

## That's It!

You now have:
- ✅ Complete PRD with Job Stories
- ✅ Acceptance criteria
- ✅ Screen designs and wireframes
- ✅ Technical architecture
- ✅ Task breakdown with estimates

All saved in `outputs/projects/001-user-authentication/`.

## Next Steps

### Option 1: Use CLI for Full Workflow

```bash
specwright  # Select "spec" from menu
```

This runs all four agents in sequence with interactive prompts (PM → Designer → Engineer → Tech Lead).

### Option 2: Work Directly with AI Agent

After scoping, just ask the AI agent natural questions:
- "Create the PRD for this project"
- "Design the login screen"
- "What tech stack should we use?"
- "Break this down into tasks"

The agent understands the project structure and will work with the right files.

## Tips

**1. Start with Scoping**
Always run `specwright new` first to get proper project structure.

**2. CLI Commands**
- `specwright new` - Scope new work via web UI
- `specwright view` - Browse all projects
- `specwright playbook` - Generate project standards
- `specwright ship` - Break down into tasks

**3. Check Outputs**
All artifacts are in `outputs/projects/XXX-project-name/`. Review and refine as needed.

**4. Version Control**
Commit your `outputs/` directory to track specification evolution.

## Common Workflows

### Workflow 1: New Project from Scratch (CLI)
```bash
# Terminal - runs full automated workflow
specwright  # Then select "spec"

# Runs PM → Designer → Engineer → Tech Lead in sequence
```

### Workflow 2: New Project with Web UI
```bash
specwright new
# Enter: "Video upload project"
# Click "Scope with AI" to analyze

# Then work through phases with AI agent in your editor:
"Create the PRD for video upload"
"Design the upload screen"  
"What's the best tech approach for video processing?"
"Break this into implementation tasks"
```

### Workflow 3: Update Existing Spec
```
"Add file size validation to the video upload project"
```

The AI understands the context and will update the right files.

## Need Help?

- **Full documentation**: [README.md](README.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Changes**: [CHANGELOG.md](CHANGELOG.md)

## Troubleshooting

**"Template not found"**
- Verify `templates/` directory exists
- Run `specwright init` to set up

**"No project_plan.json"**
- Run `specwright new` first to scope work

---

**Ready to build? Start with `specwright init`** 🚀

