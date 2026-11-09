// Matches both URLSearchParams and Next's read-only version.
export type QueryReader = {
  get(name: string): string | null;
  toString(): string;
};

export type NavDestinationId = "games" | "library" | "shop" | "leaderboard";

export type NavDestination = {
  id: NavDestinationId;
  label: string;
  href: string;
  match: (pathname: string, query: QueryReader) => boolean;
};

// One list drives the tabs and the number-key shortcuts, so they can't drift.
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    id: "games",
    label: "Games",
    href: "/",
    match: (pathname) => pathname === "/" || pathname.startsWith("/games/"),
  },
  {
    id: "library",
    label: "Library",
    href: "/library",
    match: (pathname) => pathname.startsWith("/library"),
  },
  {
    id: "shop",
    label: "Shop",
    href: "/shop",
    match: (pathname) => pathname.startsWith("/shop"),
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    href: "/leaderboard",
    match: (pathname) => pathname.startsWith("/leaderboard"),
  },
];
