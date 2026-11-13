// node src/games/yorker/scripts/build-yorker.mjs
//   →  public/games/yorker/index.html
//   +  public/games/yorker/game-runtime/**    (shared engine, loaded by the bundle's import map)
//   +  public/games/yorker/engine-assets/**   (bowler model, fetched at runtime)
//
// Like Cricketer, this bundle is not self-contained: its module imports
// "@statoz/game-engine", which an inline import map resolves to /games/yorker/game-runtime/,
// and it fetches the bowler from /games/yorker/engine-assets/. Both must be served next to it.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/yorker/bundle");
// Manifest URLs are served paths; the files sit under bundle/.
const SERVED_PREFIX = "/games/yorker/";
const html = await fs.readFile(path.join(root, "index.html"), "utf8");

/** The bundle lists the runtime files it needs, with hashes. Check them before shipping. */
function dependencies(source) {
  const marker = '<script type="application/json" id="statoz-engine-dependencies">';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("The bundle has no engine-dependency manifest.");
  const from = start + marker.length;
  return JSON.parse(source.slice(from, source.indexOf("</script>", from)));
}

/** The engine asset catalog embedded in the bundle names each fetched file with its SHA-256. */
function engineAssets(source) {
  const assets = new Map();
  for (const [, url, hash] of source.matchAll(/"url":"(\/games\/yorker\/engine-assets\/[^"]+)","hash":"([0-9a-f]{64})"/g)) {
    assets.set(url, hash);
  }
  if (assets.size === 0) throw new Error("The bundle has no engine asset catalog.");
  return assets;
}

async function verify(url, hash, bytes) {
  if (!url.startsWith(SERVED_PREFIX)) throw new Error(`${url} is not under ${SERVED_PREFIX}.`);
  const buffer = await fs.readFile(path.join(root, url.slice(SERVED_PREFIX.length)));
  const actual = crypto.createHash("sha256").update(buffer).digest("hex");
  if (actual !== hash || (bytes !== undefined && buffer.length !== bytes)) {
    throw new Error(`${url} does not match the bundle's manifest.`);
  }
}

const { files } = dependencies(html);
for (const file of files) await verify(file.url, file.hash, file.bytes);
const assets = engineAssets(html);
for (const [url, hash] of assets) await verify(url, hash);

await fs.mkdir("public/games/yorker", { recursive: true });
await fs.writeFile("public/games/yorker/index.html", html);
for (const dir of ["game-runtime", "engine-assets"]) {
  await fs.rm(`public/games/yorker/${dir}`, { recursive: true, force: true });
  await fs.cp(path.join(root, dir), `public/games/yorker/${dir}`, { recursive: true });
}

console.log(`yorker: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);
console.log(`yorker: ${files.length} runtime files verified and copied`);
console.log(`yorker: ${assets.size} engine asset(s) verified and copied`);
