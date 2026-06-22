import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import { displayName, RELATIONSHIP_BANDS, RELATIONSHIP_LINKS, createRelationship } from "../schema.js";
import { ownerColor } from "../util/owner-color.js";

// ── Owner constants ───────────────────────────────────────────────────────────
const OWNERS = ["Bree", "Jack", "Nicole", "Caiden", "NPC"];

// ── Band slider helpers ───────────────────────────────────────────────────────

function makeBandSlider(initialBand, onBandChange) {
  const wrap = el("div", { class: "rbd-band-wrap" });

  let current = initialBand || "Neutral";

  const segs = RELATIONSHIP_BANDS.map((band) => {
    const seg = el("button", {
      class: "rbd-band-seg",
      type:  "button",
      title: band,
    }, [band]);
    seg.addEventListener("click", () => {
      current = band;
      refreshSlider();
      onBandChange(band);
    });
    return { band, seg };
  });

  const segRow    = el("div", { class: "rbd-band-row", tabindex: "0" }, segs.map(s => s.seg));
  const bandLabel = el("em",  { class: "rbd-band-label" }, [current]);

  function refreshSlider() {
    for (const { band, seg } of segs) {
      seg.classList.toggle("is-active", band === current);
    }
    bandLabel.textContent = current;
  }

  segRow.addEventListener("keydown", e => {
    const idx = RELATIONSHIP_BANDS.indexOf(current);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = RELATIONSHIP_BANDS[Math.min(idx + 1, RELATIONSHIP_BANDS.length - 1)];
      current = next; refreshSlider(); onBandChange(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = RELATIONSHIP_BANDS[Math.max(idx - 1, 0)];
      current = prev; refreshSlider(); onBandChange(prev);
    }
  });

  refreshSlider();
  wrap.append(segRow, bandLabel);

  function getBand() { return current; }
  function setBand(b) { current = b; refreshSlider(); }

  return { el: wrap, getBand, setBand };
}

// ── Link checkboxes ───────────────────────────────────────────────────────────

function makeLinkChecks(initialLinks) {
  const selected = new Set(initialLinks ?? []);
  const wrap = el("div", { class: "rbd-links-wrap" });

  for (const [category, items] of Object.entries(RELATIONSHIP_LINKS)) {
    const catEl  = el("div", { class: "rbd-link-category" });
    const header = el("button", { class: "rbd-link-cat-header", type: "button" }, [
      el("span", { class: "rbd-link-cat-name" }, [category]),
      el("span", { class: "rbd-link-cat-chevron" }, ["▾"]),
    ]);
    const itemsEl = el("div", { class: "rbd-link-items" });

    for (const link of items) {
      const check = el("input", { type: "checkbox", class: "rbd-link-check", value: link });
      check.checked = selected.has(link);
      check.addEventListener("change", () => {
        if (check.checked) selected.add(link);
        else selected.delete(link);
      });
      itemsEl.append(el("label", { class: "rbd-link-label" }, [check, link]));
    }

    let open = false;
    header.addEventListener("click", () => {
      open = !open;
      itemsEl.style.display = open ? "" : "none";
      header.querySelector(".rbd-link-cat-chevron").textContent = open ? "▴" : "▾";
    });
    itemsEl.style.display = "none";

    catEl.append(header, itemsEl);
    wrap.append(catEl);
  }

  function getLinks() { return [...selected]; }
  function setLinks(arr) {
    selected.clear();
    for (const v of arr) selected.add(v);
    for (const chk of wrap.querySelectorAll(".rbd-link-check")) {
      chk.checked = selected.has(chk.value);
    }
  }

  return { el: wrap, getLinks, setLinks };
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function makeFilterBar(appData, onChange) {
  let searchQ      = "";
  let ownerSet     = new Set(OWNERS);
  let factionId    = "";
  let showDeceased = false;

  const searchEl = el("input", {
    type:        "text",
    class:       "rbd-search",
    placeholder: "Search…",
  });
  searchEl.addEventListener("input", () => { searchQ = searchEl.value.toLowerCase(); onChange(); });

  const ownerBtns = OWNERS.map(o => {
    const btn = el("button", { class: "rbd-owner-btn is-active", style: `--oc: ${ownerColor(o)}` }, [o]);
    btn.addEventListener("click", () => {
      if (ownerSet.has(o)) {
        if (ownerSet.size === 1) return;
        ownerSet.delete(o);
      } else {
        ownerSet.add(o);
      }
      btn.classList.toggle("is-active", ownerSet.has(o));
      onChange();
    });
    return btn;
  });

  const factionSel = el("select", { class: "rbd-faction-sel" });
  factionSel.append(el("option", { value: "" }, ["All factions"]));
  for (const f of [...(appData.factions ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
    factionSel.append(el("option", { value: f.id }, [f.name]));
  }
  factionSel.addEventListener("change", () => { factionId = factionSel.value; onChange(); });

  const deceasedCheck = el("input", { type: "checkbox" });
  deceasedCheck.checked = showDeceased;
  deceasedCheck.addEventListener("change", () => { showDeceased = deceasedCheck.checked; onChange(); });
  const deceasedLabel = el("label", { class: "filter-checkbox-label rbd-deceased-toggle" }, [
    deceasedCheck, " Show deceased",
  ]);

  const barEl = el("div", { class: "rbd-filter-bar" }, [
    searchEl,
    el("div", { class: "rbd-owner-btns" }, ownerBtns),
    factionSel,
    deceasedLabel,
  ]);

  function matches(ch) {
    if (!showDeceased && ch.deceased) return false;
    if (!ownerSet.has(ch.owner)) return false;
    if (factionId && !(ch.factionIds ?? []).includes(factionId)) return false;
    if (searchQ) {
      const dn      = displayName(ch).toLowerCase();
      const aliases = (ch.aliases ?? []).map(a => a.toLowerCase());
      if (!dn.includes(searchQ) && !aliases.some(a => a.includes(searchQ))) return false;
    }
    return true;
  }

  return { el: barEl, matches };
}

// ── Mutual toggle ─────────────────────────────────────────────────────────────

function makeMutualToggle() {
  const check = el("input", { type: "checkbox", class: "rbd-mutual-check" });
  check.checked = true;
  const wrap = el("label", { class: "rbd-mutual-label" }, [check, " Mirror (mutual by default)"]);
  function isMutual() { return check.checked; }
  return { el: wrap, isMutual };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function openRelationshipBulkDialog({
  mode,
  holderId,
  appData,
  prefilledTargetIds,
  onClose,
}) {
  const holder = appData.characters.find(c => c.id === holderId);
  if (!holder) return;

  const backdrop = el("div", { class: "dialog-backdrop" });
  document.body.append(backdrop);

  function onEsc(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onEsc);

  function close() {
    document.removeEventListener("keydown", onEsc);
    backdrop.remove();
    onClose?.();
  }

  backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });

  const existingRelIds = new Set(
    (appData.relationships ?? []).filter(r => r.from === holderId).map(r => r.to)
  );

  const modalTitle = mode === "add"
    ? `Add relationships — ${displayName(holder)}`
    : `Edit relationships — ${displayName(holder)}`;

  // ── Right-pane pool ─────────────────────────────────────────────────────────
  // pool: Map<charId, { ch, existingRel, links, band, leftCheckEl,
  //                     subCheckEl, linksDispEl, bandDispEl, rightRowEl }>
  const pool      = new Map();
  const subSelected = new Set(); // sub-checked within the right-pane table

  // Declare buttons early so refreshRightPane can reference them
  const applyLbl  = mode === "add" ? "Apply" : "Update relationships";
  const applyBtn  = el("button", { class: "btn-primary", disabled: true }, [applyLbl]);
  const cancelBtn = el("button", { class: "btn-secondary" }, [mode === "add" ? "Close" : "Cancel"]);
  cancelBtn.addEventListener("click", close);

  const rightCountEl = el("div", { class: "rbd-count-line rbd-right-count" });
  const tableBody    = el("div", { class: "rbd-table-body" });

  function refreshRightPane() {
    const n = pool.size;
    const s = subSelected.size;
    rightCountEl.textContent = n === 0
      ? "Select characters on the left to begin."
      : `${n} character${n !== 1 ? "s" : ""} in pool${s ? ` · ${s} sub-checked` : ""}`;
    applyBtn.disabled = n === 0;
  }

  function rowSubtitle(ch) {
    return [
      ch.deceased ? "(deceased)" : null,
      ...(ch.factionIds ?? []).map(fId => appData.factions?.find(f => f.id === fId)?.name).filter(Boolean),
    ].filter(Boolean).join(" · ");
  }

  function addToPool(ch, existingRel, leftCheckEl) {
    if (pool.has(ch.id)) {
      // If called again (list rebuild), just update leftCheckEl ref
      pool.get(ch.id).leftCheckEl = leftCheckEl;
      return;
    }
    const links = existingRel ? [...(existingRel.links ?? [])] : [];
    const band  = existingRel ? (existingRel.band ?? "Neutral") : "Neutral";

    const subCheck = el("input", { type: "checkbox", class: "rbd-sub-check" });
    subCheck.addEventListener("change", () => {
      if (subCheck.checked) subSelected.add(ch.id);
      else subSelected.delete(ch.id);
      refreshRightPane();
    });

    const linksDispEl = el("span", { class: "rbd-row-links-disp" }, [links.length ? links.join(", ") : "—"]);
    const bandDispEl  = el("span", { class: "rbd-row-band-disp" }, [band]);

    const sub    = rowSubtitle(ch);
    const rowEl  = el("div", { class: "rbd-table-row" }, [
      el("div", { class: "rbd-td rbd-td-check" }, [subCheck]),
      el("div", { class: "rbd-td rbd-td-name" }, [
        el("span", { class: "rbd-cand-name" }, [displayName(ch)]),
        sub ? el("span", { class: "rbd-cand-sub" }, [sub]) : null,
      ].filter(Boolean)),
      el("div", { class: "rbd-td rbd-td-links" }, [linksDispEl]),
      el("div", { class: "rbd-td rbd-td-band" }, [bandDispEl]),
    ]);

    // Click anywhere on row (not the sub-checkbox) to toggle it
    rowEl.addEventListener("click", e => {
      if (e.target === subCheck || e.target.type === "checkbox") return;
      subCheck.checked = !subCheck.checked;
      if (subCheck.checked) subSelected.add(ch.id);
      else subSelected.delete(ch.id);
      refreshRightPane();
    });

    tableBody.append(rowEl);
    pool.set(ch.id, { ch, existingRel, links, band, leftCheckEl, subCheckEl: subCheck, linksDispEl, bandDispEl, rightRowEl: rowEl });
    refreshRightPane();
  }

  function removeFromPool(charId) {
    const entry = pool.get(charId);
    if (!entry) return;
    entry.rightRowEl.remove();
    subSelected.delete(charId);
    pool.delete(charId);
    refreshRightPane();
  }

  // ── Bulk apply controls ─────────────────────────────────────────────────────

  const bulkLinks = makeLinkChecks([]);
  const bulkBand  = makeBandSlider("Neutral", () => {});

  function setLinksFor(entries, ls) {
    for (const e of entries) {
      e.links = [...ls];
      e.linksDispEl.textContent = ls.length ? ls.join(", ") : "—";
    }
  }
  function setBandFor(entries, b) {
    for (const e of entries) {
      e.band = b;
      e.bandDispEl.textContent = b;
    }
  }

  const poolEntries   = () => [...pool.values()];
  const subsetEntries = () => [...pool.values()].filter(e => subSelected.has(e.ch.id));

  const mkBtn = label => el("button", { class: "rbd-bulk-btn", type: "button" }, [label]);
  const linksToAllBtn = mkBtn("Apply to all");
  const linksToSelBtn = mkBtn("Apply to checked");
  const bandToAllBtn  = mkBtn("Apply to all");
  const bandToSelBtn  = mkBtn("Apply to checked");

  linksToAllBtn.addEventListener("click",  () => setLinksFor(poolEntries(),   bulkLinks.getLinks()));
  linksToSelBtn.addEventListener("click",  () => setLinksFor(subsetEntries(), bulkLinks.getLinks()));
  bandToAllBtn.addEventListener("click",   () => setBandFor(poolEntries(),    bulkBand.getBand()));
  bandToSelBtn.addEventListener("click",   () => setBandFor(subsetEntries(),  bulkBand.getBand()));

  const bulkPanel = el("div", { class: "rbd-bulk-panel" }, [
    el("div", { class: "rbd-bulk-title" }, ["Bulk apply"]),
    el("div", { class: "rbd-bulk-section" }, [
      el("div", { class: "rbd-field-label" }, ["Links"]),
      bulkLinks.el,
      el("div", { class: "rbd-bulk-btns" }, [linksToAllBtn, linksToSelBtn]),
    ]),
    el("div", { class: "rbd-bulk-section" }, [
      el("div", { class: "rbd-field-label" }, ["Band"]),
      bulkBand.el,
      el("div", { class: "rbd-bulk-btns" }, [bandToAllBtn, bandToSelBtn]),
    ]),
  ]);

  // ── Apply handler ───────────────────────────────────────────────────────────

  const mutual = makeMutualToggle();

  applyBtn.addEventListener("click", async () => {
    if (!pool.size) return;
    const isMutual = mutual.isMutual();
    const now      = new Date().toISOString();
    const date     = appData.meta?.currentDate ?? null;

    for (const [charId, entry] of pool) {
      let rel = appData.relationships.find(r => r.from === holderId && r.to === charId);
      if (!rel) {
        rel = createRelationship();
        rel.from      = holderId;
        rel.to        = charId;
        rel.createdAt = now;
        appData.relationships.push(rel);
      }
      rel.band            = entry.band;
      rel.links           = [...entry.links];
      rel.lastChangedDate = date;
      rel.updatedAt       = now;

      if (isMutual) {
        let recip = appData.relationships.find(r => r.from === charId && r.to === holderId);
        if (!recip) {
          recip = createRelationship();
          recip.from      = charId;
          recip.to        = holderId;
          recip.createdAt = now;
          appData.relationships.push(recip);
        }
        recip.band            = entry.band;
        recip.links           = [...entry.links];
        recip.lastChangedDate = date;
        recip.updatedAt       = now;
      }
    }

    await save("relationships", appData.relationships);

    if (mode === "add") {
      // Mark applied chars as now having relationships and clear pool
      for (const [charId, entry] of pool) {
        existingRelIds.add(charId);
        entry.rightRowEl.remove();
        subSelected.delete(charId);
      }
      pool.clear();
      rebuildList();    // removes applied chars from left list
      onClose?.();      // refresh character sheet; dialog intentionally stays open
      refreshRightPane();
    } else {
      close();
    }
  });

  // ── Remove selected (edit mode only) ────────────────────────────────────────

  let removeBtn = null;
  if (mode === "edit") {
    removeBtn = el("button", { class: "btn-danger rbd-remove-btn" }, ["Remove selected"]);
    removeBtn.addEventListener("click", () => {
      const toRemove = subSelected.size ? [...subSelected] : [...pool.keys()];
      if (!toRemove.length) return;
      removeBtn.textContent = `Remove ${toRemove.length}? (click again to confirm)`;
      removeBtn.addEventListener("click", async function handler() {
        removeBtn.removeEventListener("click", handler);
        appData.relationships = appData.relationships.filter(
          r => !(r.from === holderId && toRemove.includes(r.to))
        );
        await save("relationships", appData.relationships);
        close();
      }, { once: true });
    });
  }

  // ── Right-pane footer ───────────────────────────────────────────────────────

  const footerKids = [
    mutual.el,
    el("div", { class: "rbd-footer-btns" }, [applyBtn, cancelBtn]),
  ];
  if (removeBtn) footerKids.push(removeBtn);
  const footer = el("div", { class: "rbd-footer rbd-footer--right" }, footerKids);

  // ── Left-pane list ──────────────────────────────────────────────────────────

  const listEl      = el("div", { class: "rbd-cand-list" });
  const leftCountEl = el("div", { class: "rbd-count-line" });
  const filterBar   = makeFilterBar(appData, rebuildList);

  function rebuildList() {
    clear(listEl);
    const chars = (appData.characters ?? [])
      .filter(c => {
        if (c.id === holderId) return false;
        // add mode: chars WITHOUT a relationship from holder
        // edit mode: chars WITH a relationship from holder
        return mode === "add" ? !existingRelIds.has(c.id) : existingRelIds.has(c.id);
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));

    let visible = 0;
    for (const ch of chars) {
      if (!filterBar.matches(ch)) continue;
      visible++;

      const existingRel = appData.relationships.find(r => r.from === holderId && r.to === ch.id) ?? null;
      const inPool = pool.has(ch.id);

      const check = el("input", { type: "checkbox", class: "rbd-cand-check" });
      check.checked = inPool;

      // Keep leftCheckEl reference current after each list rebuild
      if (inPool) pool.get(ch.id).leftCheckEl = check;

      check.addEventListener("change", () => {
        if (check.checked) addToPool(ch, existingRel, check);
        else removeFromPool(ch.id);
      });

      const sub       = rowSubtitle(ch);
      const bandBadge = existingRel ? el("span", { class: "rbd-cand-band" }, [existingRel.band ?? "Neutral"]) : null;

      listEl.append(el("label", { class: "rbd-cand-row" }, [
        check,
        el("span", { class: "rbd-cand-info" }, [
          el("span", { class: "rbd-cand-name" }, [displayName(ch)]),
          sub ? el("span", { class: "rbd-cand-sub" }, [sub]) : null,
        ].filter(Boolean)),
        bandBadge,
      ]));
    }

    leftCountEl.textContent = `${visible} visible`;
  }

  // ── Pre-populate pool ───────────────────────────────────────────────────────

  // Edit mode: all existing relationships start in the pool (all pre-checked)
  if (mode === "edit") {
    for (const ch of (appData.characters ?? [])) {
      if (ch.id === holderId || !existingRelIds.has(ch.id)) continue;
      const rel = appData.relationships.find(r => r.from === holderId && r.to === ch.id);
      addToPool(ch, rel ?? null, null); // leftCheckEl set during rebuildList
    }
  }

  // Add mode: honour prefilledTargetIds
  if (mode === "add" && prefilledTargetIds?.length) {
    for (const id of prefilledTargetIds) {
      const ch = appData.characters.find(c => c.id === id);
      if (ch && !existingRelIds.has(id)) addToPool(ch, null, null);
    }
  }

  // ── Assemble layout ─────────────────────────────────────────────────────────

  const tableHeader = el("div", { class: "rbd-th-row" }, [
    el("div", { class: "rbd-th rbd-th-check" }),
    el("div", { class: "rbd-th rbd-th-name" }, ["Character"]),
    el("div", { class: "rbd-th rbd-th-links" }, ["Links"]),
    el("div", { class: "rbd-th rbd-th-band" }, ["Band"]),
  ]);

  const leftPane  = el("div", { class: "rbd-left" }, [filterBar.el, listEl, leftCountEl]);
  const rightPane = el("div", { class: "rbd-right rbd-right--table" }, [
    el("div", { class: "rbd-table-wrap" }, [tableHeader, tableBody]),
    rightCountEl,
    bulkPanel,
    footer,
  ]);

  const modal = el("div", { class: "rbd-modal" }, [
    el("div", { class: "rbd-header" }, [
      el("h2", { class: "rbd-title" }, [modalTitle]),
      el("button", { class: "rbd-close-btn", type: "button" }, ["✕"]),
    ]),
    el("div", { class: "rbd-body" }, [leftPane, rightPane]),
  ]);

  modal.querySelector(".rbd-close-btn").addEventListener("click", close);
  backdrop.append(modal);

  rebuildList();
  refreshRightPane();
}
