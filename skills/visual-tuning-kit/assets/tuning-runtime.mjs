export function tunedValue(document, id, fallback) {
  return document?.values && Object.prototype.hasOwnProperty.call(document.values, id)
    ? document.values[id]
    : fallback;
}

export function tunedText(document, id, fallback = "") {
  const value = tunedValue(document, id, fallback);
  return Array.isArray(value) ? value.join("\n") : String(value ?? fallback);
}

export function tunedOrder(document, id, allowed) {
  const value = tunedValue(document, id, allowed);
  if (!Array.isArray(value) || value.length !== allowed.length) return [...allowed];
  const unique = new Set(value);
  return unique.size === allowed.length && allowed.every((item) => unique.has(item))
    ? [...value]
    : [...allowed];
}
