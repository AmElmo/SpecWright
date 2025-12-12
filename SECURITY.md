# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

We take the security of SpecWright seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do NOT:

- Open a public GitHub issue
- Disclose the vulnerability publicly before it has been addressed

### Please DO:

1. **Email us directly** at [julien@argil.ai](mailto:julien@argil.ai) with:
   - A description of the vulnerability
   - Steps to reproduce the issue
   - Possible impacts
   - Any suggested fixes (if you have them)

2. **Allow time for response**: We will acknowledge your email within 48 hours and will send a more detailed response within 5 business days indicating the next steps in handling your report.

3. **Work with us**: After the initial reply to your report, we will endeavor to keep you informed of the progress being made towards a fix and full announcement.

## What to Expect

- **Acknowledgment**: Within 48 hours of your report
- **Initial Assessment**: Within 5 business days
- **Status Updates**: We'll keep you informed about our progress
- **Resolution**: We aim to patch critical vulnerabilities within 30 days
- **Credit**: We'll acknowledge your contribution (unless you prefer to remain anonymous)

## Security Best Practices for Users

When using SpecWright:

1. **Keep it updated**: Always use the latest version
2. **Review generated code**: SpecWright generates specifications and code suggestions - always review before implementation
3. **Secure your AI credentials**: If using AI features, keep your API keys secure
4. **Version control**: Keep your `outputs/` directory in version control to track changes
5. **Access control**: Limit who can modify specification files in team environments

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported releases
4. Release patches as soon as possible

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request or open an issue.

## Security Hall of Fame

We'd like to thank the following individuals for responsibly disclosing security issues:

- (None yet - be the first!)

---

Thank you for helping keep SpecWright and its users safe! 🔒
