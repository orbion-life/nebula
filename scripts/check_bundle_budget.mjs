import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const assets = "dist/assets";
const initial = readdirSync(assets).filter((name) => /^index-.*\.js$/.test(name));
if (initial.length !== 1) {
  throw new Error(`Expected one initial index chunk, found ${initial.length}: ${initial.join(", ")}`);
}
const file = join(assets, initial[0]);
const raw = readFileSync(file);
const gzip = gzipSync(raw);
const rawLimit = 350 * 1024;
const gzipLimit = 120 * 1024;
if (raw.length > rawLimit || gzip.length > gzipLimit) {
  throw new Error(
    `Initial bundle exceeds budget: ${(raw.length / 1024).toFixed(1)} KiB raw, ` +
    `${(gzip.length / 1024).toFixed(1)} KiB gzip (limits 350 / 120 KiB).`,
  );
}
console.log(`Initial bundle: ${(raw.length / 1024).toFixed(1)} KiB raw, ${(gzip.length / 1024).toFixed(1)} KiB gzip.`);
