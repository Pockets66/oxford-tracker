import { el, clear } from "../dom.js";

// Items may include divider sentinels: { divider: true }
// presorted: true — skip internal alphabetical sort (caller controls order)
export function createCombobox({ items, value, placeholder, onChange, presorted = false }) {
  const realItems = items.filter(i => !i.divider);
  const sorted    = presorted
    ? [...items]
    : [...realItems].sort((a, b) => a.label.localeCompare(b.label));

  let selectedValue = value ?? "";
  let filtered      = [...realItems]; // keyboard nav uses real items only
  let activeIndex   = -1;
  let isOpen        = false;
  let isFiltering   = false;

  const input = el("input", {
    type: "text",
    class: "combobox-input",
    placeholder: placeholder ?? "Search…",
    autocomplete: "off",
  });
  input.value = realItems.find(i => i.value === selectedValue)?.label ?? "";

  const chevron = el("span", { class: "combobox-chevron" }, ["▾"]);
  const listEl  = el("div",  { class: "combobox-dropdown" });
  listEl.style.display = "none";

  const wrapper = el("div", { class: "combobox" }, [input, chevron, listEl]);

  function renderList() {
    clear(listEl);
    // When filtering show only matching real items; when open show sorted (with dividers).
    const displayList = isFiltering ? filtered : sorted;
    const realCount   = displayList.filter(i => !i.divider).length;

    if (!realCount) {
      listEl.append(el("div", { class: "combobox-empty" }, ["No results"]));
      return;
    }

    let realIdx = 0;
    for (const item of displayList) {
      if (item.divider) {
        listEl.append(el("div", { class: "combobox-divider" }));
        continue;
      }
      const i = realIdx++;
      const opt = el("div", {
        class: "combobox-option" + (i === activeIndex ? " combobox-option--active" : ""),
      }, [item.label]);
      opt.addEventListener("mousedown", e => {
        e.preventDefault();
        pick(item.value, item.label);
      });
      listEl.append(opt);
    }
  }

  function open() {
    if (isOpen) return;
    isOpen      = true;
    isFiltering = false;
    filtered    = [...realItems];
    activeIndex = realItems.findIndex(i => i.value === selectedValue);
    input.value = "";
    renderList();
    listEl.style.display = "block";
    scrollActive();
  }

  function close() {
    if (!isOpen) return;
    isOpen      = false;
    isFiltering = false;
    listEl.style.display = "none";
    activeIndex = -1;
    input.value = realItems.find(i => i.value === selectedValue)?.label ?? "";
  }

  function pick(val, label) {
    selectedValue = val;
    input.value   = label;
    isOpen        = false;
    isFiltering   = false;
    listEl.style.display = "none";
    activeIndex   = -1;
    onChange(val);
  }

  function scrollActive() {
    if (activeIndex < 0) return;
    listEl.querySelectorAll(".combobox-option")[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", open);

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    if (q) {
      isFiltering = true;
      filtered    = realItems.filter(i => i.label.toLowerCase().includes(q));
    } else {
      isFiltering = false;
      filtered    = [...realItems];
    }
    activeIndex = -1;
    isOpen      = true;
    listEl.style.display = "block";
    renderList();
  });

  input.addEventListener("keydown", e => {
    if (!isOpen && e.key !== "Escape") { open(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      renderList(); scrollActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList(); scrollActive();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex]) {
        pick(filtered[activeIndex].value, filtered[activeIndex].label);
      }
    } else if (e.key === "Escape") {
      close();
    }
  });

  chevron.addEventListener("click", () => {
    if (isOpen) close();
    else { input.focus(); }
  });

  function onDocClick(e) {
    if (!wrapper.isConnected) { document.removeEventListener("click", onDocClick); return; }
    if (!wrapper.contains(e.target)) close();
  }
  document.addEventListener("click", onDocClick);

  return wrapper;
}
