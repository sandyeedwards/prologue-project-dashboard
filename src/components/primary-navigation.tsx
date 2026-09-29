"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const standardItems = [
  { href: "/dashboard", label: "Company Overview", shortLabel: "At a glance" },
  { href: "/revenue-trends", label: "Revenue Trends", shortLabel: "History over time" },
  {
    href: "/operational-performance",
    label: "Operational Performance",
    shortLabel: "By work group",
  },
  { href: "/projects", label: "All Projects", shortLabel: "Search, compare & combine" },
  { href: "/time-reporting", label: "Time & Payroll", shortLabel: "Utilization & PTO" },
  { href: "/hosting", label: "Hosting", shortLabel: "Revenue & costs" },
] as const;

const teamworkIssuesItem = {
  href: "/teamwork-issues",
  label: "Teamwork Issues",
  shortLabel: "Admin review",
} as const;

const guideItem = { href: "/help", label: "Guide", shortLabel: "Reference" } as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNavigation({
  issueCount = 0,
  isAdmin = false,
}: {
  issueCount?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...standardItems, teamworkIssuesItem, guideItem]
    : [...standardItems, guideItem];

  return (
    <nav className="app-nav" aria-label="Primary dashboard navigation">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "app-nav__link app-nav__link--active" : "app-nav__link"}
            aria-current={active ? "page" : undefined}
          >
            <span>
              {item.label}
              {item.href === "/teamwork-issues" && issueCount > 0 ? (
                <span className="nav-issue-badge" aria-label={`${issueCount} open Teamwork issues`}>
                  {issueCount > 99 ? "99+" : issueCount}
                </span>
              ) : null}
            </span>
            <small>{item.shortLabel}</small>
          </Link>
        );
      })}
    </nav>
  );
}
