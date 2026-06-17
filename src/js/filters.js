import { el, clear } from "./dom.js";

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}

export function createFilterBar(config) {
  const { searchPlaceholder = "Search", facets = [] } = config;
  const listeners = [];
  let state = { search: "", facetValues: {} };

  for (const f of facets) {
    if (f.type === "owner-toggles") {
      state.facetValues[f.id] = f.defaultValue ?? (f.options ?? []).map(o => o.value ?? o);
    } else if (f.type === "faction-dropdown") {
      state.facetValues[f.id] = [];
    } else {
      state.facetValues[f.id] = f.defaultValue ?? (f.type === "multi" ? [] : false);
    }
  }

  function notify() {
    for (const cb of listeners) cb({ ...state, facetValues: { ...state.facetValues } });
  }

  const searchInput = el("input", { type: "text", placeholder: searchPlaceholder, class: "filter-search" });
  searchInput.addEventListener("input", () => { state.search = searchInput.value; notify(); });

  const facetNodes = facets.map((f) => {
    if (f.type === "toggle") {
      const checkbox = el("input", { type: "checkbox", id: `facet-${f.id}` });
      checkbox.checked = !!state.facetValues[f.id];
      checkbox.addEventListener("change", () => { state.facetValues[f.id] = checkbox.checked; notify(); });
      return el("label", { class: "filter-toggle", for: `facet-${f.id}` }, [checkbox, f.label]);
    }

    if (f.type === "multi") {
      const select = el("select", { multiple: "true", class: "filter-multi", id: `facet-${f.id}` });
      for (const opt of f.options ?? []) {
        select.append(el("option", { value: opt.value ?? opt }, [opt.label ?? opt]));
      }
      select.addEventListener("change", () => {
        state.facetValues[f.id] = Array.from(select.selectedOptions).map(o => o.value);
        notify();
      });
      return el("label", { class: "filter-multi-wrap" }, [
        el("span", { class: "filter-label" }, [f.label]),
        select,
      ]);
    }

    if (f.type === "owner-toggles") {
      const chips = (f.options ?? []).map(opt => {
        const value = opt.value ?? opt;
        const color = opt.color ?? "var(--text-muted)";
        const btn = el("button", { class: "owner-toggle owner-toggle--on", title: value }, [value[0]]);
        btn.style.setProperty("--chip-color", color);
        btn.addEventListener("click", () => {
          const active = state.facetValues[f.id];
          const idx = active.indexOf(value);
          if (idx === -1) {
            active.push(value);
            btn.classList.add("owner-toggle--on");
            btn.classList.remove("owner-toggle--off");
          } else {
            active.splice(idx, 1);
            btn.classList.remove("owner-toggle--on");
            btn.classList.add("owner-toggle--off");
          }
          state.facetValues[f.id] = [...active];
          notify();
        });
        return btn;
      });
      return el("div", { class: "filter-owner-toggles" }, chips);
    }

    if (f.type === "faction-dropdown") {
      const chipsEl = el("div", { class: "filter-faction-chips" });

      function renderChips() {
        clear(chipsEl);
        for (const fId of state.facetValues[f.id]) {
          const opt   = (f.options ?? []).find(o => (o.value ?? o) === fId);
          const label = opt?.label ?? fId;
          const color = opt?.color;
          const chip  = el("span", { class: "filter-faction-active-chip" }, [
            label,
            el("button", { class: "filter-faction-chip-remove", onclick: () => {
              state.facetValues[f.id] = state.facetValues[f.id].filter(id => id !== fId);
              renderChips();
              notify();
            }}, ["×"]),
          ]);
          if (color) { chip.style.background = color; chip.style.color = chipTextColor(color); }
          chipsEl.append(chip);
        }
      }

      const select = el("select", { class: "filter-faction-select" });
      select.append(el("option", { value: "" }, ["Filter by faction…"]));
      for (const opt of f.options ?? []) {
        select.append(el("option", { value: opt.value ?? opt }, [opt.label ?? opt]));
      }
      select.addEventListener("change", () => {
        const val = select.value;
        if (!val || state.facetValues[f.id].includes(val)) { select.value = ""; return; }
        state.facetValues[f.id] = [...state.facetValues[f.id], val];
        select.value = "";
        renderChips();
        notify();
      });

      return el("div", { class: "filter-faction-wrap" }, [select, chipsEl]);
    }

    return null;
  }).filter(Boolean);

  const bar = el("div", { class: "filter-bar" }, [searchInput, ...facetNodes]);

  return {
    node: bar,
    subscribe(cb) { listeners.push(cb); },
  };
}
