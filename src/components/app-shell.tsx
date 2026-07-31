import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { PrimaryNavigation } from "@/components/primary-navigation";
import { PrologueMark } from "@/components/prologue-brand";

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PS";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function AppShell({
  user,
  children,
  contentTone = "default",
}: {
  user: SessionUser;
  children: ReactNode;
  contentTone?: "default" | "portfolio";
}) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="app-header__brand" href="/dashboard" aria-label="Open Prologue Portfolio Dashboard">
            <PrologueMark height={48} />
            <span className="app-header__brand-copy">
              <strong>PROLOGUE</strong>
              <small>Project Intelligence</small>
            </span>
          </Link>

          <div className="app-header__navigation">
            <PrimaryNavigation />
          </div>

          <div className="user-menu">
            <span className="user-menu__avatar" aria-hidden="true">{initials(user.displayName)}</span>
            <span className="user-menu__identity">
              <strong>{user.displayName}</strong>
              <small>{user.role}</small>
            </span>
            <form action="/api/auth/logout" method="post">
              <button className="button button--secondary button--compact" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="app-frame__content app-frame__content--portfolio" data-content-tone={contentTone}>{children}</div>
    </div>
  );
}
