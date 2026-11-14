"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { track, type TrackParams } from "./track";

type TrackedLinkProps = ComponentProps<typeof Link> & { event: string; params?: TrackParams };

/** A next/link that sends an event on click, for links rendered by server components. */
export function TrackedLink({ event, params, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(clickEvent) => {
        track(event, params);
        onClick?.(clickEvent);
      }}
    />
  );
}
