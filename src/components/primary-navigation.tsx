"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Company Overview", shortLabel: "At a glance" },
  { href: "/profit-forecast", label: "Profit Forecast", shortLabel: "Expected outcome" },
  { href: "/revenue-trends", label: "Revenue Trends", shortLabel: "History over time" },
  { href: "/operational-performance", label: "Operational Performance", shortLabel: "By work group" },
  { href: "/projects", label: "All Projects", shortLabel: "Search, compare & combine" },
  { href: "/time-reporting", label: "Time & Payroll", shortLabel: "Utilization & PTO" },
  { href: "/hosting", label: "Hosting", shortLabel: "Revenue & costs" },
  { href: "/help", label: "Guide", shortLabel: "Reference" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNavigation({ issueCount = 0 }: { issueCount?: number }) {
  const pathname = usePathname();

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
              {item.href === "/help" && issueCount > 0 ? (
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
