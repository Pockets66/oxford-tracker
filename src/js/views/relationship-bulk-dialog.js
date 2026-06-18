import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import { displayName, RELATIONSHIP_BANDS, RELATIONSHIP_LINKS, createRelationship } from "../schema.js";
import { ownerColor } from "../util/owner-color.js";

// ── Owner constants (mirrors characters overview) ─────────────────────────────
const OWNERS = ["Bree", "Jack", "Nicole", "Caiden", "NPC"];

// ── Band slider helpers ───────────────────────────────────────────────────────

function makeBandSlider(initialBand, onBandChange) {
  const wrap = el("div", { class: "rbd-band-wrap" });

  let current = initialBand || "Neutral";

  const segs = RELATIONSHIP_BANDS.map((band, i) => {
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

  const segRow   = el("div", { class: "rbd-band-row", tabindex: "0" }, segs.map(s => s.seg));
  const bandLabel = el("em",  { class: "rbd-band-label" }, [current]);

  function refreshSlider() {
    for (const { band, seg } of segs) {
      seg.classList.toggle("is-active", band === current);
    }
    bandLabel.textContent = current;
  }

  // Keyboard navigation
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
    const catEl = el("div", { class: "rbd-link-category" });
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

// ── Apply form ────────────────────────────────────────────────────────────────

function makeApplyForm({ label, initialBand, initialLinks, initialNotes, showReciprocal }) {
  const band  = makeBandSlider(initialBand ?? "Neutral", () => {});
  const links = makeLinkChecks(initialLinks ?? []);
  const notesEl = el("textarea", { class: "rbd-notes", placeholder: "Notes… (optional)", rows: "2" });
  notesEl.value = initialNotes ?? "";

  const formEl = el("div", { class: "rbd-apply-form" }, [
    el("div", { class: "rbd-form-label" }, [label]),
    el("div", { class: "rbd-field" }, [
      el("div", { class: "rbd-field-label" }, ["Band"]),
      band.el,
    ]),
    el("div", { class: "rbd-field" }, [
      el("div", { class: "rbd-field-label" }, ["Links"]),
      links.el,
    ]),
    el("div", { class: "rbd-field" }, [
      el("div", { class: "rbd-field-label" }, ["Notes"]),
      notesEl,
    ]),
  ]);

  let recipSection = null;
  let recipBand = null, recipLinks = null, recipNotes = null, skipRecip = null;

  if (showReciprocal) {
    recipBand  = makeBandSlider("Neutral", () => {});
    recipLinks = makeLinkChecks([]);
    recipNotes = el("textarea", { class: "rbd-notes", placeholder: "Their notes… (optional)", rows: "2" });

    const skipCheck = el("input", { type: "checkbox" });
    skipRecip = skipCheck;

    const recipBody = el("div", { class: "rbd-recip-body" }, [
      el("div", { class: "rbd-field" }, [
        el("div", { class: "rbd-field-label" }, ["Their band"]),
        recipBand.el,
      ]),
      el("div", { class: "rbd-field" }, [
        el("div", { class: "rbd-field-label" }, ["Their links"]),
        recipLinks.el,
      ]),
      el("div", { class: "rbd-field" }, [
        el("div", { class: "rbd-field-label" }, ["Their notes"]),
        recipNotes,
      ]),
    ]);

    skipCheck.addEventListener("change", () => {
      recipBody.style.display = skipCheck.checked ? "none" : "";
    });

    recipSection = el("div", { class: "rbd-recip-section" }, [
      el("div", { class: "rbd-recip-rule" }),
      el("label", { class: "rbd-skip-label" }, [skipCheck, " Skip reciprocal"]),
      recipBody,
    ]);
    formEl.append(recipSection);
  }

  function getValues() {
    return {
      band:       band.getBand(),
      links:      links.getLinks(),
      notes:      notesEl.value.trim(),
      skipRecip:  skipRecip?.checked ?? true,
      recipBand:  recipBand?.getBand() ?? "Neutral",
      recipLinks: recipLinks?.getLinks() ?? [],
      recipNotes: recipNotes?.value.trim() ?? "",
    };
  }

  return { el: formEl, getValues };
}

// ── Filter bar helpers ────────────────────────────────────────────────────────

function makeFilterBar(appData, onChange) {
  let searchQ   = "";
  let ownerSet  = new Set(OWNERS);
  let factionId = "";

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

  const barEl = el("div", { class: "rbd-filter-bar" }, [
    searchEl,
    el("div", { class: "rbd-owner-btns" }, ownerBtns),
    factionSel,
  ]);

  function matches(ch) {
    if (!ownerSet.has(ch.owner)) return false;
    if (factionId && !(ch.factionIds ?? []).includes(factionId)) return false;
    if (searchQ) {
      const dn = displayName(ch).toLowerCase();
      const aliases = (ch.aliases ?? []).map(a => a.toLowerCase());
      if (!dn.includes(searchQ) && !aliases.some(a => a.includes(searchQ))) return false;
    }
    return true;
  }

  return { el: barEl, matches };
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

  // ── Modal ─────────────────────────────────────────────────────────────────────

  const modalTitle = mode === "add"
    ? `Add relationships — ${displayName(holder)}`
    : `Edit relationships — ${displayName(holder)}`;

  const selectedIds = new Set(prefilledTargetIds ?? []);

  // ── Candidate list ────────────────────────────────────────────────────────────

  const listEl      = el("div", { class: "rbd-cand-list" });
  const countEl     = el("div", { class: "rbd-count-line" });
  const selCountEl  = el("span", { class: "rbd-sel-count" }, ["0 selected"]);
  const visCountEl  = el("span", { class: "rbd-vis-count" });

  // -- Add mode: all chars not holder, not already having a rel from holder
  // -- Edit mode: holder's existing outgoing rels
  const existingRelIds = new Set(
    (appData.relationships ?? []).filter(r => r.from === holderId).map(r => r.to)
  );

  let candidates; // { id, ch, rel? }

  if (mode === "add") {
    candidates = (appData.characters ?? [])
      .filter(c => c.id !== holderId && !existingRelIds.has(c.id))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .map(ch => ({ id: ch.id, ch, rel: null }));
  } else {
    candidates = (appData.relationships ?? [])
      .filter(r => r.from === holderId)
      .sort((a, b) => {
        const ao = appData.characters.find(c => c.id === a.to);
        const bo = appData.characters.find(c => c.id === b.to);
        const ai = RELATIONSHIP_BANDS.indexOf(a.band ?? "Neutral");
        const bi = RELATIONSHIP_BANDS.indexOf(b.band ?? "Neutral");
        if (bi !== ai) return bi - ai;
        return displayName(ao ?? {}).localeCompare(displayName(bo ?? {}));
      })
      .map(rel => {
        const ch = appData.characters.find(c => c.id === rel.to);
        return { id: rel.to, ch, rel };
      })
      .filter(c => c.ch);
  }

  const filterBar = makeFilterBar(appData, rebuildList);

  function rebuildList() {
    clear(listEl);
    let visible = 0;
    let selVisible = 0;

    for (const cand of candidates) {
      const { id, ch, rel } = cand;
      if (!filterBar.matches(ch)) continue;
      visible++;

      const check = el("input", { type: "checkbox", class: "rbd-cand-check" });
      check.checked = selectedIds.has(id);
      if (check.checked) selVisible++;

      check.addEventListener("change", () => {
        if (check.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateCount();
        updateApplyBtn();
      });

      const subtitle = ch ? [
        ch.deceased ? "(deceased)" : null,
        ...(ch.factionIds ?? []).map(fId => appData.factions?.find(f => f.id === fId)?.name).filter(Boolean),
      ].filter(Boolean).join(" · ") : "";

      const bandBadge = rel
        ? el("span", { class: "rbd-cand-band" }, [rel.band ?? "Neutral"])
        : null;

      const row = el("label", { class: "rbd-cand-row" }, [
        check,
        el("span", { class: "rbd-cand-info" }, [
          el("span", { class: "rbd-cand-name" }, [ch ? displayName(ch) : id]),
          subtitle ? el("span", { class: "rbd-cand-sub" }, [subtitle]) : null,
        ].filter(Boolean)),
        bandBadge,
      ]);

      listEl.append(row);
    }

    visCountEl.textContent = `${visible} visible`;
    updateCount();
    updateApplyBtn();
  }

  function updateCount() {
    const selCount = selectedIds.size;
    selCountEl.textContent = `${selCount} selected`;
    countEl.textContent = "";
    countEl.append(selCountEl, " · ", visCountEl);
  }

  function updateApplyBtn() {
    applyBtn.disabled = selectedIds.size === 0;
    if (mode === "add") {
      applyBtn.textContent = selectedIds.size > 0
        ? `Add ${selectedIds.size} relationship${selectedIds.size > 1 ? "s" : ""}`
        : "Add relationships";
    } else {
      applyBtn.textContent = selectedIds.size > 0
        ? `Update ${selectedIds.size} relationship${selectedIds.size > 1 ? "s" : ""}`
        : "Update relationships";
    }
  }

  // ── Apply form ────────────────────────────────────────────────────────────────

  const applyForm = makeApplyForm({
    label:           mode === "add" ? "Apply to selected:" : "Apply to selected:",
    initialBand:     "Neutral",
    initialLinks:    [],
    initialNotes:    "",
    showReciprocal:  mode === "add",
  });

  // ── Buttons ───────────────────────────────────────────────────────────────────

  const applyBtn = el("button", { class: "btn-primary", disabled: true }, [
    mode === "add" ? "Add relationships" : "Update relationships",
  ]);

  const cancelBtn = el("button", { class: "btn-secondary" }, ["Cancel"]);
  cancelBtn.addEventListener("click", close);

  applyBtn.addEventListener("click", async () => {
    const vals = applyForm.getValues();
    const now  = new Date().toISOString();
    const date = appData.meta?.currentDate ?? null;

    if (mode === "add") {
      for (const targetId of selectedIds) {
        const rel = createRelationship();
        rel.from            = holderId;
        rel.to              = targetId;
        rel.band            = vals.band;
        rel.links           = vals.links;
        rel.notes           = vals.notes;
        rel.lastChangedDate = date;
        rel.createdAt       = now;
        rel.updatedAt       = now;
        appData.relationships.push(rel);

        if (!vals.skipRecip) {
          const alreadyHasRecip = appData.relationships.some(
            r => r.from === targetId && r.to === holderId
          );
          if (!alreadyHasRecip) {
            const recip = createRelationship();
            recip.from            = targetId;
            recip.to              = holderId;
            recip.band            = vals.recipBand;
            recip.links           = vals.recipLinks;
            recip.notes           = vals.recipNotes;
            recip.lastChangedDate = date;
            recip.createdAt       = now;
            recip.updatedAt       = now;
            appData.relationships.push(recip);
          }
        }
      }
    } else {
      for (const targetId of selectedIds) {
        const rel = appData.relationships.find(r => r.from === holderId && r.to === targetId);
        if (!rel) continue;
        rel.band            = vals.band;
        rel.links           = vals.links;
        rel.notes           = vals.notes;
        rel.lastChangedDate = date;
        rel.updatedAt       = now;
      }
    }

    await save("relationships", appData.relationships);
    close();
  });

  const footer = el("div", { class: "rbd-footer" }, [applyBtn, cancelBtn]);

  if (mode === "edit") {
    const removeBtn = el("button", { class: "btn-danger rbd-remove-btn" }, ["Remove selected"]);
    removeBtn.addEventListener("click", async () => {
      if (!selectedIds.size) return;
      removeBtn.textContent = `Remove ${selectedIds.size}? (click again to confirm)`;
      removeBtn.dataset.pending = "1";
      removeBtn.addEventListener("click", async function handler() {
        removeBtn.removeEventListener("click", handler);
        appData.relationships = appData.relationships.filter(
          r => !(r.from === holderId && selectedIds.has(r.to))
        );
        await save("relationships", appData.relationships);
        close();
      }, { once: true });
    });
    footer.append(removeBtn);
  }

  // ── Layout ────────────────────────────────────────────────────────────────────

  const leftPane = el("div", { class: "rbd-left" }, [
    filterBar.el,
    listEl,
    countEl,
  ]);

  const rightPane = el("div", { class: "rbd-right" }, [
    applyForm.el,
    footer,
  ]);

  const body = el("div", { class: "rbd-body" }, [leftPane, rightPane]);

  const modal = el("div", { class: "rbd-modal" }, [
    el("div", { class: "rbd-header" }, [
      el("h2", { class: "rbd-title" }, [modalTitle]),
      el("button", { class: "rbd-close-btn", onclick: close }, ["✕"]),
    ]),
    body,
  ]);

  backdrop.append(modal);
  rebuildList();
}
