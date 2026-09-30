// Modo `embedded-page`: la pieza compilada entra adentro del contenido de
// WordPress, con un shortcode.
//
// Es el modo con menos documento propio de los cuatro: acá la página es del
// cliente y la pieza es un fragmento. Eso impone dos cosas que no son
// negociables —el CSS acotado bajo una raíz, y los assets encolados en vez de
// impresos— y una tercera que se gana: varias piezas en un mismo paquete,
// cada una con su id.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  acotarCssEmpaquetado,
  asignarHandles,
  auditarAislamiento,
  phpDeRegistro
} from '../lib/assets-wp.mjs';
import { acotarEstilosEnLinea } from '../lib/css-scope.mjs';
import { reescribirUrlsDeAssets, separarHead, separarScriptsDelCuerpo } from '../lib/html.mjs';
import { alcanceAislamiento, render } from '../lib/render.mjs';

export const modo = 'embedded-page';
export const comunes = ['readme.txt', 'assets/wordpress-isolation.css'];

function phpDelMapa(paginas) {
  return paginas
    .map((pagina) => {
      const estilos = pagina.styles.map((handle) => `'${handle}'`).join(', ');
      const scripts = pagina.scripts.map((handle) => `'${handle}'`).join(', ');

      return [
        `\t\t'${pagina.id}' => array(`,
        `\t\t\t'label'    => '${pagina.label}',`,
        `\t\t\t'fragment' => '${pagina.id}.php',`,
        `\t\t\t'styles'   => array(${estilos ? ` ${estilos} ` : ''}),`,
        `\t\t\t'scripts'  => array(${scripts ? ` ${scripts} ` : ''}),`,
        '\t\t),'
      ].join('\n');
    })
    .join('\n');
}

function fragmento(cuerpo, config, pagina, resto) {
  return [
    '<?php',
    '/**',
    ` * Fragmento compilado de «${pagina.label}».`,
    ' *',
    ' * Lo incluye el shortcode dentro del contenido de WordPress. Las hojas y',
    ' * los modulos no estan aca: los encola el plugin.',
    ' *',
    ' * Lo regenera `wordpress-publisher`. Editarlo a mano se pierde en el',
    ' * proximo build.',
    ' */',
    '',
    "defined( 'ABSPATH' ) || exit;",
    '?>',
    `<div class="${config.slug}-embed ${config.slug}-embed--${pagina.id}">`,
    resto,
    cuerpo,
    '</div>',
    ''
  ].join('\n');
}

/**
 * Deja un trozo de HTML listo para vivir adentro de una página ajena:
 * los estilos en línea acotados, y las rutas apuntando al plugin.
 */
function acomodar(html, config) {
  return reescribirUrlsDeAssets(
    acotarEstilosEnLinea(render(html, config), alcanceAislamiento(config)),
    config
  );
}

export async function preparar(contexto) {
  const { config } = contexto;

  const documentos = [];
  const rutasDeAssets = [];
  const origenes = [];
  let assets = 0;

  for (const pagina of config.pages) {
    const documento = await contexto.leer(pagina.source);
    const partes = separarHead(documento.headCrudo);
    const delCuerpo = separarScriptsDelCuerpo(documento.bodyCrudo);

    // Astro deja sus módulos cerrando el `<body>`, no en el head: si no se los
    // saca de ahí, viajan dentro del fragmento y se ejecutan una vez por cada
    // inserción en la misma página.
    const scripts = [...new Set([...partes.scripts, ...delCuerpo.scripts])];

    documentos.push({ pagina, documento, partes, scripts, cuerpo: delCuerpo.resto });
    rutasDeAssets.push(...partes.estilos, ...scripts);
    origenes.push(pagina.source);
    assets += documento.assets.length;
  }

  const handles = asignarHandles(rutasDeAssets, config);
  const archivos = [];
  const resueltas = [];

  for (const { pagina, partes, scripts, cuerpo } of documentos) {
    archivos.push({
      ruta: `fragments/${pagina.id}.php`,
      contenido: fragmento(
        acomodar(cuerpo, config),
        config,
        pagina,
        partes.resto ? acomodar(partes.resto, config) : ''
      )
    });

    resueltas.push({
      id: pagina.id,
      label: pagina.label,
      styles: partes.estilos.map((ruta) => handles.estilos.get(ruta)).filter(Boolean),
      scripts: scripts.map((ruta) => handles.scripts.get(ruta)).filter(Boolean)
    });
  }

  return {
    marcadores: {
      '{{PAGE_MAP}}': phpDelMapa(resueltas),
      '{{ASSET_REGISTRY}}': phpDeRegistro(handles, config),
      '{{SHORTCODE}}': config.shortcode,
      '{{DEFAULT_PAGE}}': config.pages[0].id
    },
    archivos,
    origenes,
    assets,
    hooks: ['wp_enqueue_scripts'],
    resumen: { shortcode: config.shortcode, pages: resueltas.map((pagina) => pagina.id) }
  };
}

export async function despues(contexto) {
  await acotarCssEmpaquetado(contexto.pluginDistDir, alcanceAislamiento(contexto.config));
}

export async function validar(pluginDir, config, { principal }) {
  const problemas = [];

  if (!principal.includes(`add_shortcode( '${config.shortcode}'`)) {
    problemas.push(`el plugin no registra el shortcode [${config.shortcode}]`);
  }

  for (const pagina of config.pages) {
    const archivo = path.join(pluginDir, 'fragments', `${pagina.id}.php`);
    const contenido = await readFile(archivo, 'utf8').catch(() => null);

    if (contenido === null) {
      problemas.push(`falta el fragmento de ${pagina.id}: fragments/${pagina.id}.php`);
      continue;
    }

    if (!contenido.includes(`${config.slug}-embed`)) {
      problemas.push(`el fragmento de ${pagina.id} no envuelve la pieza en una raíz propia`);
    }

    // Un fragmento con un documento adentro rompe la página que lo aloja.
    if (/<(?:html|head|body)\b/i.test(contenido)) {
      problemas.push(`el fragmento de ${pagina.id} trae etiquetas de documento (html, head o body)`);
    }
  }

  problemas.push(...(await auditarAislamiento(pluginDir, alcanceAislamiento(config))));

  return problemas;
}
