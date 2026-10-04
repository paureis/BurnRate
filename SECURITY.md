# Security

BurnRate is a local-first web app. It has no accounts, database, API keys or paid integrations. The only server-side code is stateless: the read-only share page, its preview image and the calendar feed, all derived from the URL payload.

## Data handling

- Subscription and trial data is stored in the user's browser (localStorage, plus IndexedDB for monthly snapshots).
- CSV import/export happens entirely in the browser.
- Summary image export happens client-side with html2canvas.
- The optional passphrase lock is a screen lock, not at-rest encryption. See the Security and privacy section of the README.

## Reporting a vulnerability

Please report security issues privately. Use GitHub's "Report a vulnerability" button on the repository's Security tab (private security advisories). Do not open a public issue for anything sensitive, and do not include real subscription data in a report.

Public issues are fine for ordinary bugs that have no security impact.
