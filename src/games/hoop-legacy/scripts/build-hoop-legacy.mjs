// node src/games/hoop-legacy/scripts/build-hoop-legacy.mjs
//   →  public/games/hoop-legacy/index.html
//   +  public/games/hoop-legacy/game-runtime/**   (shared engine, loaded by the bundle's import map)
//   +  public/games/hoop-legacy/assets/**         (athlete models, fetched from "./assets/athletes-v2/")
//
// Like Formula, this bundle is not self-contained: its module imports
// "@statoz/game-engine", which an inline import map resolves to /games/hoop-legacy/game-runtime/.
// It also streams its 3D athletes at runtime. All of it must be served next to the game.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/hoop-legacy/bundle");
// Manifest URLs are served paths; the files sit under bundle/game-runtime/.
const SERVED_PREFIX = "/games/hoop-legacy/";
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

/** Every hashed file the athlete manifest names, wherever it sits in the tree. */
function athleteFiles(node, out = []) {
  if (Array.isArray(node)) node.forEach(child => athleteFiles(child, out));
  else if (node && typeof node === "object") {
    if (typeof node.file === "string" && typeof node.sha256 === "string") out.push(node);
    Object.values(node).forEach(child => athleteFiles(child, out));
  }
  return out;
}

const athletesRoot = path.join(root, "assets/athletes-v2");
const athletes = athleteFiles(JSON.parse(await fs.readFile(path.join(athletesRoot, "manifest.json"), "utf8")));
for (const file of athletes) {
  const buffer = await fs.readFile(path.join(athletesRoot, file.file));
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (hash !== file.sha256) throw new Error(`assets/athletes-v2/${file.file} does not match its manifest.`);
}

await fs.mkdir("public/games/hoop-legacy", { recursive: true });
await fs.writeFile("public/games/hoop-legacy/index.html", html);
for (const dir of ["game-runtime", "assets"]) {
  await fs.rm(`public/games/hoop-legacy/${dir}`, { recursive: true, force: true });
  await fs.cp(path.join(root, dir), `public/games/hoop-legacy/${dir}`, { recursive: true });
}

console.log(`hoop-legacy: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);
console.log(`hoop-legacy: ${files.length} runtime files verified and copied`);
console.log(`hoop-legacy: ${athletes.length} athlete assets verified and copied`);
