# Changelog

## Unreleased

`wordpress-publisher` 0.5.0 — lo primero que se verifica de un PHP es que sea PHP

Un plugin generado tiro un sitio en produccion. La causa: una linea quedo como

    '<link ... onload="this.media='all';this.onload=null" />'

donde las comillas del JavaScript cortaron la cadena PHP. El paquete paso las
cinco comprobaciones de instalabilidad —archivos presentes, sin marcadores,
hooks intactos, alcance limitado, assets resueltos— y **ninguna miraba si el PHP
parseaba**.

`lint-php.mjs` lo comprueba sin necesitar PHP instalado: recorre el archivo
distinguiendo codigo de cadenas, comentarios y heredocs, y verifica que todo
cierre. `validate-plugin.mjs` lo corre sobre cada `.php` del paquete.

Dos cosas que costaron y valen anotarse:

**Contar comillas no alcanza.** En el archivo roto balanceaban: la cadena
cerraba antes de `all` y volvia a abrir despues. La primera version del linter
dio verde. Lo que delata el corte es que tras cerrar una cadena aparezca una
palabra pegada, cosa que PHP nunca acepta.

**Una plantilla es HTML con islas de PHP.** Leer todo el archivo como codigo
convierte cualquier `front-page.php` en un falso positivo, porque las comillas
de un atributo HTML no son comillas de codigo.

Y la prueba de CI tambien estuvo mal escrita: inyectaba el error sobre una copia
del paquete, la copia salia incompleta, y la validacion fallaba por archivos
ausentes. La prueba pasaba con el linter apagado. Ahora se inyecta sobre el
paquete real y se restaura, asi solo puede fallar por lo que se quiere probar
— verificado apagando el linter.

Tambien se saca el truco que causo todo: cargar el CSS ajeno con `media="print"`
y un `onload` para no bloquear el primer pintado. Cincuenta kilobytes no
justifican esa complejidad. Un `<link>` normal, por concatenacion, sin una sola
barra invertida.

`wordpress-publisher` 0.4.0 — cuando la portada aloja algo de WordPress

La lista blanca de estilos funcionó demasiado bien: un popup montado desde el
sitio aparecía en la portada con su markup y sin una sola regla. Es el caso que
la inversión destapó, y no se resuelve volviendo a la lista negra.

**`audit-foreign-css.mjs`.** Antes de admitir una hoja ajena, medir qué le haría
a la página. La pregunta no es si el plugin es confiable: es cuánto de esa hoja
se acota sola bajo su propia clase raíz y cuánto pisa la página entera. Sobre
plugins reales: Elementor acota el 98% de sus 689 selectores y sus 13 reglas
globales son inertes —necesitan una clase, una condición, o no aplican—; el CSS
de un tema típico acota el 68% y trae 107 reglas que redefinen `body`, `h1` y
`h2` con tipografía y espaciado.

No decide: mide y muestra las reglas globales con sus declaraciones, porque
juzgarlas es de una persona. Un `.animated` que necesita su clase es inerte; un
`body:after` con `display:none` también; un `body { font-family }` no.

La primera versión daba "segura" para el CSS de un tema que resetea `body` y
todos los encabezados. La causa: `@charset "UTF-8";` es una at-rule sin bloque,
y el parser asumía que todas tienen; desde ahí perdía sincronía y marcaba cada
regla como condicional, es decir inofensiva. Se vio probando contra una hoja que
debía fallar. Una compuerta que solo se prueba con casos que pasan no prueba
nada.

**`allowedStyles` en `wordpress.config.json`.** Lo que resulte seguro se declara
por sitio, con `*` final para familias de handles generados —los
`elementor-post-1234` que se emiten por popup—. Un handle mal escrito se rechaza
al exportar: si no, no permitiría nada y el componente aparecería sin estilos
sin que nadie sepa por qué.

**Y la portada puede decir qué bloqueó.** Con `?<slug>-styles=audit`, estando
logueado como administrador, el código fuente lista los handles quitados con su
origen. Adivinar cuál declarar costaba varias vueltas de empaquetar y mirar.

La plantilla del plugin pasa además de lista negra a lista blanca, con el filtro
`<fn_prefix>_allowed_styles` para ampliarla sin reempaquetar.

`reference-lab-builder` 0.3.0 — qué respalda a cada demo

El laboratorio no distinguía una demo apoyada en una observación —donde el
escáner se comprometió con un modo, una confianza y su evidencia— de una
apoyada en material que el documento registra sin afirmar. Quien aprobaba el
checkpoint firmaba "entendimos el sistema" sin poder ver dónde el escaneo se
había comprometido.

Medido sobre un escaneo real: de las 18 rutas que citaban sus siete demos, 8
eran observaciones y 10 no. Y la demo de aspecto más confiado —el panel de
navegación, con cuatro rutas citadas— resultó ser la menos respaldada: 1 de 4.

Ahora cada demo lleva su sello en la página y el bloque `source` lo dice ruta
por ruta. Una demo sin observación detrás no falla ni se rechaza: es un hecho
que la persona que aprueba tiene que ver.

`reference-to-astro` 1.4.0 — traducir de vuelta lo que devuelve un editor externo

Probado contra VvvebJs y la portada compilada de un sitio real. El editor
preserva los `data-rta-id`: las 42 anclas sobreviven a la exportación y 39
salen byte a byte idénticas. Lo que no sobrevive intacto es todo lo demás.

**Exportar serializa el DOM vivo**, así que el estado momentáneo del sitio queda
horneado como si fuera markup escrito. En una exportación sin editar nada
aparecieron 13 elementos con una clase de transición de página, 36 estilos
inline que había escrito el script de scroll, y varios atributos de
inicialización. Publicar eso como fuente deja el sitio con una transición a
medio salir, permanente.

`review-changeset.mjs` compara por ancla, con JavaScript apagado para que
parsear no ejecute el sitio. El estado repartido entre varios elementos se
filtra y se informa; el que vive en un solo elemento —un header compactado, un
ítem activo— se marca por convención de nombres y se deja para que lo juzgue una
persona, en vez de descartarlo en silencio. Un proyecto puede declarar su
vocabulario de runtime con `--ignore-classes` e `--ignore-attributes`.

Sobre una edición real de tres ajustes, devolvió la regla CSS exacta que se
tocó, sin un solo falso positivo.

No aplica nada por su cuenta. Traducir una regla CSS al componente que la posee,
en las unidades que ese componente ya usa, es un juicio. Lo que el script saca
del medio es adivinar *qué* cambió.

Y deja medido el límite: 42 anclas sobre 582 elementos. Lo que ocurra fuera de
un ancla no se puede atribuir, y eso es una carencia del build, no del editor.

`visual-tuning-kit` 0.6.0, `reference-to-astro` 1.3.0 — auditoría cruzada: el editor de la otra línea, y el checkpoint que faltaba

La línea de Codex adoptó `derive-schema.mjs`, `map-content.mjs`, el enum de
unidades extendido y el `wordpress-publisher` completo. Reescribieron la lógica
a sus convenciones; los algoritmos son los mismos. De vuelta viene más de lo que
fue.

**El checkpoint `content-architecture` ya no está sin herramienta.**
`build-content-architecture.mjs` renderiza el SITE_BLUEPRINT como página de
revisión: rutas, recorrido de lectura, mapeo de cada sección a su contenido y a
sus patrones de referencia, intención responsive, contenido excluido, recorridos
de conversión y el estado de los checkpoints, con sello de aprobación a la
vista. Era el hueco que este repositorio había registrado: dos checkpoints
tenían skill que producía un artefacto y el tercero se aprobaba contra nada.

**Anclas estables de revisión.** `data-rta-id` sobre el HTML compilado, con
rutas semánticas que sobreviven al build. La frontera está escrita: la
exportación de un editor externo es evidencia de revisión, no código fuente.

**Un tipo de control `navigation`.** Editar el menú con etiquetas acotadas,
destinos validados contra una lista de dominios, visibilidad y orden. La
validación vive en el endpoint de guardado y no en el cliente, que es el lugar
correcto. `apply-content.mjs` ahora lo lleva al contrato de contenido junto con
texto, líneas, imagen y orden de secciones, comprobando la forma de cada
elemento: un `target` inválido no aplica nada.

**`editor-boundary.md`**, que escribe la doctrina que faltaba: qué controles
pertenecen al ajuste final y cuáles cruzan al constructor de páginas. La línea
que importa — el arrastre libre optimiza un viewport rompiendo otro, así que el
movimiento se representa como intención de grilla, alineación, span, orden o un
desplazamiento óptico acotado.

`visual-tuning-kit` 0.4.0, `wordpress-publisher` 0.3.0, `reference-to-astro` 1.2.0 — el día después de la primera versión

Lo que se gana generando la primera versión de un sitio se pierde después si
corregir una palabra cuesta cuatro pasos y encima no sobrevive. Tres cambios
sobre esa parte del recorrido.

**Cuatro de los siete tipos de control no llegaban a producción.**
`build-approved-css.mjs` sólo emite variables CSS, así que los controles con
`content_path` —`text`, `text-lines`, `image` y `section-order`— se editaban en
el panel, se aprobaban, y el siguiente build los perdía. El contrato ya preveía
`target.content_path`; faltaba quien lo escribiera.

`apply-content.mjs` lleva el valor aprobado de vuelta al `CONTENT_MANIFEST`, que
es el archivo canónico: el panel propone, una persona aprueba, el contrato se
actualiza y el sitio se reconstruye desde ahí. Rechaza borradores con la misma
regla que el CSS, no escribe nada si alguna ruta no resuelve —en vez de aplicar
la mitad—, no crea claves que no existan, y correrlo dos veces no cambia nada.
Reordenar secciones no descarta las que el orden no nombra: quedan al final, en
su orden original, en lugar de desaparecer del sitio en silencio.

**Publicar es un paso.** `publish.mjs` construye, exporta, verifica y empaqueta,
cortando en el primer fallo. La fricción no estaba en cada comando: estaba en
acordarse de los cuatro cada vez, y en que saltear la verificación no costaba
nada. Un ZIP que sale de un paquete no verificado se sube igual y rompe la
portada en vivo. Lo único manual sigue siendo subirlo, y es a propósito.

**`fidelity_target` gobierna la ceremonia.** Era un campo obligatorio del
contrato que nadie leía, mientras el escáner ya graduaba su profundidad. Ahora:

| Objetivo | Checkpoints | Decisiones abiertas | Patrones |
| --- | --- | --- | --- |
| `directional` | pueden quedar pendientes | permitidas, registradas | cualquier modo |
| `high` | aprobados o saltados con motivo | ninguna | cualquier modo |
| `forensic` | aprobados o saltados con motivo | ninguna | sin `inferred` |

`directional` es el caso frecuente: la referencia es un punto de partida y a
menudo no hay escaneo de marca. Registrar una decisión abierta es mejor que
cerrarla para conformar a un validador.

La aprobación humana se pide en los tres niveles, y las compuertas que impiden
inventar —que el plan cubra el contenido y que cada patrón resuelva en una
observación con evidencia— son idénticas. **Bajar el objetivo baja el protocolo,
nunca la honestidad.**

`reference-scanner` 0.8.0, `reference-to-astro` 1.1.0 — una observación tiene que apuntar a lo que el documento dice

**Compuerta 7: las rutas de observación resuelven en el documento.**
`observations[].path` es la dirección que los demás skills citan para justificar
una decisión. Si no resuelve, el escáner afirmó algo que no escribió, y el
índice queda como una lista de etiquetas donde quien cita no tiene dónde mirar.

Contra un escaneo forense real, **9 de 21 observaciones no resolvían**: la
observación se llamaba `motion.process_cards` y el dato vivía en
`motion.scroll.process`. Ninguna compuerta lo veía. El fixture del propio
repositorio tenía cuatro casos del mismo tipo, por un guion bajo donde iba un
guion medio.

Incluye lo ausente: observar que no hay video es un hallazgo, y el lugar de un
hallazgo es el documento. Se registra el dato y la observación lo señala.

**Un resolvedor de rutas que entiende arreglos por id.** `components` es un
arreglo de objetos con `id`, así que `components.global-header.states` no
resolvía con un descenso por claves. Ahora un segmento puede ser una clave o el
id de un elemento. `reference-lab-builder` 0.2.1 usa la misma semántica: un spec
que cita un componente ya no pasa en un skill y falla en el otro.

**El blueprint sugiere las observaciones cercanas.** Citar una ruta que existe
como dato pero no como observación devolvía `unknown STYLE_DNA path` y nada más;
quien escribe el contrato no tiene cómo saber el nombre que le puso el escáner.
Ahora el error lista las candidatas, con la que comparte la hoja primero.

`reference-lab-builder` 0.2.0 — cuatro demos mostraban algo distinto de lo que declaraban

El primer uso contra un escaneo real —siete demos sobre 27 rutas de STYLE_DNA y
27 ids de evidencia— encontró que el laboratorio tenía la misma falla que el
repositorio entero existe para impedir: mostrar valores que nadie midió.

**`typography` no podía mostrar una escala.** Renderizaba el primer nivel en una
etiqueta y concatenaba todos los demás en un solo titular. Cinco niveles
declarados salían como dos tamaños. Peor: la demo citaba el registro tipográfico
como fuente y después generaba una escala propia. Contra la referencia real,
mostraba 1.21x entre display y titular donde lo medido era 2.25x. Ahora el spec
declara `sizes_px`, `line_height_px` y `tracking_px`, la demo los usa tal cual y
escribe la razón entre niveles consecutivos. Sin ellos cae a una escala
adaptativa y lo dice en pantalla.

**`marquee` se comía la velocidad medida.** La duración salía de
`Math.max(8, 2400 / velocidad)`: cualquier medición por encima de 300 px/s daba
exactamente 8 s. Los 302 px/s medidos en la referencia rendían igual que 900.
Ahora sale del ancho real de la pista y la velocidad declarada.

**`parallax` ignoraba su propia configuración.** Tres formas fijas con tres
ratios fijos, declarara el spec seis actores o dos. Ahora usa `items` y `ratio`.

**El nivel más chico de la escala adaptativa caía a 6 px**, ilegible. El piso no
baja de 0.72rem: una etiqueta técnica sigue siendo texto que hay que poder leer
para juzgar la escala.

Ninguno de los cuatro rompía nada ni fallaba una compuerta. Se ven usando la
herramienta con datos reales y mirando la página, que es exactamente para lo que
sirve un checkpoint.

`reference-to-astro` 1.0.0, `brand-manual-builder` 0.1.0, `reference-lab-builder` 0.1.0 — el plan aprobado, y los dos checkpoints que lo preceden

Traído de la línea de Codex por auditoría cruzada. Las compuertas de esta línea
cerraban la invención a la salida del escáner: un contrato que afirma algo tiene
que poder señalar de dónde lo sacó. Faltaba cerrarla donde nace, que es cuando
se decide qué patrón de la referencia se aplica a qué sección del cliente.

**`SITE_BLUEPRINT`.** El plan que hay que aprobar antes de construir. Registra
por sección qué patrón de la referencia se aplica y con qué evidencia, las
decisiones tomadas con su razón, y tres checkpoints obligatorios
—`brand-manual`, `reference-lab`, `content-architecture`— cada uno aprobado,
saltado con motivo escrito, o pendiente. Saltear deja de ser un olvido y pasa a
ser una decisión registrada.

Cuatro compuertas nuevas en `validate-inputs.mjs`. La que importa: cada
`style_path` del plan tiene que resolver en el `STYLE_DNA` y cada
`evidence_ref` en la evidencia registrada. Escribir "esta sección usa el
parallax de la referencia" sin que el escaneo haya visto ningún parallax ahora
falla, con el nombre de la sección.

`--lenient` prepara el borrador. El modo estricto rechaza checkpoints
pendientes, decisiones abiertas y falta de aprobación humana.

También desaparece una instrucción propia que era un agujero: ante un contrato
faltante, esta línea decía «producilo desde su plantilla antes de construir».
Eso es exactamente inventar el insumo. Ahora se vuelve al skill que lo produce.

**`brand-manual-builder` y `reference-lab-builder`** son los dos primeros
checkpoints hechos artefacto. El manual convierte el `BRAND_DNA` en un
documento navegable; el laboratorio arma un sitio neutro —contenido inventado,
geometría generada, ningún asset de la referencia— con doce tipos de demo que
aíslan tipografía, componentes, estados responsive y movimiento. Cada demo
expone de qué valor del `STYLE_DNA` salió. Los dos responden la misma pregunta
antes de gastar trabajo: ¿entendimos esto, o creemos que lo entendimos?

**El CI ahora prueba los contratos con aprobación en los dos sentidos**: el
borrador tiene que rechazarse presentado como aprobado, y tiene que pasar en
modo preparación. Probar un solo sentido deja pasar un validador que siempre
dice que no. El borrador de blueprint se fabrica degradando el ejemplo
aprobado, así los dos fixtures no pueden derivar entre sí.

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
