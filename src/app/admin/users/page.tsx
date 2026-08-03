import { asc } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { getDb } from "@/db/client";
import { appUsers } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { updateUserAccess } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const session = await requireRole("ADMIN", "/admin/users");
  const users = await getDb().select().from(appUsers).orderBy(asc(appUsers.displayName));
  return (
    <AppShell user={session.user}>
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Administration</p>
          <h1>Dashboard access</h1>
          <p className="lede">
            Internal Teamwork employees are provisioned automatically. Assign Manager or Admin only
            where needed; all other employees remain Viewers.
          </p>
        </section>
        <section className="panel panel--single">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Last login</th>
                  <th>Role and status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.displayName}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.lastLoginAt?.toLocaleString() ?? "Never"}</td>
                    <td>
                      <form className="inline-form" action={updateUserAccess}>
                        <input name="userId" type="hidden" value={user.id} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          aria-label={`${user.displayName} role`}
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="MANAGER">Manager</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <select
                          name="isActive"
                          defaultValue={String(user.isActive)}
                          aria-label={`${user.displayName} status`}
                        >
                          <option value="true">Active</option>
                          <option value="false">Disabled</option>
                        </select>
                        <button className="button button--secondary" type="submit">
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
