import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const BUCKET = "h-droid-repo";
const MANIFEST = ".tmp/uploaded.json";
const CONCURRENCY = 4;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const manifest = await readFile(MANIFEST, "utf8").then(JSON.parse, () => ({}));
const pending = [];
for await (const file of walk("repo")) {
  const hash = createHash("sha256").update(await readFile(file)).digest("hex");
  if (manifest[file] !== hash) pending.push({ file, hash });
}

console.log(`${pending.length} file(s) to upload`);
const queue = [...pending];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let item; (item = queue.shift()); ) {
      await run("pnpm", [
        "exec", "wrangler", "r2", "object", "put",
        `${BUCKET}/${relative(".", item.file)}`,
        "--file", item.file, "--remote",
      ]);
      manifest[item.file] = item.hash;
      console.log(`uploaded ${item.file}`);
    }
  }),
);

await mkdir(".tmp", { recursive: true });
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
