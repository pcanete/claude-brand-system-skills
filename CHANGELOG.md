# Changelog

## Unreleased

Publicación inicial de la línea Claude, con los tres skills base y las dos
herramientas que faltaban para llegar de una referencia a una web publicada.

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
