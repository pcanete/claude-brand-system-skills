---
name: wordpress-publisher
description: Convierte un sitio Astro ya construido en un plugin de WordPress, en el alcance que haga falta: reemplazar la portada, registrar plantillas de página que el cliente elige desde el panel, insertar piezas con un shortcode, o aportar widgets de Elementor para lo que de verdad tiene que ser editable o dinámico. Genera el paquete, verifica que sea instalable y produce un ZIP. Usar cuando el diseño nuevo tiene que convivir con un WordPress existente en lugar de reemplazarlo. No usar para publicar un sitio estático completo, que no necesita WordPress en el medio.
license: MIT
metadata:
  version: "0.6.1"
---

# WordPress Publisher

El último paso: un diseño compilado, adentro de un WordPress que sigue vivo.

Es el caso frecuente en un rediseño real. El cliente tiene WordPress con
cuentas, tienda, formularios y plugins que funcionan. Lo que quiere cambiar es
el diseño. Reemplazar todo el sitio para eso es desproporcionado, y publicar las
páginas nuevas aparte parte el dominio en dos.

Este skill toma el `dist/` de Astro y lo empaqueta como plugin, en el alcance
que corresponda.

## Elegir el alcance es la primera decisión

Antes de generar nada hay que decidir **cuánto de WordPress ocupa el paquete**.
No es una decisión de gusto: cada modo entrega una cosa y cobra otra.

El principio que la ordena:

> Elementor para lo que necesita ser editable como estructura o contenido
> dinámico. Código generado para lo que necesita máxima fidelidad, libertad
> visual y no necesita edición granular.

La decisión real es **por qué ruta entra el diseño**, y este skill cubre cuatro
de las rutas posibles, no todas:

| Modo | Qué ocupa | Cuándo |
| --- | --- | --- |
| `front-page` | la portada pública | el rediseño es la portada, y el resto del sitio sigue igual |
| `page-template` | plantillas que el cliente elige en *Página > Atributos* | varias páginas compiladas, conectadas desde el panel |
| `embedded-page` | un shortcode adentro del contenido | una pieza dentro de una página que el cliente ya administra |
| `elementor-widgets` | widgets propios en el constructor | el cliente edita ese componente y los widgets de fábrica no alcanzan |

**El mapa completo —las siete rutas, las cinco preguntas y los casos A a G—
está en [`references/modos.md`](references/modos.md).** Leerlo antes de escribir
la configuración, porque tres de esas rutas no son modos de este skill y se
eligen igual.

Dos reglas de ahí que conviene tener presentes acá:

- **Nunca elegir Elementor porque esté instalado.** La pregunta es si alguien va
  a editar ahí adentro, y hay que poder nombrarlo.
- **Nunca fragmentar un diseño terminado.** Lo que llegó resuelto del build se
  queda resuelto.

Y las dos rutas que se saltean más seguido, las dos por el mismo reflejo de
pasar de "compilado" a "widget propio" como si no hubiera nada en el medio:

- **Si el componente se puede armar con los widgets que Elementor ya trae, se
  arma así** y este skill no participa de esa región. Un widget propio sólo
  agrega código para mantener.
- **Si el contenido cambia solo** —precios, productos, últimas entradas— y nadie
  va a mover nada, eso tampoco es un widget: es la página compilada leyendo
  datos por `wp-json`, declarado en el blueprint como `runtime_content` con
  `owner: cms`.

## Uso

1. Declarar el plugin en `wordpress.config.json`, en la raíz del proyecto:

   ```json
   {
     "slug": "portada-astro",
     "name": "Portada Astro",
     "description": "Portada compilada del sitio.",
     "author": "Estudio",
     "version": "0.1.0"
   }
   ```

   El `slug` manda: de ahí salen el nombre del archivo, el prefijo de las
   constantes PHP y el de las funciones. `constPrefix` y `fnPrefix` se pueden
   declarar si hace falta otra cosa.

   **Una configuración sin `mode` es una configuración de portada.** Eso no va a
   cambiar: es la forma del archivo que ya está instalada en sitios vivos.

   **Subí `version` en cada entrega.** WordPress compara ese número para decidir
   si hay actualización; reempaquetar sin cambiarlo puede dejar la versión vieja
   instalada sin que nadie se entere.

2. Publicar:

   ```bash
   node scripts/publish.mjs --project .
   ```

   Construye, exporta, verifica y empaqueta, en ese orden y cortando en el
   primer fallo. Es un solo paso porque los cuatro van siempre juntos: la
   fricción no está en cada uno, está en acordarse de los cuatro cada vez que
   se corrige una palabra, y en que saltear la verificación no cuesta nada. Un
   ZIP que sale de un paquete no verificado es peor que no tener ZIP, porque se
   sube igual y rompe el sitio en vivo.

   `--skip-build` sirve cuando el `dist/` ya está al día.

3. Subir el ZIP desde el panel de WordPress: Plugins → Añadir nuevo → Subir
   plugin, y activarlo. Es lo único manual, y es a propósito: instalar plugins
   por API pide credenciales del sitio, que es una decisión de quien lo opera y
   no algo que esta herramienta deba tomar.

   Según el modo, después queda un paso más: asignar la plantilla a una página,
   o insertar el shortcode. `publish.mjs` lo dice al terminar.

Los tres pasos internos se pueden correr sueltos: `scripts/export-plugin.mjs`,
`scripts/validate-plugin.mjs` y `scripts/package-plugin.mjs` aceptan
`--project`, `--plugin`, `--config` y `--out`.

El empaquetado no usa la herramienta del sistema a propósito. `Compress-Archive`
en Windows guarda las rutas con barra invertida y el formato ZIP exige barra
normal: PHP puede terminar creando un archivo cuyo nombre contiene la barra
invertida, en vez de la carpeta que correspondía, y el plugin se instala sin
encontrar nada. El script lo escribe con `zlib`, que viene con Node, y las
rutas quedan siempre con barra normal.

## Cómo se declara cada modo

### `front-page`

Nada más que lo de arriba. El plugin interviene **sólo** cuando la petición es
la portada pública, y deja pasar sin tocar nada administración, AJAX, feeds,
embeds y cualquier otra ruta.

### `page-template`

```json
{
  "slug": "sistema-paginas",
  "mode": "page-template",
  "variant": "canvas",
  "pages": [
    { "id": "servicios", "label": "Servicios (compilada)" },
    { "id": "nosotros", "label": "Nosotros (compilada)", "source": "dist/nosotros/index.html" }
  ]
}
```

`label` es lo que el cliente ve en el desplegable, así que es obligatorio.
`source` cae por defecto en `dist/<id>/index.html`. Sin tema hijo: alcanza con
el filtro `theme_page_templates`.

`variant` decide de quién es el documento. `canvas` se queda con el documento
entero, como la portada. `theme` deja la cabecera y el pie del cliente en su
lugar y aporta sólo el cuerpo — con lo que eso implica: el CSS compilado viaja
acotado bajo una raíz propia, y los assets se encolan en vez de imprimirse.

`theme` depende de que el tema implemente `get_header()` y `get_footer()`, que es
lo normal en un tema clásico. **Un tema de bloques puede no tenerlas y dejar la
página sin cabecera ni pie:** comprobarlo en staging, y si no las ofrece, usar
`canvas`.

Dos cosas que este modo no toma, a propósito: las **páginas protegidas con
contraseña** —las sigue resolviendo WordPress, porque la plantilla imprime el
cuerpo compilado sin preguntar nada— y cualquier ruta que no sea una página
singular, incluida la tienda de WooCommerce, que es un archivo aunque tenga una
página asignada.

### `embedded-page`

```json
{
  "slug": "sistema-piezas",
  "mode": "embedded-page",
  "shortcode": "sistema_pieza",
  "pages": [{ "id": "comparativa", "label": "Tabla comparativa" }]
}
```

Después, en el contenido: `[sistema_pieza id="comparativa"]`.

Los assets se encolan sólo donde el shortcode aparece, y se detecta antes de
`wp_head` leyendo el contenido de la entrada: si se encolara recién al ejecutar
el shortcode, la hoja saldría en el pie y la pieza parpadearía sin estilos.

### `elementor-widgets`

```json
{
  "slug": "sistema-widgets",
  "mode": "elementor-widgets",
  "category": "Brand System",
  "widgets": [
    {
      "id": "grilla-productos",
      "label": "Grilla de productos",
      "controls": [{ "name": "titulo", "type": "text", "label": "Título" }],
      "data": [{ "name": "productos", "source": "woocommerce.products", "limit": 8 }]
    }
  ]
}
```

El exportador genera la plomería: detección de Elementor, categoría propia,
clases que extienden `Widget_Base`, los controles declarados, y un proveedor que
consulta WooCommerce o WordPress **por sus funciones, nunca por SQL** —
`wc_get_products` respeta visibilidad, stock, idioma y cualquier filtro que el
sitio tenga puesto; una consulta a mano se los saltea todos.

**El cuerpo visible de cada widget queda en `widgets/<id>.php` y se edita a
mano.** Es el único archivo del paquete pensado para eso: ahí entra el markup
que el build ya resolvió. Un componente de dominio real depende del catálogo y
del diseño de ese cliente, y no hay forma honesta de inventarlo desde acá.

Dos declaraciones se rechazan al exportar, y son la misma idea: un widget que se
llama como un ladrillo de Elementor —heading, párrafo, ícono, espaciador—, y un
widget que no declara ningún control de contenido ni ninguna fuente de datos. Si
no se puede nombrar lo que cambia, no hace falta un widget.

## Qué hace el exportador

No inventa nada. Lee el HTML construido, lo separa en head y body, y:

- **saca lo que WordPress ya emite** — charset, viewport, description,
  theme-color, icono y title. Duplicarlos deja un head que nadie puede depurar;
- **reescribe cada URL de asset** a `esc_url( <PREFIJO>_URL . 'dist/...' )`,
  porque dentro de un plugin la raíz del sitio es la de WordPress;
- **reescribe también las URLs dentro del CSS empaquetado**, que apuntan a la
  raíz igual que el HTML y se olvidan seguido;
- **excluye los `.html` del paquete**: quedarían accesibles por URL directa, como
  una copia cruda de la misma página que Google puede indexar;
- **verifica que cada asset referenciado exista** antes de empaquetar.

En los modos que conviven con el tema en el mismo documento —`page-template`
variante `theme`, `embedded-page`, `elementor-widgets`— hace además dos cosas
que no son opcionales:

- **acota el CSS compilado** bajo una raíz propia, incluidos los `<style>` en
  línea. Una regla sobre `body` no distingue entre la pieza y la cabecera del
  cliente;
- **rechaza, con archivo y salida, el CSS que no sabe acotar**: un `@import` —que
  trae una hoja que nadie miró—, una regla anidada, una at-rule desconocida, o un
  selector del que queda una raíz suelta. No es conservadurismo: son justo los
  casos que la auditoría posterior **tampoco** ve, porque los lee como el cuerpo
  de otra regla. Transformarlos a ciegas produce la única fuga que ninguna
  compuerta detecta;
- **saca los módulos del cuerpo** para encolarlos. Astro deja sus scripts
  cerrando el `<body>`; si viajan adentro del fragmento, dos inserciones en la
  misma página ejecutan el mismo módulo dos veces.

Falla en lugar de producir un paquete a medias.

## Qué verifica el validador

El exportador revisa lo que puede mientras genera. El validador revisa el
artefacto terminado, que es lo que realmente se instala. Son dos capas.

**Comunes a cualquier modo:**

- están el archivo principal, la hoja de aislamiento y el build;
- ningún `.php` conserva marcadores sin renderizar, y todos cortan el acceso
  directo;
- **cada `.php` parsea** (ver la sección siguiente);
- la cabecera declara una versión `x.y.z` **y coincide con la constante**: si
  divergen, el navegador puede servir el CSS viejo sobre el HTML nuevo;
- ninguna URL apunta a la raíz del sitio, y cada asset citado está en el paquete;
- el paquete declara su modo, y coincide con el que pide la configuración.

**Propias del modo**, que las aporta su exportador:

- `front-page` — la plantilla conserva `wp_head`, `wp_body_open` y `wp_footer`,
  y el plugin limita su alcance con `is_front_page`;
- `page-template` — las plantillas están registradas en `theme_page_templates`;
  `canvas` conserva los tres hooks, `theme` conserva `get_header` y `get_footer`
  y **no desencola nada** (la cabecera del cliente está en la misma página y
  necesita sus estilos);
- `embedded-page` — el shortcode está registrado y ningún fragmento trae
  etiquetas de documento;
- `elementor-widgets` — hay guard de Elementor, categoría propia, clases que
  extienden `Widget_Base`, y nada se imprime sin pasar por un escapador.

**El aislamiento se mide, no se declara.** En los modos que acotan CSS, el
validador vuelve a auditar cada hoja empaquetada con `audit-foreign-css.mjs` —la
misma herramienta que juzga el CSS de Astra y de Elementor— y rechaza el paquete
si queda una sola regla fuera de la raíz. Que la herramienta que juzga sea otra
que la que transforma es lo único que vuelve confiable a la transformación.

Un paquete incompleto no falla al generarse: falla en el sitio del cliente.

## El plugin generado

Se niega a activarse si le falta el build. Es preferible un plugin que no
enciende a una página en blanco en producción.

**Se defiende de su propia copia duplicada.** Dos carpetas con el mismo plugin
activas a la vez declaran las mismas constantes y las mismas funciones, y PHP
corta con *Cannot redeclare*. No es hipotético: pasó con un paquete generado
desde una carpeta de trabajo desactualizada, cuyo número de versión quedó por
encima del que estaba vivo. La segunda copia ahora se retira sola y lo avisa en
el panel.

Agrega una clase estable al `body` —o una raíz propia, según el modo— que la
hoja de aislamiento usa para acotar sus reglas.

## Lo primero que se verifica de un PHP es que sea PHP

`scripts/validate-plugin.mjs` lo corre solo, sobre cada `.php` del paquete. No
hace falta tener PHP instalado: `scripts/lint-php.mjs` recorre el archivo
distinguiendo codigo de cadenas, comentarios y heredocs, y verifica que todo
cierre.

Existe porque falto. Una linea generada quedo como

```php
'<link ... onload="this.media='all';this.onload=null" />'
```

donde las comillas del JavaScript cortaron la cadena PHP. El paquete paso las
cinco comprobaciones de instalabilidad —ninguna miraba si el PHP parseaba—, se
empaqueto, se instalo y tiro el sitio entero.

Contar comillas no alcanza: en ese archivo balanceaban, porque la cadena cerraba
antes de `all` y volvia a abrir despues. Lo que delata el corte es que tras
cerrar una cadena aparezca una palabra pegada, cosa que PHP nunca acepta.

Una plantilla es HTML con islas de PHP, asi que fuera de las etiquetas no se
lee nada: las comillas de un atributo HTML no son comillas de codigo.

Por la misma razón, la configuración rechaza un `name`, una `description` o una
etiqueta con comilla simple: ese texto viaja adentro de una cadena PHP y la
corta. Si hace falta un apóstrofo, va el tipográfico (’).

## Cuando la página compilada aloja algo de WordPress

En los modos que se quedan con el documento —`front-page` y `page-template`
variante `canvas`— el paquete reemplaza la página entera, así que por defecto
**no entra ninguna hoja de estilos del sitio**. Es una lista blanca: lo que no
está declarado no pasa, y por eso el plugin que se instale mañana tampoco se
filtra.

Pero una página sigue alojando componentes de WordPress a propósito — un popup,
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

**Si algo aparece sin estilos, preguntale a la página qué bloqueó.** Estando
logueado como administrador:

```
https://sitio.com/?<slug>-styles=audit
```

En el código fuente de la página quedan listados los handles quitados con su
origen. Un visitante nunca ve nada de esto.

También se puede ampliar la lista sin reempaquetar, con el filtro
`<fn_prefix>_allowed_styles`.

## Actualizar

Subir `version` en `wordpress.config.json`, correr `scripts/publish.mjs` y subir
el ZIP nuevo. El plugin no guarda estado propio: todo lo que muestra viene del
build, así que reemplazarlo no pierde nada.

**Verificar una publicación tiene dos cachés, no una.** La del sitio —WordPress,
el hosting, el CDN— y la del navegador de quien mira. Un teléfono puede
conservar el HTML viejo y el CSS viejo a la vez, así que la página se ve
coherente y sólo fallan los detalles que cambiaron. La comprobación se hace en
ventana privada **y** desde un teléfono.

Y se hace sin sesión iniciada: con sesión, WordPress carga estilos que un
visitante nunca recibe.

Si lo que cambió es contenido y no diseño, el cambio no empieza acá: empieza en
el contrato de contenido del proyecto. El calibrador de `visual-tuning-kit`
propone, una persona aprueba, `apply-content.mjs` lo escribe en el manifiesto, y
recién entonces se publica. Editar el HTML compilado o la plantilla del plugin
deja el sitio y su contrato diciendo cosas distintas, y el siguiente build
revierte el cambio sin avisar.
