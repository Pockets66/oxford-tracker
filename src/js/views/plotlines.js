import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import { createPlotline } from "../schema.js";
import { mountPlotlineDetail } from "./plotline-detail.js";

function progressLabel(pl) {
  const total = (pl.items ?? []).length;
  if (!total) return "";
  const done = (pl.items ?? []).filter(i => i.completed).length;
  return `${done}/${total}`;
}

export function mountPlotlines(container, appData, selectedId) {
  appData.plotlines ??= [];

  let currentId = selectedId ?? (appData.plotlines[0]?.id ?? null);

  const sidebarEl = el("div", { class: "plotlines-sidebar" });
  const detailEl  = el("div", { class: "plotlines-detail" });

  // ── Sidebar ──

  function renderSidebar() {
    clear(sidebarEl);

    const newBtn = el("button", { class: "btn-primary plotlines-new-btn", onclick: handleNew }, ["+ New plotline"]);
    sidebarEl.append(el("div", { class: "plotlines-sidebar-header" }, [newBtn]));

    const listEl = el("div", { class: "plotline-list" });
    if (!appData.plotlines.length) {
      listEl.append(el("p", { class: "plotline-empty-note" }, ["No plotlines yet."]));
    } else {
      for (const pl of appData.plotlines) {
        const isSelected = pl.id === currentId;
        const prog       = progressLabel(pl);
        const item = el("div", {
          class: "plotline-list-item" + (isSelected ? " is-selected" : ""),
          "data-id": pl.id,
        }, [
          el("span", { class: "plotline-list-title" }, [pl.title || "Untitled"]),
          prog ? el("span", { class: "plotline-list-prog" }, [prog]) : null,
        ].filter(Boolean));
        item.style.setProperty("--pl-color", pl.color ?? "#4a6b8a");
        item.addEventListener("click", () => selectPlotline(pl.id));
        listEl.append(item);
      }
    }
    sidebarEl.append(listEl);

    // Narrow-viewport select mirror
    narrowSelect.innerHTML = "";
    narrowSelect.append(el("option", { value: "" }, ["— Select plotline —"]));
    for (const pl of appData.plotlines) {
      const opt = el("option", { value: pl.id }, [pl.title || "Untitled"]);
      if (pl.id === currentId) opt.selected = true;
      narrowSelect.append(opt);
    }
  }

  // ── Detail ──

  function renderDetail() {
    clear(detailEl);
    if (!currentId) {
      detailEl.append(el("p", { class: "plotline-select-hint" }, [
        "Select a plotline from the list, or create a new one.",
      ]));
      return;
    }
    const pl = appData.plotlines.find(p => p.id === currentId);
    if (!pl) {
      detailEl.append(el("p", {}, ["Plotline not found."]));
      return;
    }
    mountPlotlineDetail(detailEl, appData, pl, {
      onUpdate: renderSidebar,
      onDelete: () => {
        const next = appData.plotlines[0]?.id ?? null;
        currentId = next;
        if (next) history.replaceState(null, "", `#/plotlines/${next}`);
        else      history.replaceState(null, "", `#/plotlines`);
        renderSidebar();
        renderDetail();
      },
    });
  }

  function selectPlotline(id) {
    currentId = id;
    history.replaceState(null, "", `#/plotlines/${id}`);
    renderSidebar();
    renderDetail();
  }

  async function handleNew() {
    const pl = createPlotline();
    appData.plotlines.push(pl);
    await save("plotlines", appData.plotlines);
    selectPlotline(pl.id);
  }

  // ── Narrow-viewport dropdown ──
  const narrowSelect = el("select", { class: "plotlines-narrow-select" });
  narrowSelect.addEventListener("change", () => {
    if (narrowSelect.value) selectPlotline(narrowSelect.value);
  });

  renderSidebar();
  renderDetail();

  container.append(
    narrowSelect,
    el("div", { class: "plotlines-layout" }, [sidebarEl, detailEl]),
  );
}
