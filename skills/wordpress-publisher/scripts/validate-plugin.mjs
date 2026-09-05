#!/usr/bin/env node

// Verifica un plugin exportado antes de que alguien lo suba a un sitio en
// producción.
//
//   node scripts/validate-plugin.mjs --plugin wordpress/build/<slug>
//
// El exportador ya falla ante lo que puede detectar mientras genera. Esto
// revisa el artefacto terminado, que es lo que efectivamente se instala: un
// paquete al que le falta un asset no rompe al generarse, rompe en la portada
// del cliente.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { checkPhpSyntax } from './php-syntax.mjs';
import { lintPhp } from './lint-php.mjs';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

async function exists(target) {
  return Boolean(await stat(target).catch(() => null));
}

async function walk(directory, prefix = '') {
  const files = [];

  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(directory, relativePath)));
    else files.push(relativePath);
  }

  return files;
}

export async function validatePlugin(pluginDir) {
  const issues = [];
  const slug = path.basename(pluginDir);

  const mainFile = path.join(pluginDir, `${slug}.php`);
  const templateFile = path.join(pluginDir, 'templates', 'front-page.php');

  for (const [label, target] of [
    ['el archivo principal del plugin', mainFile],
    ['la plantilla de portada', templateFile],
    ['la hoja de aislamiento', path.join(pluginDir, 'assets', 'wordpress-isolation.css')],
    ['el build compilado', path.join(pluginDir, 'dist')],
  ]) {
    if (!(await exists(target))) issues.push(`falta ${label}: ${path.relative(pluginDir, target)}`);
  }

  if (issues.length) return issues;

  issues.push(...await checkPhpSyntax(pluginDir));

  const main = await readFile(mainFile, 'utf8');
  const template = await readFile(templateFile, 'utf8');

  // Un marcador sin reemplazar llega a producción como texto literal.
  for (const [label, content] of [
    ['el archivo principal', main],
    ['la plantilla', template],
  ]) {
    const leftovers = content.match(/\{\{[A-Za-z_]+\}\}/g);
    if (leftovers) {
      issues.push(`${label} conserva marcadores sin renderizar: ${[...new Set(leftovers)].join(', ')}`);
    }
  }

  // Sin estos hooks, WordPress pierde su head y su footer: se caen analytics,
  // consentimiento y todo lo que otros plugins inyectan.
  for (const hook of ['wp_head()', 'wp_body_open()', 'wp_footer()']) {
    if (!template.includes(hook)) issues.push(`la plantilla no llama a ${hook}`);
  }

  // El plugin sólo debe tomar la portada.
  if (!main.includes('is_front_page()')) {
    issues.push('el plugin no limita su alcance a la portada (is_front_page)');
  }
  // WordPress compara este número para decidir si hay actualización. Si queda
  // un marcador o algo que no es x.y.z, el sitio puede quedarse con la versión
  // vieja instalada sin avisar a nadie.
  const declaredVersion = main.match(/^\s*\*\s*Version:\s*(.+)$/m)?.[1]?.trim();

  if (!declaredVersion || !/^\d+\.\d+\.\d+$/.test(declaredVersion)) {
    issues.push(
      `la cabecera declara una versión inválida: "${declaredVersion ?? 'ninguna'}"`,
    );
  }

  if (!main.includes("defined( 'ABSPATH' ) || exit")) {
    issues.push('el archivo principal no corta el acceso directo (ABSPATH)');
  }

  // Una URL absoluta a la raíz apunta a la raíz de WordPress, no a la del
  // plugin: el asset no existe ahí.
  const rootUrls = template.match(/(?:src|href)=["']\/(?:assets|_astro)\//g);
  if (rootUrls) {
    issues.push(`la plantilla conserva ${rootUrls.length} URL(s) apuntando a la raíz del sitio`);
  }

  // El index original no va en el paquete: la portada la sirve WordPress.
  if (await exists(path.join(pluginDir, 'dist', 'index.html'))) {
    issues.push('el paquete incluye dist/index.html, que WordPress no usa');
  }

  // Cada asset citado por la plantilla tiene que estar dentro del paquete.
  const packaged = new Set(await walk(path.join(pluginDir, 'dist')));
  const referenced = [...template.matchAll(/_URL \. 'dist\/([^']+)'/g)].map((match) => match[1]);
  const missing = [...new Set(referenced)].filter((asset) => !packaged.has(asset));

  if (missing.length) {
    issues.push(`la plantilla cita ${missing.length} asset(s) ausentes del paquete: ${missing.slice(0, 3).join(', ')}`);
  }

  // Lo primero que hay que comprobar de un archivo PHP es que sea PHP. Sonaba
  // tan obvio que no estaba: un paquete con un error de sintaxis paso las cinco
  // comprobaciones anteriores, se empaqueto, se instalo y tiro el sitio entero.
  for (const archivo of await walk(pluginDir)) {
    if (!archivo.endsWith('.php')) continue;
    const source = await readFile(path.join(pluginDir, archivo), 'utf8');
    for (const problema of lintPhp(source, archivo)) {
      issues.push(`${problema.archivo}:${problema.linea} — ${problema.mensaje}`);
    }
  }

  return issues;
}

async function main() {
  const pluginDir = path.resolve(process.cwd(), arg('plugin', ''));

  if (!(await exists(pluginDir))) {
    throw new Error(`No existe el plugin: ${pluginDir}. Indicá la carpeta con --plugin.`);
  }

  const issues = await validatePlugin(pluginDir);

  if (issues.length) {
    console.error('\n✗ el paquete no está listo para instalarse');
    for (const issue of issues) console.error(`  - ${issue}`);
    console.error('\nNo lo subas: corregí y volvé a exportar.');
    process.exitCode = 1;
    return;
  }

  console.log('✓ archivos requeridos presentes');
  console.log('✓ sin marcadores sin renderizar');
  console.log('✓ hooks de WordPress intactos');
  console.log('✓ alcance limitado a la portada');
  console.log('✓ assets resueltos dentro del paquete');
  console.log('\nPaquete verificado.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
