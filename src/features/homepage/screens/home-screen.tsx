import { BROWSE_SPORTS, HOME_GAMES } from "@/src/config/sports";

import { BeyondPlay } from "../components/beyond-play";
import { GamesBrowse } from "../components/games-browse";
import { HomeSpotlight } from "../components/home-spotlight";

// Playable games lead the spotlight; catalogue order is kept within each group.
const SPOTLIGHT_GAMES = [
  ...HOME_GAMES.filter((game) => !game.comingSoon),
  ...HOME_GAMES.filter((game) => game.comingSoon),
];

export function HomeScreen() {
  return (
    <HomeSpotlight games={SPOTLIGHT_GAMES}>
      <GamesBrowse sports={BROWSE_SPORTS} games={HOME_GAMES} />
      <BeyondPlay />
    </HomeSpotlight>
  );
}
