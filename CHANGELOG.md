# Changelog

## Unreleased

`visual-tuning-kit` 0.3.0 — el editor de la otra línea, con derivación automática

El editor visual que faltaba ya existía: la línea de Codex lo tenía terminado
—selección contextual, edición de texto en la página, elección de imagen
acotada a una carpeta, orden de secciones, changeset auditable, panel aislado
con Shadow DOM— mientras acá se construía otro en paralelo. Se adopta ese, y el
`site-tuner` propio se retira.

La auditoría cruzada funcionó; llegó tarde. Antes de abrir un frente conviene
mirar qué hizo el otro motor: un `git fetch` y leer el CHANGELOG habría evitado
el trabajo duplicado.

Lo que esta línea aporta al kit, que es justo su punto débil —el trabajo manual
por proyecto—:

**`derive-schema.mjs`.** El contrato se escribía a mano, control por control.
Ahora se deriva del código: cada `var(--nombre, valor)` es un punto de ajuste
que el autor ya declaró, con su default al lado; también cuenta el mismo patrón
leído desde JavaScript. El rango sale del valor que el proyecto eligió, y cada
control lleva un `rationale` que nombra el archivo del que salió, para que se
pueda revisar en vez de creer. Contra un proyecto real recuperó los 28
controles escritos a mano, ninguno menos, y propuso doce más que el proyecto ya
parametrizaba.

Los valores se emiten en **borrador y sin firmar**. Aprobar es del usuario, y
la revisión del repositorio comprueba que un borrador no pase como aprobado.

**`map-content.mjs`.** Los controles de texto necesitan un `content_path`, y
saber qué elemento tiene qué campo suele exigir anotar cada componente. No hace
falta: el texto del manifiesto es su propia señal. Un campo que aparece
exactamente una vez queda vinculado; uno ambiguo o ausente se informa y no se
ofrece para editar. Contra un sitio real vinculó 36 de 40 textos sin tocar un
solo componente.

**Unidades ampliadas en el contrato.** El enum admitía `px`, `rem`, `vw`, `vh`,
`%` y `deg`. Un proyecto real usa además `ch` para ancho de texto, y `s` y `ms`
para duraciones: sin ellas, esos controles no se pueden declarar. Es una
divergencia deliberada respecto de la otra línea, disponible para que la tome.

Publicación inicial de la línea Claude, con los tres skills base y las dos
herramientas que faltaban para llegar de una referencia a una web publicada.

### site-tuner 0.3.0 — el contrato se genera y el contenido se vincula

`map-content.mjs` vincula el CONTENT_MANIFEST con la página renderizada: qué
texto del contrato aparece en pantalla y dónde. Es el paso previo a editar
textos, y no exige anotar los componentes — el texto del manifiesto es su
propia señal.

Un campo que aparece exactamente una vez queda vinculado. Uno que aparece dos
veces o ninguna se informa y no se ofrece para editar: adivinar cuál era
terminaría escribiendo en el contrato algo que nadie pidió. Para esos casos, un
componente puede declarar `data-content-key`, que tiene prioridad.

El informe vale aunque no se edite nada: mide cuánto de la página sale
realmente del manifiesto. Contra un sitio real, 36 de 40 textos quedaron
vinculados sin tocar un solo componente, y los cuatro restantes resultaron ser
divergencias reales —un título que se renderiza como líneas sueltas, dos
botones con el mismo texto— y no fallas del método.

### site-tuner 0.2.0 — el contrato se genera

Declarar treinta controles a mano por proyecto era el trabajo que impedía que
el calibrador existiera para el segundo sitio. `generate-tuning.mjs` lo deriva
del código.

La señal estaba a la vista: cada `var(--nombre, valor)` es una variable que
quien construyó el sitio decidió dejar regulable, con su valor por defecto al
lado. También cuenta el mismo patrón escrito desde JavaScript, un helper que
lee la variable con un default — que es como se declara justo lo que los
scripts animan.

El rango sale del valor que el proyecto eligió, nunca de una tabla: una
proporción entre 0 y 1 se acota a 0–1, un ángulo se abre simétrico alrededor de
cero, una longitud se abre hacia abajo y hacia arriba. Cada control anota en
`derived_from` el archivo de donde salió; un control sin ese campo lo decidió
una persona, y conviene que se note.

Contra un proyecto real recuperó los 28 controles que un humano había escrito a
mano, y propuso otros doce que el proyecto parametriza y nadie había expuesto.
Por eso es un punto de partida y no el contrato final: lo que no merece estar
en el panel se saca.

### site-tuner 0.1.0

El ajuste fino que quedaba a mano después de reconstruir una referencia:
mover, achicar, cambiar dónde corta una línea.

Un calibrador, no un editor visual. Sólo existe lo que el proyecto declaró en
su contrato: un control no declarado no aparece, y un valor fuera de rango no
se guarda. El panel vive únicamente en desarrollo; los valores aprobados se
compilan al sitio.

El motor salió de un rediseño real y no sabía nada de ese proyecto, así que
viaja tal cual. Lo nuevo es el contrato que lo gobierna —
`tuning-contract.schema.json` — y su validador, que verifica tres cosas
distintas: que el contrato tenga la forma declarada, que cada control sea
coherente consigo mismo, y que los valores aprobados —los que sí se compilan—
sigan dentro de lo declarado aunque alguien haya editado el archivo a mano.

Un control que no declara ningún efecto se rechaza: ocupa lugar en el panel y
da la impresión de que algo cambió.

### wordpress-publisher 0.1.0

La portada compilada, adentro de un WordPress que sigue vivo.

Interviene sólo en la portada pública. Administración, AJAX, feeds, cuenta,
registro y tienda siguen siendo de WordPress. En la portada desencola los
estilos visuales del tema y de los page builders, y deja intactos scripts,
analítica, píxeles y consentimiento: aislar de más rompe el sitio del cliente,
aislar de menos deja la portada peleando con el tema.

El exportador no inventa: separa head y body del build, saca lo que WordPress
ya emite, reescribe cada URL de asset —también las que viven dentro del CSS
empaquetado— y falla si algo no cierra. El validador revisa el artefacto
terminado, que es lo que realmente se instala: un paquete incompleto no falla
al generarse, falla en la portada del cliente.

La plantilla del plugin viene de un caso real y quedó parametrizada: el `slug`
manda, y de ahí salen el archivo, las constantes y las funciones.

### Los tres skills base

Llegan en el estado en que los dejó la línea de Codex, con las compuertas de
evidencia ya endurecidas: las afirmaciones observadas necesitan evidencia, la
cobertura declarada tiene que estar respaldada, y ningún bloque puede afirmar
hallazgos sin una observación que los sostenga.
