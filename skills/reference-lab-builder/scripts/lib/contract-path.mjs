export function resolvePath(document, dottedPath) {
  let node = document;

  for (const segment of String(dottedPath).split(".")) {
    if (node && typeof node === "object" && !Array.isArray(node) && segment in node) {
      node = node[segment];
      continue;
    }
    if (Array.isArray(node)) {
      const match = node.find((item) => item && typeof item === "object" && item.id === segment);
      if (match !== undefined) {
        node = match;
        continue;
      }
    }
    return { found: false, stoppedAt: segment };
  }

  return { found: true, value: node };
}
