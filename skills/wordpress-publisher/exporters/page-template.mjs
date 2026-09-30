// Modo `page-template`: el paquete registra plantillas de página que el cliente
// elige desde Página > Atributos > Plantilla.
//
// Dos variantes, y la diferencia entre ellas es de quién es el documento:
//
//   canvas  la pieza se queda con el documento entero, como la portada. Máxima
//           fidelidad; la cabecera y el pie del tema no aparecen.
//   theme   la pieza es el cuerpo, adentro del documento del tema. La cabecera
//           y el pie siguen siendo los del cliente, así que el CSS compilado
//           viaja acotado y los assets se encolan en vez de imprimirse.
//
// Sin tema hijo en ninguno de los dos casos: `theme_page_templates` alcanza.

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

export const modo = 'page-template';
export const comunes = ['readme.txt', 'assets/wordpress-isolation.css'];

function phpDelMapa(paginas, config) {
  const bloques = paginas.map((pagina) => {
    const estilos = pagina.styles.map((handle) => `'${handle}'`).join(', ');
    const scripts = pagina.scripts.map((handle) => `'${handle}'`).join(', ');

    return [
      `\t\t'${config.slug}-${pagina.id}.php' => array(`,
      `\t\t\t'id'      => '${pagina.id}',`,
      `\t\t\t'label'   => '${pagina.label}',`,
      `\t\t\t'file'    => 'page-${pagina.id}.php',`,
      `\t\t\t'styles'  => array(${estilos ? ` ${estilos} ` : ''}),`,
      `\t\t\t'scripts' => array(${scripts ? ` ${scripts} ` : ''}),`,
      '\t\t),'
    ].join('\n');
  });

  return bloques.join('\n');
}

export async function preparar(contexto) {
  const { config } = contexto;
  const esCanvas = config.variant === 'canvas';

  const plantillaPagina = await contexto.plantilla(
    esCanvas ? 'templates/canvas.php' : 'templates/theme.php'
  );

  const archivos = [];
  const origenes = [];
  const resueltas = [];
  let assets = 0;
  let rutasDeAssets = [];

  const documentos = [];

  for (const pagina of config.pages) {
    const documento = await contexto.leer(pagina.source);
    const entrada = { pagina, documento, cuerpo: documento.body, partes: null, scripts: [] };

    origenes.push(pagina.source);
    assets += documento.assets.length;

    if (!esCanvas) {
      // Conviviendo con el tema, nada se imprime crudo: las hojas y los
      // módulos se encolan, y el cuerpo viaja acotado. Astro deja sus módulos
      // cerrando el `<body>`, así que hay que sacarlos de ahí también.
      const partes = separarHead(documento.headCrudo);
      const delCuerpo = separarScriptsDelCuerpo(documento.bodyCrudo);

      entrada.partes = partes;
      entrada.scripts = [...new Set([...partes.scripts, ...delCuerpo.scripts])];
      entrada.cuerpo = acomodar(delCuerpo.resto, config);

      rutasDeAssets.push(...partes.estilos, ...entrada.scripts);
    }

    documentos.push(entrada);
  }

  const handles = asignarHandles(rutasDeAssets, config);

  for (const entrada of documentos) {
    const { pagina, documento } = entrada;
    const cuerpo = render(plantillaPagina, config, { '{{PAGE_ID}}': pagina.id });

    let salida = cuerpo.replace(
      '<!-- COMPILED_BODY -->',
      `<!-- ASTRO_BODY_START -->${entrada.cuerpo}<!-- ASTRO_BODY_END -->`
    );

    if (esCanvas) {
      salida = salida.replace(
        '<!-- COMPILED_HEAD -->',
        `<!-- ASTRO_HEAD_START -->${documento.head}<!-- ASTRO_HEAD_END -->`
      );

      if (!salida.includes('wp_head()') || !salida.includes('wp_footer()')) {
        throw new Error(`La plantilla de ${pagina.id} perdió los hooks de WordPress.`);
      }
    }

    if (salida === cuerpo) {
      throw new Error(`Los marcadores de la plantilla de ${pagina.id} no se reemplazaron.`);
    }

    archivos.push({ ruta: `templates/page-${pagina.id}.php`, contenido: salida });

    const partes = entrada.partes ?? { estilos: [], scripts: [], resto: '' };

    if (!esCanvas) {
      // Lo que queda del head —precargas, estilos en línea, metadatos de la
      // pieza— no se puede encolar, así que se imprime en wp_head.
      archivos.push({
        ruta: `templates/head-${pagina.id}.php`,
        contenido: cabeceraSuelta(partes.resto, config, pagina)
      });
    }

    resueltas.push({
      id: pagina.id,
      label: pagina.label,
      styles: partes.estilos.map((ruta) => handles.estilos.get(ruta)).filter(Boolean),
      scripts: entrada.scripts.map((ruta) => handles.scripts.get(ruta)).filter(Boolean)
    });

    void documento;
  }

  return {
    partes: esCanvas ? ['comun.php', 'common/estilos-ajenos.php'] : ['comun.php', 'theme.php'],
    marcadores: {
      '{{PAGE_MAP}}': phpDelMapa(resueltas, config),
      '{{ASSET_REGISTRY}}': esCanvas ? '' : phpDeRegistro(handles, config),
      '{{EN_ALCANCE}}': `null !== ${config.fnPrefix}_plantilla_elegida()`,
      '{{FUERA_DE_ALCANCE}}': `null === ${config.fnPrefix}_plantilla_elegida()`,
      '{{ALCANCE_NOMBRE}}': 'esta pagina',
      '{{ALCANCE_NOMBRE_C}}': 'Esta pagina',
      '{{ALCANCE_INGLES}}': "the plugin's own page templates only"
    },
    archivos,
    origenes,
    assets,
    hooks: esCanvas ? ['wp_head', 'wp_body_open', 'wp_footer'] : ['get_header', 'wp_head', 'get_footer'],
    resumen: { variant: config.variant, pages: resueltas.map((pagina) => pagina.id) }
  };
}

/**
 * Deja un trozo de HTML listo para vivir adentro del documento del tema:
 * los estilos en línea acotados, y las rutas apuntando al plugin.
 */
function acomodar(html, config) {
  return reescribirUrlsDeAssets(
    acotarEstilosEnLinea(render(html, config), alcanceAislamiento(config)),
    config
  );
}

function cabeceraSuelta(resto, config, pagina) {
  return [
    '<?php',
    '/**',
    ` * Resto del head compilado de la pagina «${pagina.label}».`,
    ' *',
    ' * Las hojas y los modulos no estan aca: los encola WordPress. Lo que queda',
    ' * son precargas y estilos en linea, que no tienen forma de encolarse.',
    ' */',
    '',
    "defined( 'ABSPATH' ) || exit;",
    '?>',
    acomodar(resto, config),
    ''
  ].join('\n');
}

export async function despues(contexto) {
  if (contexto.config.variant !== 'theme') return;

  // La cabecera del cliente está en la misma página: el CSS compilado no puede
  // hablar de `body`, de `html` ni de `*`.
  await acotarCssEmpaquetado(contexto.pluginDistDir, alcanceAislamiento(contexto.config));
}

export async function validar(pluginDir, config, { principal }) {
  const problemas = [];

  if (!principal.includes("add_filter( 'theme_page_templates'")) {
    problemas.push('el plugin no registra sus plantillas en theme_page_templates');
  }

  for (const pagina of config.pages) {
    const archivo = path.join(pluginDir, 'templates', `page-${pagina.id}.php`);
    const contenido = await readFile(archivo, 'utf8').catch(() => null);

    if (contenido === null) {
      problemas.push(`falta la plantilla de la página ${pagina.id}: templates/page-${pagina.id}.php`);
      continue;
    }

    if (config.variant === 'canvas') {
      for (const hook of ['wp_head()', 'wp_body_open()', 'wp_footer()']) {
        if (!contenido.includes(hook)) {
          problemas.push(`la plantilla de ${pagina.id} no llama a ${hook}`);
        }
      }
    } else {
      for (const llamada of ['get_header()', 'get_footer()']) {
        if (!contenido.includes(llamada)) {
          problemas.push(`la plantilla de ${pagina.id} no llama a ${llamada}: el tema pierde su cabecera o su pie`);
        }
      }
      if (!contenido.includes(`${config.slug}-root`)) {
        problemas.push(`la plantilla de ${pagina.id} no envuelve la pieza en una raíz propia`);
      }
    }
  }

  if (config.variant === 'theme') {
    // La variante que convive con el tema no puede dejar CSS suelto, y tampoco
    // puede desencolar lo ajeno: la cabecera del cliente lo necesita.
    problemas.push(...(await auditarAislamiento(pluginDir, alcanceAislamiento(config))));

    if (principal.includes('wp_dequeue_style(')) {
      problemas.push(
        'la variante `theme` desencola estilos ajenos, pero la cabecera y el pie del tema están en la misma página y los necesitan'
      );
    }
  }

  return problemas;
}
