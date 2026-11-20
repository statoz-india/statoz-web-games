// node src/games/foot-duel/scripts/build-foot-duel.mjs
//   →  public/games/foot-duel/index.html
//
// The "pitch-duel" release is self-contained (fonts inlined, no shared engine runtime).
// The build makes two exact replacements, each of which must match once:
// - Sounds: it asks for "/games/pitch-duel/audio/"; this site serves it from "/games/foot-duel/".
// - Card crash: the release renders next/image's module object instead of its default export,
//   so every player card throws React error #130 (on the live site too). Drop this once a
//   fixed release ships. The portrait also loads unoptimized: its URL is the roster API's own
//   image, not a file on this site's image optimizer.
// - Portraits from the API: the card's portrait lookup reads the photo URLs the host saved from
//   the roster API ("foot-duel.portraits.v1", see starter-squad.ts) instead of the release's own
//   photo paths, which this site doesn't host. A card without one draws its built-in placeholder.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// SHA-256 of the "pitch-duel" release in the StatOz game-library catalogue.
const RELEASE_SHA256 = "e597a40ef9cb9a1398d00a1da5e5aaf4eac0991bc2f6825ac54fdb6410cf8a2b";
const PATCHES = [
  ['"/games/pitch-duel/audio/"', '"/games/foot-duel/audio/"'],
  ["(0,_.jsx)(kS.default,{src:up(p)", "(0,_.jsx)(kS.default.default||kS.default,{unoptimized:!0,src:up(p)"],
  [
    "function qi(e){return e.portraitSrc??Ch[e.id]??z5[e.id]}",
    'function qi(e){try{return JSON.parse(localStorage.getItem("foot-duel.portraits.v1")||"{}")[e.id]??null}catch{return null}}',
  ],
];

const source = await fs.readFile(path.join(process.cwd(), "src/games/foot-duel/bundle/index.html"));
const hash = crypto.createHash("sha256").update(source).digest("hex");
if (hash !== RELEASE_SHA256) {
  throw new Error("bundle/index.html does not match the published release. Update RELEASE_SHA256 when shipping a new release.");
}

let html = source.toString("utf8");
for (const [from, to] of PATCHES) {
  const found = html.split(from).length - 1;
  if (found !== 1) throw new Error(`Expected ${from} once in the bundle, found it ${found} times.`);
  html = html.replace(from, to);
}

await fs.mkdir("public/games/foot-duel", { recursive: true });
await fs.writeFile("public/games/foot-duel/index.html", html);

console.log(`foot-duel: ${(source.length / 1048576).toFixed(1)} MiB, release hash verified`);
