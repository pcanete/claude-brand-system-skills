---
name: site-tuner
description: Instala y opera un calibrador acotado sobre un sitio Astro ya construido, para el ajuste fino que queda después de reconstruir una referencia: mover, achicar, cambiar un salto de línea. Los controles se declaran en un contrato por proyecto y los valores aprobados se compilan al sitio. Usar cuando un sitio ya está armado y hay que afinarlo sin volver a tocar el código a mano. No usar para construir el sitio —eso es reference-to-astro— ni para cambiar contenido, que vuelve al CONTENT_MANIFEST.
license: MIT
metadata:
  version: "0.2.0"
---

# Site Tuner

El paso que faltaba entre un sitio reconstruido y un sitio publicable.

Reconstruir una referencia con evidencia funciona. Lo que queda después es otra
cosa: bajar dos puntos el titular, acercar el visual al texto, cambiar dónde
corta una línea. Ajustes que no se derivan de ninguna evidencia y que hasta
ahora se hacían editando el código, mirando, y volviendo a editar.

## Qué es y qué no

Un calibrador, no un editor visual. La diferencia está en el contrato: **sólo
existe lo que el proyecto declaró en `tuning.schema.json`**. Un control que no
está declarado no aparece en el panel, y un valor fuera de rango no se guarda.

Ese límite es el que mantiene la herramienta del lado correcto. Sin él, un
afinador se convierte en una forma lenta de escribir CSS, y el sitio deja de
ser reproducible desde sus contratos.

Tampoco toca contenido. Un texto corregido vuelve al `CONTENT_MANIFEST`, no al
calibrador: si queda acá, el manifiesto miente y la próxima regeneración
devuelve el texto viejo. La única excepción declarada son los saltos de línea
de un titular (`text-lines`), que son composición y no contenido.

## Las cuatro piezas

| Pieza | Qué hace |
| --- | --- |
| `assets/VisualTuner.astro` | El panel. Lee el contrato y arma los controles. |
| `assets/TuningStyles.astro` | Emite los valores aprobados como variables CSS. |
| `assets/visual-tuner-dev.mjs` | Plugin de Vite que recibe el guardado. Sólo en desarrollo. |
| `schemas/tuning-contract.schema.json` | La forma que debe tener el contrato de un proyecto. |

El motor no sabe nada del proyecto. Todo lo específico vive en el contrato.

## Instalación en un proyecto

1. Copiar los tres archivos de `assets/` al proyecto: los dos `.astro` a
   `src/components/`, el `.mjs` a `src/lib/`.

2. Registrar el plugin en `astro.config.mjs`:

   ```js
   import visualTunerDev from './src/lib/visual-tuner-dev.mjs';

   export default defineConfig({
     vite: { plugins: [visualTunerDev()] },
   });
   ```

3. Escribir `src/config/tuning.schema.json` con los controles del proyecto, y
   `src/config/tuning.values.json` con `{ "version": "1.0", "schema": "<id>",
   "values": {} }`.

4. Montar el panel sólo en desarrollo, y los estilos siempre:

   ```astro
   {import.meta.env.DEV && <VisualTuner schema={tuningSchema} approved={tuningValues} />}
   ```

   `TuningStyles` va en el layout, con el contrato y los valores aprobados. Usa
   `html:root` a propósito: los valores aprobados tienen que ganarle al orden
   de hojas que impongan un optimizador de producción o WordPress.

`assets/tuning.schema.example.json` y `assets/tuning.values.example.json` son
un par de ejemplo verificado: muestran los cuatro tipos de control y la forma
del archivo de valores aprobados.

## Generar el contrato, no escribirlo

Declarar treinta controles a mano por proyecto es trabajo que no hace falta.
El código ya dice cuáles son los puntos de ajuste: cada `var(--nombre, valor)`
es una variable que quien construyó el sitio decidió dejar regulable, con su
valor por defecto al lado. Lo mismo un helper que lee la variable desde
JavaScript con un default.

```bash
node scripts/generate-tuning.mjs --project . --style STYLE_DNA.json   --out src/config/tuning.schema.json
```

Recorre el proyecto, junta esos puntos de ajuste, agrupa por sección según el
prefijo del nombre y deriva el rango del valor que el proyecto eligió: nunca de
una tabla. Una proporción entre 0 y 1 se acota a 0–1; un ángulo se abre
simétrico alrededor de cero; una longitud se abre hacia abajo y hacia arriba.

Cada control anota en `derived_from` el archivo de donde salió. Un control sin
ese campo lo decidió una persona, y está bien que se note la diferencia.

**Es un punto de partida, no el contrato final.** El generador propone todo lo
que el proyecto parametrizó; lo que no merece estar en el panel se saca a mano.
Si el generador no encuentra algo que querés afinar, la respuesta no es
agregarlo al contrato: es parametrizarlo en el código con `var(--nombre,
default)`. Un control que apunta a una variable que nadie lee no hace nada.

También informa las variables que aparecen con más de un valor por defecto —se
queda con el primero— porque suele ser un descuido del código, no una decisión.

## Declarar controles

Cada control declara qué toca. Cuatro tipos:

- **`range`** — un número entre `min` y `max`, escrito en una `css_variable`
  con su `unit`. Es el caso normal.
- **`select`** — una opción entre varias declaradas. Cuando el cambio no es un
  valor sino un modo, se acompaña con `event` para que el componente se entere.
- **`boolean`** — activa o desactiva, con `class_name` o `event`.
- **`text-lines`** — los saltos de línea de una región identificada por
  `selector`.

Un control tiene que declarar algún efecto —`css_variable`, `class_name`,
`event` o `selector`—. Uno que no declara ninguno ocupa lugar en el panel y da
la impresión de que algo cambió.

Agrupá los controles por sección del sitio. El panel abre un grupo por vez: un
calibrador con treinta controles abiertos es un tablero, no una herramienta.

## Verificación

Antes de exponer el panel, y en cada cambio del contrato:

```bash
node scripts/validate-tuning.mjs \
  --schema src/config/tuning.schema.json \
  --values src/config/tuning.values.json
```

Verifica tres cosas distintas:

- que el contrato cumpla su forma;
- que cada control sea coherente consigo mismo — que su `default` esté dentro
  de lo que él mismo declara, que `min` sea menor que `max`, que declare un
  efecto;
- que los valores aprobados —que **sí se compilan al sitio**— estén dentro de
  lo declarado, aunque alguien haya editado el archivo a mano.

El endpoint ya rechaza un guardado inválido. Esto cubre el otro lado: el
archivo de valores es un artefacto de build, y nada impedía editarlo fuera del
panel.

`scripts/smoke-test.mjs` verifica el panel corriendo contra un servidor de
desarrollo: que aparezca, que la cantidad de controles coincida con el
contrato, que mover uno cambie la variable CSS en vivo, y que aplicar escriba
el valor.

## Qué no se guarda solo

El panel guarda experimentos y presets en el navegador de quien afina.
**Aplicar al proyecto** es otra cosa: escribe `tuning.values.json`, que se
versiona y se compila. Son dos estados distintos a propósito — probar no es
decidir.

El panel y su endpoint quedan fuera del build de producción; los valores
aprobados, no.
