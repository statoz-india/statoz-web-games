// node src/games/vibe-basketball/scripts/build-vibe-basketball.mjs
//   →  public/games/vibe-basketball/index.html
//   +  public/games/vibe-basketball/game-runtime/**   (shared engine, loaded by the bundle's import map)
//   +  public/games/vibe-basketball/<release files>   (game.js, adapter.js, styles, font, models, licences)
//
// Unlike the single-file bundles, this release is a folder: index.html loads ./game.js and its
// styles, and the game fetches its athletes and contest props from ./models/. The catalogue only
// hashes index.html, so every other release file is pinned here to what the live release served.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/vibe-basketball/bundle");
const out = "public/games/vibe-basketball";
// Manifest URLs are served paths; the files sit under bundle/game-runtime/.
const SERVED_PREFIX = "/games/vibe-basketball/";
const RELEASE_FILES = {
  "LICENSES.txt": "283f477e05ad9e5234f7a922e5a489b43090a2e920d63e1cfe467b9e4bf0d3fa",
  "adapter.js": "88e341b135d082c35a38410d8f947e29b5ad29c5b248f6999fd3c27a7d3cd22d",
  "fonts/barlow-condensed-800.woff2": "8beab59bb49ab049063f8ffe199da96fc4c1ae44799eb4bb999ca7ee07d075bd",
  "game.js": "cbf6fbc421bfc020ad63f7dc8c2f3453c356b5ed7a89ec32e3dc645268080139",
  "mobile.css": "69ab29600104d024e648479b71582ae27f84ec42c4e29af97a6b05609e95c6d4",
  "models/athletes/athlete-female.glb": "df045e2d17337c752d2eacd42906392f80ce03485e0450b681142c070a44cb55",
  "models/athletes/athlete-male.glb": "2ca0ae44af23dd013ba90b6468b2ae503e7b891c739b93d03125cfc624ee6ca7",
  "models/athletes/basketball.glb": "ac712964722ff4c30b00351e3c19adcaf999c3432f93a0198e05b25c07c97b88",
  "models/athletes/eyes.webp": "b23f037171940e24500e1b1964c2db59c761088259ec96181b546045c276e870",
  "models/athletes/normal-female.webp": "ab87a77cd8e2b1cb8cb8382131b328d3d5514e3797fee64690726af2cc0a2395",
  "models/athletes/normal-male.webp": "fb2fb30706de5264558dbf9397f0d4d65f53e130deea399d4bea2e7cd616548d",
  "models/athletes/skin-female.webp": "81ebbe86253dd02c45ec4d9544e4a756d477d8e97034477a8fce92d9c8260684",
  "models/athletes/skin-male.webp": "952b133390544e0471ef244a57bdf297abf592f11c195223e8c0636d8819ee70",
  "models/contest/vibe-contest-props.glb": "6cb33aa27cd03d813ca1772ee1ae2065ade1eb73f5ddc1caf5248b4857b4baf9",
  "original.css": "da398405953af161bde6be633d7b84471f26a93367bb554691954dbf50982cd6",
  "presentation.css": "d75b84b6f0f6b0632a01125991c84954a1c86a99c984664af0fc2c1e1013eb01",
};
const html = await fs.readFile(path.join(root, "index.html"), "utf8");

/** The bundle lists the runtime files it needs, with hashes. Check them before shipping. */
function dependencies(source) {
  const marker = '<script type="application/json" id="statoz-engine-dependencies">';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("The bundle has no engine-dependency manifest.");
  const from = start + marker.length;
  return JSON.parse(source.slice(from, source.indexOf("</script>", from)));
}

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const { files } = dependencies(html);
for (const file of files) {
  if (!file.url.startsWith(SERVED_PREFIX)) throw new Error(`${file.url} is not under ${SERVED_PREFIX}.`);
  const buffer = await fs.readFile(path.join(root, file.url.slice(SERVED_PREFIX.length)));
  if (sha256(buffer) !== file.hash || buffer.length !== file.bytes) {
    throw new Error(`${file.url} does not match the bundle's manifest.`);
  }
}

for (const [file, hash] of Object.entries(RELEASE_FILES)) {
  if (sha256(await fs.readFile(path.join(root, file))) !== hash) throw new Error(`${file} does not match its pinned hash.`);
}

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "index.html"), html);
await fs.cp(path.join(root, "game-runtime"), path.join(out, "game-runtime"), { recursive: true });
for (const file of Object.keys(RELEASE_FILES)) {
  await fs.mkdir(path.dirname(path.join(out, file)), { recursive: true });
  await fs.copyFile(path.join(root, file), path.join(out, file));
}

console.log(`vibe-basketball: ${files.length} runtime files verified and copied`);
console.log(`vibe-basketball: ${Object.keys(RELEASE_FILES).length} release files verified and copied`);
