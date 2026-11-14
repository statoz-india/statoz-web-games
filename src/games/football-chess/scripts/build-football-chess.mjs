// node src/games/football-chess/scripts/build-football-chess.mjs
//   →  public/games/football-chess/index.html
//
// Like Rally Dash, this bundle is self-contained (no shared engine runtime; fonts inlined),
// so the build only checks it is the published release and copies it.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// SHA-256 of the "football-chess" release in the StatOz game-library catalogue.
const RELEASE_SHA256 = "06f124ea4fc5c35ed0d1a4a451919baa498de24a6db28b8a32848589d9d743ac";

const html = await fs.readFile(path.join(process.cwd(), "src/games/football-chess/bundle/index.html"));
const hash = crypto.createHash("sha256").update(html).digest("hex");
if (hash !== RELEASE_SHA256) {
  throw new Error("bundle/index.html does not match the published release. Update RELEASE_SHA256 when shipping a new release.");
}

await fs.mkdir("public/games/football-chess", { recursive: true });
await fs.writeFile("public/games/football-chess/index.html", html);

console.log(`football-chess: ${(html.length / 1048576).toFixed(1)} MiB, release hash verified`);
