# Contributing to SpecWright

First off, thank you for considering contributing to SpecWright! 🎉

SpecWright is an open-source project and we love to receive contributions from our community. There are many ways to contribute, from writing tutorials, improving the documentation, submitting bug reports and feature requests, or writing code.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a branch for your changes
5. Make your changes
6. Push to your fork and submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm 9+
- A code editor (we recommend [Cursor](https://cursor.sh/) for the best experience with SpecWright)

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/specwright.git
cd specwright

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (with debug logging)
npm run dev
```

### Project Structure

```
specwright/
├── src/                    # TypeScript source code
│   ├── commands/           # CLI command handlers
│   ├── services/           # Business logic services
│   ├── ui/                 # Terminal UI components
│   ├── utils/              # Utility functions
│   ├── web-ui/             # React web interface
│   └── specwright.ts       # Main CLI entry point
├── agents/                 # AI agent prompts
├── templates/              # Template files for outputs
├── dist/                   # Compiled JavaScript (generated)
└── test-data/              # Test fixtures
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build CLI and Web UI |
| `npm run build:cli` | Build CLI only |
| `npm run build:ui` | Build Web UI only |
| `npm run dev` | Run CLI in dev mode with debug logging |
| `npm run dev:ui` | Run Web UI dev server |
| `npm run dev:server` | Run web server in dev mode |
| `npm run type-check` | Run TypeScript type checking |

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-new-agent` - For new features
- `fix/resolve-parsing-bug` - For bug fixes
- `docs/update-readme` - For documentation
- `refactor/improve-cli-structure` - For refactoring

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new PM agent questioning phase
fix: resolve issue with project path detection
docs: update installation instructions
refactor: simplify workflow service logic
chore: update dependencies
```

### Code Quality

Before submitting:

1. **Type check**: Run `npm run type-check` to ensure no TypeScript errors
2. **Build**: Run `npm run build` to verify the project builds
3. **Test locally**: Test your changes with `npm run dev`

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add yourself** to the contributors list if this is your first contribution
3. **Fill out the PR template** completely
4. **Request review** from maintainers
5. **Address feedback** promptly

### PR Requirements

- [ ] Code builds without errors
- [ ] Changes are tested locally
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventions
- [ ] PR description explains the changes

## Style Guide

### TypeScript

- Use TypeScript for all new code
- Prefer `const` over `let`
- Use async/await over raw promises
- Add JSDoc comments for public functions

### Logging

**Important**: Use the `logger` utility instead of `console.log`:

```typescript
import { logger } from '../utils/logger.js';

// For debugging (hidden in production)
logger.debug('Processing project...');

// For user-facing output (always visible)
logger.print('✨ Project created successfully!');
```

### File Organization

- One component/service per file
- Group related functionality in directories
- Keep files under 300 lines when possible

## Reporting Bugs

### Before Submitting

1. Check the [existing issues](https://github.com/amelmo/specwright/issues) to avoid duplicates
2. Try the latest version to see if the bug is fixed
3. Collect relevant information (OS, Node version, error messages)

### Bug Report Template

When creating an issue, include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Numbered steps to reproduce
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, Node version, SpecWright version
- **Screenshots/Logs**: If applicable

## Suggesting Features

We love feature suggestions! When proposing a feature:

1. **Explain the problem** you're trying to solve
2. **Describe the solution** you'd like
3. **Consider alternatives** you've thought about
4. **Add context** - examples, mockups, or references

## Questions?

Feel free to open a [Discussion](https://github.com/amelmo/specwright/discussions) for questions that aren't bugs or feature requests.

---

Thank you for contributing to SpecWright! 🚀

