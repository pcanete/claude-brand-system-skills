// Assertions are opt-in in QA_PROFILE; each corresponds to an observed criterion.
export async function assertPageState(page, checks = []) {
  for (const check of checks) {
    const locator = page.locator(check.selector);
    if (check.visible === false) {
      if (await locator.isVisible()) throw new Error(check.selector + ": expected hidden");
      continue;
    }
    if (await locator.count() !== 1) throw new Error(check.selector + ": expected exactly one element");
    if (check.visible === true && !(await locator.isVisible())) throw new Error(check.selector + ": expected visible");
    if (check.text !== undefined && (await locator.innerText()).trim() !== check.text) throw new Error(check.selector + ": text mismatch");
    for (const [name,value] of Object.entries(check.attributes || {})) {
      if (await locator.getAttribute(name) !== value) throw new Error(check.selector + ": attribute mismatch " + name);
    }
    const result = await locator.evaluate((element, check) => {
      const style = getComputedStyle(element);
      const errors = [];
      for (const [name,value] of Object.entries(check.css || {})) {
        if (style.getPropertyValue(name).trim() !== value) errors.push("CSS mismatch " + name);
      }
      if (check.font) {
        const normalize = s => s.replace(/['"]/g,"").trim().toLowerCase();
        const family = normalize(check.font.family);
        const first = normalize(style.fontFamily.split(",")[0]);
        if (first !== family) errors.push("unexpected first font family " + style.fontFamily);
        const faces = [...document.fonts].filter(f => normalize(f.family) === family);
        if (!faces.some(f => f.status === "loaded")) errors.push("required font face not loaded");
        if (check.font.weight && style.fontWeight !== String(check.font.weight)) errors.push("font weight mismatch");
        if (!document.fonts.check(style.fontWeight + " 16px " + JSON.stringify(check.font.family), element.textContent || "Ag")) errors.push("font unavailable for sample text");
      }
      return errors;
    }, check);
    if (result.length) throw new Error(check.selector + ": " + result.join("; "));
  }
}
