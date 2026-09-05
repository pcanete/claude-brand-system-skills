# Instalación

Cada skill es un directorio: `SKILL.md` más sus referencias, contratos, assets
y scripts. Los dos motores lo cargan igual; cambia dónde va.

Skills disponibles:

- `skills/brand-dna-scanner` — opcional, sólo si además se adopta la identidad de una marca
- `skills/reference-scanner`
- `skills/reference-to-astro`
- `skills/visual-tuning-kit`
- `skills/wordpress-publisher`

El recorrido completo no exige tener los cinco. Instalá los que use el trabajo
que tenés adelante.

## Para Claude

```text
~/.claude/skills/<skill>/SKILL.md        personal, disponible en todo proyecto
<proyecto>/.claude/skills/<skill>/       del proyecto, viaja con el repositorio
```

Claude lee la `description` del frontmatter para decidir cuándo aplica un
skill, así que cada uno tiene que quedar como hijo directo de la carpeta.

Los skills invocan sus propios validadores por línea de comandos: la sesión
necesita permiso para ejecutar `node`.

## Para Codex

```text
~/.codex/skills/<skill>/SKILL.md
```

Misma regla: cada skill como hijo directo, nunca la raíz del repositorio.

## Dependencias

Los validadores necesitan las suyas. Después de instalar, dentro del
directorio del skill:

```bash
npm install
```

`reference-to-astro` además instala Playwright para el QA visual, que puede
necesitar un navegador:

```bash
npx playwright install chromium
```

`wordpress-publisher` no tiene dependencias.

Sin esas dependencias el skill sigue funcionando como instrucciones, pero su
compuerta de verificación no puede correr — que es la parte que mantiene
honesta la salida.

## Actualizar

Las copias instaladas no siguen a este repositorio. Después de un `git pull`,
volvé a copiar los directorios que uses y corré `npm install` si cambiaron los
validadores.
# Dependencias de validación completas

Instalar las dependencias de cada skill que se ejecuta, también manual y laboratorio:

```bash
npm ci --prefix skills/brand-dna-scanner
npm ci --prefix skills/brand-manual-builder
npm ci --prefix skills/reference-scanner
npm ci --prefix skills/reference-lab-builder
npm ci --prefix skills/reference-to-astro
npm ci --prefix skills/visual-tuning-kit
npm test
```

WordPress requiere PHP CLI en PATH o PHP_BINARY para validar sintaxis antes
del ZIP. Para las pruebas visuales: instalar Chromium con Playwright desde
skills/reference-to-astro y ejecutar scripts/test-qa-assertions.mjs.
Las nuevas reglas y migración están en [behavior-evidence-release.md](behavior-evidence-release.md).
