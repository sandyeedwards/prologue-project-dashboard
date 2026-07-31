# Teamwork sign-in setup

Step 8 intentionally reuses `TEAMWORK_REDIRECT_URI`, currently `/api/teamwork/oauth/callback`. No second employee callback URI is required.

The same Teamwork app login flow supplies two separate outcomes:

- `CONNECTION`: stores the encrypted central reporting token.
- `LOGIN`: reads the employee's Teamwork identity, creates a dashboard session, and discards the employee token.

The active installation ID and imported People records restrict sign-in to Prologue's internal Teamwork users.
