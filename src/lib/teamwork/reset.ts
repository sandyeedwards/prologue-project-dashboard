import { sql } from "drizzle-orm";

import { getDb } from "@/db/client";

/**
 * Clears only Teamwork-imported reporting data and sync history.
 * The encrypted Teamwork OAuth connection and Step 5 configuration remain intact.
 */
export async function resetTeamworkImportData() {
  const db = getDb();
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`
      truncate table
        operational_group_metrics,
        task_metrics,
        project_metrics,
        calculation_runs,
        project_snapshots,
        data_quality_issues,
        unplanned_work_reviews,
        project_archive_overrides,
        task_assignments,
        time_entries,
        expenses,
        task_list_budgets,
        project_budgets,
        tasks,
        task_lists,
        project_tags,
        tags,
        projects,
        job_roles,
        people,
        companies,
        sync_issues,
        sync_runs
      cascade
    `);
    await transaction.execute(sql`
      update teamwork_connections
      set last_sync_at = null,
          last_verified_at = now(),
          updated_at = now()
      where is_active = true
    `);
  });
}
