// node src/games/formula/scripts/build-formula.mjs
//   →  public/games/formula/index.html
//   +  public/games/formula/game-runtime/**   (shared engine, loaded by the bundle's import map)
//
// Like Cricketer, this bundle is not self-contained: its module imports
// "@statoz/game-engine", which an inline import map resolves to /games/formula/game-runtime/.
// Those files must be served next to the game, so the build copies both.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/formula/bundle");
// Manifest URLs are served paths; the files sit under bundle/game-runtime/.
const SERVED_PREFIX = "/games/formula/";
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

await fs.mkdir("public/games/formula", { recursive: true });
await fs.writeFile("public/games/formula/index.html", html);
await fs.rm("public/games/formula/game-runtime", { recursive: true, force: true });
await fs.cp(path.join(root, "game-runtime"), "public/games/formula/game-runtime", { recursive: true });

console.log(`formula: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);
console.log(`formula: ${files.length} runtime files verified and copied`);
