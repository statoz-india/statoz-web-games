import type { Metadata } from "next";
import localFont from "next/font/local";

import { COLOR_VARIABLES } from "@/src/styles/colors";
import { ELEVATION_VARIABLES } from "@/src/styles/elevations";
import { GRADIENT_VARIABLES } from "@/src/styles/gradients";
import { SHAPE_VARIABLES } from "@/src/styles/shape";
import { SPACING_VARIABLES } from "@/src/styles/spacing";
import { TYPOGRAPHY_VARIABLES } from "@/src/styles/typography";

import "./globals.css";

// Self-hosted so the loading screen's wordmark paints without a network fetch.
const orbitron = localFont({
  src: "./fonts/orbitron-latin-variable.woff2",
  variable: "--font-orbitron",
  weight: "400 900",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-variable.ttf",
  weight: "300 700",
  style: "normal",
  variable: "--font-space-grotesk",
  display: "swap",
});
export const metadata: Metadata = {
  title: "StatOz Games",
  description: "Gaming website for StatOz",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${spaceGrotesk.variable} h-full antialiased`}
      style={{
        ...COLOR_VARIABLES,
        ...TYPOGRAPHY_VARIABLES,
        ...SPACING_VARIABLES,
        ...SHAPE_VARIABLES,
        ...ELEVATION_VARIABLES,
        ...GRADIENT_VARIABLES,
      }}
    >
      <body className="min-h-full flex flex-col bg-page text-fg">
        {children}
      </body>
    </html>
  );
}
