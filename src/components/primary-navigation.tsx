"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Portfolio", shortLabel: "Overview" },
  { href: "/projects", label: "Projects", shortLabel: "Compare & combine" },
  { href: "/time-reporting", label: "Time Reporting", shortLabel: "Utilization & PTO" },
  { href: "/help", label: "Guide", shortLabel: "Reference" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNavigation() {
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
            <span>{item.label}</span>
            <small>{item.shortLabel}</small>
          </Link>
        );
      })}
    </nav>
  );
}
