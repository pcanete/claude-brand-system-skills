# Mejoras pendientes

Lo que un trabajo real mostró que falta, y todavía no está en los skills. Cada
entrada dice de dónde salió: si no se puede rastrear a un caso, no va acá.

Nada de esto es específico de un cliente. Lo que sí lo es vive en la capa del
proyecto, no en el skill.

---

## reference-scanner

### Capturas declaradas que nunca existieron

`REFERENCE_EVIDENCE` puede declarar capturas con un `artifact` que el escaneo
nunca persistió. Hoy nada lo detecta: el contrato pasa las compuertas citando
archivos que no están.

Es una compuerta barata: una captura con `artifact` declarado tiene que existir,
o registrarse explícitamente como observación no persistida. La diferencia
importa cuando alguien, meses después, quiere revisar de dónde salió una
decisión.

**Origen:** notas de fidelidad de un rediseño real — 25 capturas citadas, cero
archivos. Quien lo detectó fue una persona auditando, no una herramienta.

### Identificar la familia tipográfica real

Cuando la referencia usa fuentes comerciales, la metadata de las fuentes
cargadas suele nombrarlas. Registrar esa identificación como observación —con
su evidencia— vale más que describir el trazo, y es lo que permite decidir
después si se licencian o se sustituyen.

**Origen:** un escaneo identificó dos familias comerciales por metadata; el
skill no pide ese paso en ningún lado.

---

## reference-to-astro

### Verificar que las familias declaradas efectivamente carguen

El QA visual saca capturas y no comprueba que la tipografía sea la correcta. Un
`@font-face` que devuelve 403 hace que el navegador baje silenciosamente por la
lista de fallbacks hasta una fuente de sistema: el build pasa, la captura sale,
y el sitio se ve con otra tipografía.

Un `document.fonts.check()` por cada familia declarada en el STYLE_DNA lo
detecta, y es de las cosas más baratas de agregar.

**Origen:** un sitio servido con la raíz equivocada mostraba Arial donde
correspondía Raleway. Ni el contrato, ni `astro check`, ni el QA visual lo
vieron. Lo vio una persona mirando la pantalla.

### Sustitución declarada de tipografía comercial

Identificar la familia real, no reutilizar sus archivos, servir un sustituto
abierto de métricas cercanas, y dejar registrado que si aparecen las licencias
no hay que rediseñar componentes.

Es la doctrina de "fidelidad sin copia" en su caso más concreto, y hoy el skill
no dice cómo se hace.

**Origen:** el mismo rediseño, resuelto a mano y bien.

### Pipeline de imágenes previo al build

Generar WebP de calidad 84–86 desde las fuentes editables, preservando
proporción y orientación, y excluir los originales del paquete publicable en el
postbuild.

**Origen:** el proyecto real lo tenía resuelto; `media-strategy.md` no lo
menciona.

### Un pipeline de assets no puede destruir derivados

Si las fuentes originales no están, el pipeline debe conservar los derivados ya
generados y avisar — nunca borrarlos.

En el caso real, la limpieza de archivos obsoletos eliminaba todo `.webp` sin
fuente correspondiente. Con las fuentes ausentes eso significaba borrar el
material que el sitio usa, y el proyecto quedaba sin imágenes sin que nadie
hubiera pedido nada.

**Origen:** al copiar un proyecto sin sus 630 MB de fuentes, el build no sólo
falló: iba a destruir los derivados.

### Declarar la dependencia de fuentes pesadas

Si un proyecto necesita cientos de MB de material original para construir, el
README generado tiene que decirlo. Quien clona el repositorio para tocar el
layout descubre esa dependencia cuando el build revienta.

**Origen:** el mismo caso.

### Decidir quién manda sobre los assets

Un proyecto real terminó descubriendo fotos y logos automáticamente desde
carpetas, "ya no es necesario editar el manifiesto". Pero el skill declara que
`CONTENT_MANIFEST` es autoritativo para el contenido.

Las dos cosas no pueden ser ciertas a la vez. O el manifiesto manda, o el
directorio manda y el manifiesto describe el resto. Falta decidirlo y escribirlo.

**Origen:** divergencia entre lo que hace el trabajo real y lo que dice el
contrato.

---

---

## wordpress-publisher

### La portada publicada se verifica sin sesión

Con sesión iniciada, WordPress carga estilos que un visitante nunca recibe: la
barra de administración y lo que cada plugin sume para usuarios logueados. La
portada puede verse distinta —tipografías, colores de botones— sin que nada
esté mal para el público.

Quien publica suele estar logueado, así que es la vista equivocada para
verificar. **La comprobación se hace en una ventana privada.**

Pasó en un caso real: dos plugins distintos mostraron el mismo síntoma, se
buscó la causa en el empaquetado, y la versión anónima estaba correcta desde el
principio.

### Verificación de paridad entre lo local y lo publicado

Falta la compuerta entre exportar el plugin y darlo por bueno: comparar el
sitio construido con la portada ya publicada y listar qué elementos difieren en
familia tipográfica, tamaño, peso o tracking.

El método está probado —recorrer los elementos de texto de las dos URLs y
comparar sus estilos computados— y detecta en segundos lo que hoy se descubre
mirando. Con una condición que este caso dejó clara: **la comparación se hace
contra la versión anónima del sitio publicado**, porque es la única que
representa lo que ve un visitante.

### El laboratorio de referencia no cubre WebGL ni transiciones de página

`reference-lab-builder` aísla doce tipos de demo, y ninguno es WebGL ni
transición entre páginas. Son justamente las dos cosas que `reference-to-astro`
declara como riesgo de fidelidad y donde una reconstrucción falla sin que nadie
se dé cuenta hasta ver el sitio armado. El checkpoint responde "¿entendimos el
sistema?" con un sí que deja afuera lo más caro de equivocar.

**Origen:** auditoría cruzada del 2026-08-29; el catálogo de demos y las
secciones `webgl-policy.md` y `motion-system.md` de `reference-to-astro` no se
cruzan.

### El checkpoint content-architecture no tiene herramienta

`SITE_BLUEPRINT` exige tres checkpoints. Dos tienen skill que los produce
—`brand-manual-builder` y `reference-lab-builder`—; el tercero se aprueba a
mano contra el `CONTENT_MANIFEST`, sin artefacto que revisar. En la práctica va
a terminar en `waived` con un motivo escrito de apuro, que es el modo en que un
checkpoint deja de significar algo.

**Origen:** misma auditoría. La asimetría es visible en el propio esquema.

## Transversales

### El peso de los skills

Un agente que sigue las instrucciones al pie de la letra termina leyendo
alrededor de dos mil líneas por skill. Cada mejora agrega y ninguna quita: no
hay presupuesto declarado ni criterio de qué sale cuando entra algo.

### Versionado de las compuertas

Endurecer una compuerta no cambia el esquema, pero hace que un documento que
ayer validaba hoy sea rechazado. Para un consumidor eso es incompatible.

Falta decidir si el validador es parte del contrato. Una salida: versionar el
perfil de compuertas por separado, para que endurecer deje de ser una decisión
ambigua entre minor y major.

---

## Cómo se usa esta lista

Una entrada sale de acá cuando el skill la incorpora y algo la verifica. No
cuando alguien la considera resuelta.
