# OPR Card Generator — Printable Unit Cards for OnePageRules & Army Forge

**OPR Card Generator** is a free web app that turns a shared
[Army Forge](https://army-forge.onepagerules.com) list into printable
**unit reference cards** for [OnePageRules](https://onepagerules.com) (OPR) games —
**Grimdark Future**, **Grimdark Future: Firefight**, **Age of Fantasy**,
**Age of Fantasy: Skirmish**, and others.

Paste a shared army link and get **one card per unit** (Quality, Defense, Tough,
special rules, weapons), plus a combined special-rules table and a spells table —
ready to **print** or **download as PNG**. No sign-up, no install, works in the browser.

👉 **Try it now:** <https://afonsobe.github.io/opr-redesign/>

*Keywords: OnePageRules unit cards, OPR card generator, Army Forge printable cards,
Grimdark Future cards, Age of Fantasy datacards, tabletop wargame reference cards.*

> **Note:** a list only loads if you shared it in Army Forge — open your army and
> click **“Share as Link”** first. Private (unshared) lists cannot be read.

## Features

- One printable card per unit: Quality / Defense / Tough, special rules, weapons, notes.
- **Weapons** show quantities and merge identical profiles into one line (e.g. `3x Dagger (A2)`).
- **Combine similar units** (on by default) — identical single-model units collapse into one card prefixed with their count (e.g. `3x Tribe Spider Rig`); toggle off to show each separately.
- **Use custom unit names** (off by default) — show a unit's custom Army Forge name (e.g. `Frodo`) as the card title, with the book name as the subtitle; toggle off to keep the default unit name.
- Combined **special-rules table** (including core/common rule descriptions) and a **spells table** for casters.
- Per-card **background image** (up to 2 MB) with drag-to-move, scroll/slider zoom, opacity and recenter — saved on your device per unit and kept across refreshes (cleaned up when a unit or list is removed).
- **Print** layout (choose cards / rules / spells) and **PNG** download (single or all).
- **My Lists** — every generated list is saved locally (IndexedDB via Localbase) so you can
  reload it instantly, refresh it on demand, or delete it.
- **Cache-first loading** — *Generate Cards* opens a previously loaded list instantly from your
  saved copy (works offline); use **Refresh List** to pull the latest version from Army Forge.
- **FAQ**, **Changelog**, and **About** pages.

## Project structure

```
index.html              App shell: top bar, hamburger drawer, the three views
index.ts                Front-end bootstrap + Home controller
src/
  types.ts              Army Forge payload types
  api.ts                Data fetching
  render.ts             Card / table rendering + image pan-zoom & persistence + PNG export
  router.ts             Hash router + drawer (#/, #/lists, #/faq, #/changelog, #/about)
  db.ts                 Localbase wrapper (saved lists + per-unit card images)
  views/lists.ts        "My Lists" view (Load / Refresh / Delete)
style.css               All styles
docs/                   Production build output (served by GitHub Pages)
```

## Local development

```sh
yarn install
yarn dev      # start the local dev environment
```

Run pieces individually with `yarn start` (front-end dev server) or build with
`yarn build`.

## Scripts

```sh
yarn dev        # local dev environment
yarn start      # front-end only (Parcel dev server)
yarn build      # production build into docs/
yarn typecheck  # type-check the front-end
```

On Windows PowerShell, use `yarn.cmd` if the execution policy blocks `yarn.ps1`.

## Updating the Portuguese content dictionary (pt-BR)

Unit, weapon, spell and rule text always comes **live from the Army Forge API**,
so an OPR update shows up in English with no rebuild. The pt-BR dictionary is a
snapshot bundled with the app (`src/i18n/content.pt-BR.json`), validated against
the English snapshot in `src/i18n/content.source.json`:

- English text equal to the snapshot → the translation is used.
- English text changed since the snapshot → the old translation is shown with a
  trailing `†` ("outdated"; the mark is explained under the table titles).
- No translation yet → the English text is shown.

Procedure after an OPR update:

1. **See what changed** (live API vs. snapshot):

   ```sh
   npm run i18n:check                # all systems
   npm run i18n:check -- --system gfwf
   ```

   It lists changed, new and removed terms, with a short `old → new` preview,
   plus how many entries have no translation.

2. **Refresh the English snapshot** and create empty entries for new terms:

   ```sh
   npm run i18n:collect:all -- --refresh-source
   npm run i18n:collect:all -- --system gfwf --refresh-source
   ```

   This re-collects every book already recorded in `content.source.json`; it
   never overwrites existing translations.

3. **Read the exact diff**: `git diff src/i18n/content.source.json` shows the old
   and new English text of every changed entry.

4. **Translate** the changed/new entries in `src/i18n/content.pt-BR.json`. Key
   formats:

   - `rules.<ruleId>` → `{ "name": "...", "description": "..." }`
   - `weapons.<weaponId>` → `{ "name": "..." }` (weapon id, not unit id)
   - `spells["<English name>::<English effect>"]` → `{ "name": "...", "effect": "..." }`
   - `items["<English name>"]` → `"tradução"`

5. **Verify** with `npm run i18n:check` — it should print
   `Tudo em dia: a fonte bate com a API e as traduções continuam válidas.`
   Entries left empty are shown in English and counted separately (not failures).

6. Build and publish as usual (`npm run typecheck && npm run build`, commit
   `docs/` and push).

Terms removed from the API are reported but kept in the snapshot; they are
unused and can be deleted by hand if you want to tidy the JSON.

If the API uses **two different names for the same weapon** (same `weaponId`,
different books), add both names to `src/i18n/content.aliases.json` under
`<system>.weapons.<weaponId>`, each mapped to the same translation. The check
treats listed names as equivalent and the app keeps translating the weapon
whichever name a book sends.

## Deploy

`yarn build` outputs the site into `docs/`; commit it and push. GitHub Pages
serves the app from `docs/` on the default branch.

> Keep it free and non-commercial — that's the condition under which OnePageRules
> is fine with community tools using this data.

## Disclaimer

This is a **free, non-profit project made by a fan, for fans**. It is not
affiliated with, endorsed by, or sponsored by OnePageRules.

OnePageRules and all of its game systems, rules, and content (Grimdark Future,
Age of Fantasy, and others) are the property of **OnePageRules**. This tool only
helps players display their own army lists, and is offered free of charge for
non-commercial community use.

## License

Licensed under the **PolyForm Noncommercial License 1.0.0** — free to use, copy,
modify, and share for **any noncommercial purpose**. Commercial use, including
monetizing the project in any form, is **not permitted**. See [LICENSE](LICENSE).
