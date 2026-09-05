import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

// Syntax only: PHP code is never executed. PHP_BINARY may select a local CLI.
export async function checkPhpSyntax(directory) {
  const issues = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, {withFileTypes:true})) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) { issues.push("PHP package cannot contain symlinks: " + file); continue; }
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith(".php")) {
        const result = spawnSync(process.env.PHP_BINARY || "php", ["-n", "-l", file],
          {encoding:"utf8", shell:false, timeout:15000});
        if (result.error) {
          throw new Error("PHP CLI required before packaging; install PHP or set PHP_BINARY. " + result.error.message);
        }
        if (result.status !== 0) issues.push(path.relative(directory,file) + ": " + (result.stderr || result.stdout).trim());
      }
    }
  }
  await walk(directory);
  return issues;
}
