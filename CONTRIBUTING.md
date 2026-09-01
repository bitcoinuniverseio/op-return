# Contributing

Corrections are the most valuable contribution to this repository. If a rule here does not
match what the authoritative reader does, that is a defect worth fixing.

## Ground rules for content

1. **Cite the code, not the intention.** Every protocol rule must correspond to behaviour
   implemented in the organisation's own readers. If you cannot point at the behaviour,
   the claim does not go in.
2. **Code presence is not released capability.** Do not claim wallet, marketplace or
   indexer support without seeing it wired in the organisation's code. When uncertain,
   write "not currently supported in Bitcoin Universe products", or leave it out.
3. **Keep the three protocols separate.** OP-20, OP Names and OP Inscriptions share a
   carrier and nothing else. Do not merge their rules, their state models or their
   capability rows.
4. **Attribute upstream protocols honestly.** Protocols that originated outside this
   organisation are described as the ecosystem knows them, with any Bitcoin Universe
   specific indexing decision clearly marked as such.
5. **Test vectors must be produced, not written.** A vector is added by running the script
   through the authoritative parser and recording what came back. Do not hand write an
   expected outcome.

## Style rules

- **Never use an em dash character**, anywhere: prose, headings, `<title>` tags, meta
  descriptions, Open Graph tags, code comments and commit messages included. Use commas,
  colons, periods or parentheses.
- In prose, write "authoritative", "owning", "official" or "the source of truth" rather
  than the adjective that the `rel` link attribute uses. That attribute value is HTML
  syntax and stays as it is.
- Plain, direct writing. No filler, no unsupported superlatives, no fake urgency, no
  placeholder sections, no TODOs, no "coming soon".
- Prefer a diagram or a table over a wall of text.

## Technical rules

- Hand authored static HTML, CSS and vanilla JavaScript. No build step, no framework, no
  package manager, no external fonts, no CDN, no trackers.
- Every ordinary page must work with JavaScript disabled. JavaScript may only enhance:
  theme toggle, search, decoder.
- Dark and light themes must both meet WCAG 2.2 AA contrast.
- Responsive down to 320 pixels wide with no horizontal page overflow. Wide tables, code
  blocks and byte frames scroll inside their own container.
- Semantic landmarks, a skip link, visible focus, correct heading order, and a text
  alternative on every diagram. Diagrams are inline SVG with `<title>` and `<desc>` and use
  CSS custom properties so they stay legible in both themes.
- Budget: under 50 KB of CSS, under 60 KB of JavaScript, no image over 200 KB.

## When you change a page

- Update `search-index.json` if you add, rename or remove a heading.
- Update `sitemap.xml` and `llms.txt` if you add or remove a page.
- Add an entry to `changelog.html` describing the change and the evidence behind it.
- Keep `docs.manifest.json` valid against the shared documentation manifest schema.
- Keep `.nojekyll` in place. GitHub Pages serves this repository from `main` at the root.

## Pull requests

Small and focused. Say in the description what evidence backs the change. If the change
corrects a factual claim, name the reader or registry entry that proves it.
