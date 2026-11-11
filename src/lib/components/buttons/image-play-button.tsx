import { PlayChipIcon } from "@/src/lib/icons/playChip.icon";

import styles from "./css/image-play-button.module.css";

type ImagePlayButtonProps = {
  className?: string;
};

export function ImagePlayButton({ className = "" }: ImagePlayButtonProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center ${styles["image-play-button"]} ${className}`}
    >
      <PlayChipIcon />
      <span>PLAY</span>
    </span>
  );
}
