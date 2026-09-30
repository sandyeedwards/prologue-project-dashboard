import { asc } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { getDb } from "@/db/client";
import { appUsers } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { updateUserAccess } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole("ADMIN", "/admin/users");
  const params = await searchParams;
  const users = await getDb().select().from(appUsers).orderBy(asc(appUsers.displayName));
  return (
    <AppShell user={session.user}>
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Administration</p>
          <h1>Admin permissions</h1>
          <p className="lede">
            Teamwork employees are added automatically. Grant Admin access to people who should see
            and manage Teamwork Issues; remove it when they no longer need administrative access.
            The final active administrator cannot be removed.
          </p>
        </section>
        {params.updated ? (
          <p className="notice" role="status">
            Access updated successfully.
          </p>
        ) : null}
        <section className="panel panel--single">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Last login</th>
                  <th>Dashboard permission</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.displayName}</strong>
                      {user.id === session.user.id ? (
                        <small className="table-subvalue">You</small>
                      ) : null}
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
                          Update access
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
