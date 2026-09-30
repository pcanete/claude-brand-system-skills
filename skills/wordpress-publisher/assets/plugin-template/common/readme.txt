=== {{PLUGIN_NAME}} ===
Contributors: {{slug}}
Tags: astro, landing-page
Requires at least: 6.2
Requires PHP: 7.4
Stable tag: {{PLUGIN_VERSION}}
License: Proprietary

{{PLUGIN_DESCRIPTION}}

== Description ==

Este paquete lo genera `wordpress-publisher` a partir de un sitio Astro ya
construido. No reemplaza WordPress: se monta encima, en el alcance que declara
su configuración, y deja el resto del sitio —administración, cuentas, tienda,
búsqueda, formularios— exactamente como estaba.

Las plantillas que genera conservan wp_head(), wp_body_open() y wp_footer(),
así que analítica, píxeles, consentimiento y todo lo que otros plugins inyecten
siguen funcionando.

== Installation ==

1. Hacer una copia de seguridad o probar primero en un staging.
2. En WordPress, abrir Plugins > Añadir plugin > Subir plugin.
3. Subir {{slug}}-{{PLUGIN_VERSION}}.zip.
4. Activar {{PLUGIN_NAME}}.
5. Vaciar la caché de WordPress, la del hosting y la del CDN si corresponde.
6. Verificar el sitio en una ventana privada, y desde un teléfono: el navegador
   del teléfono guarda su propia copia y puede seguir mostrando la anterior.

Si ya había una versión instalada, subir la nueva reemplaza a la anterior. El
plugin no crea tablas ni guarda estado propio.

**Una sola copia.** Dos carpetas con este mismo plugin activas a la vez
declaran las mismas funciones y tumban el sitio. El paquete se defiende solo
—la segunda copia se retira y avisa—, pero conviene borrar la vieja.

== Changelog ==

= {{PLUGIN_VERSION}} =

* Paquete generado desde el build actual del sitio.

== Uninstallation ==

Desactivar el plugin restaura inmediatamente lo que determine el tema activo.
El plugin no elimina contenido de WordPress.
