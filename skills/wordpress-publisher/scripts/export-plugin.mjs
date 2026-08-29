#!/usr/bin/env node

// Convierte un build de Astro en un plugin de WordPress que reemplaza sólo la
// portada. WordPress sigue atendiendo todo lo demás: cuenta, registro, tienda,
// búsqueda, feeds y administración.
//
//   node scripts/export-plugin.mjs --project . --config wordpress.config.json
//
// No inventa nada: lee `dist/index.html`, separa head y body, saca lo que
// WordPress ya provee, reescribe las URLs de assets a rutas del plugin, y
// rellena la plantilla. Si algo no cierra —un asset referenciado que no
// existe, un marcador que no se reemplazó, un hook de WordPress que
// desapareció— falla en lugar de publicar un paquete roto.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templateRoot = path.resolve(scriptDir, '..', 'assets', 'plugin-template');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

/** Un slug manda: de ahí salen el prefijo de constantes y el de funciones. */
export function resolveConfig(raw = {}) {
  const slug = raw.slug;
  if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error('config.slug es obligatorio y debe ser kebab-case (ej: portada-astro).');
  }

  const base = slug.replaceAll('-', '_');

  // WordPress decide si hay actualización comparando este número. Un plugin
  // que se reempaqueta sin subirlo puede no reemplazar al instalado.
  const version = raw.version || '0.1.0';
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`config.version debe ser x.y.z, no "${version}".`);
  }

  return {
    slug,
    version,
    name: raw.name || slug,
    description: raw.description || `Portada compilada para ${slug}.`,
    author: raw.author || '',
    constPrefix: raw.constPrefix || base.toUpperCase(),
    fnPrefix: raw.fnPrefix || base,
  };
}

function render(source, config) {
  return source
    .replaceAll('{{CONST_PREFIX}}', config.constPrefix)
    .replaceAll('{{fn_prefix}}', config.fnPrefix)
    .replaceAll('{{slug}}', config.slug)
    .replaceAll('{{PLUGIN_NAME}}', config.name)
    .replaceAll('{{PLUGIN_DESCRIPTION}}', config.description)
    .replaceAll('{{PLUGIN_AUTHOR}}', config.author)
    .replaceAll('{{PLUGIN_VERSION}}', config.version);
}

function extractDocumentPart(html, expression, label) {
  const match = html.match(expression);
  if (!match) throw new Error(`No se pudo extraer ${label} de dist/index.html`);
  return match[1];
}

// Lo que WordPress emite por su cuenta. Duplicarlo produce dos title, dos
// viewport y un head que nadie puede depurar.
function stripWordPressOwnedHead(head) {
  return head
    .replace(/<meta\s+charset=[^>]*>/gi, '')
    .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']theme-color["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']icon["'][^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .trim();
}

function toPhpAssetUrl(assetPath, config) {
  const escaped = assetPath.replaceAll('\\', '/').replaceAll("'", "\\'");
  return `<?php echo esc_url( ${config.constPrefix}_URL . 'dist/${escaped}' ); ?>`;
}

function rewriteAssetUrls(fragment, config) {
  const rewritten = fragment.replace(
    /(\s[\w:-]+)=(['"])\/((?:assets|_astro)\/[^'"]+)\2/g,
    (_match, attribute, quote, assetPath) =>
      `${attribute}=${quote}${toPhpAssetUrl(assetPath, config)}${quote}`,
  );

  const unresolved = rewritten.match(/['"(]\/(?:assets|_astro)\//g);
  if (unresolved) {
    throw new Error(`Quedaron ${unresolved.length} URL(s) de asset sin reescribir.`);
  }

  return rewritten;
}

async function verifyAssetReferences(html, distDir) {
  const references = [
    ...html.matchAll(/\s[\w:-]+=(['"])\/((?:assets|_astro)\/[^'"]+)\1/g),
  ].map((match) => match[2]);

  const unique = [...new Set(references)];
  const missing = [];

  for (const reference of unique) {
    const filePath = path.join(distDir, ...reference.split('/'));
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) missing.push(reference);
  }

  if (missing.length) {
    throw new Error(`El HTML referencia assets que no existen:\n${missing.join('\n')}`);
  }

  return unique;
}

async function countFiles(directory) {
  let count = 0;
  let bytes = 0;

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await countFiles(entryPath);
      count += nested.count;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      count += 1;
      bytes += (await stat(entryPath)).size;
    }
  }

  return { count, bytes };
}

// Las hojas empaquetadas también apuntan a la raíz del sitio. Dentro de un
// plugin esa raíz es la de WordPress, no la del sitio compilado.
async function rewritePackagedCssAssetUrls(directory, pluginDistDir, pluginDir) {
  const rewritten = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      rewritten.push(...(await rewritePackagedCssAssetUrls(entryPath, pluginDistDir, pluginDir)));
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.css') continue;

    const source = await readFile(entryPath, 'utf8');
    const output = source.replace(
      /url\(\s*(['"]?)\/((?:assets|_astro)\/[^)'"\s]+)\1\s*\)/g,
      (_match, quote, assetPath) => {
        const absoluteAsset = path.join(pluginDistDir, ...assetPath.split('/'));
        let relativeAsset = path
          .relative(path.dirname(entryPath), absoluteAsset)
          .replaceAll('\\', '/');
        if (!relativeAsset.startsWith('.')) relativeAsset = `./${relativeAsset}`;
        return `url(${quote}${relativeAsset}${quote})`;
      },
    );

    if (output !== source) {
      await writeFile(entryPath, output, 'utf8');
      rewritten.push(path.relative(pluginDir, entryPath).replaceAll('\\', '/'));
    }
  }

  return rewritten;
}

export async function exportPlugin({ projectRoot, config }) {
  const distDir = path.join(projectRoot, 'dist');
  const buildRoot = path.join(projectRoot, 'wordpress', 'build');
  const pluginDir = path.join(buildRoot, config.slug);
  const pluginDistDir = path.join(pluginDir, 'dist');
  const reportPath = path.join(buildRoot, 'wordpress-export-report.json');

  const distInfo = await stat(distDir).catch(() => null);
  if (!distInfo?.isDirectory()) {
    throw new Error(`No existe el build de Astro: ${distDir}. Corré astro build primero.`);
  }

  // Nunca escribir fuera del directorio generado.
  const relative = path.relative(buildRoot, pluginDir);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`El destino queda fuera de wordpress/build: ${pluginDir}`);
  }

  const indexPath = path.join(distDir, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  const originalHead = extractDocumentPart(html, /<head>([\s\S]*?)<\/head>/i, 'head');
  const originalBody = extractDocumentPart(html, /<body[^>]*>([\s\S]*?)<\/body>/i, 'body');
  const assetReferences = await verifyAssetReferences(
    `${originalHead}${originalBody}`,
    distDir,
  );

  await rm(pluginDir, { recursive: true, force: true });
  await mkdir(pluginDir, { recursive: true });

  // La plantilla se copia renderizada: el paquete no lleva marcadores.
  for (const relativePath of await listTemplateFiles(templateRoot)) {
    const source = await readFile(path.join(templateRoot, relativePath), 'utf8');
    const target =
      relativePath === 'plugin.php'
        ? path.join(pluginDir, `${config.slug}.php`)
        : path.join(pluginDir, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, render(source, config), 'utf8');
  }

  await cp(distDir, pluginDistDir, {
    recursive: true,
    filter: (source) => path.resolve(source) !== path.resolve(indexPath),
  });

  const rewrittenCssFiles = await rewritePackagedCssAssetUrls(
    pluginDistDir,
    pluginDistDir,
    pluginDir,
  );

  const templatePath = path.join(pluginDir, 'templates', 'front-page.php');
  const templateSource = await readFile(templatePath, 'utf8');
  const compiledHead = rewriteAssetUrls(stripWordPressOwnedHead(originalHead), config);
  const compiledBody = rewriteAssetUrls(originalBody, config);

  const outputTemplate = templateSource
    .replace('<!-- COMPILED_HEAD -->', `<!-- ASTRO_HEAD_START -->${compiledHead}<!-- ASTRO_HEAD_END -->`)
    .replace('<!-- COMPILED_BODY -->', `<!-- ASTRO_BODY_START -->${compiledBody}<!-- ASTRO_BODY_END -->`);

  if (outputTemplate === templateSource) {
    throw new Error('Los marcadores de la plantilla no se reemplazaron.');
  }
  if (!outputTemplate.includes('wp_head()') || !outputTemplate.includes('wp_footer()')) {
    throw new Error('La plantilla generada perdió los hooks de WordPress.');
  }

  await writeFile(templatePath, outputTemplate, 'utf8');

  const inventory = await countFiles(pluginDir);
  const report = {
    generatedAt: new Date().toISOString(),
    plugin: config.slug,
    version: config.version,
    source: path.relative(projectRoot, indexPath).replaceAll('\\', '/'),
    output: path.relative(projectRoot, pluginDir).replaceAll('\\', '/'),
    referencedAssets: assetReferences.length,
    packagedFiles: inventory.count,
    packagedBytes: inventory.bytes,
    wordpressHooks: ['wp_head', 'wp_body_open', 'wp_footer'],
    rewrittenCssFiles,
  };

  await mkdir(buildRoot, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return { pluginDir, report };
}

async function listTemplateFiles(root, prefix = '') {
  const files = [];

  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...(await listTemplateFiles(root, relativePath)));
    else files.push(relativePath);
  }

  return files;
}

async function main() {
  const projectRoot = path.resolve(process.cwd(), arg('project', '.'));
  const configPath = path.resolve(projectRoot, arg('config', 'wordpress.config.json'));

  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  const config = resolveConfig(raw);

  const { pluginDir, report } = await exportPlugin({ projectRoot, config });

  console.log(`Plugin exportado a ${pluginDir}`);
  console.log(
    `${report.packagedFiles} archivos, ${(report.packagedBytes / 1024 / 1024).toFixed(2)} MB, ` +
      `${report.referencedAssets} assets referenciados`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
