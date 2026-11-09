import Link from "next/link";
import type { CSSProperties } from "react";

import type { QueryReader } from "@/src/config/navigation";
import { CoinIcon } from "@/src/lib/icons/coin.icon";
import { FlameIcon } from "@/src/lib/icons/flame.icon";
import { PlusIcon } from "@/src/lib/icons/plus.icon";

import styles from "./css/navbar.module.css";

export type PlayerSummary = {
  name: string;
  level: number;
  /** Ring colour from the player's equipped frame. */
  frameColor?: string;
};

export type UtilityTrayProps = {
  /** Undefined until known; shows "—". */
  streak?: number;
  /** Undefined until known; shows "—". */
  coins?: number;
  /** Undefined shows a guest avatar. */
  player?: PlayerSummary;
};

// Fixed locale: server and client must format identically or hydration fails.
const INT_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const PLACEHOLDER = "—";
const FOCUS_RING =
  "focus-visible:outline-(length:--shape-stroke-regular) focus-visible:outline-offset-(--shape-focus-offset-default) focus-visible:outline-cyan";
// tabular-nums keeps the width steady as the numbers change.
const STAT_CLASS = `inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg border-(length:--shape-stroke-hairline) border-line bg-fg/4 text-sm font-bold text-fg tabular-nums whitespace-nowrap no-underline transition-colors hover:border-line-strong hover:bg-fg/7 motion-reduce:transition-none ${FOCUS_RING} ${styles.stat}`;

function formatInt(value: number) {
  return INT_FORMAT.format(value);
}

// Inside the shop, keep the sport filter when jumping to the coins tab.
function coinsHref(pathname: string, query: QueryReader) {
  const params = new URLSearchParams({ tab: "coins" });
  const sport = pathname.startsWith("/shop") ? query.get("sport") : null;
  if (sport) params.set("sport", sport);
  return `/shop?${params}`;
}

export function UtilityTray({
  streak,
  coins,
  player,
  pathname,
  query,
}: UtilityTrayProps & { pathname: string; query: QueryReader }) {
  const avatarStyle = player?.frameColor
    ? ({ "--frame": player.frameColor } as CSSProperties)
    : undefined;

  return (
    <div className="flex items-center gap-2 justify-self-end">
      <Link
        href="/streaks"
        className={STAT_CLASS}
        aria-label={
          streak === undefined
            ? "Daily streak"
            : `Daily streak: ${formatInt(streak)} days`
        }
      >
        <span className="inline-flex text-flame">
          <FlameIcon size={20} />
        </span>
        <span>{streak === undefined ? PLACEHOLDER : formatInt(streak)}</span>
      </Link>

      <Link
        href={coinsHref(pathname, query)}
        className={STAT_CLASS}
        aria-label={
          coins === undefined
            ? "Oz Coins. Add coins"
            : `${formatInt(coins)} Oz Coins. Add coins`
        }
      >
        <span className="inline-flex text-gold">
          <CoinIcon size={20} />
        </span>
        <span>{coins === undefined ? PLACEHOLDER : formatInt(coins)}</span>
        <span
          className={`size-5 place-items-center rounded-sm bg-cyan text-page ${styles.add}`}
        >
          <PlusIcon />
        </span>
      </Link>

      <Link
        href="/profile"
        className={`group inline-grid size-touch place-items-center rounded-full no-underline ${FOCUS_RING}`}
        aria-label={
          player
            ? `${player.name}, level ${player.level}. Open profile`
            : "Guest. Open profile"
        }
        aria-current={pathname.startsWith("/profile") ? "page" : undefined}
      >
        <span
          className="grid size-9 place-items-center rounded-full bg-(image:--gradient-avatar-default) font-display text-sm font-extrabold text-fg ring-(length:--shape-stroke-regular) ring-[color:var(--frame,var(--color-line-strong))] group-aria-[current=page]:bg-(image:--gradient-avatar-active) group-aria-[current=page]:ring-violet"
          style={avatarStyle}
          aria-hidden="true"
        >
          {(player?.name.trim()[0] ?? "G").toUpperCase()}
        </span>
      </Link>
    </div>
  );
}
