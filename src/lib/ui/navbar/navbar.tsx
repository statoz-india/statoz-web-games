"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { BrandLink } from "./brand-link";
import styles from "./css/navbar.module.css";
import { PrimaryNav } from "./primary-nav";
import { useNavShortcuts } from "./use-nav-shortcuts";

/** Must render inside <Suspense>: it reads useSearchParams(). */
export function Navbar() {
  const pathname = usePathname();
  const query = useSearchParams();
  useNavShortcuts();

  return (
    <header
      className={`sticky top-0 z-nav items-center border-b-(length:--shape-stroke-hairline) border-line bg-page/94 text-fg backdrop-blur-glass ${styles.bar}`}
    >
      <BrandLink />
      <PrimaryNav pathname={pathname} query={query} />
      {/*not required for now */}
      {/* <UtilityTray {...props} pathname={pathname} query={query} /> */}
    </header>
  );
}
