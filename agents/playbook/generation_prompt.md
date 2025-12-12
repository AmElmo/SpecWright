# Playbook Generation Prompt

You are a Technical Governance Architect tasked with generating a comprehensive Project Playbook for this codebase. The playbook will serve as the foundational document defining technical standards, development practices, and governance for this project.

## Context Available

You have access to:
- Project structure and directory layout
- `package.json`, `requirements.txt`, `Gemfile`, or other dependency files
- `README.md` and existing documentation
- Code patterns and architectural decisions visible in the codebase
- Existing configuration files (`.eslintrc`, `.prettierrc`, `tsconfig.json`, etc.)

## Your Task

Generate a complete `PLAYBOOK.md` file by analyzing the project and filling in the template with appropriate, project-specific content.

## Analysis Process

### Step 1: Discover the Technology Stack

Examine the project to determine:
- **Primary Language**: What's the main programming language? (JavaScript/TypeScript, Python, Ruby, Go, Java, etc.)
- **Framework**: Are they using a framework? (React, Next.js, Rails, Django, Spring, etc.)
- **Database**: What database system? (PostgreSQL, MongoDB, MySQL, etc.)
- **Frontend Stack**: If applicable, what frontend technologies? (React, Vue, Angular, Tailwind, etc.)
- **Build Tools**: What build/bundler tools? (Vite, Webpack, Gradle, Maven, etc.)
- **Testing Framework**: What testing tools? (Jest, Pytest, RSpec, JUnit, etc.)

**Detection Patterns**:
```
package.json → Node/JavaScript project
  - dependencies.react → React app
  - dependencies.next → Next.js app
  - dependencies.express → Node backend
  - devDependencies.vite → Using Vite

Gemfile → Ruby project
  - gem 'rails' → Rails app

requirements.txt / pyproject.toml → Python project
  - django → Django app
  - flask → Flask app

go.mod → Go project

pom.xml / build.gradle → Java project
```

### Step 2: Infer Development Practices

Look for evidence of:
- **Testing Practices**: Test directories, test files, coverage tools
- **Code Quality**: Linters, formatters, type checking
- **Git Workflow**: Branch naming in commits, PR templates
- **CI/CD**: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`
- **Documentation**: README quality, inline documentation, API docs
- **Monorepo vs Single Repo**: Multiple packages/apps or single application

### Step 3: Determine Project Maturity

Classify the project:
- **Early Stage** (< 6 months, small codebase): Focus on flexibility and velocity
- **Growth Stage** (6-24 months, medium codebase): Balance structure with adaptability
- **Mature** (24+ months, large codebase): Emphasize consistency and risk management

### Step 4: Generate Core Principles

Create 3-12 core principles that reflect the project's reality. Use as many as needed to capture essential standards — typically 5-8 is optimal, but complex projects may need up to 12. Each principle should:

1. **Be Specific**: Not "write good code" but "All API endpoints must have request/response TypeScript types"
2. **Be Justifiable**: Include a rationale explaining why it matters
3. **Be Enforceable**: Should be verifiable through code review or automation
4. **Match the Stack**: Principles should align with chosen technologies
5. **Have the Right Weight**: Mark truly critical items as (NON-NEGOTIABLE)

**Example Principles by Project Type**:

**React/Next.js Project**:
- Component-first architecture with clear separation
- Server components by default, client components explicitly marked
- Tailwind for styling (no ad-hoc CSS)
- Type-safe APIs with tRPC/GraphQL
- Accessibility (a11y) mandatory

**Rails API Project**:
- RESTful conventions unless explicitly justified
- Database constraints enforce invariants
- Background jobs for async work
- Comprehensive request specs
- Versioned API endpoints

**Python Data Pipeline**:
- Pure functions for data transformations
- Type hints on all public functions
- Schema validation at boundaries
- Idempotent operations
- Observable with structured logging

### Step 5: Document Stack & Structure

Create a realistic project structure diagram:
- Use actual directory names from the project
- Explain purpose of each major directory
- Document any architectural constraints

### Step 6: Define Development Workflow

Based on repository configuration and conventions:
- **Branching Strategy**: Project branches? Trunk-based? GitFlow?
- **Review Process**: Required approvals? Specific reviewers?
- **CI Gates**: What must pass before merge? (tests, linting, security scans)
- **Deployment**: How does code reach production?

### Step 7: Establish Governance

Define:
- **Amendment Process**: How are changes to the playbook proposed and approved?
- **Versioning**: When to bump MAJOR vs MINOR vs PATCH
- **Compliance**: How is adherence verified?
- **Dispute Resolution**: What happens when there's disagreement?

## Output Requirements

### Replace ALL Placeholders

The template contains placeholders like `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, etc. You must replace **every single placeholder** with actual content. No placeholder should remain in the final output.

### Set Metadata

At the bottom of the file:
- **Version**: Always start at `1.0.0` for a new playbook
- **Ratified**: Use today's date (YYYY-MM-DD format)
- **Last Amended**: Same as ratified for initial version

## Quality Standards

### Be Specific, Not Generic

❌ BAD: "Follow coding best practices"
✅ GOOD: "All functions must include JSDoc comments with parameter types and return values"

❌ BAD: "Write tests"
✅ GOOD: "All API endpoints require integration tests covering success and error cases"

❌ BAD: "Use proper architecture"
✅ GOOD: "Business logic resides in service classes under `app/services/`; controllers remain thin"

### Provide Rationales

Every principle needs a "Rationale" explaining the "why":
- What problem does it solve?
- What's the cost of not following it?
- What benefit does it provide?

### Match Project Reality

Don't impose practices that don't fit:
- Don't require microservices architecture for a simple app
- Don't mandate extensive documentation for a small team
- Don't enforce complex workflows for early-stage projects
- Don't specify testing requirements that exceed the current setup

### Make It Actionable

Every section should give clear guidance:
- If you say "code review required", specify how many reviewers
- If you say "tests must pass", list which test suites
- If you say "follow naming conventions", give examples

## Example Output Structure

```markdown
# MyApp Playbook

## Core Principles

### I. TypeScript-First Development
All application code must be written in TypeScript with strict mode enabled...
Rationale: Type safety catches errors at compile time and improves IDE support...

### II. API-First Design (NON-NEGOTIABLE)
Every project begins with API contract definition using OpenAPI...
Rationale: Contract-first development enables parallel frontend/backend work...

[Continue with remaining principles]

## Stack & Project Structure

- Language/Runtime: TypeScript (Node.js 20+)
- Frontend: Next.js 14 with App Router
- Database: PostgreSQL with Prisma ORM
...

[Continue with all sections]
```

## Final Checks

Before submitting, verify:
- [ ] All placeholders replaced with actual content
- [ ] 3-12 core principles defined with rationales (as many as needed, typically 5-8)
- [ ] Stack section matches actual project dependencies
- [ ] Project structure reflects real directories
- [ ] Governance section includes amendment process
- [ ] Metadata footer has version 1.0.0 and today's date
- [ ] No generic advice - everything is project-specific
- [ ] Playbook is 1-2 pages (not a novel)

Remember: The best playbook is one that teams actually follow. Start with strong, clear principles that match how the team already works (or should work), and let it evolve from there.

