# Security policy

This is a private internal application.

## Secrets

Never commit:

- `.env` files
- Teamwork API tokens
- Teamwork OAuth client secrets
- Teamwork OAuth access tokens
- Session secrets
- Database production passwords

Use the hosting provider's secret manager in production.

## Read-only Teamwork access

The production connector must contain only read operations. Any future Teamwork write capability requires a separate documented approval and security review.

## Financial data

Employee and Teamwork job-role hourly cost rates must not be included in client-side responses or exports. Server-side calculations may use them to produce permitted aggregate cost values. Billable rates are not used for internal project-cost calculations.

## Reporting a problem

Report suspected credential exposure or unauthorized access immediately to the Prologue Systems administrator responsible for the dashboard and rotate affected credentials.

## Employee authentication

Employee sign-in uses Teamwork OAuth only to identify the user. Employee OAuth access tokens are discarded after the callback and are not stored in the application database. The central reporting token remains separately encrypted.

Browser sessions use random opaque tokens. Only SHA-256 token hashes are stored. Sessions expire after 12 hours and can be revoked when a user is disabled. Do not expose session cookies, OAuth state values, or database session hashes in logs or client responses.

Authorization must be enforced beside server-side data access and mutations. Hiding a link or button is not an authorization control.
