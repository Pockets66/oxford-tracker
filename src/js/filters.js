import { el } from "./dom.js";

export function createFilterBar(config) {
  const { searchPlaceholder = "Search", facets = [] } = config;
  const listeners = [];
  let state = { search: "", facetValues: {} };

  for (const f of facets) {
    state.facetValues[f.id] = f.defaultValue ?? (f.type === "multi" ? [] : false);
  }

  function notify() {
    for (const cb of listeners) cb({ ...state, facetValues: { ...state.facetValues } });
  }

  // ── Search input ──
  const searchInput = el("input", {
    type: "text",
    placeholder: searchPlaceholder,
    class: "filter-search",
  });
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    notify();
  });

  // ── Facet controls ──
  const facetNodes = facets.map((f) => {
    if (f.type === "toggle") {
      const checkbox = el("input", { type: "checkbox", id: `facet-${f.id}` });
      checkbox.checked = !!state.facetValues[f.id];
      checkbox.addEventListener("change", () => {
        state.facetValues[f.id] = checkbox.checked;
        notify();
      });
      return el("label", { class: "filter-toggle", for: `facet-${f.id}` }, [
        checkbox,
        f.label,
      ]);
    }

    if (f.type === "multi") {
      const select = el("select", { multiple: "true", class: "filter-multi", id: `facet-${f.id}` });
      for (const opt of f.options ?? []) {
        const option = el("option", { value: opt.value ?? opt }, [opt.label ?? opt]);
        select.append(option);
      }
      select.addEventListener("change", () => {
        state.facetValues[f.id] = Array.from(select.selectedOptions).map((o) => o.value);
        notify();
      });
      return el("label", { class: "filter-multi-wrap" }, [
        el("span", { class: "filter-label" }, [f.label]),
        select,
      ]);
    }

    return null;
  }).filter(Boolean);

  const bar = el("div", { class: "filter-bar" }, [searchInput, ...facetNodes]);

  return {
    node: bar,
    subscribe(cb) {
      listeners.push(cb);
    },
  };
}
