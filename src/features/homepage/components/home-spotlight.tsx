"use client";

import { useRef, useState } from "react";

import { PlayButton } from "@/src/lib/components/buttons/play-button";
import { PauseIcon } from "@/src/lib/icons/pause.icon";
import { PlayIcon } from "@/src/lib/icons/play.icon";

import type { HomeGame } from "../data/home-game";
import { AmbientBackdrop } from "./ambient-backdrop";
import { COVER_SELECTOR, CoverRail } from "./cover-rail";
import styles from "./css/home-spotlight.module.css";
import { SpotlightArtwork } from "./spotlight-artwork";
import { useIdleRotation } from "./use-idle-rotation";
import { useInView, useTabVisible } from "./use-visibility";

/** Smoothly centres the card in the rail when it isn't fully in view. */
function revealCard(rail: HTMLElement | null, index: number) {
  const card = rail?.querySelectorAll<HTMLElement>(COVER_SELECTOR)[index];
  if (!rail || !card) return;
  const railBox = rail.getBoundingClientRect();
  const cardBox = card.getBoundingClientRect();
  if (cardBox.left >= railBox.left && cardBox.right <= railBox.right) return;
  rail.scrollTo({
    left:
      rail.scrollLeft +
      cardBox.left -
      railBox.left -
      (railBox.width - cardBox.width) / 2,
    behavior: "smooth",
  });
}

export function HomeSpotlight({ games }: { games: readonly HomeGame[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const openingRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLUListElement>(null);
  const heroVisible = useInView(openingRef);
  const tabVisible = useTabVisible();

  useIdleRotation(heroVisible && !paused, () => {
    const next = (activeIndex + 1) % games.length;
    setActiveIndex(next);
    revealCard(railRef.current, next);
  });

  const game = games[activeIndex];
  if (!game) return null;

  return (
    <div
      data-motion-paused={paused}
      className={`relative isolate min-w-0 ${styles.dashboard}`}
    >
      <AmbientBackdrop />

      <section
        ref={openingRef}
        aria-label="Game spotlight"
        className={`relative isolate ${styles.opening}`}
      >
        <SpotlightArtwork
          art={{ src: game.spotlight ?? game.cover, position: game.position }}
          video={game.video}
          videoActive={heroVisible && tabVisible && !paused}
        />

        <button
          type="button"
          aria-label={
            paused ? "Play background motion" : "Pause background motion"
          }
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
          className={`absolute z-3 grid size-touch place-items-center ${styles["motion-control"]}`}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>

        <div
          className={`relative mx-auto flex items-center ${styles.hero}`}
        >
          {/* Keyed so copy-in replays for each game. */}
          <div key={game.id} className={styles["hero-copy"]}>
            <p className={`items-center gap-2 ${styles.eyebrow}`}>
              <span className={`size-[5px] ${styles["live-dot"]}`} />
              YOUR NEXT GREAT GAME
            </p>
            <h1 className={styles.title}>{game.title}</h1>
            <p className={styles.description}>{game.subtitle}</p>
            <div className={`flex items-center ${styles["hero-actions"]}`}>
              {/* No action until game routes exist. */}
              <PlayButton aria-label={`Play ${game.title}`} />
              <button
                type="button"
                className={`min-h-touch ${styles["hero-browse"]}`}
              >
                Explore {game.sport} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </div>

        <CoverRail
          games={games}
          activeIndex={activeIndex}
          onActivate={setActiveIndex}
          railRef={railRef}
        />
      </section>
    </div>
  );
}
