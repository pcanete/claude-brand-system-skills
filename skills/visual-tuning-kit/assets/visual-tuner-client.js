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
      noImages: "No hay imágenes disponibles.", addNav: "Agregar opción", removeNav: "Eliminar", visibleNav: "Visible", newNav: "Nueva opción", move: "Mover", reset: "Reset", copy: "Copiar JSON", save: "Guardar borrador",
      copied: "Copiado.", saved: "Borrador guardado", changes: "cambios", saveFailed: "No se pudo guardar.",
    } : {
      all: "Show all", intro: "Click a marked element. Double-click declared text to edit it inline.",
      selected: "Selected", chooseImage: "Choose an image.", inline: "Double-click to edit on the page.",
      noImages: "No images available.", addNav: "Add item", removeNav: "Remove", visibleNav: "Visible", newNav: "New item", move: "Move", reset: "Reset", copy: "Copy JSON", save: "Save draft",
      copied: "Copied.", saved: "Draft saved", changes: "changes", saveFailed: "Save failed.",
    };
    const controlsByPreview = new Map();
    for (const control of controls) {
      const previewId = control.target?.preview_id;
      if (!previewId) continue;
      const related = controlsByPreview.get(previewId) || [];
      related.push(control);
      controlsByPreview.set(previewId, related);
    }
    const storageKey = `visual-tuner:${schema.id}`;
    const positionStorageKey = `visual-tuner-position:${schema.id}`;
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
      *{box-sizing:border-box}header,footer{position:sticky;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;background:#111;border-bottom:1px solid #3a3a3a}header{top:0;cursor:grab;user-select:none;touch-action:none}header[data-dragging=true]{cursor:grabbing}header button,header input,header select,header textarea{cursor:pointer}footer{bottom:0;border-top:1px solid #3a3a3a;border-bottom:0;flex-wrap:wrap}.toolbar{display:flex;align-items:center;gap:6px}.intro{margin:0;padding:10px 12px;background:#1a1a1a;color:#ddd;border-bottom:1px solid #333}.selection{color:#ff7a63}.group{border-bottom:1px solid #333}.group>summary{display:block;padding:9px 30px 9px 12px;background:#202020;color:#bbb;text-transform:uppercase;cursor:pointer;list-style:none;position:relative}.group>summary::-webkit-details-marker{display:none}.group>summary::after{content:'+';position:absolute;right:12px}.group[open]>summary::after{content:'−'}.control{display:grid;gap:7px;padding:10px 12px;border-top:1px solid #292929}.control[hidden],.group[hidden]{display:none}.label{display:flex;gap:6px}.label output{margin-left:auto;color:#9ee7a7}button,select,input,textarea{font:inherit;color:inherit;background:#171717;border:1px solid #4b4b4b}button{min-height:32px;padding:0 9px;cursor:pointer}button:hover{border-color:#888}button.primary{background:#ff3d1f;border-color:#ff3d1f;color:#fff}select,textarea,input[type=text],input[type=url]{width:100%;min-height:34px;padding:6px}textarea{resize:vertical}input[type=range]{width:100%;accent-color:#ff3d1f}.status{min-height:1.3em;padding:0 12px 10px;color:#9ee7a7}.hint{color:#929292;font-size:10px}.move-hint{white-space:nowrap}.order{display:grid;gap:4px}.navigation-editor{display:grid;gap:8px}.nav-item{display:grid;gap:6px;padding:8px;border:1px solid #3a3a3a;background:#171717}.nav-item__fields{display:grid;grid-template-columns:1fr 1.5fr;gap:5px}.nav-item__actions{display:flex;align-items:center;gap:4px}.nav-item__actions label{display:flex;align-items:center;gap:4px;margin-right:auto}.nav-item__actions button{min-height:28px}.asset-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-height:240px;overflow:auto}.asset{position:relative;min-height:78px;padding:0;overflow:hidden}.asset img{display:block;width:100%;height:76px;object-fit:cover}.asset[data-selected=true]{border:2px solid #ff3d1f}.asset span{position:absolute;right:0;bottom:0;left:0;padding:3px;background:#000b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty{padding:12px;color:#aaa}@media(max-width:600px){:host{top:6px;right:6px;left:6px;width:auto;max-height:calc(100svh - 12px)}header{cursor:default;touch-action:auto}.move-hint{display:none}.nav-item__fields{grid-template-columns:1fr}}
    </style>`;

    const panel = create("div");
    const header = create("header");
    const title = create("strong", schema.title);
    const toolbar = create("div", undefined, "toolbar");
    const showAll = create("button", ui.all);
    showAll.type = "button";
    toolbar.append(showAll, create("span", `↕ ${ui.move}`, "hint move-hint"), create("span", "DEV", "hint"));
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

    const selectControls = (selectedControls, element) => {
      const selectedIds = new Set(selectedControls.map((control) => control.id));
      const active = selectedIds.size > 0;
      selectedElement?.removeAttribute("data-tune-selected");
      selectedElement = element || null;
      selectedElement?.setAttribute("data-tune-selected", "true");
      for (const [id, node] of controlNodes) {
        const hidden = active && !selectedIds.has(id);
        node.hidden = hidden;
        node.toggleAttribute("inert", hidden);
        node.setAttribute("aria-hidden", String(hidden));
      }
      root.querySelectorAll(".group").forEach((group) => {
        group.hidden = active && !group.querySelector(".control:not([hidden])");
        if (active && !group.hidden) group.open = true;
      });
      const primary = selectedControls[0];
      intro.textContent = active
        ? `${ui.selected}: ${selectedControls.map((control) => control.label).join(" · ")}. ${primary.kind === "image" ? ui.chooseImage : ui.inline}`
        : ui.intro;
      intro.classList.toggle("selection", active);
      controlNodes.get(primary?.id)?.scrollIntoView({ block: "nearest" });
    };

    showAll.onclick = () => selectControls([], null);

    for (const [groupIndex, group] of schema.groups.entries()) {
      const section = create("details", undefined, "group");
      section.open = groupIndex === 0;
      section.append(create("summary", group.label));
      for (const control of group.controls) {
        const wrap = create(["section-order", "navigation"].includes(control.kind) ? "div" : "label", undefined, "control");
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
        } else if (control.kind === "navigation") {
          input = create("div", undefined, "navigation-editor");
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

        const commitNavigation = (next, rerender = false) => {
          values[control.id] = next;
          apply(control, next);
          store();
          if (rerender) setInput(next);
        };

        const renderNavigation = (value) => {
          input.replaceChildren();
          value.forEach((item, index) => {
            const card = create("div", undefined, "nav-item");
            const fields = create("div", undefined, "nav-item__fields");
            const labelInput = create("input");
            labelInput.type = "text";
            labelInput.value = item.label;
            labelInput.maxLength = control.max_length || 60;
            labelInput.placeholder = ui.newNav;
            const hrefInput = create("input");
            hrefInput.type = "url";
            hrefInput.value = item.href;
            hrefInput.placeholder = "/destino o #seccion";
            fields.append(labelInput, hrefInput);
            const actions = create("div", undefined, "nav-item__actions");
            const visibilityLabel = create("label");
            const visible = create("input");
            visible.type = "checkbox";
            visible.checked = item.visible !== false;
            visibilityLabel.append(visible, create("span", ui.visibleNav));
            const target = create("select");
            target.add(new Option("Misma pestaña", "_self"));
            target.add(new Option("Nueva pestaña", "_blank"));
            target.value = item.target || "_self";
            const up = create("button", "↑");
            const down = create("button", "↓");
            const remove = create("button", "×");
            up.type = down.type = remove.type = "button";
            up.disabled = index === 0;
            down.disabled = index === value.length - 1;
            remove.title = ui.removeNav;
            const updateItem = () => {
              const next = value.map((candidate, itemIndex) => itemIndex === index ? {
                ...candidate,
                label: labelInput.value,
                href: hrefInput.value,
                target: target.value,
                visible: visible.checked,
              } : candidate);
              commitNavigation(next);
            };
            labelInput.addEventListener("input", updateItem);
            hrefInput.addEventListener("input", updateItem);
            target.addEventListener("change", updateItem);
            visible.addEventListener("change", updateItem);
            const move = (to) => {
              const next = [...value];
              [next[index], next[to]] = [next[to], next[index]];
              commitNavigation(next, true);
            };
            up.onclick = () => move(index - 1);
            down.onclick = () => move(index + 1);
            remove.onclick = () => {
              if (value.length <= (control.min_items || 1)) return;
              commitNavigation(value.filter((_, itemIndex) => itemIndex !== index), true);
            };
            actions.append(visibilityLabel, target, up, down, remove);
            card.append(fields, actions);
            input.append(card);
          });
          const add = create("button", ui.addNav);
          add.type = "button";
          add.disabled = value.length >= (control.max_items || 12);
          add.onclick = () => {
            const suffix = `${Date.now().toString(36)}-${value.length + 1}`;
            commitNavigation([...value, { id: `nav-${suffix}`, label: ui.newNav, href: "#inicio", target: "_self", visible: true }], true);
          };
          input.append(add);
        };

        const setInput = (value) => {
          if (control.kind === "section-order") renderOrder(value);
          else if (control.kind === "navigation") renderNavigation(value);
          else if (control.kind === "image") renderAssets(value);
          else if (input.type === "checkbox") input.checked = Boolean(value);
          else input.value = Array.isArray(value) ? value.join("\n") : String(value ?? "");
          output.textContent = control.kind === "range" ? `${value}${control.unit || ""}` : "";
        };
        const readInput = () => {
          if (control.kind === "range") return Number(input.value);
          if (control.kind === "boolean") return input.checked;
          if (control.kind === "text-lines") return input.value.split("\n").map((line) => line.trim()).filter(Boolean);
          if (["section-order", "image", "navigation"].includes(control.kind)) return values[control.id];
          return input.value;
        };

        setInput(values[control.id]);
        apply(control, values[control.id]);
        inputRecords.set(control.id, { control, input, setInput, readInput });
        if (!["section-order", "image", "navigation"].includes(control.kind)) {
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
    reset.onclick = () => { localStorage.removeItem(storageKey); localStorage.removeItem(positionStorageKey); location.reload(); };
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

    const isCompactViewport = () => window.matchMedia("(max-width: 600px)").matches;
    const clampPosition = (left, top) => {
      const margin = 6;
      const rect = host.getBoundingClientRect();
      return {
        left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - rect.width - margin)),
        top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - rect.height - margin)),
      };
    };
    const applyPosition = (position) => {
      if (!position || isCompactViewport()) return;
      const next = clampPosition(Number(position.left), Number(position.top));
      if (!Number.isFinite(next.left) || !Number.isFinite(next.top)) return;
      host.style.left = `${next.left}px`;
      host.style.top = `${next.top}px`;
      host.style.right = "auto";
    };
    const readStoredPosition = () => {
      try { return JSON.parse(localStorage.getItem(positionStorageKey) || "null"); }
      catch { return null; }
    };
    let dragState = null;
    const finishDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const rect = host.getBoundingClientRect();
      localStorage.setItem(positionStorageKey, JSON.stringify({ left: rect.left, top: rect.top }));
      header.dataset.dragging = "false";
      if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
      dragState = null;
    };
    header.addEventListener("pointerdown", (event) => {
      if (isCompactViewport() || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button,input,select,textarea,a")) return;
      const rect = host.getBoundingClientRect();
      dragState = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      header.dataset.dragging = "true";
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      applyPosition({ left: event.clientX - dragState.offsetX, top: event.clientY - dragState.offsetY });
      const rect = host.getBoundingClientRect();
      localStorage.setItem(positionStorageKey, JSON.stringify({ left: rect.left, top: rect.top }));
    });
    header.addEventListener("pointerup", finishDrag);
    header.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", () => {
      if (isCompactViewport()) {
        host.style.removeProperty("left");
        host.style.removeProperty("top");
        host.style.removeProperty("right");
        return;
      }
      applyPosition(readStoredPosition() || { left: host.getBoundingClientRect().left, top: host.getBoundingClientRect().top });
    });
    applyPosition(readStoredPosition());

    document.addEventListener("click", (event) => {
      const element = event.target instanceof Element ? event.target.closest("[data-tune-id]") : null;
      if (!element) return;
      const related = controlsByPreview.get(element.getAttribute("data-tune-id"));
      if (!related?.length) return;
      event.preventDefault();
      event.stopPropagation();
      selectControls(related, element);
    }, true);

    document.addEventListener("dblclick", (event) => {
      const element = event.target instanceof Element ? event.target.closest("[data-tune-id]") : null;
      if (!element) return;
      const control = controlsByPreview.get(element.getAttribute("data-tune-id"))
        ?.find((candidate) => ["text", "text-lines"].includes(candidate.kind));
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
