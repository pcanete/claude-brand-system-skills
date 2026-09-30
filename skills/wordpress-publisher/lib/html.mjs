// Lo que hay que hacerle a un build de Astro para que entre en WordPress:
// separarlo en head y body, sacarle lo que WordPress ya provee, y reescribir
// cada URL de asset a una ruta del plugin.
//
// Es igual para los cuatro modos. Lo único que cambia es dónde termina cada
// fragmento.

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function extraerParte(html, expresion, etiqueta, origen) {
  const encontrado = html.match(expresion);
  if (!encontrado) throw new Error(`No se pudo extraer ${etiqueta} de ${origen}`);
  return encontrado[1];
}

// Lo que WordPress emite por su cuenta. Duplicarlo produce dos title, dos
// viewport y un head que nadie puede depurar.
export function quitarHeadDeWordPress(head) {
  return head
    .replace(/<meta\s+charset=[^>]*>/gi, '')
    .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']theme-color["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']icon["'][^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .trim();
}

export function urlPhpDeAsset(assetPath, config) {
  const escapado = assetPath.replaceAll('\\', '/').replaceAll("'", "\\'");
  return `<?php echo esc_url( ${config.constPrefix}_URL . 'dist/${escapado}' ); ?>`;
}

export function reescribirUrlsDeAssets(fragmento, config) {
  const reescrito = fragmento.replace(
    /(\s[\w:-]+)=(['"])\/((?:assets|_astro)\/[^'"]+)\2/g,
    (_todo, atributo, comilla, assetPath) =>
      `${atributo}=${comilla}${urlPhpDeAsset(assetPath, config)}${comilla}`
  );

  const sinResolver = reescrito.match(/['"(]\/(?:assets|_astro)\//g);
  if (sinResolver) {
    throw new Error(`Quedaron ${sinResolver.length} URL(s) de asset sin reescribir.`);
  }

  return reescrito;
}

export async function verificarAssets(html, distDir) {
  const referencias = [...html.matchAll(/\s[\w:-]+=(['"])\/((?:assets|_astro)\/[^'"]+)\1/g)].map(
    (encontrado) => encontrado[2]
  );

  const unicas = [...new Set(referencias)];
  const faltantes = [];

  for (const referencia of unicas) {
    const archivo = path.join(distDir, ...referencia.split('/'));
    const info = await stat(archivo).catch(() => null);
    if (!info?.isFile()) faltantes.push(referencia);
  }

  if (faltantes.length) {
    throw new Error(`El HTML referencia assets que no existen:\n${faltantes.join('\n')}`);
  }

  return unicas;
}

/**
 * Lee un HTML del build y devuelve sus dos mitades listas para WordPress.
 * `rutaRelativa` es relativa a la raíz del proyecto, no al dist.
 */
export async function leerDocumento({ projectRoot, distDir, rutaRelativa, config }) {
  const archivo = path.resolve(projectRoot, rutaRelativa);

  // Nada fuera del build: una ruta con `..` en la configuración no tiene por
  // qué poder leer el disco entero.
  const dentro = path.relative(distDir, archivo);
  if (dentro.startsWith('..') || path.isAbsolute(dentro)) {
    throw new Error(`\`${rutaRelativa}\` queda fuera de dist/. Las páginas se leen del build.`);
  }

  const html = await readFile(archivo, 'utf8').catch(() => null);
  if (html === null) {
    throw new Error(`No existe ${rutaRelativa}. ¿La construyó Astro? Revisá el nombre de la página.`);
  }

  const head = extraerParte(html, /<head>([\s\S]*?)<\/head>/i, 'head', rutaRelativa);
  const body = extraerParte(html, /<body[^>]*>([\s\S]*?)<\/body>/i, 'body', rutaRelativa);
  const assets = await verificarAssets(`${head}${body}`, distDir);
  const propio = quitarHeadDeWordPress(head);

  return {
    assets,
    // Con las URLs ya convertidas a rutas del plugin: sirve para imprimir.
    head: reescribirUrlsDeAssets(propio, config),
    body: reescribirUrlsDeAssets(body, config),
    // Sin convertir: sirven para separar lo que hay que encolar y para acotar
    // los estilos en línea antes de reescribir nada.
    headCrudo: propio,
    bodyCrudo: body
  };
}

/**
 * Parte el `<head>` compilado en lo que WordPress sabe encolar y lo que no.
 *
 * Cuando la página compilada se queda con el documento entero, el head se
 * imprime tal cual y listo. Cuando convive con el tema, no: las hojas y los
 * módulos tienen que pasar por `wp_enqueue_style` y `wp_enqueue_script`, que es
 * lo único que permite cargarlos sólo en las páginas que los usan y dejar que
 * el resto del sitio siga liviano.
 *
 * Trabaja sobre el head original, antes de reescribir las URLs: acá las rutas
 * todavía son las del build.
 */
export function separarHead(head) {
  const estilos = [];
  const scripts = [];

  let resto = head.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi,
    (etiqueta) => {
      const href = etiqueta.match(/\bhref=["']\/((?:assets|_astro)\/[^"']+)["']/i);
      if (!href) return etiqueta;
      estilos.push(href[1]);
      return '';
    }
  );

  resto = resto.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, (etiqueta) => {
    const src = etiqueta.match(/\bsrc=["']\/((?:assets|_astro)\/[^"']+)["']/i);
    if (!src) return etiqueta;
    scripts.push(src[1]);
    return '';
  });

  return {
    estilos: [...new Set(estilos)],
    scripts: [...new Set(scripts)],
    resto: resto.replace(/\n{3,}/g, '\n\n').trim()
  };
}

/**
 * Saca del cuerpo los módulos que Astro deja al final.
 *
 * Astro no pone sus scripts en el head: los deja cerrando el `<body>`. Un
 * fragmento que los arrastra tal cual se los lleva puestos cada vez que se
 * inserta, y dos inserciones en la misma página ejecutan el mismo módulo dos
 * veces. Encolados por WordPress, eso no puede pasar.
 */
export function separarScriptsDelCuerpo(body) {
  const scripts = [];

  const resto = body.replace(
    /<script\b[^>]*\bsrc=["']\/((?:assets|_astro)\/[^"']+)["'][^>]*>\s*<\/script>/gi,
    (_etiqueta, ruta) => {
      scripts.push(ruta);
      return '';
    }
  );

  return { scripts: [...new Set(scripts)], resto };
}

export async function contarArchivos(directorio) {
  let archivos = 0;
  let bytes = 0;

  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      const anidado = await contarArchivos(ruta);
      archivos += anidado.count;
      bytes += anidado.bytes;
    } else if (entrada.isFile()) {
      archivos += 1;
      bytes += (await stat(ruta)).size;
    }
  }

  return { count: archivos, bytes };
}

export async function listarArchivos(raiz, prefijo = '') {
  const archivos = [];

  for (const entrada of await readdir(path.join(raiz, prefijo), { withFileTypes: true })) {
    const relativa = prefijo ? path.join(prefijo, entrada.name) : entrada.name;
    if (entrada.isDirectory()) archivos.push(...(await listarArchivos(raiz, relativa)));
    else archivos.push(relativa);
  }

  return archivos;
}

// Las hojas empaquetadas también apuntan a la raíz del sitio. Dentro de un
// plugin esa raíz es la de WordPress, no la del sitio compilado.
export async function reescribirCssEmpaquetado(directorio, pluginDistDir, pluginDir) {
  const reescritas = [];

  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    const ruta = path.join(directorio, entrada.name);

    if (entrada.isDirectory()) {
      reescritas.push(...(await reescribirCssEmpaquetado(ruta, pluginDistDir, pluginDir)));
      continue;
    }

    if (!entrada.isFile() || path.extname(entrada.name).toLowerCase() !== '.css') continue;

    const fuente = await readFile(ruta, 'utf8');
    const salida = fuente.replace(
      /url\(\s*(['"]?)\/((?:assets|_astro)\/[^)'"\s]+)\1\s*\)/g,
      (_todo, comilla, assetPath) => {
        const absoluto = path.join(pluginDistDir, ...assetPath.split('/'));
        let relativo = path.relative(path.dirname(ruta), absoluto).replaceAll('\\', '/');
        if (!relativo.startsWith('.')) relativo = `./${relativo}`;
        return `url(${comilla}${relativo}${comilla})`;
      }
    );

    if (salida !== fuente) {
      await writeFile(ruta, salida, 'utf8');
      reescritas.push(path.relative(pluginDir, ruta).replaceAll('\\', '/'));
    }
  }

  return reescritas;
}
