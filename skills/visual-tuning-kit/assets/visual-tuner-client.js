(() => {
  const prefix = "/__visual-tuner";
  const params = new URLSearchParams(location.search);
  const create = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  const boot = async () => {
    if (document.querySelector("visual-tuner")) return;
    const response = await fetch(`${prefix}/config`);
    if (!response.ok) return;
    const { schema, approved } = await response.json();
    if (params.get(schema.query_parameter || "tune") !== "1") return;

    const controls = schema.groups.flatMap((group) => group.controls);
    const spanish = document.documentElement.lang.toLowerCase().startsWith("es");
    const ui = spanish ? {
      all: "Ver todo", intro: "Hacé clic en un elemento marcado. Doble clic para editar texto directamente.",
      selected: "Seleccionado", chooseImage: "Elegí una imagen.", inline: "Doble clic para editar en la página.",
      noImages: "No hay imágenes disponibles.", reset: "Reset", copy: "Copiar JSON", save: "Guardar borrador",
      copied: "Copiado.", saved: "Borrador guardado", changes: "cambios", saveFailed: "No se pudo guardar.",
    } : {
      all: "Show all", intro: "Click a marked element. Double-click declared text to edit it inline.",
      selected: "Selected", chooseImage: "Choose an image.", inline: "Double-click to edit on the page.",
      noImages: "No images available.", reset: "Reset", copy: "Copy JSON", save: "Save draft",
      copied: "Copied.", saved: "Draft saved", changes: "changes", saveFailed: "Save failed.",
    };
    const controlsByPreview = new Map(
      controls
        .filter((control) => control.target?.preview_id)
        .map((control) => [control.target.preview_id, control]),
    );
    const storageKey = `visual-tuner:${schema.id}`;
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); }
      catch { return {}; }
    })();
    const values = {
      ...Object.fromEntries(controls.map((control) => [control.id, control.default])),
      ...(approved.values || {}),
      ...stored,
    };

    document.documentElement.dataset.visualTuning = "true";
    const pageStyle = create("style");
    pageStyle.textContent = `
      html[data-visual-tuning=true] [data-tune-id]{cursor:crosshair;outline:1px dashed rgba(255,61,31,.58);outline-offset:3px}
      html[data-visual-tuning=true] [data-tune-id]:hover{outline:2px solid #ff3d1f;outline-offset:4px}
      html[data-visual-tuning=true] [data-tune-selected=true]{outline:3px solid #ff3d1f!important;outline-offset:5px!important}
      html[data-visual-tuning=true] [contenteditable=true]{cursor:text;box-shadow:0 0 0 5px rgba(255,61,31,.22)}
    `;
    document.head.append(pageStyle);

    const host = create("visual-tuner");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{position:fixed;z-index:2147483000;top:12px;right:12px;width:min(390px,calc(100vw - 24px));max-height:calc(100svh - 24px);overflow:auto;background:#111;color:#f3f3f3;border:1px solid #444;box-shadow:0 18px 60px #0008;font:11px/1.35 ui-monospace,monospace}
      *{box-sizing:border-box}header,footer{position:sticky;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;background:#111;border-bottom:1px solid #3a3a3a}header{top:0}footer{bottom:0;border-top:1px solid #3a3a3a;border-bottom:0;flex-wrap:wrap}.toolbar{display:flex;align-items:center;gap:6px}.intro{margin:0;padding:10px 12px;background:#1a1a1a;color:#ddd;border-bottom:1px solid #333}.selection{color:#ff7a63}.group{border-bottom:1px solid #333}.group>strong{display:block;padding:9px 12px;background:#202020;color:#bbb;text-transform:uppercase}.control{display:grid;gap:7px;padding:10px 12px;border-top:1px solid #292929}.control[hidden],.group[hidden]{display:none}.label{display:flex;gap:6px}.label output{margin-left:auto;color:#9ee7a7}button,select,input,textarea{font:inherit;color:inherit;background:#171717;border:1px solid #4b4b4b}button{min-height:32px;padding:0 9px;cursor:pointer}button:hover{border-color:#888}button.primary{background:#ff3d1f;border-color:#ff3d1f;color:#fff}select,textarea,input[type=text]{width:100%;min-height:34px;padding:6px}textarea{resize:vertical}input[type=range]{width:100%;accent-color:#ff3d1f}.status{min-height:1.3em;padding:0 12px 10px;color:#9ee7a7}.hint{color:#929292;font-size:10px}.order{display:grid;gap:4px}.asset-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-height:240px;overflow:auto}.asset{position:relative;min-height:78px;padding:0;overflow:hidden}.asset img{display:block;width:100%;height:76px;object-fit:cover}.asset[data-selected=true]{border:2px solid #ff3d1f}.asset span{position:absolute;right:0;bottom:0;left:0;padding:3px;background:#000b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty{padding:12px;color:#aaa}@media(max-width:600px){:host{top:6px;right:6px;left:6px;width:auto;max-height:calc(100svh - 12px)}}
    </style>`;

    const panel = create("div");
    const header = create("header");
    const title = create("strong", schema.title);
    const toolbar = create("div", undefined, "toolbar");
    const showAll = create("button", ui.all);
    showAll.type = "button";
    toolbar.append(showAll, create("span", "DEV", "hint"));
    header.append(title, toolbar);
    panel.append(header);
    const intro = create("p", ui.intro, "intro");
    panel.append(intro);

    const inputRecords = new Map();
    const controlNodes = new Map();
    let selectedElement = null;

    const store = () => localStorage.setItem(storageKey, JSON.stringify(values));

    const apply = (control, value) => {
      if (control.target?.css_variable) document.documentElement.style.setProperty(control.target.css_variable, `${value}${control.unit || ""}`);
      if (control.target?.class_name) document.body.classList.toggle(control.target.class_name, Boolean(value));
      if (control.target?.preview_id && ["text", "text-lines"].includes(control.kind)) {
        const target = document.querySelector(`[data-tune-id="${CSS.escape(control.target.preview_id)}"]`);
        if (target) {
          if (Array.isArray(value)) {
            const tag = control.target.render === "paragraphs" ? "p" : "span";
            target.replaceChildren(...value.map((line) => create(tag, line)));
          } else {
            target.textContent = String(value);
          }
        }
      }
      if (control.kind === "image" && control.target?.preview_id) {
        const target = document.querySelector(`[data-tune-id="${CSS.escape(control.target.preview_id)}"]`);
        if (target instanceof HTMLImageElement) target.src = String(value);
      }
      if (control.target?.event_name) window.dispatchEvent(new CustomEvent(control.target.event_name, { detail: { value } }));
      if (control.kind === "section-order") {
        const parent = document.querySelector(control.target?.container || "#main-content");
        if (parent) value.forEach((id) => {
          const section = document.getElementById(id);
          if (section && section.parentElement === parent) parent.append(section);
        });
        window.dispatchEvent(new CustomEvent("visual-tuner:section-order", { detail: { id: control.id, value } }));
      }
    };

    const selectControl = (control, element) => {
      selectedElement?.removeAttribute("data-tune-selected");
      selectedElement = element || null;
      selectedElement?.setAttribute("data-tune-selected", "true");
      for (const [id, node] of controlNodes) {
        const hidden = Boolean(control) && id !== control.id;
        node.hidden = hidden;
        node.toggleAttribute("inert", hidden);
        node.setAttribute("aria-hidden", String(hidden));
      }
      root.querySelectorAll(".group").forEach((group) => {
        group.hidden = Boolean(control) && !group.querySelector(".control:not([hidden])");
      });
      intro.textContent = control
        ? `${ui.selected}: ${control.label}. ${control.kind === "image" ? ui.chooseImage : ui.inline}`
        : ui.intro;
      intro.classList.toggle("selection", Boolean(control));
      controlNodes.get(control?.id)?.scrollIntoView({ block: "nearest" });
    };

    showAll.onclick = () => selectControl(null, null);

    for (const group of schema.groups) {
      const section = create("section", undefined, "group");
      section.append(create("strong", group.label));
      for (const control of group.controls) {
        const wrap = create(control.kind === "section-order" ? "div" : "label", undefined, "control");
        controlNodes.set(control.id, wrap);
        const label = create("span", control.label, "label");
        const output = create("output", "");
        label.append(output);
        wrap.append(label, create("small", control.rationale, "hint"));
        let input;

        if (control.kind === "range") {
          input = create("input");
          input.type = "range";
          input.min = control.min;
          input.max = control.max;
          input.step = control.step;
        } else if (control.kind === "select") {
          input = create("select");
          control.options.forEach((option) => input.add(new Option(option.label, option.value)));
        } else if (control.kind === "boolean") {
          input = create("input");
          input.type = "checkbox";
        } else if (["text", "text-lines"].includes(control.kind)) {
          input = control.kind === "text" ? create("input") : create("textarea");
          if (control.kind === "text") input.type = "text";
          input.maxLength = control.max_length;
        } else if (control.kind === "image") {
          input = create("div", undefined, "asset-grid");
        } else {
          input = create("div", undefined, "order");
        }

        const renderOrder = (value) => {
          input.replaceChildren();
          value.forEach((item, index) => {
            const row = create("div");
            row.style.display = "grid";
            row.style.gridTemplateColumns = "1fr auto auto";
            row.style.gap = "4px";
            const option = control.options.find((candidate) => candidate.value === item);
            row.append(create("span", option?.label || item));
            const up = create("button", "↑");
            const down = create("button", "↓");
            up.type = down.type = "button";
            up.disabled = index === 0;
            down.disabled = index === value.length - 1;
            const move = (to) => {
              const next = [...value];
              [next[index], next[to]] = [next[to], next[index]];
              values[control.id] = next;
              apply(control, next);
              store();
              setInput(next);
            };
            up.onclick = () => move(index - 1);
            down.onclick = () => move(index + 1);
            row.append(up, down);
            input.append(row);
          });
        };

        const renderAssets = (value) => {
          input.replaceChildren();
          for (const option of control.asset_options || []) {
            const button = create("button", undefined, "asset");
            button.type = "button";
            button.dataset.selected = String(option.value === value);
            const image = create("img");
            image.src = option.src;
            image.alt = "";
            image.loading = "lazy";
            button.append(image, create("span", option.label));
            button.onclick = () => {
              values[control.id] = option.value;
              apply(control, option.value);
              store();
              setInput(option.value);
            };
            input.append(button);
          }
          if (!input.children.length) input.append(create("p", ui.noImages, "empty"));
        };

        const setInput = (value) => {
          if (control.kind === "section-order") renderOrder(value);
          else if (control.kind === "image") renderAssets(value);
          else if (input.type === "checkbox") input.checked = Boolean(value);
          else input.value = Array.isArray(value) ? value.join("\n") : String(value ?? "");
          output.textContent = control.kind === "range" ? `${value}${control.unit || ""}` : "";
        };
        const readInput = () => {
          if (control.kind === "range") return Number(input.value);
          if (control.kind === "boolean") return input.checked;
          if (control.kind === "text-lines") return input.value.split("\n").map((line) => line.trim()).filter(Boolean);
          if (["section-order", "image"].includes(control.kind)) return values[control.id];
          return input.value;
        };

        setInput(values[control.id]);
        apply(control, values[control.id]);
        inputRecords.set(control.id, { control, input, setInput, readInput });
        if (!["section-order", "image"].includes(control.kind)) {
          input.addEventListener(control.kind === "boolean" || control.kind === "select" ? "change" : "input", () => {
            values[control.id] = readInput();
            apply(control, values[control.id]);
            store();
            setInput(values[control.id]);
          });
        }
        wrap.append(input);
        section.append(wrap);
      }
      panel.append(section);
    }

    const status = create("p", "", "status");
    const footer = create("footer");
    const reset = create("button", ui.reset);
    const copy = create("button", ui.copy);
    const save = create("button", ui.save, "primary");
    reset.onclick = () => { localStorage.removeItem(storageKey); location.reload(); };
    copy.onclick = async () => { await navigator.clipboard.writeText(JSON.stringify({ schema: schema.id, values }, null, 2)); status.textContent = ui.copied; };
    save.onclick = async () => {
      const result = await fetch(`${prefix}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schema: schema.id, values }) });
      const body = await result.json();
      status.textContent = body.ok ? `${ui.saved} (${body.changed} ${ui.changes}).` : body.error || ui.saveFailed;
    };
    footer.append(reset, copy, save);
    panel.append(footer, status);
    root.append(panel);
    document.body.append(host);

    document.addEventListener("click", (event) => {
      const element = event.target instanceof Element ? event.target.closest("[data-tune-id]") : null;
      if (!element) return;
      const control = controlsByPreview.get(element.getAttribute("data-tune-id"));
      if (!control) return;
      event.preventDefault();
      event.stopPropagation();
      selectControl(control, element);
    }, true);

    document.addEventListener("dblclick", (event) => {
      const element = event.target instanceof Element ? event.target.closest("[data-tune-id]") : null;
      if (!element) return;
      const control = controlsByPreview.get(element.getAttribute("data-tune-id"));
      if (!control || !["text", "text-lines"].includes(control.kind)) return;
      event.preventDefault();
      event.stopPropagation();
      element.setAttribute("contenteditable", "true");
      element.setAttribute("spellcheck", "true");
      element.focus();
      const finish = () => {
        element.removeAttribute("contenteditable");
        const next = control.kind === "text-lines"
          ? element.innerText.split("\n").map((line) => line.trim()).filter(Boolean)
          : element.textContent.trim();
        values[control.id] = next;
        apply(control, next);
        store();
        inputRecords.get(control.id)?.setInput(next);
      };
      element.addEventListener("blur", finish, { once: true });
    }, true);
  };

  boot().catch((error) => console.warn("Visual tuner unavailable", error));
})();
