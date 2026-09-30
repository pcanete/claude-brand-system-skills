// Sustitución de marcadores en las plantillas del plugin.
//
// Todo lo que sale de acá termina adentro de un archivo PHP que se instala en
// un sitio vivo. `lib/config.mjs` ya rechazó los textos que podrían cortar una
// cadena; acá no se vuelve a escapar nada, se sustituye y nada más.

// Los handles que el sitio declara alojar a proposito. Se validan acá porque un
// handle mal escrito no rompe nada visible: simplemente no permite nada, y el
// componente aparece sin estilos sin que nadie sepa por que.
export function renderAllowedStyles(declarados) {
  if (declarados === undefined || declarados === null) return '';

  if (!Array.isArray(declarados)) {
    throw new Error('`allowedStyles` tiene que ser una lista de handles');
  }

  const limpios = declarados.map((handle) => {
    if (typeof handle !== 'string' || !/^[a-z0-9][a-z0-9_-]*\*?$/i.test(handle)) {
      throw new Error(
        `handle invalido en allowedStyles: ${JSON.stringify(handle)}. ` +
          'Solo letras, numeros, guiones y un `*` final para una familia.'
      );
    }
    return `'${handle.toLowerCase()}'`;
  });

  return limpios.length ? ` ${limpios.join(', ')} ` : '';
}

/**
 * Bajo qué selector se acota la hoja de compatibilidad.
 *
 * Cuando el paquete se queda con el documento entero, alcanza con una clase en
 * el `<body>`. Cuando convive con el tema en la misma página —una plantilla que
 * llama a get_header(), un fragmento incrustado— el aislamiento no puede tocar
 * el `<body>`: ahí vive también la cabecera del cliente.
 */
export function alcanceAislamiento(config) {
  if (config.modo === 'front-page') return `body.${config.slug}`;
  if (config.modo === 'page-template') {
    return config.variant === 'canvas' ? `body.${config.slug}` : `.${config.slug}-root`;
  }
  if (config.modo === 'embedded-page') return `.${config.slug}-embed`;
  if (config.modo === 'elementor-widgets') return `.${config.slug}-widget`;
  return null;
}

export function marcadores(config) {
  return {
    '{{CONST_PREFIX}}': config.constPrefix,
    '{{fn_prefix}}': config.fnPrefix,
    '{{slug}}': config.slug,
    '{{PLUGIN_SLUG}}': config.slug,
    '{{PLUGIN_NAME}}': config.name,
    '{{PLUGIN_DESCRIPTION}}': config.description,
    '{{PLUGIN_AUTHOR}}': config.author,
    '{{PLUGIN_VERSION}}': config.version,
    '{{MODE}}': config.modo,
    '{{const_global}}': `$${config.fnPrefix}_removed_styles`,
    '{{ALLOWED_STYLES}}': renderAllowedStyles(config.allowedStyles),
    '{{ISOLATION_SCOPE}}': alcanceAislamiento(config) ?? ''
  };
}

export function render(fuente, config, extra = {}) {
  let salida = fuente;

  for (const [marcador, valor] of Object.entries({ ...marcadores(config), ...extra })) {
    salida = salida.replaceAll(marcador, valor);
  }

  return salida;
}
