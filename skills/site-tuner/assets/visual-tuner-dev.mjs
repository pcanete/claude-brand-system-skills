import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const flatten = (schema) => schema.groups.flatMap((group) => group.controls);

const validateValue = (control, value) => {
  if (control.kind === 'range') {
    return typeof value === 'number' && Number.isFinite(value)
      && value >= control.min && value <= control.max;
  }
  if (control.kind === 'select') {
    return typeof value === 'string'
      && control.options.some((option) => option.value === value);
  }
  if (control.kind === 'boolean') return typeof value === 'boolean';
  if (control.kind === 'text-lines') {
    return Array.isArray(value) && value.length > 0 && value.length <= 30
      && value.every((line) => typeof line === 'string' && line.length <= 500);
  }
  return false;
};

const readBody = (request) => new Promise((resolveBody, reject) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 131072) reject(new Error('Payload too large.'));
  });
  request.on('end', () => resolveBody(body));
  request.on('error', reject);
});

export default function visualTunerDev(options = {}) {
  const schemaPath = resolve(options.schema ?? 'src/config/tuning.schema.json');
  const valuesPath = resolve(options.values ?? 'src/config/tuning.values.json');
  const endpoint = options.endpoint ?? '/__visual-tuner/save';

  return {
    name: 'visual-tuner-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(endpoint, async (request, response, next) => {
        if (request.method !== 'POST') return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const schema = await readJson(schemaPath);
          const payload = JSON.parse(await readBody(request));
          if (payload.schema !== schema.id || !payload.values || typeof payload.values !== 'object') {
            throw new Error('Schema or values payload is invalid.');
          }
          const controls = flatten(schema);
          const byId = new Map(controls.map((control) => [control.id, control]));
          const sanitized = {};
          for (const [id, value] of Object.entries(payload.values)) {
            const control = byId.get(id);
            if (!control || !validateValue(control, value)) {
              throw new Error(`Invalid value for control: ${id}`);
            }
            sanitized[id] = value;
          }
          for (const control of controls) {
            if (!(control.id in sanitized)) {
              const fallback = control.default;
              if (!validateValue(control, fallback)) throw new Error(`Missing control: ${control.id}`);
              sanitized[control.id] = fallback;
            }
          }
          const output = {
            version: schema.version,
            schema: schema.id,
            values: sanitized,
          };
          await writeFile(valuesPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
          response.statusCode = 200;
          response.end(JSON.stringify({ ok: true, path: valuesPath }));
        } catch (error) {
          response.statusCode = 400;
          response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Invalid request.' }));
        }
      });
    },
  };
}
