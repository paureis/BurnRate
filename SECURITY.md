# Security

BurnRate is a static, local-first web app. It does not require authentication, backend services, databases, API keys, or third-party paid integrations.

## Data Handling

- Subscription and trial data is stored only in the user's browser localStorage.
- CSV import/export happens entirely in the browser.
- Summary image export happens client-side with html2canvas.

## Reporting

If you find a security issue, please open a GitHub issue with a minimal reproduction and avoid including private subscription data.
