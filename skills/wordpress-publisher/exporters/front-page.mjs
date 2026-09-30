// Modo `front-page`: la portada compilada reemplaza a la del tema, y nada más.
//
// Es el modo original del skill y el que está instalado en sitios vivos. Su
// salida no cambia: la comprobación del repositorio la compara archivo por
// archivo contra una línea base congelada.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { render } from '../lib/render.mjs';

export const modo = 'front-page';
export const comunes = ['readme.txt', 'assets/wordpress-isolation.css'];

export async function preparar(contexto) {
  const { config } = contexto;
  const documento = await contexto.leer(config.source);

  const plantilla = render(await contexto.plantilla('templates/front-page.php'), config);

  const salida = plantilla
    .replace('<!-- COMPILED_HEAD -->', `<!-- ASTRO_HEAD_START -->${documento.head}<!-- ASTRO_HEAD_END -->`)
    .replace('<!-- COMPILED_BODY -->', `<!-- ASTRO_BODY_START -->${documento.body}<!-- ASTRO_BODY_END -->`);

  if (salida === plantilla) {
    throw new Error('Los marcadores de la plantilla no se reemplazaron.');
  }
  if (!salida.includes('wp_head()') || !salida.includes('wp_footer()')) {
    throw new Error('La plantilla generada perdió los hooks de WordPress.');
  }

  return {
    partes: ['plugin.php', 'common/estilos-ajenos.php', 'plugin-post.php'],
    marcadores: {
      '{{EN_ALCANCE}}': 'is_front_page()',
      '{{FUERA_DE_ALCANCE}}': '! is_front_page()',
      '{{ALCANCE_NOMBRE}}': 'la portada',
      '{{ALCANCE_NOMBRE_C}}': 'La portada',
      '{{ALCANCE_INGLES}}': 'the custom front page only'
    },
    archivos: [{ ruta: 'templates/front-page.php', contenido: salida }],
    origenes: [config.source],
    assets: documento.assets.length,
    hooks: ['wp_head', 'wp_body_open', 'wp_footer']
  };
}

export async function validar(pluginDir, config, { principal }) {
  const problemas = [];

  const plantilla = await readFile(path.join(pluginDir, 'templates', 'front-page.php'), 'utf8').catch(
    () => null
  );

  if (plantilla === null) {
    problemas.push('falta la plantilla de portada: templates/front-page.php');
    return problemas;
  }

  // Sin estos hooks, WordPress pierde su head y su footer: se caen analytics,
  // consentimiento y todo lo que otros plugins inyectan.
  for (const hook of ['wp_head()', 'wp_body_open()', 'wp_footer()']) {
    if (!plantilla.includes(hook)) problemas.push(`la plantilla no llama a ${hook}`);
  }

  // El plugin sólo debe tomar la portada.
  if (!principal.includes('is_front_page()')) {
    problemas.push('el plugin no limita su alcance a la portada (is_front_page)');
  }

  if (!plantilla.includes(`body_class()`)) {
    problemas.push('la plantilla no emite body_class(), así que la hoja de aislamiento no alcanza a nada');
  }

  void config;
  return problemas;
}
