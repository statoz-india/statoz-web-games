import { Suspense } from "react";

import { AppLoading } from "@/src/lib/ui/loading";
import { Navbar } from "@/src/lib/ui/navbar/navbar";

// Suspense: the navbar reads useSearchParams(), which needs a boundary.
export default function WithNavbarLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppLoading label="Opening StatOz" />}>
      <div className="flex min-h-dvh flex-1 flex-col bg-(image:--gradient-app) text-fg">
        {/* Off-screen until focused, so keyboard users can jump past the navbar. */}
        <a
          href="#main-content"
          className="absolute top-2 left-2 z-skip-link -translate-y-[calc(100%+var(--spacing)*4)] rounded-md bg-cyan px-4 py-2.5 font-bold text-page no-underline focus:translate-y-0 focus:outline-(length:--shape-stroke-regular) focus:outline-offset-(--shape-focus-offset-default) focus:outline-fg"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
      </div>
    </Suspense>
  );
}
