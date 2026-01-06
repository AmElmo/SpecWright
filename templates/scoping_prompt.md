# Project Scoping Analysis

## Your Task

Analyze the user's request and determine if it needs a full project specification or if they should just implement it directly in Cursor.

**CRITICAL**: Update the scoping plan file `specwright/outputs/scoping_plan.json` with your analysis using the exact JSON structure shown below.

## Analysis Steps

### Step 1: Determine if Project is Needed

Classify the work into one of these categories:

**WORK DIRECTLY** - Small changes that don't need a full spec
- Modifying existing validation logic
- Changing styling/layout of existing components
- Fixing bugs or small UX improvements
- Updating error messages or text
- Tweaking existing behavior
- Refactoring, dependency updates, maintenance
- **No specification needed** - tell user to implement directly

**PROJECT** - New capability that needs proper specification (PM → Designer → Engineer → Tech Lead)
- Building new functionality from scratch
- Adding new user flows or screens
- Integrating new services (OAuth, payments, etc.)
- Creating new components or systems
- **Requires full specification** before implementation

**DEFAULT TO "WORK DIRECTLY" if in doubt** - Most day-to-day work is iterative improvements that don't need a full spec.

### Step 2: If Project - Understand Project vs Product Scope

**CRITICAL DISTINCTION:**

**A PROJECT = ONE independently valuable piece of functionality**
- One user flow or capability
- Can be built, tested, and shipped independently
- Has a single, clear testable outcome
- Examples: "User login", "Video upload", "Payment processing", "Search functionality"

**A PRODUCT/MVP = MULTIPLE PROJECTS working together**
- Contains several distinct features or capabilities
- User mentions "MVP", "app", "platform", "system" with multiple features
- Each feature could be built and tested separately
- Examples: "E-commerce platform", "Social media app", "Lead generation tool"

**WHEN IN DOUBT, SPLIT IT UP** - It's better to have multiple focused projects than one monolithic project.

### Step 3: If Project - Assess Scope

If classified as a **Project**, then determine:

1. **Single Project** - ONE cohesive capability (rare - only if truly atomic)
2. **Multiple Projects** - MULTIPLE independently valuable pieces (common - default for MVPs/products)

### Step 4: Keep it Brief

Descriptions should be clear but concise (1-2 sentences max)

## Output Requirements

### For "WORK DIRECTLY"

If the work doesn't need a project spec, use this structure:

```json
{
  "type": "direct",
  "scope_analysis": "Brief explanation of why this doesn't need a full project spec (1-2 sentences)",
  "direct_work_suggestion": "Specific guidance on how to implement this change directly in Cursor"
}
```

### For PROJECTS

If classified as a **Project**, use this structure:

```json
{
  "type": "project",
  "project_name": "Short descriptive name",
  "description": "Brief 1-2 sentence summary of the overall initiative",
  "scope_analysis": "Your analysis of the scope (2-3 sentences explaining your reasoning)",
  "recommendation": "single|multiple",
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description of what this project does",
      "priority": "high|medium|low",
      "dependencies": "None or list project dependencies (e.g., 'Requires Project A to be completed first')",
      "testable_outcome": "What the user can test/see after this is built"
    }
  ]
}
```

## Examples

### "Work Directly" Examples (No spec needed - just implement)
- 💡 Request: "Change login validation to require 8 characters" → **WORK DIRECTLY**
- 💡 Request: "Fix: Button crashes when clicked twice" → **WORK DIRECTLY**
- 💡 Request: "Update button color from blue to green" → **WORK DIRECTLY**
- 💡 Request: "Fix spacing on dashboard cards" → **WORK DIRECTLY**
- 💡 Request: "Make error messages more user-friendly" → **WORK DIRECTLY**
- 💡 Request: "Upgrade React to v18" → **WORK DIRECTLY**
- 💡 Request: "Refactor authentication helper functions" → **WORK DIRECTLY**
- 💡 Request: "Add loading spinner to submit button" → **WORK DIRECTLY**

### Single Project Examples (ONE focused capability)
- ✅ Request: "Add Google Sign-in" → **Single Project**: "Google OAuth Authentication"
- ✅ Request: "Add video upload capability" → **Single Project**: "Video Upload System"
- ✅ Request: "Implement password reset flow" → **Single Project**: "Password Reset"
- ✅ Request: "Add ability to export data as CSV" → **Single Project**: "CSV Export"

### Multiple Projects Examples (PRODUCT/MVP with distinct features)

**🎯 THESE ARE THE MOST COMMON - MVPs and products always need multiple projects!**

- 🔀 Request: "Build an MVP for a lead generation web app" → **Multiple Projects**: 
  - Even if it sounds like "one thing", an MVP is a product with multiple capabilities
  - Break down into: Data ingestion, Search/filtering, Results display, Export functionality

- 🔀 Request: "I want to build a web app that generates company leads with a spreadsheet UI and natural language search" → **Multiple Projects**:
  1. Natural language query system
  2. Company data API integration
  3. People/leads finder
  4. Spreadsheet-style UI
  5. Data export and management

- 🔀 Request: "Build a video editor app" → **Multiple Projects**: 
  1. Video upload and storage
  2. Video playback and preview
  3. Basic trimming and cutting
  4. Timeline editor UI
  5. Export and rendering

- 🔀 Request: "I need authentication and payment processing" → **Multiple Projects**: 
  1. User registration and login
  2. Password reset flow
  3. Payment gateway integration
  4. Subscription management

- 🔀 Request: "Build a social media platform" → **Multiple Projects**: 
  1. User profiles and authentication
  2. Post creation and feed
  3. Like and comment system
  4. Follow/unfollow functionality
  5. Direct messaging
  6. Notifications

- 🔀 Request: "Create a task management app" → **Multiple Projects**:
  1. Task creation and editing
  2. Project organization
  3. Team collaboration features
  4. Calendar integration
  5. Notifications and reminders

## Decision Guidelines

### Priority Order (Check in this order):

1. **Is it modifying existing functionality?** → Probably **WORK DIRECTLY**
2. **Is it building something new?** → Probably needs **PROJECT(S)**
3. **Does the request mention "MVP", "app", "platform", "system", or "product"?** → Almost always **MULTIPLE PROJECTS**
4. **Does it describe 2+ distinct features or capabilities?** → **MULTIPLE PROJECTS**
5. **Can you identify separate user flows or independently testable pieces?** → **MULTIPLE PROJECTS**
6. **Is it truly ONE atomic capability with ONE testable outcome?** → **SINGLE PROJECT** (rare!)

### How to Identify Multiple Projects

Ask yourself:
- **Can this be broken into separate user stories?** If yes → Multiple projects
- **Does each piece provide independent value?** If yes → Multiple projects  
- **Could we ship piece A without piece B?** If yes → Multiple projects
- **Are there 3+ nouns describing different capabilities?** (e.g., "search", "display", "export") → Multiple projects
- **Did the user say "MVP", "platform", "app", or "system"?** → Almost certainly multiple projects

### Red Flags for "Single Project" Classification

❌ **DON'T create a single project if:**
- The request mentions "MVP" or "app" or "product"
- You can identify 2+ distinct features
- The description is longer than 2 sentences
- Multiple user flows are involved
- Several nouns describe different capabilities

✅ **ONLY create a single project if:**
- It's ONE atomic capability (e.g., "Add Google Sign-in")
- ONE clear user flow with ONE testable outcome
- Cannot be meaningfully subdivided
- Description fits in 1-2 sentences

**When in doubt, split it up!** - It's better to have 3-5 focused projects than 1 bloated project.

## Special Case: MVP and Product Requests

**🚨 CRITICAL: If the user mentions "MVP", "app", "platform", "product", or "system", you should ALMOST ALWAYS create MULTIPLE PROJECTS.**

### Why MVPs Need Multiple Projects

An MVP is a **minimum viable PRODUCT**, not a minimum viable PROJECT. Even the simplest MVP contains multiple distinct capabilities that should be:
- Specified separately (clearer requirements)
- Built incrementally (faster feedback)
- Tested independently (better quality)
- Prioritized differently (critical vs nice-to-have)

### How to Break Down an MVP

1. **Identify the core user flows** (each flow = potential project)
2. **List the distinct technical capabilities** (each capability = potential project)
3. **Separate data/backend from UI/frontend** (often separate projects)
4. **Think in terms of independent value delivery**

### Example Breakdown

Request: "Build an MVP for a lead generation tool with spreadsheet UI"

❌ **WRONG (Single Project)**:
- Project: "Lead Generation MVP"
  - Problem: Too broad, unclear scope, hard to spec and build

✅ **RIGHT (Multiple Projects)**:
1. "Company Search API Integration" - Connect to data sources
2. "Natural Language Query Parser" - Convert user queries to API calls  
3. "Data Storage and Caching" - Store and manage fetched data
4. "Spreadsheet UI Component" - Display data in table format
5. "Lead Export System" - Export data to CSV/Excel

Each project has:
- Clear, testable outcome
- Independent value
- Manageable scope
- Separate specification needs

