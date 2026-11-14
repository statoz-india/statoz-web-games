"use client";

import { useEffect } from "react";

import { track, type TrackParams } from "./track";

/** Sends one event when it mounts, so server components can report a view. */
export function TrackOnMount({ event, params }: { event: string; params?: TrackParams }) {
  useEffect(() => {
    track(event, params);
  }, [event, params]);
  return null;
}
