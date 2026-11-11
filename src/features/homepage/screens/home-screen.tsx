import { HOME_GAMES } from "@/src/config/sports";

import { HomeSpotlight } from "../components/home-spotlight";

export function HomeScreen() {
  return <HomeSpotlight games={HOME_GAMES} />;
}
