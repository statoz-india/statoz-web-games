import type { ComponentProps } from "react";

import { PlayIcon } from "@/src/lib/icons/play.icon";

import styles from "./css/play-button.module.css";

type PlayButtonProps = Omit<
  ComponentProps<"button">,
  "children" | "className" | "type"
>;

/** Chamfered glass PLAY plate: ▶ icon, Orbitron label and slanted bars. */
export function PlayButton(props: PlayButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`relative inline-flex items-center justify-center gap-3 ${styles["play-button"]}`}
    >
      <span aria-hidden="true" className={`absolute ${styles.fill}`} />
      <span
        aria-hidden="true"
        className={`relative grid shrink-0 place-items-center ${styles.icon}`}
      >
        <PlayIcon />
      </span>
      <span className={`relative ${styles.label}`}>PLAY</span>
      <span aria-hidden="true" className={`relative inline-flex ${styles.bars}`}>
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}
