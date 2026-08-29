#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const invocationCwd = process.cwd();

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const cwd = path.resolve(
  invocationCwd,
  arg("project", ".")
);

async function exists(file) {
  try {
    await fs.access(path.resolve(cwd, file));
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager() {
  if (await exists("pnpm-lock.yaml")) {
    return {
      command: "pnpm",
      args: ["run", "build"]
    };
  }

  if (await exists("yarn.lock")) {
    return {
      command: "yarn",
      args: ["build"]
    };
  }

  if (
    await exists("bun.lockb") ||
    await exists("bun.lock")
  ) {
    return {
      command: "bun",
      args: ["run", "build"]
    };
  }

  return {
    command: "npm",
    args: ["run", "build"]
  };
}

async function inspectPackage() {
  const file =
    path.resolve(cwd, "package.json");

  const pkg =
    JSON.parse(
      await fs.readFile(file, "utf8")
    );

  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  return {
    name: pkg.name || "unknown",
    astro: dependencies.astro || null,
    buildScript:
      pkg.scripts?.build || null
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const windows = process.platform === "win32";
    const executable = windows
      ? process.env.ComSpec || "cmd.exe"
      : command;
    const spawnArgs = windows
      ? ["/d", "/s", "/c", [command, ...args].join(" ")]
      : args;

    const child = spawn(
      executable,
      spawnArgs,
      {
        cwd,
        stdio: "inherit",
        shell: false
      }
    );

    child.on("error", reject);

    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const project =
    await inspectPackage();

  console.log(`Project: ${project.name}`);
  console.log(
    `Astro: ${project.astro || "not detected"}`
  );

  if (!project.buildScript) {
    throw new Error(
      "package.json has no build script."
    );
  }

  const pm =
    await detectPackageManager();

  console.log(
    `Build command: ${pm.command} ${pm.args.join(" ")}`
  );

  const started = Date.now();
  const code =
    await run(pm.command, pm.args);
  const elapsed =
    Date.now() - started;

  const report = {
    timestamp: new Date().toISOString(),
    project,
    command:
      `${pm.command} ${pm.args.join(" ")}`,
    exit_code: code,
    elapsed_ms: elapsed,
    passed: code === 0
  };

  await fs.mkdir(
    path.resolve(cwd, "qa"),
    { recursive: true }
  );

  await fs.writeFile(
    path.resolve(
      cwd,
      "qa/build-report.json"
    ),
    JSON.stringify(report, null, 2)
  );

  if (code !== 0) {
    console.error(
      "\nProduction build failed."
    );

    process.exitCode = code;
    return;
  }

  console.log(
    `\nBuild passed in ${(elapsed / 1000).toFixed(2)}s.`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
