# Step 8: Employee authentication and roles

## Authentication boundary

Employees sign in through Teamwork's OAuth App Login Flow. The existing Teamwork callback URI is reused and the OAuth state identifies whether the request is for the central reporting connection or employee login.

Employee bearer tokens are used only to retrieve Teamwork user information during the callback. They are not stored. The central encrypted reporting token remains in `teamwork_connections` and continues to supply synchronized dashboard data.

## Eligibility

A Teamwork identity may sign in only when it resolves to an imported `people` record that is active, is not a client user, and is not marked as a service account. The Teamwork installation ID must match the active Prologue reporting connection.

## Sessions

The browser receives a 32-byte opaque cookie. Only its SHA-256 hash is stored in `app_sessions`. Sessions expire after 12 hours, use HttpOnly and SameSite=Lax cookies, use Secure cookies in production, and may be revoked immediately. Provisioning also disables active dashboard accounts that no longer resolve to an eligible imported employee.

## Authorization

The role hierarchy is:

1. Viewer
2. Manager
3. Admin

Secure checks occur in the server-side data access layer, pages, Server Actions, and Route Handlers. Proxy checks are only an early redirect based on cookie presence and are not the security boundary.

Viewer access covers project-level reporting. Manager access adds employee-level labor analysis. Admin access adds configuration, Teamwork synchronization, calculation administration, and user-role management. Raw employee cost rates remain server-only in every role.

## Administrator bootstrap

The employee who authorized the central Teamwork reporting connection becomes an Admin when their imported email matches. Additional initial administrators may be supplied through `DASHBOARD_BOOTSTRAP_ADMIN_EMAILS`. The user-management action prevents removal of the last active administrator.
