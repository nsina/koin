# Security

## Deployment Warning

Koin has **no built-in authentication**. Anyone who can reach the URL can read your expense data and bank transactions. Before deploying to a public URL, protect it with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/).

For local use only, no additional steps are needed.

## Sensitive Data

- **Mercury API token** — stored server-side in SQLite. It is never returned to the browser in plaintext (masked as `••••abcd` in client responses). Never commit tokens or credentials to this repository.
- **Expense and mileage data** — stored in your NuxtHub D1 database. It does not leave your Cloudflare account.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use [GitHub's private vulnerability reporting](https://github.com/nsina/koin/security/advisories/new) instead. You can expect an initial response within 72 hours.

Please include:
- Description of the vulnerability and its potential impact
- Steps to reproduce
- Any relevant file paths or commit references
