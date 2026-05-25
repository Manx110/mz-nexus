[README.md](https://github.com/user-attachments/files/28206935/README.md)
# MZ-Nexus Optimizer Suite

> A browser-based plugin conflict analyzer, load order optimizer, and database auditor for **RPG Maker MZ**.

**🔗 Live Tool → [manx110.github.io/mz-nexus](https://manx110.github.io/mz-nexus/)**  
**☕ Support the project → [ko-fi.com/nexusenginetools](https://ko-fi.com/nexusenginetools)**

---

## What is MZ-Nexus?

Managing a large RPG Maker MZ project means juggling dozens of plugins, database entries, and notetags. Things break silently — a wrong load order crashes your battle system, a missing `)` in a notetag only surfaces when a player triggers that skill, a blank `<Multi-Element: >` just does nothing with no warning.

MZ-Nexus is a drag-and-drop diagnostic tool that runs entirely in your browser — no install, no account, no data ever leaves your machine. Drop in your project files and it tells you exactly what's wrong before your players find out.

---

## Features

### 🔌 Plugin Manager
- Parses your `plugins.js` and displays the full active load order in the sidebar
- Detects **tier violations** — higher-tier VisuStella plugins loading before their lower-tier dependencies
- Detects **critical prototype overwrites** — plugins that hard-replace a core method without aliasing, silently breaking other plugins that modified the same method
- Generates downloadable **compatibility patch files** (`.zip`) for detected conflicts
- **Auto-Optimize Order** — topological sort that resolves the entire dependency graph in one click, snapping Nexus patches directly below their target plugins
- Export a corrected `plugins.js` ready to drop back into your project

### 🗃️ Database Auditor
Drop in any of your `/data` folder JSON files (Skills.json, Items.json, Weapons.json, etc.) for a full structural audit:

- **Damage formula sandbox** — executes every formula in a mock RPG Maker environment to catch broken stat references (`a.atkk`), incomplete math, and NaN results before runtime
- **Formula style suggestions** — flags `$gameVariables.value(x)` (use `v[x]` instead) and ambiguous `Math.floor` precedence, with a side-by-side suggested rewrite
- **JavaScript notetag validation** — compiles every embedded JS block and reports syntax errors with line hints and auto-suggested fixes. Supports:
  - VisuStella MZ `<JS Tag Name>` blocks
  - VisuStella / Yanfly `<Custom Tag>` blocks
  - MOG Hunter `<JS>` blocks
  - Galv `<js: expression>` inline tags
  - Generic `<script>`, `<eval>`, `<code>` blocks
- **Missing parameter detection** — catches `<Multi-Element: >` style tags where a required value was left blank
- **Missing value on DSL lines** — catches lines like `Target Not State` with no ID number following
- **Typo detection** — Levenshtein fuzzy matching against known VisuStella AI condition keywords catches `Target Not Stat` → suggests `Target Not State`
- **Unclosed notetag brackets** — catches asymmetric `<` / `>` pairs that break plugin parameter parsing

### 🗺️ Conflict Map
Visual node map of all detected method conflicts and tier violations — see at a glance which plugins are fighting over the same methods.

---

## How to Use

**No installation required.** Open the live tool at [manx110.github.io/mz-nexus](https://manx110.github.io/mz-nexus/) in any modern desktop browser.

### Plugin Analysis
1. Locate your `plugins.js` file — it lives at `[your project]/js/plugins.js`
2. Optionally also grab the individual plugin `.js` files from `[your project]/js/plugins/`
3. Drag and drop them all into the **sidebar drop zone**
4. The load order appears in the sidebar, conflicts appear in the **Resolution Center** tab

> **Tip:** Dropping the individual plugin `.js` files alongside `plugins.js` enables deep source scanning — the tool can then detect actual prototype overwrites inside the code rather than just tier violations.

### Database Audit
1. Locate your data files — they live at `[your project]/data/`
2. Drag one or more `.json` files (Skills.json, Items.json, Weapons.json, Armors.json, etc.) into the sidebar drop zone
3. The **Database Audit** tab opens automatically with results grouped by severity

### Fixing Conflicts
- **Tier violations** and **load order issues** → click **Auto-Optimize Order** to sort everything automatically, then **Export Updated plugins.js**
- **Critical overwrites** → click **Generate Compatibility Patch** to download a ready-to-use alias wrapper, then add it to your project below the offending plugin
- **Database errors** → fix the issue in RPG Maker's database editor, re-export the JSON, and re-drop it to verify

### Reset
Click the **Reset** button in the bottom bar to clear all loaded files and start a fresh session.

---

## Supported File Types

| File | Purpose |
|------|---------|
| `plugins.js` | RPG Maker MZ plugin configuration array |
| `*.js` | Individual plugin source files (for deep conflict scanning) |
| `*.json` | RPG Maker MZ database files (Skills, Items, Weapons, Armors, States, etc.) |

---

## Adding Support for New Plugin Notetag Formats

MZ-Nexus uses a registry-based system for recognising JavaScript notetag blocks. To add support for a plugin that uses a format not already covered, add one entry to the `JS_NOTETAG_PATTERNS` array at the top of `parser.js`:

```javascript
{
    plugin: 'Your Plugin Name',
    args: ['user', 'target', 'value'],   // variables the plugin injects at runtime
    extract(note) {
        const results = [];
        const re = /<MyTag>([\s\S]*?)<\/MyTag>/gi;
        let m;
        while ((m = re.exec(note)) !== null) {
            results.push({ tag: 'MyTag', code: m[1] });
        }
        return results;
    }
}
```

Similarly, to add a new AI-condition-style block to the typo checker, add its tag name (lower-case) to `CONDITION_BLOCK_TAGS`.

---

## Browser Compatibility

MZ-Nexus runs entirely client-side. No data is sent to any server.

| Browser | Support |
|---------|---------|
| Chrome / Edge 90+ | ✅ Full support |
| Firefox 88+ | ✅ Full support |
| Safari 15+ | ✅ Full support |
| Mobile browsers | ⚠️ Layout not optimised — desktop recommended |

---

## Roadmap

- [ ] Drag-to-reorder plugin list (Sortable.js integration)
- [ ] Per-file breakdown in Database Audit summary
- [ ] Plugin list search / filter
- [ ] Dark / light mode toggle
- [ ] Expanded AI condition keyword dictionary

---

## License

Copyright (c) 2025 Manx110  
Licensed under **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)**

You are free to use, share, and adapt this tool for **non-commercial purposes** with attribution.  
Commercial use or hosting as a service requires written permission from the author.

See [`LICENSE`](./LICENSE) for full terms.

---

## Contributing & Bug Reports

Found a bug or a notetag format that isn't detected?  
**[Open an issue on GitHub](https://github.com/Manx110/mz-nexus/issues)** — include the plugin name, the notetag format used, and ideally a minimal example of the note content.

Pull requests are welcome. Please open an issue first to discuss significant changes.

---

*Built for the RPG Maker MZ community. Not affiliated with Kadokawa, Degica, or VisuStella.*
