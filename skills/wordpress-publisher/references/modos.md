# Cómo llega un diseño a WordPress

La decisión no es qué modo usar: es **por qué ruta entra el diseño**. Cuatro de
las rutas son modos de este skill. Las otras tres no, y decir cuáles no están es
parte del mapa: una ruta que no figura se resuelve igual, pero a mano y sin que
nadie la revise.

El principio que ordena todo:

> **Elementor para lo que necesita ser editable como estructura o contenido
> dinámico. Código generado para lo que necesita máxima fidelidad, libertad
> visual y no necesita edición granular.**

Dos reglas que no se negocian:

- **Nunca elegir Elementor porque esté instalado.** La pregunta es si alguien va
  a editar ahí adentro, y hay que poder nombrarlo.
- **Nunca fragmentar un diseño terminado.** Partir una pieza en widgets para que
  "se pueda mover" garantiza que alguien la mueva, y entonces el diseño deja de
  existir.

## El mapa

| Ruta | Quién cambia el contenido | Qué conserva el cliente | Estado |
| --- | --- | --- | --- |
| `front-page` | nadie: es el build | todo el sitio menos la portada | **implementado** |
| `page-template` · `canvas` | nadie: es el build | el sitio; elige la plantilla por página | **implementado** |
| `page-template` · `theme` | nadie: es el build | además, su cabecera y su pie | **implementado** |
| `embedded-page` | nadie: es el build | la página entera alrededor de la pieza | **implementado** |
| **Elementor nativo** | el cliente, editando | su forma de trabajar | documentado, sin herramienta |
| `elementor-widgets` | el cliente, editando | edición nativa del componente | **implementado** (el cuerpo se escribe a mano) |
| **Datos en vivo** | el sistema (WP/Woo) | el dato al día, la forma fija | declarado en el blueprint |
| **Contrato para un ejecutor** | el cliente, editando | componentes nativos de verdad | no implementado en esta línea |

Las cuatro primeras son la misma idea en tres escalas de documento: el sitio, la
página, el fragmento. Las cuatro últimas son la pregunta difícil —qué pasa
cuando el contenido tiene que cambiar— y tienen cuatro respuestas distintas, no
una.

## Las cinco preguntas

Se responden antes de escribir la configuración, y la respuesta se deja
anotada: quien retome el trabajo dentro de seis meses necesita saber por qué
este paquete es como es.

1. **¿Es una página completa o un fragmento de otra página?**
   Una página completa puede quedarse con el documento. Un fragmento no: vive
   adentro de algo que ya existe.

2. **¿Alguien va a editar esto, campo por campo, desde el panel?**
   No "¿podría?". ¿Quién, y qué campo. Si la respuesta es "el teléfono" o "el
   precio", eso es un dato, no una estructura.

3. **¿El contenido sale de WordPress o de WooCommerce?**
   Productos, entradas, campos de JetEngine o ACF. Si sale de ahí, el contenido
   cambia sin que nadie toque el diseño.

4. **¿Se va a insertar en más de un lugar?**
   Una pieza que aparece en cinco páginas no puede ser una plantilla.

5. **¿Tiene que verse y moverse adentro del editor de Elementor?**
   Es la única pregunta que justifica un widget propio, y hay que poder nombrar
   a la persona que lo va a mover.

## Las rutas, una por una

### A · La portada nueva reemplaza a la del tema

Un WordPress vivo —tienda, cuentas, formularios— y una portada compilada que
tiene que ocupar su lugar sin tocar el resto.

→ **`front-page`.** Es el modo por defecto y el que menos supuestos hace.
WordPress sigue atendiendo todas las demás rutas.

### B · Varias páginas compiladas, y el cliente elige cuál usa cada una

Tres o cuatro piezas que el cliente asigna desde *Página > Atributos >
Plantilla*, sin que nadie tenga que tocar código para conectarlas.

→ **`page-template`.** Sin tema hijo. Dos variantes, y la pregunta que las
separa es de quién es el documento:

- **`canvas`** — la pieza se queda con el documento entero. Máxima fidelidad.
  La cabecera y el pie del tema no aparecen.
- **`theme`** — la pieza es el cuerpo, adentro del documento del tema. La
  cabecera, el menú y el pie siguen siendo los del cliente, y siguen
  actualizándose desde WordPress. Se paga con fidelidad: el CSS compilado viaja
  acotado bajo una raíz propia para no tocar lo que el tema dibuja alrededor.

Si el menú del sitio tiene que seguir siendo el menú de WordPress, la respuesta
es `theme`. Si la pieza pierde sentido con una cabecera ajena encima, es
`canvas`.

**Límite de `theme`:** depende de que el tema implemente `get_header()` y
`get_footer()`, que es lo normal en un tema clásico. Un tema de bloques puede no
tener esas plantillas y dejar la página sin cabecera ni pie. Comprobarlo en
staging antes de publicar; si no las ofrece, `canvas`.

Dos cosas que esta ruta **no** toma, a propósito: las páginas protegidas con
contraseña —las sigue resolviendo WordPress, porque la plantilla imprime el
cuerpo compilado sin preguntar nada— y cualquier ruta que no sea una página
singular, incluida la tienda de WooCommerce, que es un archivo aunque tenga una
página asignada.

### C · Una pieza adentro de una página que el cliente ya administra

La página existe, tiene su contenido, y hay que meter una sección compilada en
el medio. O la misma sección en cinco páginas distintas.

→ **`embedded-page`.** Un shortcode, un id por pieza, y los assets encolados
sólo donde el shortcode aparece: una página que no lo usa no descarga nada.

El paquete puede llevar varias piezas a la vez, cada una con su id.

### D · El cliente edita, y los widgets que Elementor ya trae alcanzan

Alguien va a entrar a Elementor a cambiar ese bloque, y lo que hay que cambiar
es texto, una imagen, un enlace, el orden de tres ítems. El diseño aprobado se
puede reproducir con los widgets que Elementor trae de fábrica sin pérdida que
importe.

→ **Elementor nativo, y este skill no hace nada.** Se arma en el editor, con sus
widgets, y el paquete compilado no entra en esa región.

Es la ruta que falta reconocer más seguido, y la que ahorra más trabajo. El
reflejo es saltar de "compilado" a "widget propio" como si no hubiera nada en el
medio, y casi siempre lo hay: **si el componente se puede armar con lo que
Elementor ya tiene, un widget propio sólo agrega código para mantener.**

Cuándo *no* alcanza: cuando reproducirlo nativamente exige tantas capas
anidadas que el cliente puede desarmarlo sin darse cuenta, cuando el diseño
depende de algo que Elementor no sabe hacer, o cuando la misma pieza tiene que
repetirse idéntica en muchos lugares.

Estado: **decisión documentada, sin herramienta.** Este skill no genera
plantillas de Elementor, y reconocer la ruta no cuesta nada; construirla sí.

### E · El contenido cambia solo, pero la forma no se toca

Precios que se actualizan, productos que entran y salen, las últimas entradas
del blog. Nadie va a mover nada: lo único que tiene que estar al día es el dato.

→ **No es un widget.** Es la página compilada, que conserva su forma, leyendo
los datos de WordPress por su API REST (`wp-json`).

Este caso es el que más se confunde con el F, y confundirlos es caro: se
fragmenta un diseño terminado para resolver algo que no necesitaba
fragmentarse. La diferencia es quién cambia el contenido. Si lo cambia **el
sistema** —porque se cargó un producto, porque se publicó una entrada— es este
caso. Si lo cambia **una persona editando**, es el F.

En el blueprint del sitio esto se declara antes de construir: la sección lleva
`runtime_content` con `owner: cms`, la fuente y qué tolera. El build deja el
lugar preparado y el dato llega en vivo.

Estado: **declarado en el blueprint, sin herramienta propia acá.** El
`wordpress-publisher` empaqueta la página; quién la alimenta es decisión del
proyecto.

### F · El cliente tiene que editar el componente adentro del constructor

Alguien va a entrar a Elementor y va a cambiar ese componente de maneras que los
widgets de fábrica no cubren: qué categoría muestra una grilla, el orden de unas
preguntas frecuentes, los campos de una ficha.

→ **`elementor-widgets`**, y sólo para ese componente. El resto de la página
sigue compilado.

Lo que se construye acá son **componentes de dominio completos**: una grilla de
productos, un bloque de preguntas frecuentes, una ficha, un listado filtrable.
Nunca ladrillos —título, párrafo, ícono, espaciador—: Elementor ya los trae, y
hacer los propios es la forma más rápida de que el diseño se desarme.

El exportador rechaza dos cosas, y las dos son la misma:

- un widget que se llama como un ladrillo;
- un widget que no declara ningún control de contenido ni ninguna fuente de
  datos. Si no podés nombrar lo que cambia, no necesitás un widget.

Los datos de WooCommerce se piden siempre por sus funciones —`wc_get_products`—
nunca por SQL: esas funciones respetan visibilidad, stock, idioma y cualquier
filtro que el sitio tenga puesto, y una consulta a mano se los saltea todos.

**Lo que este modo entrega y lo que no.** Entrega la plomería completa y segura:
registro con las APIs oficiales, categoría propia, controles declarados,
proveedor de datos, escapado. El **cuerpo visible** de cada widget queda en
`widgets/<id>.php` como andamio, para escribirlo a mano tomando el markup del
build. Un componente de dominio real depende del catálogo y del diseño de ese
cliente.

### G · Entregar un contrato y que otro lo implemente

Una variante de F que invierte quién construye: en vez de generar PHP y
empaquetarlo, se produce una **especificación portable y aprobada** del
componente —controles, datos, estados, responsive, criterios de aceptación— y se
entrega a un ejecutor que la implementa nativamente en el sitio, con su propia
autorización de escritura, separada de la aprobación del diseño.

Lo que cambia no es el resultado, es **qué se versiona**: el artefacto pasa a ser
el contrato, no el ZIP. Eso hace que el componente sea nativo de verdad —editable
como cualquier otro, sin código propio que mantener— y mueve el riesgo a otro
lado: alguien escribe en el sitio del cliente.

Estado: **no implementado en esta línea.** La otra línea del sistema lo está
explorando con su propio contrato y su propio ejecutor. Si se adopta acá,
cambiaría qué entrega el skill, no sólo cómo lo entrega, así que es una decisión
de producto y no un modo más.

## Lo que Astro sigue siendo

La fuente, en todas las rutas. El orden no cambia nunca:

```
astro build  →  dist  →  wordpress-publisher  →  la ruta elegida
```

Astro no corre adentro de WordPress. Para las partes que van a Elementor —D, F o
G— el build es la **referencia visual**: de ahí sale el markup, y el widget o la
plantilla lo vuelven editable. No hay una compilación intermedia que reconstruya
la página dentro del editor.

## Si la respuesta sigue sin ser obvia

Elegir la ruta más chica que resuelva el caso, en este orden: compilado antes
que nativo, nativo antes que widget propio, widget propio antes que contrato
delegado. Un `embedded-page` se puede ascender a `page-template` sin rehacer el
build; un widget que no hacía falta ya partió el diseño y no se vuelve atrás sin
rehacerlo.
