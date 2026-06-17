# Slice 1.5: Oxford aesthetic pass

Read CLAUDE.md. Confirm Slice 1 is done. This slice is CSS only with two tiny exceptions noted below. **Do not touch any JS logic.** If you find yourself wanting to refactor JS, stop and ask.

## Goal

Make the app look like an Oxford university administrator's private journal. Aged paper, deep blues, oxblood accents, serif type, the feel of a bound book rather than a SaaS dashboard. Light and dark themes both supported.

## Files to touch

- `src/css/theme.css` (rewrite the variables, expand the palette)
- `src/css/layout.css` (restyle topbar, tabs, welcome card, banner, main area)
- `src/index.html` (add Google Fonts link, add a theme toggle button next to settings, nothing else)
- `src/js/app.js` (add about 15 lines wiring the theme toggle and persisting it to localStorage — this is the one JS exception)

That is the entire scope.

## Visual direction

**Type.**
- Headings: EB Garamond (Google Fonts), weight 500 to 600, with small caps where it suits
- Body: Inter (Google Fonts) or system-ui as fallback, weight 400 to 500
- Numerals in cards use tabular figures (`font-variant-numeric: tabular-nums`)
- Letterspacing slightly open on headings (`letter-spacing: 0.02em` for h1, more for small caps labels)

Add the Google Fonts link to index.html head:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

**Palette (light theme, the default).**

```
--bg:           #f4ecd8   aged paper cream
--bg-surface:   #efe6cf   slightly darker parchment for cards
--bg-raised:    #e8dfc5   raised elements, hover states
--text:         #2a1f15   dark sepia ink
--text-muted:   #6b5a48   faded ink
--accent:       #002147   Oxford blue
--accent-hover: #0a3a6b
--accent-soft:  #c9d4e3   pale blue for subtle backgrounds
--oxblood:      #722f37   secondary accent, used for highlights and active states
--gold:         #b8860b   gold leaf, for thin rules and ornament
--gold-soft:    rgba(184, 134, 11, 0.25)
--border:       #c9b896   warm tan border, like aged book edges
--danger:       #8b2326   deep crimson
--success:      #4a6b3a   ivy green
```

**Owner colors (refined to feel like inks and seals, not UI tags).**

```
--owner-bree:   #2d5a3d   deep ivy green
--owner-jack:   #a07820   burnished brass
--owner-nicole: #1e3a5f   deep lapis
--owner-caiden: #722f37   oxblood
--owner-npc:    #5a5042   sepia
```

**Dark theme palette** (applied when `<html data-theme="dark">`).

```
--bg:           #1a1814   dark walnut
--bg-surface:   #232019
--bg-raised:    #2e2a22
--text:         #e8dfc5   warm cream
--text-muted:   #9a8c75
--accent:       #6e96c0   lighter Oxford blue for contrast on dark
--accent-hover: #8eb0d8
--accent-soft:  #2a3a52
--oxblood:      #a04d56
--gold:         #d4a838
--gold-soft:    rgba(212, 168, 56, 0.25)
--border:       #4a4034
--danger:       #c0444a
--success:      #6b9554
```

Owner colors stay the same in dark mode but get a slight luminosity boost via separate dark-mode vars (lighten each by roughly 15 percent).

## Component restyling

**Topbar.** Background `--bg-surface` with a 1px `--gold-soft` line along the bottom plus a 3px solid `--accent` line below that, like a banded book spine. App title in EB Garamond 600, 1.4rem, small caps, letterspacing 0.06em. Slight golden underline below the title that only shows on hover.

**Tabs.** All-caps labels in Inter 500, 0.78rem, letterspacing 0.12em. Inactive tabs use `--text-muted`. Hover gets `--text` and a thin `--gold` underline that grows in from the center (0.15s ease). Active tab uses `--accent` text and a 2px solid `--accent` underline. No background fill on active. Tabs feel like book chapter markers, not buttons.

**Settings and theme toggle.** Sit to the right of tabs. Both use the muted text color with `--accent` on hover. Theme toggle shows a sun icon in dark mode and a moon icon in light mode (use unicode `☀` and `☾` for now, no SVG needed).

**Welcome card.** Restyled to look like a personal letter or library card:
- Card background `--bg-surface` with a 1px `--gold` border and a subtle inset shadow
- A double-rule decoration at top and bottom of the card (two thin gold lines with a gap, classic book frontispiece style)
- Title in EB Garamond italic, 1.8rem, centered
- A small ornamental flourish under the title (unicode `❦` or `❧` works fine, in `--gold`)
- Body text in EB Garamond italic, slightly smaller
- "Open project folder" button in `--accent` background with a subtle `--gold` 1px border, all-caps label, letterspacing 0.1em, no rounded corners (sharp like a wax seal stamp)

**Main content area.** Background stays `--bg`. Add a very subtle paper grain via a CSS gradient or `background-image` data URI with a small noise pattern. Keep it under 5 percent opacity so it does not distract.

**Banner.** Restyled with `--danger` background, cream text, no rounded corners, thin gold border at top and bottom.

**Placeholder views (the "coming in Slice X" text).** Center it. Use EB Garamond italic, `--text-muted`, 1rem. Add a small `❦` flourish above. This is what the user will see most of right now so make it pleasant.

## Theme toggle wiring (the JS exception)

In `app.js`, near the top of `init()`:

```js
// Theme toggle.
const savedTheme = localStorage.getItem("oxford-theme") || "light";
document.documentElement.dataset.theme = savedTheme;
const themeBtn = qs("#theme-toggle");
themeBtn.textContent = savedTheme === "dark" ? "☀" : "☾";
themeBtn.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  themeBtn.textContent = next === "dark" ? "☀" : "☾";
  localStorage.setItem("oxford-theme", next);
});
```

Add the button to index.html topbar:

```html
<button id="theme-toggle" title="Toggle theme">☾</button>
```

In `theme.css`, define both palettes using `[data-theme="light"]` and `[data-theme="dark"]` selectors on `:root` or `html`. Light is the default applied when no `data-theme` is set.

## Quality bar

- Text remains comfortably readable. Contrast ratio at least 7:1 for body text against background in both themes.
- The paper grain is felt, not seen. If you can identify the texture pattern, it is too strong.
- Owner color borders on character cards (when slice 2 lands) should still be obvious. Run a mental test now by imagining a left-edge bar in oxblood against the cream background.
- No emoji used anywhere. The unicode flourishes (`❦ ❧ ☀ ☾`) are typographic ornaments, not emoji, and should render in the body serif font.

## Out of scope

- Any new layouts
- Anything in the JS beyond the theme toggle
- Animations beyond the tab underline grow
- Iconography beyond the unicode characters listed
- Any change to storage, router, filters

## Definition of done

- Light theme is the default on first load
- Theme toggle button switches and persists across reloads
- App reads as Oxford-academic, not generic dashboard
- Both themes pass a vibe check: light feels like aged paper, dark feels like a leather-bound journal at night
- Welcome card looks like something you would open in a sealed envelope
- ROADMAP.md updated with `**Status: done**` for slice 1.5 (add it as a new section between slice 1 and slice 2)
