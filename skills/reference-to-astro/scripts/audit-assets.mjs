#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1
    ? fallback
    : process.argv[index + 1];
}

const cwd = path.resolve(
  process.cwd(),
  arg("project", ".")
);

const contentFile =
  arg("content", "CONTENT_MANIFEST.json");

const evidenceFile =
  arg("evidence", "REFERENCE_EVIDENCE.json");

function isRemote(value) {
  return (
    /^https?:\/\//i.test(value) ||
    /^data:/i.test(value) ||
    /^blob:/i.test(value)
  );
}

async function readJson(file) {
  return JSON.parse(
    await fs.readFile(
      path.resolve(cwd, file),
      "utf8"
    )
  );
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function candidatePaths(src) {
  const clean =
    src.split("?")[0].split("#")[0];

  if (path.isAbsolute(clean)) {
    return [
      path.resolve(cwd, `.${clean}`),
      path.resolve(
        cwd,
        "public",
        clean.slice(1)
      )
    ];
  }

  return [
    path.resolve(cwd, clean),
    path.resolve(cwd, "public", clean)
  ];
}

async function findLocalAsset(src) {
  for (const candidate of candidatePaths(src)) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function main() {
  const [content, evidence] =
    await Promise.all([
      readJson(contentFile),
      readJson(evidenceFile)
    ]);

  const missing = [];
  const remote = [];
  const found = [];

  for (const asset of content.assets || []) {
    if (isRemote(asset.src)) {
      remote.push(asset);
      continue;
    }

    const resolved =
      await findLocalAsset(asset.src);

    if (!resolved) {
      missing.push({
        kind: "content",
        id: asset.id,
        src: asset.src
      });
    } else {
      found.push({
        kind: "content",
        id: asset.id,
        resolved
      });
    }
  }

  for (const capture of evidence.captures || []) {
    const artifact = capture.artifact;

    if (!artifact || isRemote(artifact)) {
      continue;
    }

    const resolved =
      await findLocalAsset(artifact);

    if (!resolved) {
      missing.push({
        kind: "evidence",
        id: capture.id,
        src: artifact
      });
    } else {
      found.push({
        kind: "evidence",
        id: capture.id,
        resolved
      });
    }
  }

  console.log(
    `Found local assets: ${found.length}`
  );

  console.log(
    `Remote assets: ${remote.length}`
  );

  if (missing.length) {
    console.error(
      `Missing assets: ${missing.length}`
    );

    for (const item of missing) {
      console.error(
        `  - [${item.kind}] ${item.id}: ${item.src}`
      );
    }

    process.exitCode = 1;
    return;
  }

  console.log("Asset audit passed.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
