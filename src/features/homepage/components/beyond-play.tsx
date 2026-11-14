import type { ReactNode } from "react";

import { TrackedLink } from "@/src/lib/analytics/tracked-link";
import { ChestIcon } from "@/src/lib/icons/chest.icon";
import { CollectionsBookmarkIcon } from "@/src/lib/icons/collectionsBookmark.icon";
import { GridViewIcon } from "@/src/lib/icons/gridView.icon";
import { PodiumIcon } from "@/src/lib/icons/podium.icon";

import styles from "./css/beyond-play.module.css";

const SHORTCUT_CLASS = `relative flex flex-wrap content-center items-center gap-4 text-left no-underline ${styles.shortcut}`;

type ShortcutProps = {
  icon: ReactNode;
  title: string;
  text: string;
  href?: string;
  /** GA `destination` for a shortcut with a link. */
  destination?: string;
};

function Shortcut({ icon, title, text, href, destination }: ShortcutProps) {
  const body = (
    <>
      <span className={`flex-none ${styles.icon}`}>{icon}</span>
      <span className="min-w-[100px] flex-1">
        <b className={`block ${styles["shortcut-title"]}`}>{title}</b>
        <small className={`mt-1.5 block ${styles["shortcut-text"]}`}>
          {text}
        </small>
      </span>
      <span aria-hidden="true" className={`ml-auto ${styles.arrow}`}>
        ↗
      </span>
    </>
  );

  return href ? (
    <TrackedLink
      href={href}
      prefetch={false}
      event="web_game_shortcut_click"
      params={destination ? { destination } : undefined}
      className={SHORTCUT_CLASS}
    >
      {body}
    </TrackedLink>
  ) : (
    <button type="button" className={SHORTCUT_CLASS}>
      {body}
    </button>
  );
}

/** Closing section: shortcuts to the rest of StatOz, then the footer. */
export function BeyondPlay() {
  return (
    <div className={`mx-auto ${styles.content}`}>
      <section aria-label="More from StatOz" className={styles.more}>
        <div className="mb-4">
          <span className={`mb-1.5 block ${styles.kicker}`}>
            THERE’S MORE TO YOUR GAME
          </span>
          <h2 className={styles["heading-title"]}>Beyond the play button</h2>
        </div>

        <div className={`grid ${styles.shortcuts}`}>
          <Shortcut
            icon={<GridViewIcon size={29} />}
            title="Game Library"
            text="Your entire arcade, one place."
            href="/library"
            destination="library"
          />
          <Shortcut
            icon={<PodiumIcon />}
            title="Leaderboard"
            text="See where you stand."
            href="/leaderboard"
            destination="leaderboard"
          />
          <Shortcut
            icon={<CollectionsBookmarkIcon />}
            title="Your Collection"
            text="Build a lineup of your own."
          />
          <Shortcut
            icon={<ChestIcon />}
            title="StatOz Shop"
            text="Find your next signature look."
            href="/shop"
            destination="shop"
          />
        </div>
      </section>

      <footer className={`flex justify-between gap-4 ${styles.footer}`}>
        <span className={styles.brand}>
          STATOZ <b>GAMES</b>
        </span>
        <span>Play. Collect. Climb.</span>
      </footer>
    </div>
  );
}
