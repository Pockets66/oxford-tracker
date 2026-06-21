import { el, clear } from "../dom.js";
import { displayName } from "../schema.js";
import { formatFlexibleDate, flexibleDateSortKey } from "../dates.js";
import { navigate } from "../router.js";
import { openTimelineEventDialog } from "./timeline-event-dialog.js";
import { getTypeSettings, itemContent } from "../util/timeline-settings.js";

export function openPersonalTimeline(characterId, appData) {
  const character = appData.characters.find(c => c.id === characterId);
  if (!character) return;

  let tlInstance = null;
  let dialogOpen = false;

  function closeModal() {
    if (dialogOpen) return;
    document.removeEventListener("keydown", onEsc);
    window.removeEventListener("current-date-change", onDateChange);
    if (tlInstance) { tlInstance.destroy(); tlInstance = null; }
    backdrop.remove();
    document.body.style.cursor = "";
  }

  function onEsc(e) {
    if (dialogOpen) return;
    if (e.key === "Escape") closeModal();
  }
  document.addEventListener("keydown", onEsc);

  function onDateChange(e) {
    if (!tlInstance) return;
    try { tlInstance.setCustomTime(new Date(e.detail.date), "now"); } catch (_) {}
  }
  window.addEventListener("current-date-change", onDateChange);

  const backdrop = el("div", { class: "rweb-backdrop" });
  const closeBtn = el("button", { class: "btn-small", onclick: () => closeModal() }, ["Close"]);
  const topbar = el("div", { class: "rweb-topbar" }, [
    el("span", { class: "rweb-title" }, [`${displayName(character)} — Timeline`]),
    el("div", { class: "rweb-topbar-actions" }, [closeBtn]),
  ]);

  const tlCanvas     = el("div", { class: "ptl-canvas" });
  const eventsSection = el("div", { class: "ptl-events-section" });

  const body  = el("div", { class: "ptl-body" }, [tlCanvas, eventsSection]);
  const modal = el("div", { class: "ptl-modal" }, [topbar, body]);
  backdrop.append(modal);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });
  document.body.append(backdrop);

  // ── Data helpers ─────────────────────────────────────────────────────────────

  function charEvents() {
    return (appData.timelineEvents ?? []).filter(ev =>
      (ev.characterIds ?? []).includes(characterId),
    );
  }

  function sceneItems() {
    return (appData.scenes ?? []).filter(sc => {
      if (!sc.sceneDate) return false;
      if (!["In progress", "Complete"].includes(sc.status)) return false;
      return (sc.characters ?? []).some(row => row.characterId === characterId);
    });
  }

  function hasContent() {
    return !!(
      character.birthday ||
      character.deathDate ||
      charEvents().length ||
      sceneItems().length
    );
  }

  // ── Build a JS Date from a flexible or YYYY-MM-DD date string ───────────────
  function toJsDate(s) {
    if (!s) return null;
    const parts = s.split("-").map(Number);
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
    if (parts.length === 2) return new Date(parts[0], parts[1] - 1, 1);
    if (parts.length === 1) return new Date(parts[0], 0, 1);
    return null;
  }

  // ── Render events list below the timeline ─────────────────────────────────

  function renderEventsList() {
    clear(eventsSection);

    const events = charEvents().slice().sort((a, b) =>
      flexibleDateSortKey(a.date).localeCompare(flexibleDateSortKey(b.date)),
    );

    if (events.length) {
      const groupsMap = new Map();
      for (const ev of events) {
        const year = ev.date ? ev.date.split("-")[0] : "No date";
        if (!groupsMap.has(year)) groupsMap.set(year, []);
        groupsMap.get(year).push(ev);
      }

      for (const [year, group] of groupsMap) {
        const yearEl = el("div", { class: "ptl-year-group" }, [
          el("div", { class: "ptl-year-label" }, [year]),
        ]);
        for (const ev of group) {
          const dateStr = ev.date ? formatFlexibleDate(ev.date) : "No date";
          const editBtn = el("button", { class: "btn-small" }, ["Edit"]);
          editBtn.addEventListener("click", () => {
            dialogOpen = true;
            openTimelineEventDialog({
              existingEvent: ev,
              characterId,
              appData,
              onSave:   () => refresh(),
              onDelete: () => refresh(),
              onClose:  () => { dialogOpen = false; },
            });
          });
          yearEl.append(el("div", { class: "ptl-event-row" }, [
            el("div", { class: "ptl-event-info" }, [
              el("span", { class: "ptl-event-title" }, [ev.title || "(untitled)"]),
              el("span", { class: "ptl-event-date" }, [dateStr]),
            ]),
            el("div", { class: "ptl-event-btns" }, [editBtn]),
          ]));
        }
        eventsSection.append(yearEl);
      }
    }

    const addBtn = el("button", { class: "btn-small ptl-add-btn" }, ["+ Add event"]);
    addBtn.addEventListener("click", () => {
      dialogOpen = true;
      openTimelineEventDialog({
        existingEvent: null,
        characterId,
        appData,
        onSave:  () => refresh(),
        onClose: () => { dialogOpen = false; },
      });
    });
    eventsSection.append(el("div", { class: "ptl-add-row" }, [addBtn]));
  }

  // ── Build vis-timeline ────────────────────────────────────────────────────

  async function buildTimeline() {
    if (tlInstance) { tlInstance.destroy(); tlInstance = null; }
    clear(tlCanvas);

    if (!hasContent()) {
      tlCanvas.append(el("div", { class: "placeholder-view" }, [
        "Nothing on this character's timeline yet.",
      ]));
      return;
    }

    try {
      const visModule = await import("../../vendor/vis-timeline.esm.min.js");
      const Timeline  = visModule.Timeline;
      const DataSet   = visModule.DataSet;

      const items = [];
      const ts = getTypeSettings(appData);

      if (character.birthday) {
        const d = toJsDate(character.birthday);
        if (d) {
          items.push({
            id:        "birth",
            content:   itemContent(ts.births.symbol, ts.births.color, `${displayName(character)} born`),
            start:     d,
            type:      "box",
            className: "gtl-item-base",
            style:     "",
          });
        }
      }

      if (character.deathDate) {
        const d = toJsDate(character.deathDate);
        if (d) {
          items.push({
            id:        "death",
            content:   itemContent(ts.deaths.symbol, ts.deaths.color, `${displayName(character)} died`),
            start:     d,
            type:      "box",
            className: "gtl-item-base",
            style:     "",
          });
        }
      }

      for (const ev of charEvents()) {
        const d = toJsDate(ev.date);
        if (!d) continue;
        const sym = ev.symbol || ts.events.symbol;
        items.push({
          id:        ev.id,
          content:   itemContent(sym, ts.events.color, ev.title || "(untitled)"),
          start:     d,
          type:      "box",
          className: "gtl-item-base",
          style:     "",
        });
      }

      for (const sc of sceneItems()) {
        const d = toJsDate(sc.sceneDate);
        if (!d) continue;
        const plotline = (appData.plotlines ?? []).find(
          pl => (sc.plotlineIds ?? []).includes(pl.id),
        );
        const color = plotline?.color ?? ts.scenes.color;
        items.push({
          id:        `scene:${sc.id}`,
          content:   itemContent(ts.scenes.symbol, color, sc.title || "(untitled scene)"),
          start:     d,
          type:      "box",
          className: "gtl-item-base",
          style:     "",
        });
      }

      const dataset = new DataSet(items);

      const options = {
        height:          "260px",
        stack:           true,
        editable:        { add: false, updateTime: false, updateGroup: false, remove: false },
        zoomable:        true,
        moveable:        true,
        showCurrentTime: false,
        selectable:      true,
      };

      tlInstance = new Timeline(tlCanvas, dataset, options);

      if (appData.meta?.currentDate) {
        try { tlInstance.addCustomTime(new Date(appData.meta.currentDate), "now"); } catch (_) {}
      }

      tlInstance.on("click", props => {
        if (!props.item) return;
        const itemId = String(props.item);
        if (itemId.startsWith("scene:")) {
          navigate(`scenes/${itemId.slice(6)}`);
          return;
        }
        if (itemId === "birth" || itemId === "death") return;
        const ev = charEvents().find(e => e.id === itemId);
        if (!ev) return;
        dialogOpen = true;
        openTimelineEventDialog({
          existingEvent: ev,
          characterId,
          appData,
          onSave:   () => refresh(),
          onDelete: () => refresh(),
          onClose:  () => { dialogOpen = false; },
        });
      });
    } catch (err) {
      tlCanvas.append(el("p", { class: "ptl-error" }, [`Timeline unavailable: ${err.message}`]));
    }
  }

  async function refresh() {
    await buildTimeline();
    renderEventsList();
  }

  // ── Empty state shortcut ─────────────────────────────────────────────────────
  if (!hasContent()) {
    tlCanvas.append(el("div", { class: "placeholder-view" }, [
      "Nothing on this character's timeline yet.",
    ]));
    const addBtn = el("button", { class: "btn-small ptl-add-btn" }, ["+ Add event"]);
    addBtn.addEventListener("click", () => {
      dialogOpen = true;
      openTimelineEventDialog({
        existingEvent: null,
        characterId,
        appData,
        onSave:  () => refresh(),
        onClose: () => { dialogOpen = false; },
      });
    });
    eventsSection.append(el("div", { class: "ptl-add-row" }, [addBtn]));
  } else {
    buildTimeline();
    renderEventsList();
  }
}
