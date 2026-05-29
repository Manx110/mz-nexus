/**
 * MZ-Nexus Optimizer Suite — parser.js
 * Copyright (c) 2026 Manx110
 *
 * Repository : https://github.com/Manx110/mz-nexus
 * Live tool  : https://manx110.github.io/mz-nexus/
 * Support    : https://ko-fi.com/nexusenginetools
 *
 * Licensed under Creative Commons Attribution-NonCommercial 4.0 International
 * https://creativecommons.org/licenses/by-nc/4.0/
 *
 * You are free to:
 *   Share  — copy and redistribute the material in any medium or format
 *   Adapt  — remix, transform, and build upon the material
 *
 * Under the following terms:
 *   Attribution      — You must give appropriate credit, provide a link to
 *                      the license, and indicate if changes were made.
 *   NonCommercial    — You may not use the material for commercial purposes
 *                      or host it as a monetised / ad-supported service.
 *   No extra locks   — You may not apply legal terms or technological measures
 *                      that legally restrict others from doing anything the
 *                      license permits.
 *
 * Commercial use or redistribution as a hosted service requires written
 * permission from the author.
 */

const NEXUS_VERSION = '1.0.0';
const NEXUS_AUTHOR  = 'Manx110';
const NEXUS_REPO    = 'https://github.com/Manx110/mz-nexus';

// =============================================================================
// JS NOTETAG PATTERN REGISTRY
// =============================================================================
// Each entry defines how a plugin wraps JavaScript inside a database note box.
// The audit engine iterates this list for every entry it scans — add a new
// object here to support any additional plugin without touching the audit logic.
//
// Each pattern requires:
//   plugin   {string}  Human-readable plugin/author name shown in the error card
//   args     {Array}   Parameter names passed into the sandbox Function — should
//                      match the variables the plugin injects at runtime so the
//                      syntax check doesn't false-positive on them
//   extract  {Function}  Receives the full note string, returns an array of
//                        { tag, code } objects — tag is the display name shown in
//                        the error card, code is the raw JS string to validate
//
// Matching rules:
//   - Patterns are tested in order; ALL matching patterns run (a note can contain
//     blocks from multiple plugins simultaneously)
//   - Only SyntaxErrors are reported — ReferenceErrors are runtime-only and would
//     produce false positives against plugin-defined globals
// =============================================================================
const JS_NOTETAG_PATTERNS = [

    // -------------------------------------------------------------------------
    // VISUSTELLA / YANFLY (MZ)
    // Named block format:  <JS Tag Name> ... </JS Tag Name>
    // Covers: VisuMZ_1_BattleCore, VisuMZ_1_SkillsStatesCore, all VisuMZ plugins
    // Runtime args injected by VisuStella battle engine
    // -------------------------------------------------------------------------
    {
        plugin: 'VisuStella MZ',
        args: ['user', 'target', 'value', 'skill', 'item', 'a', 'b', 's', 'v'],
        extract(note) {
            const results = [];
            const re = /<JS ([^>]+)>([\s\S]*?)<\/JS \1>/gi;
            let m;
            while ((m = re.exec(note)) !== null) {
                results.push({ tag: `JS ${m[1].trim()}`, code: m[2] });
            }
            return results;
        }
    },

    // -------------------------------------------------------------------------
    // YANFLY (MV legacy — pre-VisuStella) / VISUSTELLA <Custom> tags
    // VisuStella MZ also uses <Custom ...> (e.g. Custom Cost Text in SkillsStatesCore).
    // VisuStella pattern above catches those first; dedup prevents double-reporting.
    // Block format:  <Custom Pre-Damage> ... </Custom Pre-Damage>  etc.
    //
    // IMPORTANT: Not all <Custom ...> blocks contain JavaScript. VisuStella and
    // Yanfly both use <Custom Cost Text>, <Custom Cost Display>, <Custom Name> etc.
    // as *display text* notetags that accept RPG Maker text codes like \i[160],
    // \c[2], \v[n] — never JavaScript. Two-layer guard below prevents those from
    // being falsely flagged as syntax errors:
    //   1. Tag name exclusion  — skip tags ending with known display-only suffixes
    //   2. Content heuristic   — skip blocks whose content looks like RPG Maker text
    //                            codes and contains no JavaScript indicators
    // -------------------------------------------------------------------------
    {
        plugin: 'Yanfly MV (legacy) / VisuStella MZ Custom tags',
        args: ['user', 'target', 'value', 'skill', 'item'],
        extract(note) {
            // Tag name suffixes that always indicate display text, never JavaScript
            const TEXT_ONLY_SUFFIXES = /\b(text|display|name|description|icon|label|title|message|string|format|caption|header|footer|prefix|suffix|popup|notify|alert|tooltip)$/i;

            // Returns true if the content looks like RPG Maker display text rather
            // than JavaScript. Positive signal: contains \i[, \c[, \n[, \v[ etc.
            // Negative signal: no JS indicators (semicolons, braces, function calls).
            function looksLikeRPGText(code) {
                const hasTextCodes = /\\[icnvpCIGNVP]\[/.test(code);
                const hasJSIndicators = /[;{}]|\bfunction\b|\bvar\b|\blet\b|\bconst\b|\bif\s*\(|\bfor\s*\(|\breturn\b/.test(code);
                return hasTextCodes && !hasJSIndicators;
            }

            const results = [];
            const re = /<Custom ([^>]+)>([\s\S]*?)<\/Custom \1>/gi;
            let m;
            while ((m = re.exec(note)) !== null) {
                const tagName = m[1].trim();
                const code    = m[2];

                // Layer 1: skip known display-text tag name suffixes
                if (TEXT_ONLY_SUFFIXES.test(tagName)) continue;

                // Layer 2: skip blocks that look like RPG Maker text codes
                if (looksLikeRPGText(code)) continue;

                results.push({ tag: `Custom ${tagName}`, code });
            }
            return results;
        }
    },

    // -------------------------------------------------------------------------
    // GENERIC <script> / <eval> / <code> BLOCKS
    // Used by: Hime Works, SumRndmDde (SRD), misc community plugins
    // -------------------------------------------------------------------------
    {
        plugin: 'Generic Script Block (<script> / <eval> / <code>)',
        args: ['a', 'b', 'v', 's', 'item', 'skill'],
        extract(note) {
            const results = [];
            const re = /<(script|eval|code)>([\s\S]*?)<\/\1>/gi;
            let m;
            while ((m = re.exec(note)) !== null) {
                results.push({ tag: m[1], code: m[2] });
            }
            return results;
        }
    },

    // -------------------------------------------------------------------------
    // MOG HUNTER
    // Block format:  <JS> ... </JS>  (bare, no tag name)
    // -------------------------------------------------------------------------
    {
        plugin: 'MOG Hunter',
        args: ['user', 'target', 'value'],
        extract(note) {
            const results = [];
            // Must NOT match VisuStella's <JS TagName> variant — only bare <JS>
            const re = /<JS>([\s\S]*?)<\/JS>/gi;
            let m;
            while ((m = re.exec(note)) !== null) {
                results.push({ tag: 'JS', code: m[1] });
            }
            return results;
        }
    },

    // -------------------------------------------------------------------------
    // GALV
    // Inline single-line format:  <js: expression>
    // Example: <js: $gameVariables.setValue(1, a.atk)>
    // -------------------------------------------------------------------------
    {
        plugin: 'Galv',
        args: ['a', 'b', 'item'],
        extract(note) {
            const results = [];
            const re = /<js:\s*([^>]+)>/gi;
            let m;
            while ((m = re.exec(note)) !== null) {
                // Wrap in return so bare expressions are valid Function bodies
                results.push({ tag: 'js: (inline)', code: `return (${m[1].trim()});` });
            }
            return results;
        }
    },

    // -------------------------------------------------------------------------
    // VISUSTELLA PARAM / FORMULA BLOCKS (special-case)
    // Some VisuMZ plugins use a tighter <JS Formulas> ... </JS Formulas> wrapper
    // for parameter overrides — covered by the main VisuStella pattern above,
    // but listed here explicitly for documentation clarity.
    // (No separate entry needed — handled by entry 0 above.)
    // -------------------------------------------------------------------------

];

// =============================================================================
// CODE BALANCE ANALYSER
// =============================================================================
// Called after a SyntaxError is caught in a JS notetag block. Independently
// walks the code to count unbalanced parentheses and braces, then attempts to
// generate a corrected version of the code. This is separate from new Function()
// because JS engines stop at the *first* syntax error they encounter — so a block
// with both a missing ')' AND a missing ';' only surfaces the paren error via the
// engine. This analyser catches everything in one pass.
// =============================================================================
function analyzeCodeBalance(code) {
    const findings = [];
    let parenCount = 0, braceCount = 0;
    let inLineComment = false, inBlockComment = false;
    let inString = false, strChar = '';

    for (let i = 0; i < code.length; i++) {
        const ch   = code[i];
        const next = code[i + 1] || '';

        if (inBlockComment) {
            if (ch === '*' && next === '/') { inBlockComment = false; i++; }
            continue;
        }
        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            continue;
        }
        if (inString) {
            if (ch === strChar && code[i - 1] !== '\\') inString = false;
            continue;
        }

        if (ch === '/' && next === '/') { inLineComment = true;  i++; continue; }
        if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { inString = true; strChar = ch; continue; }

        if      (ch === '(') parenCount++;
        else if (ch === ')') parenCount--;
        else if (ch === '{') braceCount++;
        else if (ch === '}') braceCount--;
    }

    let fixedCode  = code.trimEnd();
    let canAutoFix = true;

    if (parenCount > 0) {
        const plural = parenCount === 1 ? 'is' : 'es';
        findings.push(`Missing ${parenCount} closing parenthes${plural}: <code>${')'.repeat(parenCount)}</code>`);
        // Append the missing parens + semicolon to the last substantive line
        const lines = fixedCode.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const t = lines[i].trim();
            if (t && !t.startsWith('//') && t !== '{' && t !== '}') {
                lines[i] = lines[i].trimEnd().replace(/;$/, '') + ')'.repeat(parenCount) + ';';
                break;
            }
        }
        fixedCode = lines.join('\n');
    } else if (parenCount < 0) {
        findings.push(`${-parenCount} extra closing parenthes${-parenCount === 1 ? 'is' : 'es'} with no matching open — remove the extra <code>)</code>.`);
        canAutoFix = false;
    }

    if (braceCount > 0) {
        findings.push(`Missing ${braceCount} closing brace${braceCount === 1 ? '' : 's'}: <code>${'}'.repeat(braceCount)}</code>`);
        fixedCode += '\n' + '}'.repeat(braceCount);
    } else if (braceCount < 0) {
        findings.push(`${-braceCount} extra closing brace${-braceCount === 1 ? '' : 's'} with no matching open.`);
        canAutoFix = false;
    }

    return {
        findings,
        suggestedFix: (canAutoFix && findings.length > 0) ? fixedCode : null
    };
}

// =============================================================================
// BLOCK NOTETAG DSL CONTENT VALIDATOR
// =============================================================================
// Scans the plain-text content of block notetags line by line. Catches:
//
//  1. MISSING VALUE  — a line ends with a keyword that always requires a
//     following numeric ID (e.g. "Target Not State" with no number).
//     Applied universally to all non-JS block notetag content.
//
//  2. POSSIBLE TYPO  — a word closely resembles a known RPG Maker / VisuStella
//     DSL keyword (Levenshtein distance 1) but isn't an exact match.
//     Applied only to known condition-block tag names to avoid false positives
//     in action-sequence or custom-format blocks with their own DSL vocabularies.
//
// Adding a new condition block:  add its tag name (lower-case) to CONDITION_BLOCK_TAGS.
// Adding a new value-requiring keyword: add it to REQUIRES_VALUE_WORDS.
// =============================================================================

// Keywords that MUST be followed by a numeric ID on the same line.
// If a line ends with one of these words and nothing follows, a value is missing.
const REQUIRES_VALUE_WORDS = new Set([
    'state', 'element', 'switch', 'skill', 'weapon', 'armor',
    'class', 'actor', 'enemy', 'buff', 'debuff', 'variable',
    'type', 'troop', 'animation', 'region', 'terrain', 'map', 'event'
]);

// Block tag names (lower-case) whose content is a known condition DSL.
// Only these get the typo check — avoids false positives in action-sequence
// blocks or other plugin-specific DSLs with their own keyword vocabularies.
const CONDITION_BLOCK_TAGS = new Set([
    'all ai conditions',
    'any ai conditions',
    'all conditions',
    'any conditions',
    'trait conditions',
    'skill conditions',
    'party ai conditions'
]);

// Full vocabulary of known valid words in condition DSL contexts.
// Used as the reference dictionary for the Levenshtein typo check.
const KNOWN_CONDITION_KEYWORDS = new Set([
    // Value-requiring keywords
    'state', 'element', 'switch', 'skill', 'weapon', 'armor', 'class',
    'actor', 'enemy', 'buff', 'debuff', 'variable', 'type', 'troop',
    'animation', 'region', 'terrain',
    // Complete / standalone conditions
    'always', 'never', 'alive', 'dead', 'chance', 'physical', 'magical',
    'certain', 'hit', 'evasion', 'critical', 'guard', 'substitution',
    'regenerate', 'true', 'false',
    // Stats
    'hp', 'mp', 'tp', 'atk', 'def', 'mat', 'mdf', 'agi', 'luk', 'level',
    // Qualifiers and structure words
    'target', 'user', 'not', 'count', 'turn', 'rate', 'param', 'xparam', 'sparam'
]);

// Returns the Levenshtein edit distance between two strings.
// Short-circuits at 99 if length difference alone exceeds the threshold.
function editDistance(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 99;
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

// Returns the closest known keyword if within distance 1, otherwise null.
// Distance threshold is intentionally tight (1) to avoid false positives on
// plugin-specific terms that happen to resemble known keywords.
function closestKnownKeyword(word) {
    let best = null, bestDist = 99;
    for (const kw of KNOWN_CONDITION_KEYWORDS) {
        const d = editDistance(word, kw);
        if (d < bestDist) { bestDist = d; best = kw; }
    }
    return bestDist === 1 ? best : null;
}

// Validates the plain-text content of a single block notetag.
// tagNameLower must already be lower-cased.
// Returns an array of { type, lineNum, text, message } issue objects.
function validateBlockLines(tagNameLower, content) {
    const issues = [];
    const isConditionBlock = CONDITION_BLOCK_TAGS.has(tagNameLower);

    content.split('\n').forEach((line, idx) => {
        const trimmed = line.trim();
        // Skip blank lines and comment lines
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        // Tokenize: lower-case, split on whitespace, strip surrounding punctuation
        const tokens = trimmed.toLowerCase()
            .split(/\s+/)
            .map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9%]+$/g, ''))
            .filter(Boolean);

        if (tokens.length === 0) return;

        const lastToken = tokens[tokens.length - 1];

        // --- CHECK 1: Missing value ---
        // If the last token is a value-requiring keyword (not a number),
        // the required ID was never provided.
        if (REQUIRES_VALUE_WORDS.has(lastToken)) {
            issues.push({
                type: 'missing_value',
                lineNum: idx + 1,
                text: trimmed,
                message: `Line ends with <code>${lastToken}</code> but no value follows.
                          A numeric ID is required (e.g. <code>${trimmed} 21</code>).`
            });
            return; // Don't also run typo check on the same line
        }

        // --- CHECK 2: Possible typo (condition blocks only) ---
        // Compare every meaningful word against the known keyword dictionary.
        // Only flag words of 4+ characters — shorter words have too many
        // near-misses to report reliably.
        if (!isConditionBlock) return;

        const meaningfulTokens = tokens.filter(t => /^[a-z]{4,}$/.test(t));
        for (const token of meaningfulTokens) {
            if (KNOWN_CONDITION_KEYWORDS.has(token)) continue; // exact match
            const closest = closestKnownKeyword(token);
            if (closest) {
                issues.push({
                    type: 'possible_typo',
                    lineNum: idx + 1,
                    text: trimmed,
                    message: `<code>${token}</code> is not a recognized condition keyword —
                              did you mean <code>${closest}</code>?
                              (full line: <em>${trimmed}</em>)`
                });
                break; // One typo report per line is enough
            }
        }
    });

    return issues;
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('file-drop-target');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const viewPanel = document.getElementById('active-view-panel');

    // --- SANDBOX DEMO INJECTOR ---
    const btnLoadDemo = document.getElementById('btn-load-demo'); // Ensure your index.html button uses this ID!
    
    if (btnLoadDemo) {
        btnLoadDemo.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            viewPanel.innerHTML = `
                <div class="loading-indicator">
                    <div class="loading-spinner"></div>
                    <span>Injecting Sandbox Architecture...</span>
                </div>`;

            // 1. Simulate a broken plugins.js load order (Added Pathfinding test)
            loadedPluginsCache = [
                { name: "MK_RNGMaps_Core", status: true, description: "Map generator core." },
                { name: "VisuMZ_0_CoreEngine", status: true, description: "<VisuStella MZ>\nCore Engine." },
                { name: "VisuMZ_1_BattleCore", status: true, description: "<VisuStella MZ>\nBattle Core. [Tier 1]" },
                { name: "Rogue_Combat_Overwrite", status: true, description: "A poorly written combat plugin." },
                { name: "Improved_Pathfinding", status: true, description: "Contains MV/MZ platform conditional methods." }
            ];

            // Helper to simulate file text extraction
            const mockTextFile = (content) => ({ text: async () => content });

            // 2. Simulate the JS source files (Added self-conflict double method)
            scriptFileStorage = {
                "MK_RNGMaps_Core.js": mockTextFile("var MK = MK || {};\nScene_Map.prototype.start = function() { /* alias */ .call(this); };"),
                "VisuMZ_0_CoreEngine.js": mockTextFile("var VisuMZ = VisuMZ || {};\nScene_Map.prototype.start = function() { /* base */ };"),
                "VisuMZ_1_BattleCore.js": mockTextFile("var VisuMZ = VisuMZ || {};\n@base VisuMZ_0_CoreEngine\nScene_Battle.prototype.start = function() { /* alias */ .call(this); };"),
                "Rogue_Combat_Overwrite.js": mockTextFile("Scene_Battle.prototype.start = function() { /* CRITICAL OVERWRITE - NO ALIAS */ };"),
                "Improved_Pathfinding.js": mockTextFile("if (Utils.isMz()) {\n Game_Character.prototype.findDirectionTo = function() { .call(this); };\n} else {\n Game_Character.prototype.findDirectionTo = function() { .call(this); };\n}")
            };

            // 3. Simulate Database JSON (Added complex S/X params and inequality brackets)
            databaseFiles = {
                "Skills.json": JSON.stringify([
                    null,
                    { 
                        id: 1, 
                        name: "Broken Strike (Real Error)", 
                        note: "<JS Post-Damage>\n if (a.atk > 10) {\n   b.gainHp(-50);\n // Missing closing brace!\n</JS Post-Damage>", 
                        damage: { formula: "a.atk * 4 - b.def" } 
                    },
                    { 
                        id: 2, 
                        name: "Native Function & Global Eval (Should be safe)", 
                        note: "", 
                        damage: { formula: "$gameSwitches.setValue(260,true); 10 * a.agi / b.agi * b.paramBuffRate(3)" } 
                    },
                    { 
                        id: 3, 
                        name: "Math Inequality Bracket Check (Should be safe)", 
                        note: "<Custom Note: value < 5>\n<Range: a.hp > 50>", 
                        damage: { formula: "Math.floor(25 * b.pha ** 3)" } 
                    }
                ])
            };

            // 4. Execute the engines
            await runDeepProjectScan();
            runDatabaseAudit();

            // 5. Render the UI
            currentTab = 'resolution';
            switchTabUI('resolution');
            updateButtonStates();
            renderActiveView();

            // 6. Lock the export button so they don't accidentally download fake data
            btnExport.disabled = true;
            btnExport.innerText = "Export Blocked (Demo Mode)";
            btnExport.style.opacity = "0.4";
        });
    }

    let currentTab = 'resolution';
    let loadedPluginsCache = [];
    let scriptFileStorage = {};
    let conflictMatrixCache = {};
    let pluginDependenciesMap = {};
    let architecturalViolations = [];

    let databaseFiles = {};
    let databaseAlerts = [];

    // Button refs — cached once so updateButtonStates() doesn't query the DOM repeatedly
    const btnReset    = document.getElementById('btn-reset');
    const btnOptimize = document.getElementById('btn-optimize');
    const btnExport   = document.getElementById('btn-export');

    // Enable / disable action buttons based on whether any data is loaded.
    // Called after every drop, scan, and reset so the UI always reflects state.
    function updateButtonStates() {
        const hasPlugins  = loadedPluginsCache.length > 0;
        const hasDatabase = Object.keys(databaseFiles).length > 0;
        const hasAnyData  = hasPlugins || hasDatabase;

        btnReset.disabled    = !hasAnyData;
        btnOptimize.disabled = !hasPlugins;   // only meaningful with a plugin list
        btnExport.disabled   = !hasPlugins;   // only meaningful with a plugin list
    }

    // Safe view execution delay to guarantee DOM rendering settles on first load
    setTimeout(() => { renderActiveView(); }, 50);

    // --- 1. TAB VIEWPORT MANAGER ---
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.getAttribute('data-tab');
            renderActiveView();
        });
    });

    function renderActiveView() {
        if (loadedPluginsCache.length === 0 && Object.keys(databaseFiles).length === 0) {
            viewPanel.innerHTML = `
                <div class="welcome-message">
                    <h3>System Diagnostics Ready</h3>
                    <p>Drag and drop your project files into the dashed <strong>sidebar drop zone</strong> on the left to begin.</p>
                    <p style="font-size: 0.85rem; color: #71717a; margin-top: 10px;">Supported files: <code>plugins.js</code>, plugin script files (<code>.js</code>), and database files (<code>.json</code>).</p>
                </div>`;
            return;
        }
        switch (currentTab) {
            case 'resolution':  renderResolutionCenter(); break;
            case 'conflict-map': renderConflictMap();     break;
            case 'database':    renderDatabaseAudit();    break;
        }
    }

    // --- 2. DRAG & DROP FILE HIGHLIGHT HANDLERS ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // Show loading state immediately so the user knows work is happening
        viewPanel.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-spinner"></div>
                <span>Scanning project files...</span>
            </div>`;

        let hasDatabaseFiles = false;
        let hasPluginFiles = false;

        await Promise.all(files.map(async file => {
            if (file.name.endsWith('.js') && file.name !== 'plugins.js') {
                scriptFileStorage[file.name] = file;
            } else if (file.name === 'plugins.js') {
                hasPluginFiles = true;
                const text = await file.text();
                try {
                    // Find the start of the array by locating the '[' that follows '$plugins ='
                    // rather than using indexOf('[') which would break if comments above contain '['.
                    // We then use lastIndexOf(']') for the end — this is safe because the regex
                    // anchors us past any '[' in comments, and the last ']' in the file is always
                    // the closing bracket of the $plugins array.
                    //
                    // NOTE: Do NOT use a lazy quantifier ([\s\S]*?) here. Plugin descriptions
                    // commonly contain text like "[Tier 1]", so a lazy match stops at the very
                    // first ']' it finds — producing truncated JSON that silently fails to parse.
                    const headerMatch = text.match(/var\s+\$plugins\s*=\s*/);
                    if (headerMatch) {
                        const startIdx = text.indexOf('[', headerMatch.index + headerMatch[0].length);
                        const endIdx   = text.lastIndexOf(']');
                        if (startIdx !== -1 && endIdx > startIdx) {
                            loadedPluginsCache = JSON.parse(text.substring(startIdx, endIdx + 1));
                        }
                    } else {
                        // Fallback for non-standard formats: still safer than plain indexOf('[')
                        // because we only reach here if the header pattern wasn't found at all.
                        const startIdx = text.indexOf('[');
                        const endIdx   = text.lastIndexOf(']');
                        if (startIdx !== -1 && endIdx > startIdx) {
                            loadedPluginsCache = JSON.parse(text.substring(startIdx, endIdx + 1));
                        }
                    }
                } catch (err) {
                    console.error("plugins.js parse error:", err);
                    viewPanel.innerHTML = `<p style="color:#f87171; padding:20px;">⚠️ Failed to parse <code>plugins.js</code>. Ensure the file is a valid RPG Maker MZ plugin list.</p>`;
                    return;
                }
            } else if (file.name.endsWith('.json')) {
                hasDatabaseFiles = true;
                databaseFiles[file.name] = await file.text();
            }
        }));

        if (hasPluginFiles || loadedPluginsCache.length > 0) {
            await runDeepProjectScan();
            if (!hasDatabaseFiles) {
                currentTab = 'resolution';
                switchTabUI('resolution');
            }
        }

        if (hasDatabaseFiles) {
            runDatabaseAudit();
            currentTab = 'database';
            switchTabUI('database');
        }

        updateButtonStates();
        renderActiveView();
    });

    function switchTabUI(tabId) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // --- 3. ECOSYSTEM DETECTION & TIER EXTRACTOR ---

    // Identifies which plugin family a plugin belongs to.
    // Tiers are only meaningful WITHIN the same ecosystem — a MK Tier 1 plugin
    // has no ordering relationship with a VisuStella Tier 1 plugin unless an
    // explicit @base / @orderAfter dependency is declared between them.
    // Dynamic namespace registry — populated by namespace detection during source scans.
    // Maps plugin name → detected namespace string (e.g. 'CGMZ', 'TOD', 'VisuMZ').
    // Allows getPluginEcosystem to return accurate families for plugins whose source
    // files have been dropped, even if their prefix isn't in the hardcoded list below.
    const detectedNamespaceRegistry = {};

    function getPluginEcosystem(pluginName) {
        // 1. Check source-scan detected namespace first — most accurate
        if (detectedNamespaceRegistry[pluginName]) {
            const ns = detectedNamespaceRegistry[pluginName];
            if (ns === 'VisuMZ') return 'VisuStella';
            if (ns === 'MK')     return 'MK_RNGMaps';
            return ns; // Use the raw namespace as the ecosystem name
        }

        // 2. Fall back to name-prefix heuristics
        // Public_* are VisuStella-distributed runtime libraries (e.g. Dragonbones
        // engine). They are VisuStella prerequisites, not third-party plugins.
        if (pluginName.startsWith('VisuMZ_') ||
            pluginName.startsWith('Public_') ||
            pluginName.startsWith('Yanfly')) return 'VisuStella';
        if (pluginName.startsWith('MK_'))   return 'MK_RNGMaps';
        if (pluginName.startsWith('YEP_'))  return 'Yanfly_MV';
        if (pluginName.startsWith('CGMZ_')) return 'CGMZ';
        if (pluginName.startsWith('HIME_')) return 'Hime';
        if (pluginName.startsWith('SRD_'))  return 'SRD';
        // Add more known prefixes here as needed
        return 'standalone';
    }

    // ==========================================================================
    // ECOSYSTEM ANCHOR RULES
    // ==========================================================================
    // Maps each third-party ecosystem to the single root/anchor plugin that all
    // other plugins in that ecosystem depend on (directly or transitively).
    //
    // If VisuMZ_0_CoreEngine is present in the load list, these anchor plugins
    // are forced to depend on it — which transitively pulls their ENTIRE chain
    // after CoreEngine without having to annotate every individual plugin.
    //
    // Why anchor-only and not every plugin in the ecosystem?
    //   Because once the anchor is constrained, every plugin that @base or
    //   @orderAfter the anchor inherits the constraint automatically through the
    //   topological sort. Annotating every plugin would be redundant and could
    //   cause circular dependency false-positives.
    //
    // To add a new ecosystem: find its root plugin name and add one line here.
    // ==========================================================================
    const ECOSYSTEM_VISUCORE_ANCHORS = {
        'MK_RNGMaps': 'MK_RNGMaps_Core', // Updated from MK_Core
        'CGMZ':       'CGMZ_Core',
        'Yanfly_MV':  'YEP_CoreEngine',
        // Add others as needed, e.g.:
        // 'SRD': 'SRD_Core',
    };

    function extractUniversalTierLevel(plugin) {
        // Public_* runtime libraries (e.g. Public_0_DragonBones) are VisuStella-
        // distributed JS engines that must load before everything else, including
        // VisuMZ_0_CoreEngine. Tier -2 places them below -1 (CoreEngine) so the
        // implicit tier rule automatically makes CoreEngine depend on them —
        // no explicit dependency or circular-dependency workaround needed.
        if (plugin.name.startsWith('Public_')) return -2;

        // Strict Foundational Anchor Protection: VisuMZ_0_CoreEngine must lock below all
        if (plugin.name === 'VisuMZ_0_CoreEngine') return -1;

        const descMatch = plugin.description
            ? plugin.description.match(/(?:\[Tier\s*|Tier\s*)(\d+)/i)
            : null;
        if (descMatch) return parseInt(descMatch[1]);

        const nameMatch = plugin.name.match(/_(\d+)_/);
        if (nameMatch) return parseInt(nameMatch[1]);

        return null;
    }

    // --- 4. SOURCE CODE DEEP CHECKER & RULE PARSER ---
    async function runDeepProjectScan() {
        const listStack = document.getElementById('sortable-plugin-stack');
        listStack.innerHTML = '';
        conflictMatrixCache = {};
        pluginDependenciesMap = {};
        architecturalViolations = [];
        const globalPrototypeRegistry = {};
        let activePluginsCount = 0;

        // Build a quick lookup of which plugins are actually in the list
        const pluginNameSet = new Set(loadedPluginsCache.map(p => p.name));

        loadedPluginsCache.forEach(plugin => {
            pluginDependenciesMap[plugin.name] = [];
            const currentTier   = extractUniversalTierLevel(plugin);
            const thisEcosystem = getPluginEcosystem(plugin.name);

            // Force all VisuMZ plugins to declare VisuMZ_0_CoreEngine as their base anchor
            if (plugin.name.startsWith('VisuMZ_') && plugin.name !== 'VisuMZ_0_CoreEngine') {
                pluginDependenciesMap[plugin.name].push('VisuMZ_0_CoreEngine');
            }

            // Note: Public_* runtime libraries (e.g. Public_0_DragonBones) are
            // handled by extractUniversalTierLevel returning tier -2, which makes
            // the implicit tier rule automatically place them before CoreEngine [T-1].
            // No explicit dependency needed here.

            // Standalone plugins that declare [Tier X] in their description are
            // following VisuStella's tier convention and expect the entire VisuStella
            // stack to be in place before they run.
            //
            // FIX: Previously we only added VisuMZ_0_CoreEngine as a dependency,
            // which placed standalone-tier plugins at the same sort depth as
            // VisuMZ_1_* plugins (both are 1 hop from CoreEngine). The sort then
            // interleaved them between VisuStella tiers.
            //
            // Correct fix: depend on ALL active VisuStella plugins — same rule as
            // the MK ecosystem anchor. This places them cleanly AFTER the entire
            // VisuStella block. The ecosystem anchor rule further ensures the MK
            // chain sorts after these, giving the final order:
            //   [all VisuStella] → [standalone tier plugins] → [MK chain]
            if (thisEcosystem === 'standalone' && currentTier !== null) {
                loadedPluginsCache.forEach(visuPlugin => {
                    if (
                        visuPlugin.status &&
                        getPluginEcosystem(visuPlugin.name) === 'VisuStella' &&
                        !pluginDependenciesMap[plugin.name].includes(visuPlugin.name)
                    ) {
                        pluginDependenciesMap[plugin.name].push(visuPlugin.name);
                    }
                });
            }

            // Ecosystem anchor rule — if this plugin is the declared root of its
            // ecosystem, add EVERY active VisuStella plugin as a dependency.
            //
            // Why every plugin and not just VisuMZ_0_CoreEngine?
            //
            // MK_RNGMaps_Core touches Game_Event.prototype and Scene_Map.prototype.
            // VisuStella plugins at Tier 1, 2, 3, and 4 also modify those same
            // methods. MK must alias the FULLY BUILT VisuStella chain — not just
            // CoreEngine's version. If MK_RNGMaps_Core only depended on CoreEngine, the
            // topological sort could legally place it before VisuMZ_1_EventsMoveCore
            // (which also rewrites Game_Event), causing MK's alias to overwrite
            // VisuStella's T1 modification instead of wrapping it.
            //
            // Adding all VisuStella plugins as dependencies guarantees the sort
            // produces a clean two-block order: [all VisuStella] → [all MK].
            //
            // These are implicit graph constraints for the sort only — they do NOT
            // generate "missing dependency" warnings since the plugin authors never
            // declared them explicitly.
            const anchorForThisEco = ECOSYSTEM_VISUCORE_ANCHORS[thisEcosystem];
            if (anchorForThisEco && plugin.name === anchorForThisEco) {
                loadedPluginsCache.forEach(otherPlugin => {
                    if (!otherPlugin.status) return;
                    if (pluginDependenciesMap[plugin.name].includes(otherPlugin.name)) return;

                    const otherEco  = getPluginEcosystem(otherPlugin.name);
                    const otherTier = extractUniversalTierLevel(otherPlugin);

                    // Depend on every VisuStella plugin (as before)
                    const isVisuStella = otherEco === 'VisuStella';

                    // Also depend on standalone plugins that declare [Tier X].
                    // These follow VisuStella's tier convention and alias core
                    // RPG Maker methods that must be fully built before MK runs.
                    const isStandaloneWithTier = otherEco === 'standalone' && otherTier !== null;

                    if (isVisuStella || isStandaloneWithTier) {
                        pluginDependenciesMap[plugin.name].push(otherPlugin.name);
                    }
                });
            }

            // Implicit tier-based dependencies — ONLY within the same ecosystem.
            // Without this guard, MK Tier 0 (MK_RNGMaps_Core) would be incorrectly treated
            // as a dependency of VisuStella Tier 1 plugins and vice-versa.
            if (currentTier !== null && plugin.status) {
                loadedPluginsCache.forEach(otherPlugin => {
                    if (otherPlugin.name !== plugin.name && otherPlugin.status) {
                        const otherEcosystem = getPluginEcosystem(otherPlugin.name);
                        if (otherEcosystem !== thisEcosystem) return; // different ecosystem — skip
                        const otherTier = extractUniversalTierLevel(otherPlugin);
                        if (otherTier !== null && otherTier < currentTier) {
                            if (!pluginDependenciesMap[plugin.name].includes(otherPlugin.name)) {
                                pluginDependenciesMap[plugin.name].push(otherPlugin.name);
                            }
                        }
                    }
                });
            }
        });

        for (let i = 0; i < loadedPluginsCache.length; i++) {
            const plugin = loadedPluginsCache[i];
            if (plugin.status) activePluginsCount++;
            const currentTier = extractUniversalTierLevel(plugin);

            if (currentTier !== null && plugin.status) {
                const pluginEco = getPluginEcosystem(plugin.name);
                for (let j = i + 1; j < loadedPluginsCache.length; j++) {
                    const trackingPlugin = loadedPluginsCache[j];
                    if (trackingPlugin.status) {
                        // Only flag tier violations within the same ecosystem.
                        // MK uses its own Tier 0-6 numbering independently of
                        // VisuStella's Tier 0-4 system — cross-ecosystem tier
                        // comparisons produce meaningless false violations.
                        if (getPluginEcosystem(trackingPlugin.name) !== pluginEco) continue;
                        const trackingTier = extractUniversalTierLevel(trackingPlugin);
                        if (trackingTier !== null && trackingTier < currentTier) {
                            architecturalViolations.push({
                                badPlugin: plugin.name,
                                badTier: currentTier,
                                baselinePlugin: trackingPlugin.name,
                                baselineTier: trackingTier
                            });
                        }
                    }
                }
            }

            const fileName = `${plugin.name}.js`;
            let scanResult = { status: 'PENDING_SCRIPT', hooks: [] };

            if (plugin.status && scriptFileStorage[fileName]) {
                const codeText = await scriptFileStorage[fileName].text();

                // ---------------------------------------------------------------
                // NAMESPACE DETECTION
                // ---------------------------------------------------------------
                // Scan for the plugin's namespace declaration — the line every
                // well-authored RPG Maker plugin uses to claim its "family":
                //
                //   var VisuMZ = VisuMZ || {};   → VisuStella family
                //   var MK     = MK     || {};   → MK RNGMaps family
                //   var CGMZ   = CGMZ   || {};   → CGMZ family
                //
                // This is more reliable than name-prefix guessing because it comes
                // directly from the plugin author's own code.
                //
                // When a namespace is detected that isn't already known to
                // getPluginEcosystem(), we register it so the ecosystem-aware tier
                // comparison and violation detection automatically cover it too.
                // ---------------------------------------------------------------
                const nsRegex = /var\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s* \s*\|\|\s*\{\s*\}/g;
                let nsMatch;
                while ((nsMatch = nsRegex.exec(codeText)) !== null) {
                    const ns = nsMatch[1];
                    // Skip trivial single-letter vars and known JS globals
                    if (ns.length < 2) continue;
                    const knownGlobals = new Set(['Imported','PluginManager','DataManager',
                        'SceneManager','SoundManager','StorageManager','ImageManager',
                        'Utils','Graphics','Input','TouchInput','AudioManager','window',
                        'JsonEx','TextManager','ColorManager','ConfigManager','BattleManager']);
                    if (knownGlobals.has(ns)) continue;

                    // Register the detected namespace on the plugin for later use
                    // and store it in the shared registry so getPluginEcosystem()
                    // can use it for ALL subsequent calls involving this plugin.
                    if (!plugin._detectedNamespace) plugin._detectedNamespace = ns;
                    detectedNamespaceRegistry[plugin.name] = ns;

                    // If this namespace isn't in our known ecosystem map, add it
                    // as a new ecosystem keyed by the namespace name itself.
                    // This makes tier comparisons work correctly for any family
                    // we haven't hardcoded, as long as source files are dropped.
                    if (!['VisuStella','MK_RNGMaps','Yanfly_MV','CGMZ','Hime','SRD','standalone']
                            .includes(ns) && ns !== 'VisuMZ' && ns !== 'MK') {
                        // Dynamically extend getPluginEcosystem via the plugin's own tag
                        plugin._dynamicEcosystem = ns;
                    }
                }

                // Parse both @base and @orderAfter tags from plugin headers.
                //
                // @base      — plugin REQUIRES this dependency to function at all
                // @orderAfter — plugin must load AFTER this plugin (softer constraint,
                //               no hard dependency but ordering matters)
                //
                // Both are treated as ordering dependencies in the graph. The distinction
                // is preserved in the label so the user sees which type triggered a warning.
                const depTagRegex = /@(base|orderAfter)\s+([A-Za-z0-9_]+)/g;
                let depTagMatch;
                while ((depTagMatch = depTagRegex.exec(codeText)) !== null) {
                    const depType = depTagMatch[1];   // 'base' or 'orderAfter'
                    const depName = depTagMatch[2];

                    if (!pluginDependenciesMap[plugin.name].includes(depName)) {
                        pluginDependenciesMap[plugin.name].push(depName);
                    }

                    // Missing dependency detection — warn if the declared dependency
                    // isn't present in the loaded plugin list at all.
                    if (!pluginNameSet.has(depName)) {
                        architecturalViolations.push({
                            type: 'missing_dependency',
                            badPlugin:    plugin.name,
                            missingDep:   depName,
                            depType:      depType,
                            badTier:      null,
                            baselineTier: null
                        });
                    }
                }

                const overwriteRegex = /(\w+)\.prototype\.(\w+)\s*=\s*function/g;
                scanResult.status = 'SAFE';

                let match;
                while ((match = overwriteRegex.exec(codeText)) !== null) {
                    const targetClass  = match[1];
                    const targetMethod = match[2];
                    const methodKey    = `${targetClass}.prototype.${targetMethod}`;

                    // FIX: Previously, aliasCallRegex was defined ONCE outside the loop with the /g flag.
                    // Calling .test() with a /g regex advances its internal lastIndex, so on the 2nd+
                    // iteration of this while-loop it would search from the wrong position in codeSnippet,
                    // causing alias calls to be missed and safe plugins to be falsely flagged as conflicts.
                    // Fix: create a fresh regex literal on each iteration so lastIndex always starts at 0.
                    const codeSnippet = codeText.substring(match.index, match.index + 400);
                    const hasAliasCall = /\.call\(\s*this|\.apply\(\s*this/.test(codeSnippet);
                    const safetyType = hasAliasCall ? 'SAFE_ALIAS' : 'CRITICAL_OVERWRITE';

                    scanResult.hooks.push({ methodKey, safetyType });
                    if (!globalPrototypeRegistry[methodKey]) globalPrototypeRegistry[methodKey] = [];
                    globalPrototypeRegistry[methodKey].push({ pluginName: plugin.name, safetyType });
                }
            }

            // Register Nexus_Patch_ plugins as dependents of their target plugin
            if (plugin.name.includes('Nexus_Patch_')) {
                let targetBullyPlugin = plugin.name.split('Nexus_Patch_')[1];
                if (targetBullyPlugin) {
                    targetBullyPlugin = targetBullyPlugin.replace(/\s\(\d+\)$/, '');
                    if (!pluginDependenciesMap[plugin.name].includes(targetBullyPlugin)) {
                        pluginDependenciesMap[plugin.name].push(targetBullyPlugin);
                    }
                    Object.keys(pluginDependenciesMap).forEach(key => {
                        if (key !== plugin.name && pluginDependenciesMap[key].includes(targetBullyPlugin)) {
                            const idx = pluginDependenciesMap[key].indexOf(targetBullyPlugin);
                            pluginDependenciesMap[key][idx] = plugin.name;
                        }
                    });
                }
            }

            // --- Ecosystem anchor position check ---
            // If this plugin is an ecosystem anchor AND VisuMZ_0_CoreEngine exists
            // in the list but appears AFTER this plugin, flag it as a critical error.
            // This catches the case where MK_RNGMaps_Core is above VisuMZ_0_CoreEngine even
            // when no source files have been dropped (so @base scanning hasn't run).
            const thisAnchor = ECOSYSTEM_VISUCORE_ANCHORS[getPluginEcosystem(plugin.name)];
            if (thisAnchor && plugin.name === thisAnchor && pluginNameSet.has('VisuMZ_0_CoreEngine')) {
                const coreIdx    = loadedPluginsCache.findIndex(p => p.name === 'VisuMZ_0_CoreEngine');
                const anchorIdx  = i;
                if (coreIdx > anchorIdx) {
                    // Detect which core classes the anchor touches by scanning its source if available
                    const touchedClasses = [];
                    const srcFile = scriptFileStorage[`${plugin.name}.js`];
                    if (srcFile) {
                        const quickScan = await srcFile.text();
                        ['Game_Event', 'Game_Map', 'Game_Player', 'Scene_Map', 'Scene_Boot',
                         'Game_Interpreter', 'DataManager', 'SceneManager'].forEach(cls => {
                            if (quickScan.includes(`${cls}.prototype`)) touchedClasses.push(cls);
                        });
                    }
                    architecturalViolations.push({
                        type:           'framework_anchor_order',
                        badPlugin:      plugin.name,
                        frameworkName:  getPluginEcosystem(plugin.name),
                        touchedClasses: touchedClasses.length > 0
                            ? touchedClasses
                            : ['core prototype methods'],
                        badTier:      null,
                        baselineTier: null
                    });
                }
            }

            // Build sidebar list item
            const li = document.createElement('li');
            li.className = 'plugin-item';
            // Show ecosystem prefix in tier badge so MK T1 and VisuStella T1
            // are visually distinct in the sidebar (e.g. "[MK T1]" vs "[T1]")
            const eco = getPluginEcosystem(plugin.name);
            const ecoPrefix = eco !== 'VisuStella' && eco !== 'standalone' ? `${eco.split('_')[0]} ` : '';
            // Use the parser's computed tier (e.g. -2 for Public_*) rather than the
            // raw description tier so the badge accurately reflects sort priority
            const tierDisplayLevel = currentTier !== null ? ` [${ecoPrefix}T${currentTier}]` : '';
            let badgeHTML = '<span style="color:#71717a; font-size:0.8rem; margin-left:auto;">⚪ Need Script</span>';

            if (!plugin.status) {
                li.style.borderLeftColor = '#52525b';
                badgeHTML = '<span style="color:#71717a; font-size:0.8rem; margin-left:auto;">⚪ Off</span>';
            } else if (scanResult.status === 'SAFE' || plugin.name.includes('Nexus_Patch_')) {
                li.style.borderLeftColor = '#34d399';
                badgeHTML = `<span style="color:#34d399; font-size:0.8rem; margin-left:auto;">🟢 Parsed${tierDisplayLevel}</span>`;
            } else {
                li.style.borderLeftColor = '#f59e0b';
            }

            li.innerHTML = `
                <span class="drag-handle">☰</span>
                <span class="plugin-name" style="${!plugin.status ? 'color:#71717a;' : ''}">${plugin.name}</span>
                ${badgeHTML}
            `;
            listStack.appendChild(li);
        }

        document.getElementById('total-count').innerText = activePluginsCount;

        // Detect critical overwrites: if the last modifier of a method doesn't alias, it's a conflict
        for (const [method, modifiers] of Object.entries(globalPrototypeRegistry)) {
            // Get unique plugins that modified this method (ignores MV/MZ if-else re-declarations)
            const uniquePlugins = [...new Set(modifiers.map(m => m.pluginName))];
            
            if (uniquePlugins.length > 1) {
                const finalActiveHandler = modifiers[modifiers.length - 1];
                if (finalActiveHandler.safetyType === 'CRITICAL_OVERWRITE') {
                    const disabledPlugins = uniquePlugins.filter(name => name !== finalActiveHandler.pluginName);
                    
                    if (disabledPlugins.length > 0) {
                        conflictMatrixCache[finalActiveHandler.pluginName] = {
                            method: method,
                            impact: `Completely overwrites native structure. Deactivates core modifications made by: [${disabledPlugins.join(', ')}].`
                        };
                    }
                }
            }
        }
        // If an active Nexus_Patch_ covers a conflict, remove it from the conflict list
        const activePatches = loadedPluginsCache.filter(p => p.status && p.name.includes('Nexus_Patch_'));
        activePatches.forEach(patch => {
            let targetName = patch.name.split('Nexus_Patch_')[1];
            if (targetName) {
                targetName = targetName.replace(/\s\(\d+\)$/, '');
                if (conflictMatrixCache[targetName]) delete conflictMatrixCache[targetName];
            }
        });

        const activeConflictsCount = Object.keys(conflictMatrixCache).length;
        document.getElementById('conflict-count').innerText = activeConflictsCount + architecturalViolations.length;
    }

    // --- 5. DATABASE AUDIT ENGINE ---
    function runDatabaseAudit() {
        databaseAlerts = [];
        for (const [fileName, jsonText] of Object.entries(databaseFiles)) {
            try {
                const dataArray = JSON.parse(jsonText);
                if (!Array.isArray(dataArray)) continue;

                dataArray.forEach((entry, index) => {
                    if (!entry) return;
                    const name = entry.name || `Unnamed Object (ID: ${entry.id || index})`;

                    // Check for unclosed notetag brackets and invalid JS notetag blocks
                    if (entry.note) {

                        // --- JS NOTETAG BLOCK SYNTAX VALIDATOR ---
                        // Iterate every registered pattern. Each pattern extracts its own
                        // set of JS blocks from the note and we attempt to compile each one.
                        // Adding support for a new plugin = one new entry in JS_NOTETAG_PATTERNS.
                        const alreadyReported = new Set(); // dedupe identical code blocks
                        JS_NOTETAG_PATTERNS.forEach(pattern => {
                            let blocks;
                            try {
                                blocks = pattern.extract(entry.note);
                            } catch (_) {
                                return; // malformed extractor — skip gracefully
                            }

                            blocks.forEach(({ tag, code }) => {
                                // Skip if we already flagged this exact code block via
                                // a different pattern (e.g. a block matched by two patterns)
                                if (alreadyReported.has(code)) return;

                                try {
                                    // Compile only — we never execute this.
                                    // Pass the pattern's declared args so the parser doesn't
                                    // choke on bare references like 'user', 'value', etc.
                                    new Function(...pattern.args, code);
                                } catch (err) {
                                    if (!(err instanceof SyntaxError)) return;

                                    alreadyReported.add(code);

                                    // JS engines report only the FIRST syntax error they hit.
                                    // Run our own balance analyser to surface ALL issues
                                    // (e.g. missing ')' AND missing ';' in one pass) and
                                    // attempt to generate a corrected version of the code.
                                    const balance = analyzeCodeBalance(code);

                                    const lineMatch = err.message.match(/line (\d+)/i) ||
                                                      (err.stack && err.stack.match(/:(\d+):/));
                                    const lineHint  = lineMatch
                                        ? ` (near line ${lineMatch[1]} of the block)`
                                        : '';

                                    const escaped = code
                                        .trim()
                                        .replace(/&/g, '&amp;')
                                        .replace(/</g, '&lt;')
                                        .replace(/>/g, '&gt;');

                                    // Build the full findings list: engine message first,
                                    // then any additional issues found by the balance analyser
                                    const engineFinding = `Parse failure${lineHint}: <em>${err.message}</em>`;
                                    const allFindings = [engineFinding, ...balance.findings];
                                    const findingsList = allFindings
                                        .map(f => `<li style="margin-bottom:5px;">${f}</li>`)
                                        .join('');

                                    // If we can auto-fix, show a side-by-side diff
                                    const fixBlock = balance.suggestedFix
                                        ? `<div style="margin-top:12px;">
                                               <p style="color:#34d399; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Suggested Fix</p>
                                               <code style="display:block; background:#0a1a0a; padding:8px 10px; border-radius:4px; color:#34d399; white-space:pre; overflow-x:auto;">${balance.suggestedFix.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code>
                                               <p style="color:#71717a; font-size:0.8rem; margin-top:6px;">⚠️ Always verify auto-suggested fixes before applying — complex logic may require manual review.</p>
                                           </div>`
                                        : '';

                                    databaseAlerts.push({
                                        file: fileName,
                                        item: name,
                                        id: entry.id || index,
                                        type: 'Syntax Error',
                                        issue: `Invalid JavaScript in &lt;${tag}&gt; notetag`,
                                        originalFormula: null,
                                        suggestedFormula: null,
                                        suggestions: [],
                                        details: `<strong>Plugin:</strong> ${pattern.plugin}<br>
                                                  This will cause a crash when the engine executes this notetag in-game.
                                                  <ul style="margin:10px 0 10px 0; padding-left:18px; line-height:1.8;">${findingsList}</ul>
                                                  <code style="display:block; margin-top:8px; white-space:pre; overflow-x:auto;">${escaped}</code>
                                                  ${fixBlock}`
                                    });
                                }
                            });
                        });

                        // --- UNCLOSED BRACKET CHECK ---
                        let sanitizedNote = entry.note;

                        // 1. Strip mathematical multi-char operators
                        sanitizedNote = sanitizedNote.replace(/<=|>=|=>|->|<-|==|===|!=|!==/g, '');
                        
                        // 2. Strip < and > used as math inequalities (surrounded by spaces or word boundaries)
                        sanitizedNote = sanitizedNote.replace(/<\s/g, '');
                        sanitizedNote = sanitizedNote.replace(/\s>/g, '');
                        sanitizedNote = sanitizedNote.replace(/(?<=\w)[<>](?=\w)/g, ''); // Handles a<b or x>y

                        // 3. Strip block notetags (e.g. <Tag>...</Tag>)
                        sanitizedNote = sanitizedNote.replace(/<([^>]+)>[\s\S]*?<\/\1>/ig, '');

                        // 4. Strip single/inline tags (e.g. <Tag> or <Tag: Value>)
                        sanitizedNote = sanitizedNote.replace(/<[^>]+>/g, '');

                        const openBrackets  = (sanitizedNote.match(/</g) || []).length;
                        const closeBrackets = (sanitizedNote.match(/>/g) || []).length;

                        if (openBrackets !== closeBrackets) {
                            databaseAlerts.push({
                                file: fileName,
                                item: name,
                                id: entry.id || index,
                                type: 'Syntax Error',
                                issue: 'Unclosed Notetag Brackets',
                                originalFormula: null,
                                suggestedFormula: null,
                                suggestions: [],
                                details: `The note box has ${openBrackets} opening '&lt;' brackets and ${closeBrackets} closing '&gt;' brackets. This asymmetry will cause complex plugin parameters to fail.`
                            });
                        }

                        // --- STATIC LOGIC CHECKS (NOTETAGS) ---
                        // Look for explicit division by literal zero (e.g., / 0, /0) but ignore decimals like / 0.5
                        if (/\/\s*0(?!\.\d)/.test(entry.note)) {
                            databaseAlerts.push({
                                file: fileName,
                                item: name,
                                id: entry.id || index,
                                type: 'Logic Warning',
                                issue: 'Division by Zero in Notetag',
                                originalFormula: null,
                                suggestedFormula: null,
                                suggestions: [],
                                details: `A literal division by zero (<code>/ 0</code>) was detected in the note box. When executed by a plugin in-game, this evaluates to Infinity. If damage variance is applied, it will corrupt the calculation and result in NaN (0 damage).`
                            });
                        }

                        // --- EMPTY PARAMETER CHECK ---
                        // Catches notetags of the form <TagName: > where a required value
                        // was left blank — e.g. <Multi-Element: > instead of <Multi-Element: 2>.
                        const emptyParamRegex = /<([^>]+?):\s*>/g;
                        let emptyMatch;
                        while ((emptyMatch = emptyParamRegex.exec(entry.note)) !== null) {
                            const tagName = emptyMatch[1].trim();
                            databaseAlerts.push({
                                file: fileName,
                                item: name,
                                id: entry.id || index,
                                type: 'Incomplete Notetag',
                                issue: `Missing parameter value in &lt;${tagName}: &gt;`,
                                originalFormula: null,
                                suggestedFormula: null,
                                suggestions: [],
                                details: `The notetag <code>&lt;${tagName}: &gt;</code> has a colon indicating a required value, but the value is empty. The plugin will silently ignore this tag or produce unexpected behaviour. Add the missing value — e.g. <code>&lt;${tagName}: 2&gt;</code>.`
                            });
                        }

                        // --- BLOCK NOTETAG LINE CONTENT VALIDATION ---
                        // Scan the plain-text content of every block notetag for:
                        //   - Lines ending with a value-requiring keyword (missing ID)
                        //   - Possible typos in known condition-block DSL contexts
                        // JS blocks are skipped here — they are handled by JS_NOTETAG_PATTERNS.
                        // Display-text blocks are skipped — they contain text codes, not DSL.
                        const TEXT_SUFFIX_RE = /\b(text|display|name|description|icon|label|title|message|string|format|caption|header|footer|prefix|suffix|popup|notify|alert|tooltip)$/i;
                        const blockScanRegex = /<([^/][^>]*)>([\s\S]*?)<\/\1>/gi;
                        let bsMatch;
                        while ((bsMatch = blockScanRegex.exec(entry.note)) !== null) {
                            const bTagName    = bsMatch[1].trim();
                            const bTagLower   = bTagName.toLowerCase();
                            const bContent    = bsMatch[2];

                            // Skip JS blocks (already validated by JS_NOTETAG_PATTERNS)
                            if (bTagLower.startsWith('js ') || bTagLower === 'js') continue;
                            // Skip Custom JS blocks
                            if (bTagLower.startsWith('custom ') && !TEXT_SUFFIX_RE.test(bTagLower)) {
                                // Only skip if it's the kind that holds JS — the JS pattern
                                // already covers these; we don't want to double-report typos
                                // on what is actually code.
                            }
                            // Skip known display-text blocks
                            if (TEXT_SUFFIX_RE.test(bTagLower)) continue;

                            const lineIssues = validateBlockLines(bTagLower, bContent);
                            lineIssues.forEach(issue => {
                                databaseAlerts.push({
                                    file: fileName,
                                    item: name,
                                    id: entry.id || index,
                                    type: issue.type === 'missing_value'
                                        ? 'Incomplete Notetag'
                                        : 'Possible Typo',
                                    issue: issue.type === 'missing_value'
                                        ? `Missing value on line ${issue.lineNum} of &lt;${bTagName}&gt;`
                                        : `Possible typo on line ${issue.lineNum} of &lt;${bTagName}&gt;`,
                                    originalFormula: null,
                                    suggestedFormula: null,
                                    suggestions: [],
                                    details: issue.message
                                });
                            });
                        }
                    }

                    // Validate and sandbox-execute damage formulas
                    if (entry.damage && entry.damage.formula && entry.damage.formula.trim() !== '') {
                        const originalFormula = entry.damage.formula;

                        // --- STYLE SUGGESTION PASS ---
                        // Run before execution so valid-but-improvable formulas get a
                        // suggestion rather than a false error.
                        let suggestedFormula = originalFormula;
                        const suggestions = [];

                        // $gameVariables.value(x) is valid MZ syntax but 'v' is already
                        // passed into every damage formula as the shorthand accessor (v[x]).
                        const gameVarRegex = /\$gameVariables\.value\((\d+)\)/g;
                        if (gameVarRegex.test(originalFormula)) {
                            suggestedFormula = suggestedFormula.replace(
                                /\$gameVariables\.value\((\d+)\)/g,
                                (_, id) => `v[${id}]`
                            );
                            suggestions.push('Replace <code>$gameVariables.value(x)</code> with <code>v[x]</code> — the shorthand is already available in every damage formula context and is the standard convention.');
                        }

                        // Math.floor(expr)/divisor floors only the numerator before dividing.
                        // Suggest wrapping the full expression to make intent unambiguous.
                        //
                        // FIX: The regex [^)]+ stops at the FIRST ')' in the string, not the
                        // one that actually closes Math.floor. For an already-corrected formula
                        // like Math.floor((a.atk-10) / 2), it would match:
                        //   Math.floor( → captures (a.atk-10 → hits ) → sees / 2
                        // falsely re-flagging a formula the user already fixed.
                        // Guard: if the character immediately after the full regex match is ')',
                        // the division was inside Math.floor and is already correct — skip it.
                        const floorDivideRegex = /Math\.floor\(([^)]+)\)\s*\/\s*(\d+)/g;
                        let floorMatch;
                        while ((floorMatch = floorDivideRegex.exec(suggestedFormula)) !== null) {
                            const charAfterMatch = suggestedFormula[floorMatch.index + floorMatch[0].length];
                            if (charAfterMatch === ')') {
                                // Division is already inside Math.floor — pattern is correct, skip
                                continue;
                            }
                            const inner   = floorMatch[1];
                            const divisor = floorMatch[2];
                            const replacement = `Math.floor((${inner}) / ${divisor})`;
                            suggestedFormula = suggestedFormula.replace(floorMatch[0], replacement);
                            suggestions.push(`<code>Math.floor(${inner})/${divisor}</code> floors only the numerator. If you intend to floor the final result, use <code>Math.floor((${inner}) / ${divisor})</code>.`);
                        }

                        if (suggestions.length > 0) {
                            databaseAlerts.push({
                                file: fileName,
                                item: name,
                                id: entry.id || index,
                                type: 'Style Suggestion',
                                issue: 'Formula Can Be Simplified',
                                originalFormula,
                                suggestedFormula: suggestedFormula.trim(),
                                suggestions,
                                details: null
                            });
                        }

                        // --- EXECUTION VALIDATION PASS ---
                        try {
                            // Inject $gameSwitches into the sandbox arguments
                            const testFunc = new Function('a', 'b', 'v', 'sign', '$gameVariables', '$gameSwitches', `
                                let dmg = 0;
                                return ${originalFormula};
                            `);

                            const baseStats = {
                                hp: 100, mp: 50, tp: 10,
                                mhp: 100, mmp: 50,
                                atk: 20, def: 10, mat: 20, mdf: 10, agi: 15, luk: 15,
                                level: 5,
                                
                                // Expand X-Params and S-Params
                                hit: 0.95, eva: 0.05, cri: 0.04, cev: 0, mev: 0, mrf: 0, cnt: 0, hrg: 0, mrg: 0, trg: 0,
                                tgr: 1, grd: 1, rec: 1, pha: 1, mcr: 1, tcr: 1, pdr: 1, mdr: 1, fdr: 1, exr: 1,

                                param:   function() { return 20; },
                                xparam:  function() { return 0.1; },
                                sparam:  function() { return 1.0; },
                                paramBuffRate: function() { return 1.0; }, // Missing native MZ function
                                
                                hpRate:  function() { return 1; },
                                mpRate:  function() { return 1; },
                                tpRate:  function() { return 1; },
                                
                                isStateAffected:  function() { return false; },
                                isBuffAffected:   function() { return false; },
                                isDebuffAffected: function() { return false; },
                                isStateResist:    function() { return false; }, // Missing native MZ function
                                isDead:   function() { return false; },
                                isAlive:  function() { return true; },
                                isEnemy:  function() { return false; },
                                isActor:  function() { return true; },
                                
                                elementRate: function() { return 1; },
                                stateRate:   function() { return 1; },
                                addState:    function() {},
                                removeState: function() {},
                                skills:   function() { return []; },
                                hasSkill: function() { return false; },
                            };

                            const dummyV = new Proxy({}, {
                                get: (t, p) => t[p] !== undefined ? t[p] : 5,
                                set: (t, p, val) => { t[p] = val; return true; }
                            });

                            // Mock global database objects
                            const dummyGameVariables = { value: () => 5, setValue: () => {} };
                            const dummyGameSwitches  = { value: () => false, setValue: () => {} };

                            const result = testFunc(baseStats, baseStats, dummyV, 1, dummyGameVariables, dummyGameSwitches);

                            if (typeof result === 'number') {
                                if (isNaN(result)) {
                                    throw new Error('Execution evaluated to NaN (Not-a-Number).');
                                }
                                if (!isFinite(result)) {
                                    throw new Error('Execution evaluated to Infinity. This is usually caused by dividing by zero.');
                                }
                            }
                        } catch (err) {
                            databaseAlerts.push({
                                file: fileName,
                                item: name,
                                id: entry.id || index,
                                type: 'Logic Error',
                                issue: 'Broken Damage Formula',
                                originalFormula,
                                suggestedFormula: null,
                                suggestions: [],
                                details: `Engine test failure: "${err.message}". This usually means a misspelled stat reference (e.g. <code>a.atkk</code> instead of <code>a.atk</code>) or incomplete math operators.`
                            });
                        }
                    }
                });
            } catch (e) {
                databaseAlerts.push({
                    file: fileName,
                    item: 'N/A',
                    id: 'N/A',
                    type: 'Critical Error',
                    issue: 'Invalid JSON Structure',
                    details: 'This file could not be parsed. The data structure may be corrupted or the file is not valid JSON.'
                });
            }
        }
    }

    // --- 6. VIEWPORT RENDERERS ---

    function renderResolutionCenter() {
        const hasIssues = Object.keys(conflictMatrixCache).length > 0 || architecturalViolations.length > 0;

        if (loadedPluginsCache.length > 0 && !hasIssues) {
            viewPanel.innerHTML = `<p class="success-text">🟢 Structural Evaluation Complete: Load paths are correctly aligned and active patches have successfully bridged execution logic.</p>`;
            return;
        }

        let html = '<div class="resolution-center">';

        architecturalViolations.forEach((violation) => {

            // --- Missing dependency card ---
            if (violation.type === 'missing_dependency') {
                html += `
                    <div class="alert-card" style="border-left: 4px solid #a78bfa; background:#150d2a;">
                        <h4 style="color:#a78bfa;">🔍 Missing ${violation.depType === 'base' ? 'Required' : 'Declared'} Plugin: <code>${violation.missingDep}</code></h4>
                        <p><strong>${violation.badPlugin}</strong> declares <code>@${violation.depType} ${violation.missingDep}</code> in its header but that plugin is not present in the current load list.</p>
                        <div class="impact-text" style="border-left-color:#a78bfa;">
                            ${violation.depType === 'base'
                                ? `This is a <strong>hard dependency</strong> — <strong>${violation.badPlugin}</strong> will likely throw an error or alert at boot without it.`
                                : `This is a soft ordering constraint — <strong>${violation.badPlugin}</strong> should load after <strong>${violation.missingDep}</strong> but will not crash without it. Verify whether the missing plugin is needed.`
                            }
                        </div>
                    </div>`;
                return;
            }

            // --- Framework anchor out-of-order card ---
            if (violation.type === 'framework_anchor_order') {
                const isMK = violation.frameworkName === 'MK_RNGMaps';
                const alertClass = isMK ? 'alert-warning' : 'alert-critical';
                const alertColor = isMK ? '#f59e0b' : '#ef4444';
                const severityType = isMK ? 'Recommendation' : 'Critical Order Mismatch';

                html += `
                    <div class="alert-card ${alertClass}">
                        <h4 style="color: ${alertColor};">⚠️ ${severityType}: Core Plugin Loading Before VisuStella</h4>
                        <p><strong>${violation.badPlugin}</strong> is a foundational standalone plugin for the <strong>${violation.frameworkName}</strong> collection and is currently positioned <strong>above VisuMZ_0_CoreEngine</strong> in the load order.</p>
                        <div class="impact-text" style="border-left-color: ${alertColor};">
                            ${violation.badPlugin} modifies core RPG Maker prototype methods
                            (${violation.touchedClasses.join(', ')}). 
                            ${isMK 
                                ? 'As a best practice for maximum compatibility, it is highly recommended to load standalone plugins below the VisuStella library so they properly alias any previously established modifications.' 
                                : 'These modifications must alias <em>VisuStella\'s already-enhanced versions</em> of those methods. Loading before CoreEngine reverses that chain and will cause silent runtime failures or crashes.'}
                            <br><br>
                            <strong>Fix:</strong> Place <strong>${violation.badPlugin}</strong> 
                            after all VisuStella plugins. Auto-Optimize will handle this automatically.
                        </div>
                    </div>`;
                return;
            }

            // --- Tier violation card ---
            html += `
                <div class="alert-card alert-warning">
                    <h4 style="color: #f59e0b;">⚠️ Sequence Violation: Structural Tier Placement Mismatch</h4>
                    <p>The component <strong>${violation.badPlugin}</strong> (Tier ${violation.badTier}) is loading <strong>above</strong> foundational component <strong>${violation.baselinePlugin}</strong> (Tier ${violation.baselineTier}).</p>
                    <div class="impact-text" style="border-left-color: #f59e0b;">Impact: Reversing internal vendor architecture frameworks causes runtime memory access failures inside engine instances.</div>
                </div>`;
        });

        for (const [pluginName, details] of Object.entries(conflictMatrixCache)) {
            html += `
                <div class="alert-card alert-critical">
                    <h4 style="color: #ef4444;">⚠️ Critical Function Overwrite Verified: <code>${details.method}</code></h4>
                    <p>The code inside <strong>${pluginName}.js</strong> explicitly replaces this core routine without an internal backward-compatible alias loop.</p>
                    <div class="impact-text" style="border-left-color: #ef4444;">${details.impact}</div>
                </div>`;
        }

        html += '</div>';
        viewPanel.innerHTML = html;
    }

    // FIX: Conflict Map was previously a static placeholder with no real content.
    // Now renders an actual visual node map showing which plugins are in conflict
    // and which methods they are fighting over, grouped by method name.
    function renderConflictMap() {
        const hasConflicts = Object.keys(conflictMatrixCache).length > 0;
        const hasViolations = architecturalViolations.length > 0;

        if (loadedPluginsCache.length === 0) {
            viewPanel.innerHTML = `
                <div class="conflict-map-container">
                    <h4>System Component Vector Nodes</h4>
                    <p style="color:#a1a1aa; font-size:0.9rem;">No project loaded. Drop a <code>plugins.js</code> to generate the conflict map.</p>
                </div>`;
            return;
        }

        let html = `
            <div class="conflict-map-container">
                <h4>System Component Vector Nodes</h4>
                <div class="conflict-map-legend">
                    <span><span class="legend-dot" style="background:#3b82f6;"></span> Core / Anchor</span>
                    <span><span class="legend-dot" style="background:#ef4444;"></span> Conflict</span>
                    <span><span class="legend-dot" style="background:#34d399;"></span> Safe / Patched</span>
                    <span><span class="legend-dot" style="background:#f59e0b;"></span> Tier Violation</span>
                </div>
                <div class="conflict-map-canvas">`;

        if (!hasConflicts && !hasViolations) {
            html += `<p class="success-text">🟢 No conflicts detected. All component vectors are clean.</p>`;
        }

        // Render each conflict as a method -> [offending plugin] row
        if (hasConflicts) {
            html += `<p style="color:#a1a1aa; font-size:0.85rem; margin-bottom:12px;">Showing ${Object.keys(conflictMatrixCache).length} method conflict(s):</p>`;
            for (const [pluginName, details] of Object.entries(conflictMatrixCache)) {
                // Find all plugins involved in this method
                const allInvolved = details.impact.match(/\[([^\]]+)\]/);
                const disabledList = allInvolved ? allInvolved[1].split(', ') : [];

                html += `<div class="conflict-map-row">`;
                html += `<span class="conflict-node node-safe" title="Overwritten plugin(s)">`;
                html += disabledList.length > 0 ? disabledList.join('</span><span class="conflict-map-arrow">→</span><span class="conflict-node node-safe">') : '(origin)';
                html += `</span>`;
                html += `<span class="conflict-map-arrow">⟶ overwrites <code style="font-size:0.75rem;">${details.method}</code> ⟶</span>`;
                html += `<span class="conflict-node node-conflict" title="This plugin hard-overwrites the method">${pluginName}</span>`;
                html += `</div>`;
            }
        }

        // Render tier violations as simple rows
        if (hasViolations) {
            html += `<p style="color:#a1a1aa; font-size:0.85rem; margin-bottom:12px; margin-top:16px;">Showing ${architecturalViolations.length} tier violation(s):</p>`;
            architecturalViolations.forEach(v => {
                html += `
                    <div class="conflict-map-row">
                        <span class="conflict-node node-safe">T${v.baselineTier}: ${v.baselinePlugin}</span>
                        <span class="conflict-map-arrow">should be before</span>
                        <span class="conflict-node" style="background:#4d2600; border-color:#f59e0b; color:#fcd34d;">T${v.badTier}: ${v.badPlugin}</span>
                    </div>`;
            });
        }

        html += `</div></div>`;
        viewPanel.innerHTML = html;
    }

    function renderDatabaseAudit() {
        if (Object.keys(databaseFiles).length === 0) {
            viewPanel.innerHTML = `
                <div class="welcome-message" style="border: 1px dashed #3f3f46; background: transparent; padding: 30px; border-radius: 8px;">
                    <h3 style="color:#a1a1aa;">QA Engine Awaiting Data</h3>
                    <p>Drag and drop your <code>/data</code> folder JSON files (e.g., Items.json, Skills.json) into the <strong>sidebar drop zone</strong> on the left to execute a deep structural audit.</p>
                </div>`;
            return;
        }

        if (databaseAlerts.length === 0) {
            viewPanel.innerHTML = `<p class="success-text">🟢 Database Audit Complete: Scanned ${Object.keys(databaseFiles).length} dataset(s). Zero syntax anomalies or formula rejections detected.</p>`;
            return;
        }

        const hardErrors  = databaseAlerts.filter(a => !['Style Suggestion','Incomplete Notetag','Possible Typo'].includes(a.type));
        const warnings    = databaseAlerts.filter(a => a.type === 'Incomplete Notetag');
        const typos       = databaseAlerts.filter(a => a.type === 'Possible Typo');
        const suggestions = databaseAlerts.filter(a => a.type === 'Style Suggestion');

        let html = '<div class="resolution-center">';

        // --- Hard errors (red) ---
        if (hardErrors.length > 0) {
            html += `<h3 style="color:#ef4444; margin-bottom:15px;">Database QA Anomalies Detected</h3>`;
            hardErrors.forEach(alert => {
                html += `
                    <div class="db-alert-card" style="border-left-color:#ef4444;">
                        <h4>🚨 ${alert.type}: ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:4px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) |
                            <strong>Source:</strong> ${alert.file}
                        </p>
                        <div class="impact-text" style="border-left-color:#ef4444;">
                            ${alert.details}
                            ${alert.originalFormula ? `<br><code>Formula: ${alert.originalFormula}</code>` : ''}
                        </div>
                    </div>`;
            });
        }

        // --- Incomplete notetag warnings (amber) ---
        if (warnings.length > 0) {
            html += `<h3 style="color:#f59e0b; margin-bottom:15px; margin-top:${hardErrors.length > 0 ? '28px' : '0'};">⚠️ Incomplete Notetags</h3>
                     <p style="color:#71717a; font-size:0.85rem; margin-bottom:16px; margin-top:-10px;">
                         These notetags have a colon indicating a required value but the value is empty. The plugin will silently ignore them in-game.
                     </p>`;
            warnings.forEach(alert => {
                html += `
                    <div class="db-alert-card" style="border-left-color:#f59e0b; background:#1a1500;">
                        <h4 style="color:#f59e0b;">⚠️ ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:4px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) |
                            <strong>Source:</strong> ${alert.file}
                        </p>
                        <div class="impact-text" style="border-left-color:#f59e0b;">${alert.details}</div>
                    </div>`;
            });
        }

        // --- Possible typos (purple) ---
        if (typos.length > 0) {
            const prevSectionCount = hardErrors.length + warnings.length;
            html += `<h3 style="color:#a78bfa; margin-bottom:15px; margin-top:${prevSectionCount > 0 ? '28px' : '0'};">🔍 Possible Typos</h3>
                     <p style="color:#71717a; font-size:0.85rem; margin-bottom:16px; margin-top:-10px;">
                         These words closely resemble known RPG Maker / VisuStella keywords but are not exact matches. Verify each one — they may be intentional plugin-specific terms or genuine typos that would cause the condition to be silently ignored.
                     </p>`;
            typos.forEach(alert => {
                html += `
                    <div class="db-alert-card" style="border-left-color:#a78bfa; background:#150d2a;">
                        <h4 style="color:#a78bfa;">🔍 ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:4px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) |
                            <strong>Source:</strong> ${alert.file}
                        </p>
                        <div class="impact-text" style="border-left-color:#a78bfa;">${alert.details}</div>
                    </div>`;
            });
        }

        // --- Style suggestions ---
        if (suggestions.length > 0) {
            html += `<h3 style="color:#3b82f6; margin-bottom:15px; margin-top:${hardErrors.length > 0 ? '28px' : '0'};">
                        💡 Formula Style Suggestions
                     </h3>
                     <p style="color:#71717a; font-size:0.85rem; margin-bottom:16px; margin-top:-10px;">
                        These formulas are valid and will work correctly — the suggestions below are optional improvements for readability and convention.
                     </p>`;

            suggestions.forEach(alert => {
                // Build the bullet list of individual suggestions
                const suggestionItems = alert.suggestions
                    .map(s => `<li style="margin-bottom:6px;">${s}</li>`)
                    .join('');

                html += `
                    <div class="db-alert-card" style="border-left-color:#3b82f6; background:#0f1e35;">
                        <h4 style="color:#60a5fa;">💡 ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:10px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) |
                            <strong>Source:</strong> ${alert.file}
                        </p>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                            <div>
                                <p style="color:#71717a; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Current Formula</p>
                                <code style="display:block; background:#121214; padding:8px 10px; border-radius:4px; color:#a1a1aa; word-break:break-all;">${alert.originalFormula}</code>
                            </div>
                            <div>
                                <p style="color:#34d399; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Suggested Formula</p>
                                <code style="display:block; background:#121214; padding:8px 10px; border-radius:4px; color:#34d399; word-break:break-all;">${alert.suggestedFormula}</code>
                            </div>
                        </div>

                        <div class="impact-text" style="border-left-color:#3b82f6;">
                            <ul style="margin:0; padding-left:18px; line-height:1.7;">
                                ${suggestionItems}
                            </ul>
                        </div>
                    </div>`;
            });
        }

        html += '</div>';
        viewPanel.innerHTML = html;
    }

    // --- 7. AUTO-OPTIMIZER WITH TOPOLOGICAL SORT ---
    btnOptimize.addEventListener('click', async () => {
        if (loadedPluginsCache.length === 0) {
            alert('No active configuration array found.');
            return;
        }

        alert('⚙️ MZ-Nexus Engine Active:\nRunning Universal Topological Graph Alignment + Snap-to-Grid Pass...');

        const visited   = {};
        const tempMark  = {};
        const sortedStack = [];
        const pluginMap = {};
        // FIX: Track plugins that are part of a dependency cycle so they can be
        // reported to the user instead of silently dropped from the output.
        const cycleViolators = new Set();

        loadedPluginsCache.forEach(p => { pluginMap[p.name] = p; });

        function visit(nodeName) {
            if (!pluginMap[nodeName]) return;
            if (visited[nodeName]) return;

            // FIX: Previously, hitting a tempMark caused a silent 'return', which dropped
            // the plugin entirely from sortedStack, producing a corrupted plugins.js export.
            // Now we record the cycle and still skip to avoid an infinite loop, but the
            // user will be warned after the sort completes.
            if (tempMark[nodeName]) {
                cycleViolators.add(nodeName);
                return;
            }

            tempMark[nodeName] = true;
            const dependencies = pluginDependenciesMap[nodeName] || [];
            dependencies.forEach(dep => visit(dep));
            tempMark[nodeName] = false;
            visited[nodeName] = true;
            sortedStack.push(pluginMap[nodeName]);
        }

        loadedPluginsCache.forEach(p => {
            if (!visited[p.name]) visit(p.name);
        });

        // Any plugin that was marked as a cycle violator was skipped. Append them at
        // the end so they are NOT silently dropped from the export.
        cycleViolators.forEach(name => {
            if (pluginMap[name] && !sortedStack.find(p => p.name === name)) {
                sortedStack.push(pluginMap[name]);
            }
        });

        loadedPluginsCache = sortedStack;

        // Snap Nexus_Patch_ plugins directly below their targets
        const patchesToSnap = [];
        loadedPluginsCache = loadedPluginsCache.filter(p => {
            if (p.name.includes('Nexus_Patch_')) {
                patchesToSnap.push(p);
                return false;
            }
            return true;
        });

        patchesToSnap.forEach(patch => {
            let targetName = patch.name.split('Nexus_Patch_')[1];
            if (targetName) {
                targetName = targetName.replace(/\s\(\d+\)$/, '');
                const targetIdx = loadedPluginsCache.findIndex(p => p.name === targetName);
                if (targetIdx !== -1) {
                    loadedPluginsCache.splice(targetIdx + 1, 0, patch);
                } else {
                    loadedPluginsCache.push(patch);
                }
            } else {
                loadedPluginsCache.push(patch);
            }
        });

        let doneMessage = '🚀 Universal Layout Matrix Alignment Complete!\nAll structural component tiers sorted and patches snapped securely to targets.';
        if (cycleViolators.size > 0) {
            doneMessage += `\n\n⚠️ Warning: Circular dependencies detected for the following plugin(s) — they have been appended at the end of the load order and may require manual review:\n\n• ${[...cycleViolators].join('\n• ')}`;
        }
        alert(doneMessage);

        await runDeepProjectScan();

        // Re-render the main panel so the user immediately sees the updated conflict state.
        updateButtonStates();
        renderActiveView();
    });

    // --- 8. RESET ---
    btnReset.addEventListener('click', () => {
        if (!confirm('Clear all loaded files and start over?')) return;

        // Wipe all state back to initial values
        loadedPluginsCache    = [];
        scriptFileStorage     = {};
        conflictMatrixCache   = {};
        pluginDependenciesMap = {};
        architecturalViolations = [];
        databaseFiles         = {};
        databaseAlerts        = [];
        // Clear source-scan namespace registry so stale detections from a
        // previous project don't affect the new one
        Object.keys(detectedNamespaceRegistry).forEach(k => delete detectedNamespaceRegistry[k]);

        // Reset sidebar plugin list
        const listStack = document.getElementById('sortable-plugin-stack');
        listStack.innerHTML = '<li class="plugin-list-placeholder">Sandbox Waiting for Upload...</li>';

        // Reset counters
        document.getElementById('total-count').innerText   = '0';
        document.getElementById('conflict-count').innerText = '0';

        // Reset tabs to default
        currentTab = 'resolution';
        switchTabUI('resolution');

        updateButtonStates();
        renderActiveView();
    });

    // --- 9. EXPORT ---
    btnExport.addEventListener('click', () => {
        if (loadedPluginsCache.length === 0) return;
        const outputString = `var $plugins =\n${JSON.stringify(loadedPluginsCache, null, 2)};\n`;
        const dataBlob = new Blob([outputString], { type: 'text/javascript' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(dataBlob);
        downloadLink.download = 'plugins.js';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });

    // --- UI TOGGLES ---
    window.showChangelog = function(e) {
        if(e) e.preventDefault();
        document.getElementById('changelog-modal').style.display = 'flex';
    };
});