// node src/games/pitch-rush/scripts/build-pitch-rush.mjs
//   →  public/games/pitch-rush/index.html
//   +  public/games/pitch-rush/game-runtime/**   (shared engine, loaded by the bundle's import map)
//
// Like Longbow, this bundle is not self-contained: its module imports "@statoz/game-engine"
// (core, audio and the 2D renderer), which an inline import map resolves to
// /games/pitch-rush/game-runtime/. Those files must be served next to the game, so the build
// copies both. The 2D renderer adds 23 files the 3D games don't use.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/pitch-rush/bundle");
// Manifest URLs are served paths; the files sit under bundle/game-runtime/.
const SERVED_PREFIX = "/games/pitch-rush/";
const html = await fs.readFile(path.join(root, "index.html"), "utf8");

/** The bundle lists the runtime files it needs, with hashes. Check them before shipping. */
function dependencies(source) {
  const marker = '<script type="application/json" id="statoz-engine-dependencies">';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("The bundle has no engine-dependency manifest.");
  const from = start + marker.length;
  return JSON.parse(source.slice(from, source.indexOf("</script>", from)));
}

const { files } = dependencies(html);
for (const file of files) {
  if (!file.url.startsWith(SERVED_PREFIX)) throw new Error(`${file.url} is not under ${SERVED_PREFIX}.`);
  const buffer = await fs.readFile(path.join(root, file.url.slice(SERVED_PREFIX.length)));
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (hash !== file.hash || buffer.length !== file.bytes) {
    throw new Error(`${file.url} does not match the bundle's manifest.`);
  }
}

await fs.mkdir("public/games/pitch-rush", { recursive: true });
await fs.writeFile("public/games/pitch-rush/index.html", html);
await fs.rm("public/games/pitch-rush/game-runtime", { recursive: true, force: true });
await fs.cp(path.join(root, "game-runtime"), "public/games/pitch-rush/game-runtime", { recursive: true });

console.log(`pitch-rush: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);
console.log(`pitch-rush: ${files.length} runtime files verified and copied`);
