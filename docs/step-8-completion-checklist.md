# Step 8 completion checklist

- [x] Teamwork employee login reuses the approved OAuth callback.
- [x] Login OAuth state is single-use, expiring, and purpose-bound.
- [x] Only active internal Prologue Teamwork users are eligible.
- [x] Login tokens are not retained.
- [x] Central reporting authorization remains separate.
- [x] Opaque database sessions are hashed and revocable.
- [x] Viewer, Manager, and Admin roles are stored in PostgreSQL.
- [x] Admin, manager, page, API, and Server Action checks execute server-side.
- [x] The last active administrator cannot be removed.
- [x] User-role changes are written to the audit log.
- [x] Setup provisions imported employees and verifies the access model.
