import type { ComponentType } from "react";

import type { NavDestinationId } from "@/src/config/navigation";

import { GamesIcon } from "../../icons/games.icon";
import { LeaderboardIcon } from "../../icons/leaderboard.icon";
import { LibraryIcon } from "../../icons/library.icon";
import { ShopIcon } from "../../icons/shop.icon";
import type { IconProps } from "../../icons/svg.icon";

// Kept out of src/config so the config stays free of UI components.
export const NAV_ICONS: Record<NavDestinationId, ComponentType<IconProps>> = {
  games: GamesIcon,
  library: LibraryIcon,
  shop: ShopIcon,
  leaderboard: LeaderboardIcon,
};
