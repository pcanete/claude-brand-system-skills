=== {{PLUGIN_NAME}} ===
Contributors: {{slug}}
Tags: portada, astro, landing-page
Requires at least: 6.2
Requires PHP: 7.4
Stable tag: 0.1.3
License: Proprietary

{{PLUGIN_DESCRIPTION}}

== Description ==

Reemplaza únicamente la portada pública del sitio mediante la jerarquía de
plantillas de WordPress. El resto de las rutas, administración, WooCommerce,
cuentas, formularios y plugins continúan bajo WordPress.

La plantilla conserva wp_head(), wp_body_open() y wp_footer().

== Installation ==

1. Hacer una copia de seguridad o usar primero un staging.
2. En WordPress, abrir Plugins > Añadir plugin > Subir plugin.
3. Subir {{slug}}-0.1.3.zip.
4. Activar {{PLUGIN_NAME}}.
5. Vaciar la caché de WordPress, Hostinger y CDN si corresponde.
6. Verificar portada, menú, carrito, cuenta, registro y enlaces externos.

== Changelog ==

= 0.1.3 =

* Corrige la especificidad del aislamiento para respetar IBM Plex Mono en los rótulos técnicos.
* Restaura el texto blanco de todos los botones rojos.
* Elimina la palabra PASO de las tarjetas del carnet digital.
* Bloquea también la hoja tardía generada por Astra Addon.

= 0.1.2 =

* Corrige las rutas de las fuentes locales Inter Tight, Raleway e IBM Plex Mono.
* Evita que el tema, Astra, Elementor y WooCommerce impriman CSS visual en la portada.
* Conserva wp_head(), wp_body_open() y wp_footer() para píxeles, analítica y otros complementos.

= 0.1.1 =

* Aísla la portada de los estilos globales de Astra, Elementor y WooCommerce.
* Mantiene los valores aprobados en el calibrador después del build de producción.

= 0.1.0 =

* Primera versión instalable de la portada Astro.

== Uninstallation ==

Desactivar el plugin restaura inmediatamente la portada que determine el tema
activo. El plugin no crea tablas ni elimina contenido de WordPress.
