# Claude Brand System Skills

**De una referencia a una web publicada, sin que ninguna herramienta invente nada.**

Cinco skills que se encadenan. Cada una lee artefactos y produce el input de la
siguiente. Ninguna completa lo que falta por su cuenta: si no hay evidencia,
lo dice y se detiene.

```
                    (opcional)
                brand-dna-scanner ──> BRAND_DNA
                                          │
una referencia ──> reference-scanner ──> STYLE_DNA ──┐
                                                     │
contenido del cliente ──> CONTENT_MANIFEST ──────────┤
                                                     v
                                          reference-to-astro
                                                     │
                                                     v
                                                  astro build
                                                     │
                                    ┌────────────────┴────────────────┐
                                    v                                 v
                              site-tuner                    wordpress-publisher
                          (el ajuste fino)                 (la portada, dentro
                                                            de un WordPress vivo)
```

## El recorrido real

El caso más frecuente no empieza en la marca. Empieza en una referencia:

1. **Escanear la referencia** con `reference-scanner`. Produce `STYLE_DNA` y
   `REFERENCE_EVIDENCE`: cómo funciona ese sitio, con la evidencia de dónde
   salió cada afirmación.
2. **Reconstruir con el contenido del cliente** usando `reference-to-astro`.
   La referencia aporta lógica visual; el cliente aporta identidad y
   contenido. Sale un proyecto Astro verificado.
3. **Afinar** con `site-tuner`. Lo que queda después de reconstruir: bajar el
   titular, acercar el visual, cambiar dónde corta una línea. Dentro de límites
   declarados, no con CSS libre.
4. **Publicar** con `wordpress-publisher` cuando el cliente ya tiene un
   WordPress que debe seguir funcionando.

`brand-dna-scanner` es opcional y va antes de todo. Hace falta sólo cuando la
web nueva también tiene que adoptar la identidad de una marca —su voz, sus
códigos, sus límites— y no únicamente la estructura de una referencia.

## Por qué las herramientas no inventan

Un agente que completa lo que falta produce algo que parece terminado y que
nadie puede defender después. Estas herramientas hacen lo contrario: cada
afirmación queda atada a la evidencia que la sostiene, y cuando esa evidencia
no existe, el contrato se rechaza.

Los validadores no revisan sólo la forma. Rechazan documentos bien armados
pero sin sustento: una observación registrada como observada sin nada detrás,
una cobertura que el escaneo no ganó, un bloque que afirma hallazgos sin una
sola observación respaldada.

**Bajar un score no es bajar una afirmación.** `family: "Söhne"` afirma lo
mismo con confianza 0.55 que con 0.99, y por eso la compuerta que importa
ignora los números y mira lo que el documento dice.

`tests/rejected/` y `tests/rejected-evasive/` contienen contratos que *deben*
ser rechazados. Si algún día pasan, las compuertas dejaron de funcionar y la
revisión del repositorio falla.

## Los cinco skills

| Skill | Pregunta que responde | Salida |
| --- | --- | --- |
| `brand-dna-scanner` | ¿Qué hace reconocible a esta marca? | `BRAND_DNA`, reglas verificables |
| `reference-scanner` | ¿Cómo funciona esta web de referencia? | `STYLE_DNA`, evidencia |
| `reference-to-astro` | ¿Cómo se reconstruye con el contenido del cliente? | Proyecto Astro verificado |
| `site-tuner` | ¿Cómo se afina sin volver a tocar el código? | Valores aprobados que se compilan |
| `wordpress-publisher` | ¿Cómo entra esta portada en un WordPress vivo? | Plugin instalable y verificado |

Cada uno se instala por separado. Los contratos compartidos viajan duplicados a
propósito, y la revisión del repositorio falla si las copias derivan.

## Instalación

Cada skill es un directorio. Los dos motores lo cargan igual:

```text
~/.claude/skills/<skill>/SKILL.md      personal, en todo proyecto
<proyecto>/.claude/skills/<skill>/     del proyecto, viaja con el repositorio
~/.codex/skills/<skill>/SKILL.md       para Codex
```

Instalá los que necesites: el recorrido completo no exige tener los cinco.

Los validadores necesitan sus dependencias:

```bash
npm ci --prefix skills/<skill>
```

Detalles en [installation.md](docs/installation.md).

## Relación con brand-system-skills

[`brand-system-skills`](https://github.com/pcanete/brand-system-skills) es la
línea que se mantiene con Codex. Este repositorio es la línea que se mantiene
con Claude, con los mismos tres skills base más las dos herramientas que
cierran el recorrido hasta la publicación.

Son dos líneas del mismo sistema, no un fork abandonado ni una copia
sincronizada: las mejoras cruzan por auditoría, revisando qué encontró el otro
motor, no por merge automático. Cuando difieren, la diferencia es una decisión,
no un descuido.

## Desarrollo

```bash
npm ci --prefix skills/brand-dna-scanner
```

```bash
npm ci --prefix skills/reference-scanner
```

```bash
npm ci --prefix skills/reference-to-astro
```

```bash
npm ci --prefix skills/site-tuner
```

```bash
npm test
```

La revisión comprueba estructura, versiones coherentes entre `SKILL.md`,
`package.json` y la documentación, sincronización de los contratos duplicados,
que ningún archivo empaquetado quede sin ser mencionado por su skill, y que
ningún dato real se filtre a los fixtures. Además corre los validadores sobre
los ejemplos —que deben pasar— y sobre los fixtures de rechazo —que deben
fallar—, y exporta y verifica un plugin de WordPress completo desde un `dist`
sintético.

## Licencia

MIT. Concepto y desarrollo: **Patricio Cañete**.
