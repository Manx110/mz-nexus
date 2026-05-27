# MZ-Nexus Optimizer Suite

> A browser-based plugin conflict analyzer, load order optimizer, and database auditor for **RPG Maker MZ**.

**🔗 Live Tool → [manx110.github.io/mz-nexus](https://manx110.github.io/mz-nexus/)**  
**☕ Support the project → [ko-fi.com/nexusenginetools](https://ko-fi.com/nexusenginetools)**

---

## What is MZ-Nexus?

Managing a large RPG Maker MZ project means juggling dozens of plugins, database entries, and notetags across multiple plugin ecosystems. Things break silently — a wrong load order crashes your battle system, a missing `)` in a notetag only surfaces when a player triggers that skill, a blank `<Multi-Element: >` just does nothing with no warning.

MZ-Nexus is a drag-and-drop diagnostic tool that runs entirely in your browser — no install, no account, no data ever leaves your machine. Drop in your project files and it tells you exactly what's wrong before your players find out.

> **New to the tool?** Click **⚡ Load Demo Sandbox** in the sidebar drop zone to see the full feature set on example data without needing your own project files.

---

## Features

### 🔌 Plugin Manager

- Parses your `plugins.js` and displays the full active load order in the sidebar with tier and ecosystem badges
- **Ecosystem-aware load order analysis** — understands that VisuStella, MK RNGMaps, and other plugin families each have their own internal tier systems that must not be compared against each other
- **Multi-ecosystem ordering** — enforces the correct three-block order: `[VisuStella + Public_* runtimes] → [standalone tier plugins] → [third-party ecosystems like MK]`
- **Public_* runtime detection** — correctly places VisuStella runtime libraries (e.g. `Public_0_DragonBones`) before `VisuMZ_0_CoreEngine` where the engine expects them
- **Tier violation detection** — flags higher-tier plugins loading before their lower-tier dependencies, within the same ecosystem only
- **Ecosystem root anchor detection** — catches third-party ecosystem root plugins (e.g. `MK_Core`) placed above VisuStella plugins, and explains exactly which core prototype methods are at risk
- **`@base` and `@orderAfter` parsing** — reads explicit dependency declarations from plugin source headers and registers them in the dependency graph
- **Missing dependency detection** — warns when a `@base` or `@orderAfter` declaration points to a plugin not present in the load list, distinguishing hard dependencies (will crash) from soft ordering constraints
- **Namespace detection from source** — when plugin `.js` files are dropped, scans for `var NAMESPACE = NAMESPACE || {}` declarations to accurately identify plugin families without relying on name prefixes alone
- **Critical prototype overwrite detection** — identifies plugins that hard-replace a core method without aliasing, silently breaking other plugins that modified the same method
- **Auto-Optimize Order** — topological sort that resolves the entire multi-ecosystem dependency graph in one click, snapping Nexus compatibility patches directly below their target plugins and warning about any circular dependencies found
- Generates downloadable **compatibility patch files** (`.zip`) for detected code conflicts
- Export a corrected `plugins.js` ready to drop back into your project

### 🗃️ Database Auditor

Drop in any of your `/data` folder JSON files (Skills.json, Items.json, Weapons.json, etc.) for a full structural audit. Results are grouped into four severity tiers:

**🔴 Hard Errors**
- **Damage formula sandbox** — executes every formula in a mock RPG Maker MZ environment (including `$gameVariables`, `param()`, `xparam()`, `sparam()`, `isEnemy()`, `hasSkill()`, and more) to catch broken stat references, incomplete math, and NaN results before runtime
- **JavaScript notetag block validation** — compiles every embedded JS block and reports syntax errors with line hints and auto-suggested fixes. Uses a registry-based pattern system covering:
  - VisuStella MZ `<JS Tag Name>` blocks
  - VisuStella MZ / Yanfly `<Custom Tag>` blocks (with display-text exclusion for tags like `<Custom Cost Text>`)
  - MOG Hunter `<JS>` blocks
  - Galv `<js: expression>` inline tags
  - Generic `<script>`, `<eval>`, `<code>` blocks
- **Multi-error reporting** — after catching the first syntax error (JS engine limitation), runs an independent balance analyser to surface all unbalanced parentheses and braces in one pass, with an auto-generated suggested fix
- **Unclosed notetag brackets** — catches asymmetric `<` / `>` pairs that silently break plugin parameter parsing

**🟡 Incomplete Notetags**
- **Missing colon-parameter values** — catches `<Multi-Element: >` and similar tags where a required value was left blank
- **Missing values on DSL lines** — catches plain-text lines inside block notetags like `Target Not State` with no ID number following, across all non-JS block types

**🔍 Possible Typos**
- **Levenshtein fuzzy keyword matching** — detects words within one character edit of a known RPG Maker / VisuStella condition keyword inside known condition blocks (e.g. `Target Not Stat` → suggests `Target Not State`). Restricted to known condition-block tag names to avoid false positives in action-sequence blocks with their own DSL vocabularies

**💡 Style Suggestions**
- **Formula style improvements** — flags `$gameVariables.value(x)` (standard shorthand is `v[x]`) and ambiguous `Math.floor` precedence, with a side-by-side current/suggested formula display

### 🗺️ Conflict Map

Visual node map showing which plugins are fighting over the same prototype methods and which plugins have tier order violations — see the full conflict topology at a glance without reading individual cards.

---

## How to Use

**No installation required.** Open the live tool at [manx110.github.io/mz-nexus](https://manx110.github.io/mz-nexus/) in any modern desktop browser.

### Try the Demo First

Click **⚡ Load Demo Sandbox** in the sidebar drop zone to load a pre-built example project. It demonstrates a wrong load order, a prototype overwrite conflict, a broken damage formula, a JS syntax error in a notetag, a missing parameter value, a typo in an AI condition block, and an unclosed tag — all in one session without needing your own files.

### Plugin Analysis

1. Locate your `plugins.js` file — it lives at `[your project]/js/plugins.js`
2. Optionally also grab the individual plugin `.js` files from `[your project]/js/plugins/`
3. Drag and drop them all into the **sidebar drop zone**
4. The load order appears in the sidebar with tier `[T1]` and ecosystem `[MK T1]` badges
5. Conflicts and violations appear in the **Resolution Center** tab

> **Tip:** Dropping the individual plugin `.js` files alongside `plugins.js` enables deep source scanning. The tool can then detect actual prototype overwrites inside the code, read `@base` and `@orderAfter` declarations, detect plugin family namespaces, and produce more accurate ordering — rather than relying on tier numbers and name prefixes alone.

### Database Audit

1. Locate your data files — they live at `[your project]/data/`
2. Drag one or more `.json` files (Skills.json, Items.json, Weapons.json, Armors.json, etc.) into the sidebar drop zone
3. The **Database Audit** tab opens automatically with results grouped by severity

### Fixing Issues

- **Tier violations and load order issues** → click **Auto-Optimize Order** to sort everything automatically across all ecosystems, then **Export Updated plugins.js**
- **Critical overwrites** → click **Generate Compatibility Patch** to download a ready-to-use alias wrapper, place it below the offending plugin in your project
- **Database errors** → fix the issue in RPG Maker's database editor, re-export the JSON, and re-drop it to verify
- **Style suggestions** → copy the suggested formula from the side-by-side display directly into your database

### Reset

Click the **Reset** button in the bottom bar to clear all loaded files and start a fresh session.

---

## Supported File Types

| File | Purpose |
|------|---------|
| `plugins.js` | RPG Maker MZ plugin configuration array |
| `*.js` | Individual plugin source files (deep conflict scanning, namespace detection, `@base`/`@orderAfter` parsing) |
| `*.json` | RPG Maker MZ database files (Skills, Items, Weapons, Armors, States, Enemies, etc.) |

---

## Extending the Tool

### Adding a New JS Notetag Format

MZ-Nexus uses a registry-based system for recognising JavaScript notetag blocks. Add one entry to `JS_NOTETAG_PATTERNS` at the top of `parser.js`:

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

### Adding a New Condition Block for Typo Checking

Add the tag name (lower-case) to `CONDITION_BLOCK_TAGS` and any new valid keywords to `KNOWN_CONDITION_KEYWORDS` in `parser.js`.

### Adding a New Plugin Ecosystem

Add the ecosystem's root/anchor plugin to `ECOSYSTEM_VISUCORE_ANCHORS`:

```javascript
const ECOSYSTEM_VISUCORE_ANCHORS = {
    'MK_RNGMaps': 'MK_Core',
    'CGMZ':       'CGMZ_Core',
    'MyEcosystem': 'MyEcosystem_Core',  // add here
};
```

And add its name prefix to `getPluginEcosystem()`:

```javascript
if (pluginName.startsWith('My_')) return 'MyEcosystem';
```

Once registered, the tool will automatically enforce that the entire ecosystem sorts after VisuStella and standalone tier-declaring plugins, and tier comparisons will be scoped within the ecosystem correctly.

---

## How the Load Order Engine Works

MZ-Nexus uses a **topological sort** over a directed dependency graph. Understanding the three-layer ordering model helps if you're debugging an unexpected result:

**Layer 1 — VisuStella + Public_* runtimes**  
`Public_*` plugins (tier `-2`) load first — these are raw JavaScript runtime libraries (Dragonbones engine etc.) that set up globals before RPG Maker initialises. `VisuMZ_0_CoreEngine` (tier `-1`) follows, then all `VisuMZ_*` plugins in ascending tier order.

**Layer 2 — Standalone tier-declaring plugins**  
Third-party plugins from other authors that declare `[Tier X]` in their description (following VisuStella's convention) are placed after the entire VisuStella block. They depend on VisuStella's fully-built method chain rather than just CoreEngine.

**Layer 3 — Third-party ecosystems**  
Registered ecosystems like MK RNGMaps are placed after both previous layers. The ecosystem anchor plugin (`MK_Core`) is forced to depend on all VisuStella and standalone-tier plugins, pulling the entire chain with it.

Within each ecosystem, `@base` and `@orderAfter` declarations (read from source files if dropped) provide the authoritative ordering. Tier numbers provide the fallback when source files are not available.

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
- [ ] Separate conflict counter — ordering violations vs code conflicts
- [ ] Per-file breakdown in Database Audit summary
- [ ] Plugin list search / filter
- [ ] Dark / light mode toggle
- [ ] Expanded AI condition keyword dictionary
- [ ] Version display in top bar

---

## License

Copyright (c) 2026 Manx110  
Licensed under **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)**

You are free to use, share, and adapt this tool for **non-commercial purposes** with attribution.  
Commercial use or hosting as a service requires written permission from the author.

See [`LICENSE`](./LICENSE) for full terms.

---

## Contributing & Bug Reports

Found a bug, an undetected notetag format, or a plugin ecosystem that needs registering?  
**[Open an issue on GitHub](https://github.com/Manx110/mz-nexus/issues)** — include the plugin name, the notetag or pattern involved, and ideally a minimal example.

Pull requests are welcome. Please open an issue first to discuss significant changes.

---

*Built for the RPG Maker MZ community. Not affiliated with Kadokawa, Degica, or VisuStella.*
