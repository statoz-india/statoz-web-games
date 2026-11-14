// node src/games/racer/scripts/build-racer.mjs
//   →  public/games/racer/index.html
//   +  public/games/racer/game-runtime/**   (shared engine, loaded by the bundle's import map)
//   +  public/games/racer/kenney/**         (car kit model and three sounds, fetched at runtime)
//
// The release ("f1-racing" in the catalogue) loads "<assetRoot>kenney/racer-kit.glb" and
// "<assetRoot>kenney/audio/<name>.ogg". The live site serves them from game-library/games/f1-racing/,
// and nothing in the bundle hashes them, so they are pinned here to what that folder served.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/racer/bundle");
const out = "public/games/racer";
// Manifest URLs are served paths; the files sit under bundle/game-runtime/.
const SERVED_PREFIX = "/games/racer/";
const KENNEY_FILES = {
  "License.txt": "c33b7f6453d134deae7b1b8493717d9ccfa754c25ab97f6de89b88f8fda19b00",
  "audio/engine.ogg": "6d665dfc961e2d522c866bdcf12fc0ac56c885c0c7117e830df84ba8eecd655c",
  "audio/impact.ogg": "964c5fcfb91e7710e2af25c2243c8b7160756b223b0984bacc9eb25bfeea057b",
  "audio/skid.ogg": "e62a42c0a4af29ed69b37cfc80d088a6808c59f8f725285ebcc3f409267965a0",
  "racer-kit.glb": "5c909b5df02ba6a8eede6238a8e12e1fc2b96507135348b0eb0a096ae609bc66",
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

for (const [file, hash] of Object.entries(KENNEY_FILES)) {
  if (sha256(await fs.readFile(path.join(root, "kenney", file))) !== hash) {
    throw new Error(`kenney/${file} does not match its pinned hash.`);
  }
}

await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "index.html"), html);
for (const dir of ["game-runtime", "kenney"]) {
  await fs.rm(path.join(out, dir), { recursive: true, force: true });
  await fs.cp(path.join(root, dir), path.join(out, dir), { recursive: true });
}

console.log(`racer: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);
console.log(`racer: ${files.length} runtime files verified and copied`);
console.log(`racer: ${Object.keys(KENNEY_FILES).length} Kenney files verified and copied`);
