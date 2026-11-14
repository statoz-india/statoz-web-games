// node src/games/rim-rush/scripts/build-rim-rush.mjs
//   →  public/games/rim-rush/index.html
//   +  public/games/rim-rush/game-runtime/**   (shared engine, loaded by the bundle's import map)
//   +  public/games/rim-rush/audio/**          (sound effects, fetched from "<assetRoot>audio/")
//
// Textures and fonts are inlined, but the engine and the seven sound effects are not,
// so they must be served next to the game. PROVENANCE.json records each sound's hash.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/rim-rush/bundle");
// Manifest URLs are served paths; the files sit under bundle/game-runtime/.
const SERVED_PREFIX = "/games/rim-rush/";
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

const { audio } = JSON.parse(await fs.readFile(path.join(root, "PROVENANCE.json"), "utf8"));
for (const sound of audio) {
  const buffer = await fs.readFile(path.join(root, sound.file));
  if (sha256(buffer) !== sound.sha256 || buffer.length !== sound.bytes) {
    throw new Error(`${sound.file} does not match PROVENANCE.json.`);
  }
}

await fs.mkdir("public/games/rim-rush", { recursive: true });
await fs.writeFile("public/games/rim-rush/index.html", html);
for (const dir of ["game-runtime", "audio"]) {
  await fs.rm(`public/games/rim-rush/${dir}`, { recursive: true, force: true });
  await fs.cp(path.join(root, dir), `public/games/rim-rush/${dir}`, { recursive: true });
}

console.log(`rim-rush: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);
console.log(`rim-rush: ${files.length} runtime files verified and copied`);
console.log(`rim-rush: ${audio.length} sounds verified and copied`);
