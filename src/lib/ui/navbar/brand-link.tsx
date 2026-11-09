import Image from "next/image";
import Link from "next/link";

import { IMAGES } from "@/src/config/image";

import styles from "./css/navbar.module.css";

export function BrandLink() {
  return (
    <Link
      href="/"
      aria-label="StatOz home"
      className="inline-flex min-h-touch min-w-touch items-center gap-2.5 justify-self-start rounded-sm text-fg no-underline focus-visible:outline-(length:--shape-stroke-regular) focus-visible:outline-offset-(--shape-focus-offset-default) focus-visible:outline-cyan"
    >
      <Image
        src={IMAGES.appLogo}
        alt=""
        width={30}
        height={30}
        preload
        className="shrink-0"
      />
      <span
        className={`flex flex-col font-display leading-none font-black tracking-brand max-[760px]:hidden ${styles.wordmark}`}
      >
        StatOz
        <small
          className={`mt-1.25 text-micro font-bold tracking-sub text-cyan ${styles.sub}`}
        >
          GAMES
        </small>
      </span>
    </Link>
  );
}
