---
name: wordpress-publisher
description: Convierte un sitio Astro ya construido en un plugin de WordPress que reemplaza únicamente la portada, dejando que WordPress siga atendiendo cuenta, registro, tienda, búsqueda y administración. Genera el paquete, verifica que sea instalable y produce un ZIP. Usar cuando la portada nueva tiene que convivir con un WordPress existente en lugar de reemplazarlo. No usar para publicar un sitio estático completo, que no necesita WordPress en el medio.
license: MIT
metadata:
  version: "0.4.0"
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

## Cuando la portada aloja algo de WordPress

La portada reemplaza la página entera, así que por defecto **no entra ninguna
hoja de estilos del sitio**. Es una lista blanca: lo que no está declarado no
pasa, y por eso el plugin que se instale mañana tampoco se filtra.

Pero una portada sigue alojando componentes de WordPress a propósito — un popup,
un banner de consentimiento, un chat, un mini-carrito — y esos necesitan su CSS.

**Primero se mide, después se declara.** Antes de admitir una hoja ajena:

```bash
node scripts/audit-foreign-css.mjs   https://sitio.com/wp-content/plugins/algo/assets/css/frontend.min.css
```

La pregunta no es si el plugin es confiable: es cuánto de esa hoja se acota sola
bajo su propia clase raíz y cuánto pisa la página entera. Un plugin bien hecho
escribe casi todo acotado y admitirlo no cuesta nada; uno que redefine `body`,
`h1` o `p` a secas se lleva puesto el diseño. La herramienta cuenta las dos
cosas y muestra las reglas globales con sus declaraciones, porque juzgarlas es
de una persona: un `.animated` que necesita su clase es inerte, un
`body { font-family }` no.

Medido sobre plugins reales: Elementor acota el 98% de sus selectores y es
seguro de admitir; el CSS de un tema típico acota el 68% y trae más de cien
reglas que redefinen elementos base.

Lo que resulte seguro se declara en `wordpress.config.json`:

```json
{
  "slug": "portada-astro",
  "allowedStyles": ["elementor-frontend", "elementor-post-*", "widget-*"]
}
```

Un `*` final permite una familia de handles generados, como los
`elementor-post-1234` que se emiten por cada popup. Un handle mal escrito se
rechaza al exportar, porque si no fallaría en silencio: no permitiría nada y el
componente aparecería sin estilos sin que nadie sepa por qué.

**Si algo aparece sin estilos, preguntale a la portada qué bloqueó.** Estando
logueado como administrador:

```
https://sitio.com/?<slug>-styles=audit
```

En el código fuente de la página quedan listados los handles quitados con su
origen. Un visitante nunca ve nada de esto.

También se puede ampliar la lista sin reempaquetar, con el filtro
`<fn_prefix>_allowed_styles`.

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
