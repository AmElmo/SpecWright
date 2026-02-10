## [3.2.0](https://github.com/amelmo/specwright/compare/v3.1.1...v3.2.0) (2026-02-10)

### Features

* add manual issue status changes with drag-and-drop ([#15](https://github.com/amelmo/specwright/issues/15)) ([8e4e7bd](https://github.com/amelmo/specwright/commit/8e4e7bd3de77da151362e63aa2ee5eea41e8af4c))

### Bug Fixes

* correct npx syntax in publish workflow for semantic-release ([#16](https://github.com/amelmo/specwright/issues/16)) ([be7a43f](https://github.com/amelmo/specwright/commit/be7a43f3961764343e3eac20f487099cd6073626))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CODE_OF_CONDUCT.md for community guidelines
- SECURITY.md for security policy
- ARCHITECTURE.md for technical documentation
- CI/CD workflow with GitHub Actions
- ESLint and Prettier configuration

## [3.0.0] - 2024-12-11

### Added
- Complete TypeScript rewrite from JavaScript v2.0
- Modern web UI for scoping and browsing projects
- Project playbook generation and auditing
- Smart scoping system to classify work types
- Four specialized AI agents (PM, Designer, Engineer, Tech Lead)
- Interactive CLI with menu system
- Phase-based workflow with validation and recovery
- Technology choices viewer component
- Comprehensive logging system with debug modes
- Template-based specification generation

### Changed
- Migrated from JavaScript to TypeScript
- Improved project structure and organization
- Enhanced output formats with JSON schemas
- Better error handling and resilience
- Modernized dependency management

### Removed
- Legacy JavaScript v2.0 codebase (archived)
- Old manual specification formats

## [2.0.0] - 2024-XX-XX (Archived)

### Added
- Initial JavaScript-based CLI implementation
- Basic workflow automation
- Template system for specifications

### Notes
- Version 2.0 has been archived in `backup-js-v2.0.0 (archived)/`
- Users should migrate to v3.0+ for the latest features

## [1.0.0] - 2024-XX-XX

### Added
- Initial release
- Basic specification generation
- Simple CLI interface

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

[Unreleased]: https://github.com/amelmo/specwright/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/amelmo/specwright/releases/tag/v3.0.0
