# Cómo se elige el modo

Antes de generar nada hay que decidir qué parte de WordPress ocupa el paquete.
La decisión no es de gusto: cada modo entrega una cosa y cobra otra, y elegir
mal se paga después, cuando el sitio ya está publicado.

El principio que ordena todo:

> **Elementor para lo que necesita ser editable como estructura o contenido
> dinámico. Código generado para lo que necesita máxima fidelidad, libertad
> visual y no necesita edición granular.**

Dos reglas que no se negocian:

- **Nunca elegir Elementor porque esté instalado.** Que el sitio lo tenga no es
  un argumento. La pregunta es si alguien va a editar ahí adentro.
- **Nunca fragmentar un diseño terminado.** Partir una pieza en widgets para que
  "se pueda mover" garantiza que alguien la mueva, y entonces el diseño deja de
  existir. Lo que llegó resuelto del build se queda resuelto.

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
   Es la única pregunta que justifica un widget, y hay que poder nombrar a la
   persona que lo va a mover.

## Los casos

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
  La cabecera y el pie del tema no aparecen. Es lo que se quiere cuando la
  página compilada *es* la página.
- **`theme`** — la pieza es el cuerpo, adentro del documento del tema. La
  cabecera, el menú y el pie siguen siendo los del cliente, y siguen
  actualizándose desde WordPress. Se paga con fidelidad: el CSS compilado viaja
  acotado bajo una raíz propia para no tocar lo que el tema dibuja alrededor.

Si el menú del sitio tiene que seguir siendo el menú de WordPress, la respuesta
es `theme`. Si la pieza pierde sentido con una cabecera ajena encima, es
`canvas`.

### C · Una pieza adentro de una página que el cliente ya administra

La página existe, tiene su contenido, y hay que meter una sección compilada en
el medio. O la misma sección en cinco páginas distintas.

→ **`embedded-page`.** Un shortcode, un id por pieza, y los assets encolados
sólo donde el shortcode aparece: una página que no lo usa no descarga nada.

El paquete puede llevar varias piezas a la vez, cada una con su id.

### D · El contenido cambia solo, pero la forma no se toca

Precios que se actualizan, productos que entran y salen, las últimas entradas
del blog. Nadie va a mover nada: lo único que tiene que estar al día es el dato.

→ **No es un widget de Elementor.** Es la página compilada, que conserva su
forma, leyendo los datos de WordPress por su API REST (`wp-json`).

Este caso es el que más se confunde con el E, y confundirlos es caro: se
fragmenta un diseño terminado para resolver algo que no necesitaba fragmentarse.
La diferencia es quién cambia el contenido. Si lo cambia **el sistema**
—porque se cargó un producto, porque se publicó una entrada— es este caso. Si lo
cambia **una persona editando**, es el E.

En el blueprint del sitio esto se declara antes de construir: la sección lleva
`runtime_content` con `owner: cms`, la fuente y qué tolera. El build deja el
lugar preparado y el dato llega en vivo.

### E · El cliente tiene que editarlo adentro del constructor

Alguien va a entrar a Elementor y va a cambiar ese componente: el texto de una
ficha, qué categoría muestra una grilla, el orden de unas preguntas frecuentes.

→ **`elementor-widgets`**, y sólo para ese componente. El resto de la página
sigue compilado.

Lo que se construye acá son **componentes de dominio completos**: una grilla de
productos, un bloque de preguntas frecuentes, una ficha, un listado filtrable.
Nunca ladrillos —título, párrafo, ícono, espaciador, botón—: Elementor ya los
trae, y hacer los propios es la forma más rápida de que el diseño se desarme.

El exportador rechaza dos cosas, y las dos son la misma:

- un widget que se llama como un ladrillo;
- un widget que no declara ningún control de contenido ni ninguna fuente de
  datos. Si no podés nombrar lo que cambia, no necesitás un widget.

Los datos de WooCommerce se piden siempre por sus funciones —`wc_get_products`—
nunca por SQL: esas funciones respetan visibilidad, stock, idioma y cualquier
filtro que el sitio tenga puesto, y una consulta a mano se los saltea todos.

## Lo que Astro sigue siendo

La fuente, en los cinco casos. El orden no cambia nunca:

```
astro build  →  dist  →  wordpress-publisher  →  el modo elegido
```

Astro no corre adentro de WordPress. Para las partes que sí van a Elementor, el
build es la **referencia visual**: de ahí sale el markup que se pega en el
cuerpo del widget, y el widget lo vuelve dinámico. No hay una compilación
intermedia que reconstruya la página dentro del editor.

## Si la respuesta sigue sin ser obvia

Elegir el modo más chico que resuelva el caso. Un `embedded-page` se puede
ascender a `page-template` sin rehacer el build; un widget que no hacía falta ya
partió el diseño y no se vuelve atrás sin rehacerlo.
