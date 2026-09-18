-- Payroll records deliberately have no cascading foreign keys: source deletion
-- must not delete finalized payroll history.
CREATE TABLE payroll_pto_ledger (
  teamwork_id bigint PRIMARY KEY,
  person_id uuid,
  employee_name text NOT NULL,
  employee_teamwork_id bigint,
  project_id uuid NOT NULL,
  project_name text NOT NULL,
  task_name text NOT NULL,
  logged_date date NOT NULL,
  minutes integer NOT NULL CHECK (minutes >= 0),
  description text,
  lock_on date NOT NULL,
  baseline boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX payroll_pto_ledger_date_idx ON payroll_pto_ledger(logged_date);
--> statement-breakpoint
CREATE VIEW payroll_source_time AS
SELECT te.teamwork_id, te.person_id, te.project_id, te.logged_date, te.minutes,
  te.description, te.is_deleted, te.is_billable,
  person.teamwork_id AS employee_teamwork_id,
  coalesce(nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), person.email, 'Unassigned') AS employee_name,
  project.name AS project_name, coalesce(task.name, '') AS task_name,
  (lower(trim(project.name)) = 'internal operations'
    AND lower(trim(coalesce(list.name, ''))) = 'out of office'
    AND lower(trim(coalesce(task.name, ''))) = 'pto') AS is_pto
FROM time_entries te
JOIN projects project ON project.id = te.project_id
LEFT JOIN people person ON person.id = te.person_id
LEFT JOIN tasks task ON task.id = te.task_id
LEFT JOIN task_lists list ON list.id = task.task_list_id;
--> statement-breakpoint
CREATE FUNCTION refresh_payroll_pto() RETURNS void LANGUAGE plpgsql AS $$
DECLARE today date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  PERFORM pg_advisory_xact_lock(792610);
  DELETE FROM payroll_pto_ledger l
  WHERE l.lock_on > today AND NOT EXISTS (
    SELECT 1 FROM payroll_source_time s
    WHERE s.teamwork_id = l.teamwork_id AND s.is_pto AND NOT s.is_deleted
  );
  INSERT INTO payroll_pto_ledger (
    teamwork_id, person_id, employee_name, employee_teamwork_id, project_id,
    project_name, task_name, logged_date, minutes, description, lock_on, baseline
  )
  SELECT teamwork_id, person_id, employee_name, employee_teamwork_id, project_id,
    project_name, task_name, logged_date, minutes, description, logged_date + 30,
    logged_date + 30 <= today
  FROM payroll_source_time WHERE is_pto AND NOT is_deleted
  ON CONFLICT (teamwork_id) DO UPDATE SET
    person_id = excluded.person_id, employee_name = excluded.employee_name,
    employee_teamwork_id = excluded.employee_teamwork_id,
    project_id = excluded.project_id, project_name = excluded.project_name,
    task_name = excluded.task_name, logged_date = excluded.logged_date,
    minutes = excluded.minutes, description = excluded.description,
    lock_on = excluded.lock_on, updated_at = now()
  WHERE payroll_pto_ledger.lock_on > today;
END;
$$;
--> statement-breakpoint
-- Capture an entry's last observed value before any source update or deletion.
CREATE FUNCTION capture_payroll_pto_before_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO payroll_pto_ledger (
    teamwork_id, person_id, employee_name, employee_teamwork_id, project_id,
    project_name, task_name, logged_date, minutes, description, lock_on, baseline
  )
  SELECT teamwork_id, person_id, employee_name, employee_teamwork_id, project_id,
    project_name, task_name, logged_date, minutes, description, logged_date + 30, true
  FROM payroll_source_time WHERE teamwork_id = OLD.teamwork_id
    AND is_pto AND NOT is_deleted
    AND logged_date + 30 <= (now() AT TIME ZONE 'America/New_York')::date
  ON CONFLICT (teamwork_id) DO NOTHING;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payroll_pto_before_change BEFORE UPDATE OR DELETE ON time_entries
FOR EACH ROW EXECUTE FUNCTION capture_payroll_pto_before_change();
--> statement-breakpoint
SELECT refresh_payroll_pto();
--> statement-breakpoint
CREATE VIEW payroll_export_time AS
SELECT l.teamwork_id, l.person_id, l.employee_name, l.employee_teamwork_id,
  l.project_id, l.project_name, l.task_name, l.logged_date, l.minutes, l.description,
  true AS is_pto, false AS is_billable, l.lock_on, l.baseline,
  (s.teamwork_id IS NULL OR s.is_deleted OR NOT s.is_pto
    OR s.person_id IS DISTINCT FROM l.person_id
    OR s.employee_name IS DISTINCT FROM l.employee_name
    OR s.project_id IS DISTINCT FROM l.project_id
    OR s.project_name IS DISTINCT FROM l.project_name
    OR s.task_name IS DISTINCT FROM l.task_name
    OR s.logged_date IS DISTINCT FROM l.logged_date
    OR s.minutes IS DISTINCT FROM l.minutes
    OR s.description IS DISTINCT FROM l.description) AS changed_after_lock
FROM payroll_pto_ledger l
LEFT JOIN payroll_source_time s ON s.teamwork_id = l.teamwork_id
WHERE l.lock_on <= (now() AT TIME ZONE 'America/New_York')::date
UNION ALL
SELECT s.teamwork_id, s.person_id, s.employee_name, s.employee_teamwork_id,
  s.project_id, s.project_name, s.task_name, s.logged_date, s.minutes, s.description,
  s.is_pto, s.is_billable, CASE WHEN s.is_pto THEN s.logged_date + 30 END,
  false, false
FROM payroll_source_time s
WHERE NOT s.is_deleted AND NOT EXISTS (
  SELECT 1 FROM payroll_pto_ledger l WHERE l.teamwork_id = s.teamwork_id
  AND l.lock_on <= (now() AT TIME ZONE 'America/New_York')::date
);
