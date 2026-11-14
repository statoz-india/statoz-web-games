import Link from "next/link";
import type { ComponentProps } from "react";

import { PlayIcon } from "@/src/lib/icons/play.icon";

import styles from "./css/play-button.module.css";

type PlayButtonProps = Omit<
  ComponentProps<"button">,
  "children" | "className" | "type" | "onClick"
> & {
  /** Renders a link to this URL instead of a button. */
  href?: string;
  /** Runs for the link and the button alike. */
  onClick?: () => void;
};

/** Chamfered glass PLAY plate: ▶ icon, Orbitron label and slanted bars. */
export function PlayButton({ href, onClick, ...props }: PlayButtonProps) {
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
    <Link href={href} aria-label={props["aria-label"]} onClick={onClick} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" {...props} onClick={onClick} className={className}>
      {body}
    </button>
  );
}
