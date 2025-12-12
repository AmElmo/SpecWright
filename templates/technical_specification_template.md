# Technical Specification

## 1. Data Model

### New Tables/Collections
[NEW_TABLES_PLACEHOLDER]

### Table Modifications
[TABLE_MODIFICATIONS_PLACEHOLDER]

### Data Relationships
[DATA_RELATIONSHIPS_PLACEHOLDER]

### Migration Strategy
[MIGRATION_STRATEGY_PLACEHOLDER]

## 2. Implementation Notes

### Key Logic & Flows
[KEY_LOGIC_PLACEHOLDER]
- Main business logic, algorithms, calculations, rules
- Critical edge cases to handle
- State transitions (if applicable)

### Integration Points
[INTEGRATION_POINTS_PLACEHOLDER]
- What existing code/APIs/systems this connects to
- What this project exposes to other parts of the system
- How data flows between components

### Special Considerations
[SPECIAL_CONSIDERATIONS_PLACEHOLDER]
- Performance-critical operations
- Security considerations specific to implementation
- Data consistency requirements
- Any unique technical constraints

## 3. Architecture Notes (Only if needed)
[ARCHITECTURE_NOTES_PLACEHOLDER]
**Note**: Only include this section if introducing a new architectural pattern or major deviation from existing patterns. Most projects should follow established patterns and can leave this section empty.

## 4. Technology Choices
[TECHNOLOGY_CHOICES_PLACEHOLDER - This section will be populated after human selection from technology_choices.json]

**This section documents the selected technologies and alternatives considered.**

## 5. Non-Functional Requirements
[NON_FUNCTIONAL_REQUIREMENTS_PLACEHOLDER]

### Security
[Security requirements: authentication, authorization, data protection, compliance]

### Performance
[Performance requirements and targets: response times, throughput, load handling]

### Scalability
[Scalability considerations: growth projections, scaling strategy, resource planning]

### Accessibility
[Accessibility requirements: WCAG compliance level, screen reader support, keyboard navigation]

## 6. Testing Strategy
[TESTING_STRATEGY_PLACEHOLDER]

**Focus on critical edge cases only:**
- Test scenarios that could block user access
- Test scenarios that could corrupt or lose critical data
- Test scenarios that could affect payment or billing

**Not focused on test coverage** - prioritize impact over coverage metrics.

**Startup-appropriate** - enough testing to be safe, not enterprise-level exhaustive testing.

### Specific Test Scenarios
[List the key test cases needed for this specific project]

### What NOT to Test
[Explicitly note what does NOT need testing to avoid over-testing]

## 7. Rabbit Holes to Avoid
[RABBIT_HOLES_PLACEHOLDER]

**Technical pitfalls and time sinks to avoid:**
- ⚠️ Over-engineering or premature optimization traps
- ⚠️ Complex abstractions not needed for the initial version
- ⚠️ Technical debt patterns or maintenance nightmares
- ⚠️ Time-consuming approaches that won't deliver proportional value

**Example:**
- ⚠️ **Building a custom caching layer**: The initial traffic won't justify this complexity. Use simple database queries first and add caching only when performance metrics show it's needed.
