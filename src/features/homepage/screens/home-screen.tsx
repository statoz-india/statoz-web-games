import { BROWSE_SPORTS, HOME_GAMES } from "@/src/config/sports";

import { BeyondPlay } from "../components/beyond-play";
import { GamesBrowse } from "../components/games-browse";
import { HomeSpotlight } from "../components/home-spotlight";

export function HomeScreen() {
  return (
    <HomeSpotlight games={HOME_GAMES}>
      <GamesBrowse sports={BROWSE_SPORTS} games={HOME_GAMES} />
      <BeyondPlay />
    </HomeSpotlight>
  );
}
