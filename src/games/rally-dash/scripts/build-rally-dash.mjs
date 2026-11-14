// node src/games/rally-dash/scripts/build-rally-dash.mjs
//   →  public/games/rally-dash/index.html
//
// Like Mini Golf, this bundle is self-contained (no shared engine runtime, no asset folder),
// so the build only checks it is the published release and copies it.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// SHA-256 of the "grand-prix-dash" release in the StatOz game-library catalogue.
const RELEASE_SHA256 = "098cf9af5de78a834876f721c4b7a5450a94224ad0cf85549a921052f2b7d72b";

const html = await fs.readFile(path.join(process.cwd(), "src/games/rally-dash/bundle/index.html"));
const hash = crypto.createHash("sha256").update(html).digest("hex");
if (hash !== RELEASE_SHA256) {
  throw new Error("bundle/index.html does not match the published release. Update RELEASE_SHA256 when shipping a new release.");
}

await fs.mkdir("public/games/rally-dash", { recursive: true });
await fs.writeFile("public/games/rally-dash/index.html", html);

console.log(`rally-dash: ${(html.length / 1048576).toFixed(1)} MiB, release hash verified`);
