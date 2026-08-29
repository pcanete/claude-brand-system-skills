#!/usr/bin/env node

// Empaqueta el plugin en un ZIP instalable desde el panel de WordPress.
//
//   node scripts/package-plugin.mjs --plugin wordpress/build/<slug>
//
//   --out <archivo>   destino (por defecto, junto a la carpeta del plugin)
//
// Escribe el ZIP a mano, con zlib, por una razón concreta: `Compress-Archive`
// de Windows guarda las rutas con barra invertida, y el formato ZIP exige
// barra normal. WordPress descomprime con PHP, que puede terminar creando un
// archivo llamado `plugin\dist\algo.css` en lugar de la carpeta — el plugin se
// instala y no encuentra nada.
//
// No hay dependencias: zlib viene con Node.

import { createWriteStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { deflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/** Fecha y hora en el formato de MS-DOS que usa el ZIP. */
function dosDateTime(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

async function listFiles(root, prefix = '') {
  const entries = [];

  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) entries.push(...(await listFiles(root, relative)));
    else if (entry.isFile()) entries.push(relative);
  }

  return entries;
}

export async function packagePlugin({ pluginDir, outPath }) {
  const slug = path.basename(pluginDir);
  const files = await listFiles(pluginDir);

  if (!files.length) throw new Error(`No hay archivos en ${pluginDir}`);

  const output = createWriteStream(outPath);
  const write = (chunk) =>
    new Promise((resolve, reject) => {
      output.write(chunk, (error) => (error ? reject(error) : resolve()));
    });

  const central = [];
  let offset = 0;

  for (const relative of files) {
    const absolute = path.join(pluginDir, ...relative.split('/'));
    const content = await readFile(absolute);
    const info = await stat(absolute);

    // La ruta dentro del ZIP siempre con barra normal, y siempre bajo la
    // carpeta del plugin: WordPress instala lo que encuentra en la raíz.
    const name = `${slug}/${relative}`;
    const nameBuffer = Buffer.from(name, 'utf8');

    const deflated = deflateRawSync(content, { level: 9 });
    const useDeflate = deflated.length < content.length;
    const payload = useDeflate ? deflated : content;
    const method = useDeflate ? 8 : 0;

    const crc = crc32(content);
    const { time, day } = dosDateTime(info.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    await write(local);
    await write(nameBuffer);
    await write(payload);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(day, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(payload.length, 20);
    entry.writeUInt32LE(content.length, 24);
    entry.writeUInt16LE(nameBuffer.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);

    central.push(Buffer.concat([entry, nameBuffer]));
    offset += local.length + nameBuffer.length + payload.length;
  }

  const directory = Buffer.concat(central);
  await write(directory);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  await write(end);

  await new Promise((resolve, reject) => {
    output.end((error) => (error ? reject(error) : resolve()));
  });

  const packaged = await stat(outPath);
  return { files: files.length, bytes: packaged.size };
}

async function main() {
  const pluginDir = path.resolve(process.cwd(), arg('plugin', ''));

  const info = await stat(pluginDir).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`No existe el plugin: ${pluginDir}. Indicá la carpeta con --plugin.`);
  }

  const slug = path.basename(pluginDir);
  const mainFile = path.join(pluginDir, `${slug}.php`);
  const main = await readFile(mainFile, 'utf8').catch(() => '');
  const version = main.match(/^\s*\*\s*Version:\s*(.+)$/m)?.[1]?.trim() ?? '0.0.0';

  const outPath = path.resolve(
    process.cwd(),
    arg('out', path.join(pluginDir, '..', `${slug}-${version}.zip`)),
  );

  const result = await packagePlugin({ pluginDir, outPath });

  console.log(`ZIP: ${outPath}`);
  console.log(`${result.files} archivos, ${(result.bytes / 1024 / 1024).toFixed(2)} MB, versión ${version}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
