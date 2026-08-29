---
name: wordpress-publisher
description: Convierte un sitio Astro ya construido en un plugin de WordPress que reemplaza únicamente la portada, dejando que WordPress siga atendiendo cuenta, registro, tienda, búsqueda y administración. Genera el paquete, verifica que sea instalable y produce un ZIP. Usar cuando la portada nueva tiene que convivir con un WordPress existente en lugar de reemplazarlo. No usar para publicar un sitio estático completo, que no necesita WordPress en el medio.
license: MIT
metadata:
  version: "0.3.0"
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

   **Subí `version` en cada entrega.** WordPress compara ese número para decidir
   si hay actualización; reempaquetar sin cambiarlo puede dejar la versión vieja
   instalada sin que nadie se entere. El validador rechaza un paquete cuya
   cabecera no declare un `x.y.z` válido.

2. Publicar:

   ```bash
   node scripts/publish.mjs --project .
   ```

   Construye, exporta, verifica y empaqueta, en ese orden y cortando en el
   primer fallo. Es un solo paso porque los cuatro van siempre juntos: la
   fricción no está en cada uno, está en acordarse de los cuatro cada vez que
   se corrige una palabra, y en que saltear la verificación no cuesta nada. Un
   ZIP que sale de un paquete no verificado es peor que no tener ZIP, porque se
   sube igual y rompe la portada en vivo.

   `--skip-build` sirve cuando el `dist/` ya está al día.

3. Subir el ZIP desde el panel de WordPress: Plugins → Añadir nuevo → Subir
   plugin, y activarlo. Es lo único manual, y es a propósito: instalar plugins
   por API pide credenciales del sitio, que es una decisión de quien lo opera y
   no algo que esta herramienta deba tomar.

Los tres pasos internos se pueden correr sueltos cuando hace falta mirar uno:
`scripts/export-plugin.mjs`, `scripts/validate-plugin.mjs` y
`scripts/package-plugin.mjs` aceptan `--project`, `--plugin` y `--out`.

El empaquetado no usa la herramienta del sistema a propósito. `Compress-Archive`
en Windows guarda las rutas con barra invertida y el formato ZIP exige barra
normal: PHP puede terminar creando un archivo cuyo nombre contiene la barra
invertida, en vez de la carpeta que correspondía, y el plugin se instala sin
encontrar nada. El script lo escribe con `zlib`, que viene con Node, y las
rutas quedan siempre con barra normal.

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
- cada asset citado está dentro del paquete;
- la cabecera declara una versión con forma `x.y.z`.

Un paquete incompleto no falla al generarse: falla en la portada del cliente.

## El plugin generado

Se niega a activarse si le falta el build. Es preferible un plugin que no
enciende a una portada en blanco en producción.

Agrega una clase estable al `body` de la portada, que la hoja de aislamiento
usa para acotar sus reglas. Nada de lo que hace se derrama al resto del sitio.

## Actualizar la portada

Subir `version` en `wordpress.config.json`, correr `scripts/publish.mjs` y subir
el ZIP nuevo. El plugin no guarda estado propio: todo lo que muestra viene del
build, así que reemplazarlo no pierde nada.

Si lo que cambió es contenido y no diseño, el cambio no empieza acá: empieza en
el contrato de contenido del proyecto. El calibrador de `visual-tuning-kit`
propone, una persona aprueba, `apply-content.mjs` lo escribe en el manifiesto, y
recién entonces se publica. Editar el HTML compilado o la plantilla del plugin
deja el sitio y su contrato diciendo cosas distintas, y el siguiente build
revierte el cambio sin avisar.
