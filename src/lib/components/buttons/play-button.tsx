import Link from "next/link";
import type { ComponentProps } from "react";

import { PlayIcon } from "@/src/lib/icons/play.icon";

import styles from "./css/play-button.module.css";

type PlayButtonProps = Omit<
  ComponentProps<"button">,
  "children" | "className" | "type"
> & {
  /** Renders a link to this URL instead of a button. */
  href?: string;
};

/** Chamfered glass PLAY plate: ▶ icon, Orbitron label and slanted bars. */
export function PlayButton({ href, ...props }: PlayButtonProps) {
  const className = `relative inline-flex items-center justify-center gap-3 ${styles["play-button"]}`;
  const body = (
    <>
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
    </>
  );

  return href ? (
    <Link href={href} aria-label={props["aria-label"]} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" {...props} className={className}>
      {body}
    </button>
  );
}
