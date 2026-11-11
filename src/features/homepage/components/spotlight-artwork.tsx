"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import styles from "./css/home-spotlight.module.css";

const VIDEO_PLAYS = 2;

type Art = { src: string; position: string };

type SpotlightArtworkProps = {
  art: Art;
  video?: string;
  /** Hero on screen, tab visible and motion not paused. */
  videoActive: boolean;
};

export function SpotlightArtwork({
  art,
  video,
  videoActive,
}: SpotlightArtworkProps) {
  // The image on show; a different `art` is layered above it until it fades in.
  const [shown, setShown] = useState(art);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const layers = shown.src === art.src ? [shown] : [shown, art];

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 -z-1 overflow-hidden ${styles.artwork}`}
    >
      {layers.map((layer, index) => (
        <Image
          key={layer.src}
          src={layer.src}
          alt=""
          fill
          sizes="100vw"
          preload={index === 0}
          className={`object-cover ${styles["art-enter"]}`}
          style={{ objectPosition: layer.position }}
          data-pending={
            (layer.src !== shown.src && loadedSrc !== layer.src) || undefined
          }
          onLoad={() => setLoadedSrc(layer.src)}
          onAnimationEnd={() => setShown(layer)}
        />
      ))}
      {video && (
        <SpotlightVideo key={video} src={video} active={videoActive} />
      )}
      <div className={`absolute inset-0 ${styles["art-veil"]}`} />
      <div className={`absolute inset-0 ${styles["art-grid"]}`} />
    </div>
  );
}

/** Plays twice while active, then fades back to the still artwork. */
function SpotlightVideo({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const plays = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    // CSS hides the video under reduced motion, so don't download or play it.
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (active && !finished && !reduced) video.play().catch(() => {});
    else video.pause();
  }, [active, finished]);

  const onEnded = () => {
    plays.current += 1;
    if (plays.current < VIDEO_PLAYS) ref.current?.play().catch(() => {});
    else setFinished(true);
  };

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full object-cover ${styles["gameplay-video"]}`}
      data-playing={(playing && !finished) || undefined}
      onPlaying={() => setPlaying(true)}
      onEnded={onEnded}
    />
  );
}
