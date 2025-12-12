# Project Request: Special Characters & "Quotes" Test <Testing>

## Overview
Test project with special characters: & " ' < > / \ @ # $ % ^ * ( ) [ ] { } | ` ~

## Goals
- Test special character handling in titles
- Verify HTML/XML escaping
- Test markdown rendering with special chars

## Code Example
```javascript
const test = "Hello & goodbye";
const html = "<div>Test</div>";
```

## Success Criteria
- All characters render correctly
- No XSS vulnerabilities
- Markdown code blocks work

