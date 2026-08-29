---
name: wordpress-publisher
description: Convierte un sitio Astro ya construido en un plugin de WordPress que reemplaza únicamente la portada, dejando que WordPress siga atendiendo cuenta, registro, tienda, búsqueda y administración. Genera el paquete, verifica que sea instalable y produce un ZIP. Usar cuando la portada nueva tiene que convivir con un WordPress existente en lugar de reemplazarlo. No usar para publicar un sitio estático completo, que no necesita WordPress en el medio.
license: MIT
metadata:
  version: "0.1.0"
---

# WordPress Publisher

El último paso: una portada compilada, adentro de un WordPress que sigue vivo.

Es el caso frecuente en un rediseño real. El cliente tiene WordPress con
cuentas, tienda, formularios y plugins que funcionan. Lo que quiere cambiar es
la portada. Reemplazar todo el sitio para eso es desproporcionado, y publicar
la portada aparte parte el dominio en dos.

Este skill toma el `dist/` de Astro y lo empaqueta como plugin: WordPress
entrega la portada nueva y conserva todo lo demás intacto.

## Qué toca y qué no

El plugin interviene **sólo** cuando la petición es la portada pública. Deja
pasar sin tocar nada: administración, AJAX, feeds, embeds y cualquier otra
ruta. La tienda, la cuenta y el registro siguen siendo de WordPress.

En la portada desencola los estilos **visuales** del tema y de los page
builders —Astra, Elementor, bloques de WooCommerce— porque son los que pelean
con el diseño nuevo. No toca scripts ni estilos de otros plugins: analítica,
píxeles, consentimiento y demás integraciones siguen entrando por `wp_head()`
y `wp_footer()`, que la plantilla conserva.

Esa distinción es el corazón del asunto. Aislar de más rompe el sitio del
cliente; aislar de menos deja la portada peleando con el tema.

## Uso

1. Declarar el plugin en `wordpress.config.json`, en la raíz del proyecto:

   ```json
   {
     "slug": "portada-astro",
     "name": "Portada Astro",
     "description": "Portada compilada del sitio.",
     "author": "Estudio"
   }
   ```

   El `slug` manda: de ahí salen el nombre del archivo, el prefijo de las
   constantes PHP y el de las funciones. `constPrefix` y `fnPrefix` se pueden
   declarar si hace falta otra cosa.

2. Construir el sitio y exportar:

   ```bash
   npm run build
   node scripts/export-plugin.mjs --project . --config wordpress.config.json
   ```

3. Verificar el paquete **antes** de subirlo:

   ```bash
   node scripts/validate-plugin.mjs --plugin wordpress/build/portada-astro
   ```

4. Comprimir la carpeta del plugin y subirla desde el panel de WordPress.

## Qué hace el exportador

No inventa nada. Lee `dist/index.html`, lo separa en head y body, y:

- **saca lo que WordPress ya emite** — charset, viewport, description,
  theme-color, icono y title. Duplicarlos deja un head que nadie puede depurar;
- **reescribe cada URL de asset** a `esc_url( <PREFIJO>_URL . 'dist/...' )`,
  porque dentro de un plugin la raíz del sitio es la de WordPress;
- **reescribe también las URLs dentro del CSS empaquetado**, que apuntan a la
  raíz igual que el HTML y se olvidan seguido;
- **excluye el `index.html` original**: esa portada la sirve WordPress;
- **verifica que cada asset referenciado exista** antes de empaquetar.

Falla en lugar de producir un paquete a medias: si un asset no está, si un
marcador no se reemplazó o si la plantilla perdió los hooks de WordPress, no
hay export.

## Qué verifica el validador

El exportador revisa lo que puede mientras genera. El validador revisa el
artefacto terminado, que es lo que realmente se instala:

- están el archivo principal, la plantilla, la hoja de aislamiento y el build;
- no quedaron marcadores sin renderizar;
- la plantilla conserva `wp_head`, `wp_body_open` y `wp_footer`;
- el plugin limita su alcance a la portada y corta el acceso directo;
- ninguna URL apunta a la raíz del sitio;
- cada asset citado está dentro del paquete.

Un paquete incompleto no falla al generarse: falla en la portada del cliente.

## El plugin generado

Se niega a activarse si le falta el build. Es preferible un plugin que no
enciende a una portada en blanco en producción.

Agrega una clase estable al `body` de la portada, que la hoja de aislamiento
usa para acotar sus reglas. Nada de lo que hace se derrama al resto del sitio.

## Actualizar la portada

Volver a construir, volver a exportar, volver a validar y subir el ZIP nuevo.
El plugin no guarda estado propio: todo lo que muestra viene del build.
