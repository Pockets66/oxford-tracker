import { el, clear } from "../dom.js";

export function createCombobox({ items, value, placeholder, onChange }) {
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label));

  let selectedValue = value ?? "";
  let filtered      = sorted;
  let activeIndex   = -1;
  let isOpen        = false;

  const input = el("input", {
    type: "text",
    class: "combobox-input",
    placeholder: placeholder ?? "Search…",
    autocomplete: "off",
  });
  input.value = sorted.find(i => i.value === selectedValue)?.label ?? "";

  const chevron = el("span", { class: "combobox-chevron" }, ["▾"]);
  const listEl  = el("div",  { class: "combobox-dropdown" });
  listEl.style.display = "none";

  const wrapper = el("div", { class: "combobox" }, [input, chevron, listEl]);

  function renderList() {
    clear(listEl);
    if (!filtered.length) {
      listEl.append(el("div", { class: "combobox-empty" }, ["No results"]));
      return;
    }
    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
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
    isOpen = true;
    filtered = sorted;
    activeIndex = filtered.findIndex(i => i.value === selectedValue);
    input.value = "";
    renderList();
    listEl.style.display = "block";
    scrollActive();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    listEl.style.display = "none";
    activeIndex = -1;
    input.value = sorted.find(i => i.value === selectedValue)?.label ?? "";
  }

  function pick(val, label) {
    selectedValue = val;
    input.value   = label;
    isOpen        = false;
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
    filtered = q ? sorted.filter(i => i.label.toLowerCase().includes(q)) : sorted;
    activeIndex = -1;
    isOpen = true;
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
      if (activeIndex >= 0 && filtered[activeIndex]) pick(filtered[activeIndex].value, filtered[activeIndex].label);
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
