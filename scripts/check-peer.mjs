import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const peer = process.argv[2];
if (!peer) throw new Error("Usage: node scripts/check-peer.mjs <other-checkout>");
const files = [
 "skills/reference-scanner/scripts/lib/evidence-integrity.mjs",
 "skills/reference-scanner/scripts/lib/web-contracts.mjs",
 "skills/reference-scanner/scripts/lib/behavior-gates.mjs",
 "skills/reference-scanner/schemas/style-dna.schema.json",
 "skills/reference-scanner/schemas/reference-evidence.schema.json",
 "skills/reference-to-astro/schemas/site-blueprint.schema.json",
 "skills/reference-to-astro/scripts/lib/qa-assertions.mjs",
 "skills/reference-to-astro/scripts/visual-qa.mjs",
 "skills/reference-lab-builder/schemas/reference-lab-spec.schema.json",
 "skills/reference-lab-builder/scripts/build-lab.mjs",
 "skills/wordpress-publisher/scripts/php-syntax.mjs"
];
let failed = false;
for (const file of files) {
 const [a,b] = await Promise.all([fs.readFile(path.join(root,file),"utf8"),fs.readFile(path.resolve(peer,file),"utf8")]);
 if(a.replaceAll("\r\n","\n") !== b.replaceAll("\r\n","\n")) {
  console.error("Shared contract drift: " + file); failed = true;
 }
}
if(failed) process.exitCode=1;
else console.log("Cross-platform parity verified for " + files.length + " shared contracts and runtimes.");
