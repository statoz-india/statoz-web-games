import Image from "next/image";
import Link from "next/link";

import { ImagePlayButton } from "@/src/lib/components/buttons/image-play-button";
import { ComingSoonTag } from "@/src/lib/components/coming-soon-tag";
import { ClockIcon } from "@/src/lib/icons/clock.icon";

import styles from "./css/game-cover-card.module.css";

type GameCoverCardProps = {
  id: string;
  title: string;
  /** 3:2 image. */
  cover: string;
  sportLabel: string;
  /** Without one the card is a button with no action, until the game has a route. */
  href?: string;
  /** Shows the clock mark next to the title. */
  recent?: boolean;
  /** Not playable yet: a "Coming soon" tag replaces the PLAY chip. */
  comingSoon?: boolean;
};

/**
 * Chamfered 3:2 cover with title and sport. Carries data-game-cover, so a list
 * of them can use moveCoverFocus for arrow-key navigation.
 */
export function GameCoverCard({
  id,
  title,
  cover,
  sportLabel,
  href,
  recent = false,
  comingSoon = false,
}: GameCoverCardProps) {
  const shared = {
    "data-game-cover": id,
    "aria-label": comingSoon ? `${title}, coming soon` : `Play ${title}`,
    className: `block w-full min-w-0 text-left ${styles.card}`,
  };
  const body = (
    <>
      <span className={`relative block ${styles.frame}`}>
        <span className={`relative block overflow-hidden ${styles.image}`}>
          <Image src={cover} alt="" fill sizes="13rem" className="object-cover" />
          {comingSoon ? (
            <ComingSoonTag className={`absolute ${styles.soon}`} />
          ) : (
            <ImagePlayButton className={`absolute ${styles.play}`} />
          )}
        </span>
      </span>
      <span className={`flex items-baseline gap-1.5 ${styles.caption}`}>
        <span className={`min-w-0 flex-1 truncate ${styles.title}`}>
          {title}
        </span>
        {recent && (
          <span
            role="img"
            aria-label="Recently played"
            title="Recently played"
            className={`inline-flex flex-none items-center ${styles.recent}`}
          >
            <ClockIcon />
          </span>
        )}
      </span>
      <span className={`block ${styles.sport}`}>{sportLabel}</span>
    </>
  );

  return href ? (
    <Link href={href} {...shared}>
      {body}
    </Link>
  ) : (
    <button type="button" {...shared}>
      {body}
    </button>
  );
}
