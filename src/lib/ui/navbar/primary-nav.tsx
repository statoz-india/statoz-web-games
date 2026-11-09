import Link from "next/link";

import { NAV_DESTINATIONS, type QueryReader } from "@/src/config/navigation";
import { NAV_ICONS } from "@/src/lib/ui/navbar/nav-icons";

import styles from "./css/navbar.module.css";

export type PrimaryNavProps = {
  pathname: string;
  query: QueryReader;
};

export function PrimaryNav({ pathname, query }: PrimaryNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={`flex items-center gap-2 ${styles.nav}`}
    >
      {NAV_DESTINATIONS.map((destination, index) => {
        const Icon = NAV_ICONS[destination.id];
        // Matches useNavShortcuts, which only handles keys 1–9.
        const shortcut = index < 9 ? String(index + 1) : undefined;
        return (
          <Link
            key={destination.id}
            href={destination.href}
            prefetch={false}
            aria-label={destination.label}
            title={
              shortcut
                ? `${destination.label} (${shortcut})`
                : destination.label
            }
            aria-keyshortcuts={shortcut}
            aria-current={
              destination.match(pathname, query) ? "page" : undefined
            }
            className={`relative isolate inline-flex min-h-touch min-w-touch items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap no-underline ${styles.command}`}
          >
            <Icon size={20} />
            <span className={styles.label}>{destination.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
