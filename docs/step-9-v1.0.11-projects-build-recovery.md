# Step 9 v1.0.11 Projects build recovery

Step 9 v1.0.10 removed the `getAvailableProjectTypes` import from the Projects page while the page still used the helper to build its type filter. This caused strict TypeScript checking to stop before database synchronization.

Version 1.0.11 restores the import and adds verification coverage. No migration, Teamwork authorization, import reset, or recalculation-specific recovery is required.
