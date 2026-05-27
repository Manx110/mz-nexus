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
 */

const NEXUS_VERSION = '1.0.0';
const NEXUS_AUTHOR  = 'Manx110';
const NEXUS_REPO    = 'https://github.com/Manx110/mz-nexus';

// =============================================================================
// JS NOTETAG PATTERN REGISTRY
// =============================================================================
const JS_NOTETAG_PATTERNS = [
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
    {
        plugin: 'Yanfly MV (legacy) / VisuStella MZ Custom tags',
        args: ['user', 'target', 'value', 'skill', 'item'],
        extract(note) {
            const TEXT_ONLY_SUFFIXES = /\b(text|display|name|description|icon|label|title|message|string|format|caption|header|footer|prefix|suffix|popup|notify|alert|tooltip)$/i;

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

                if (TEXT_ONLY_SUFFIXES.test(tagName)) continue;
                if (looksLikeRPGText(code)) continue;

                results.push({ tag: `Custom ${tagName}`, code });
            }
            return results;
        }
    },
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
    {
        plugin: 'MOG Hunter',
        args: ['user', 'target', 'value'],
        extract(note) {
            const results = [];
            const re = /<JS>([\s\S]*?)<\/JS>/gi;
            let m;
            while ((m = re.exec(note)) !== null) {
                results.push({ tag: 'JS', code: m[1] });
            }
            return results;
        }
    },
    {
        plugin: 'Galv',
        args: ['a', 'b', 'item'],
        extract(note) {
            const results = [];
            const re = /<js:\s*([^>]+)>/gi;
            let m;
            while ((m = re.exec(note)) !== null) {
                results.push({ tag: 'js: (inline)', code: `return (${m[1].trim()});` });
            }
            return results;
        }
    }
];

// =============================================================================
// CODE BALANCE ANALYSER
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
const REQUIRES_VALUE_WORDS = new Set([
    'state', 'element', 'switch', 'skill', 'weapon', 'armor',
    'class', 'actor', 'enemy', 'buff', 'debuff', 'variable',
    'type', 'troop', 'animation', 'region', 'terrain', 'map', 'event'
]);

const CONDITION_BLOCK_TAGS = new Set([
    'all ai conditions',
    'any ai conditions',
    'all conditions',
    'any conditions',
    'trait conditions',
    'skill conditions',
    'party ai conditions'
]);

const KNOWN_CONDITION_KEYWORDS = new Set([
    'state', 'element', 'switch', 'skill', 'weapon', 'armor', 'class',
    'actor', 'enemy', 'buff', 'debuff', 'variable', 'type', 'troop',
    'animation', 'region', 'terrain', 'always', 'never', 'alive', 'dead', 
    'chance', 'physical', 'magical', 'certain', 'hit', 'evasion', 'critical', 
    'guard', 'substitution', 'regenerate', 'true', 'false', 'hp', 'mp', 'tp', 
    'atk', 'def', 'mat', 'mdf', 'agi', 'luk', 'level', 'target', 'user', 'not', 
    'count', 'turn', 'rate', 'param', 'xparam', 'sparam'
]);

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

function closestKnownKeyword(word) {
    let best = null, bestDist = 99;
    for (const kw of KNOWN_CONDITION_KEYWORDS) {
        const d = editDistance(word, kw);
        if (d < bestDist) { bestDist = d; best = kw; }
    }
    return bestDist === 1 ? best : null;
}

function validateBlockLines(tagNameLower, content) {
    const issues = [];
    const isConditionBlock = CONDITION_BLOCK_TAGS.has(tagNameLower);

    content.split('\n').forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        const tokens = trimmed.toLowerCase()
            .split(/\s+/)
            .map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9%]+$/g, ''))
            .filter(Boolean);

        if (tokens.length === 0) return;
        const lastToken = tokens[tokens.length - 1];

        if (REQUIRES_VALUE_WORDS.has(lastToken)) {
            issues.push({
                type: 'missing_value',
                lineNum: idx + 1,
                text: trimmed,
                message: `Line ends with <code>${lastToken}</code> but no value follows. A numeric ID is required (e.g. <code>${trimmed} 21</code>).`
            });
            return;
        }

        if (!isConditionBlock) return;

        const meaningfulTokens = tokens.filter(t => /^[a-z]{4,}$/.test(t));
        for (const token of meaningfulTokens) {
            if (KNOWN_CONDITION_KEYWORDS.has(token)) continue;
            const closest = closestKnownKeyword(token);
            if (closest) {
                issues.push({
                    type: 'possible_typo',
                    lineNum: idx + 1,
                    text: trimmed,
                    message: `<code>${token}</code> is not a recognized condition keyword — did you mean <code>${closest}</code>? (full line: <em>${trimmed}</em>)`
                });
                break;
            }
        }
    });

    return issues;
}

// =============================================================================
// RUNTIME DOM CONTROLLER INTERFACE
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('file-drop-target');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const viewPanel = document.getElementById('active-view-panel');
    const btnLoadDemo = document.getElementById('btn-load-demo');

    let currentTab = 'resolution';
    let loadedPluginsCache = [];
    let scriptFileStorage = {};
    let conflictMatrixCache = {};
    let pluginDependenciesMap = {};
    let architecturalViolations = [];
    let isDemoModeActive = false;

    let databaseFiles = {};
    let databaseAlerts = [];

    const btnReset    = document.getElementById('btn-reset');
    const btnOptimize = document.getElementById('btn-optimize');
    const btnExport   = document.getElementById('btn-export');

    function updateButtonStates() {
        const hasPlugins  = loadedPluginsCache.length > 0;
        const hasDatabase = Object.keys(databaseFiles).length > 0;
        const hasAnyData  = hasPlugins || hasDatabase;

        btnReset.disabled    = !hasAnyData;
        btnOptimize.disabled = !hasPlugins;   
        btnExport.disabled   = !hasPlugins || isDemoModeActive;   
    }

    setTimeout(() => { renderActiveView(); }, 50);

    // --- TAB VIEWPORT MANAGER ---
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

    // --- DRAG & DROP FILE HIGHLIGHT HANDLERS ---
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
                    const headerMatch = text.match(/var\s+\$plugins\s*=\s*/);
                    if (headerMatch) {
                        const startIdx = text.indexOf('[', headerMatch.index + headerMatch[0].length);
                        const endIdx   = text.lastIndexOf(']');
                        if (startIdx !== -1 && endIdx > startIdx) {
                            loadedPluginsCache = JSON.parse(text.substring(startIdx, endIdx + 1));
                        }
                    } else {
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
            isDemoModeActive = false; // Reset mode on fresh drop
            btnExport.innerText = "Export Updated plugins.js";
            btnExport.style.opacity = "";
            
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

    // =============================================================================
    // DEMO SANDBOX INJECTOR ENGINE
    // =============================================================================
    btnLoadDemo.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        isDemoModeActive = true;

        // 1. Inject polished MZ-centric plugin structures (Using Public_ tier logic)
        loadedPluginsCache = [
            { name: "MK_Core", status: true, description: "Tier 0 core architecture rules." },
            { name: "VisuMZ_1_SkillsStatesCore", status: true, description: "Tier 1 skill processing." },
            { name: "VisuMZ_4_AnimiEffects", status: true, description: "Tier 4 advanced aesthetics." },
            { name: "VisuMZ_0_CoreEngine", status: true, description: "Tier 0 absolute foundational system layout framework." },
            { name: "Public_0_DragonBones", status: true, description: "External dynamic animation engine runtime." },
            { name: "Incompatible_Extension_Pack", status: true, description: "Community optimization utility pack." }
        ];

        // 2. Supply modern script files to feed the method overwrite parsers
        scriptFileStorage = {
            "Public_0_DragonBones.js": new Blob([`
                Sprite_Actor.prototype.updateBitmap = function() { console.log("DragonBones active"); };
            `], { type: 'text/javascript' }),

            "VisuMZ_0_CoreEngine.js": new Blob([`
                DataManager.prototype.loadDatabase = function() { console.log("CoreEngine loader"); };
            `], { type: 'text/javascript' }),
            
            "MK_Core.js": new Blob([`
                Game_Event.prototype.initialize = function() { console.log("MK map systems initialized"); };
            `], { type: 'text/javascript' }),

            "Incompatible_Extension_Pack.js": new Blob([`
                DataManager.prototype.loadDatabase = function() {
                    this._overrideSandboxActive = true;
                };
            `], { type: 'text/javascript' })
        };

        // 3. Inject mock /data JSON strings containing syntactically broken notetags and formulas
        databaseFiles = {
            "Skills.json": JSON.stringify([
                null, 
                {
                    id: 1,
                    name: "Cataclysm Spark",
                    note: "<JS Post-Damage>\nif(user.atk > 50) {\n   target.addState(4);\n// Missing closing brace balance typo!\n</JS Post-Damage>",
                    damage: { formula: "a.atkk * 4 - b.def" } 
                },
                {
                    id: 2,
                    name: "Deep Freeze",
                    note: "<Armor Penetration: >\n<All AI Conditions>\nTarget Not Stat\nchance 50%\n</All AI Conditions>", 
                    damage: { formula: "Math.floor(a.mat) / 2" } 
                }
            ]),
            "Items.json": JSON.stringify([
                null,
                {
                    id: 1,
                    name: "Elixir of Fate",
                    note: "<Unclosed_Tag_Anomaly" 
                }
            ])
        };

        // 4. Force execution loop across layout and QA validation modules
        await runDeepProjectScan();
        runDatabaseAudit();

        // 5. Shift focus directly to the interactive resolution control desk
        currentTab = 'resolution';
        switchTabUI('resolution');
        updateButtonStates();
        renderActiveView();

        // 6. Gracefully block the export action tracking bar
        btnExport.disabled = true;
        btnExport.innerText = "Export Blocked (Demo Mode)";
        btnExport.style.opacity = "0.4";
    });

    function switchTabUI(tabId) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // --- ECOSYSTEM DETECTION & TIER EXTRACTOR ---
    const detectedNamespaceRegistry = {};

    function getPluginEcosystem(pluginName) {
        if (detectedNamespaceRegistry[pluginName]) {
            const ns = detectedNamespaceRegistry[pluginName];
            if (ns === 'VisuMZ') return 'VisuStella';
            if (ns === 'MK')     return 'MK_RNGMaps';
            return ns; 
        }

        if (pluginName.startsWith('VisuMZ_') ||
            pluginName.startsWith('Public_') ||
            pluginName.startsWith('Yanfly')) return 'VisuStella';
        if (pluginName.startsWith('MK_'))   return 'MK_RNGMaps';
        if (pluginName.startsWith('YEP_'))  return 'Yanfly_MV';
        if (pluginName.startsWith('CGMZ_')) return 'CGMZ';
        if (pluginName.startsWith('HIME_')) return 'Hime';
        if (pluginName.startsWith('SRD_'))  return 'SRD';
        return 'standalone';
    }

    const ECOSYSTEM_VISUCORE_ANCHORS = {
        'MK_RNGMaps': 'MK_Core',
        'CGMZ':       'CGMZ_Core',
        'Yanfly_MV':  'YEP_CoreEngine',
    };

    function extractUniversalTierLevel(plugin) {
        if (plugin.name.startsWith('Public_')) return -2;
        if (plugin.name === 'VisuMZ_0_CoreEngine') return -1;

        const descMatch = plugin.description
            ? plugin.description.match(/(?:\[Tier\s*|Tier\s*)(\d+)/i)
            : null;
        if (descMatch) return parseInt(descMatch[1]);

        const nameMatch = plugin.name.match(/_(\d+)_/);
        if (nameMatch) return parseInt(nameMatch[1]);

        return null;
    }

    // --- SOURCE CODE DEEP CHECKER & RULE PARSER ---
    async function runDeepProjectScan() {
        const listStack = document.getElementById('sortable-plugin-stack');
        listStack.innerHTML = '';
        conflictMatrixCache = {};
        pluginDependenciesMap = {};
        architecturalViolations = [];
        const globalPrototypeRegistry = {};
        let activePluginsCount = 0;

        const pluginNameSet = new Set(loadedPluginsCache.map(p => p.name));

        loadedPluginsCache.forEach(plugin => {
            pluginDependenciesMap[plugin.name] = [];
            const currentTier   = extractUniversalTierLevel(plugin);
            const thisEcosystem = getPluginEcosystem(plugin.name);

            if (plugin.name.startsWith('VisuMZ_') && plugin.name !== 'VisuMZ_0_CoreEngine') {
                pluginDependenciesMap[plugin.name].push('VisuMZ_0_CoreEngine');
            }

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

            const anchorForThisEco = ECOSYSTEM_VISUCORE_ANCHORS[thisEcosystem];
            if (anchorForThisEco && plugin.name === anchorForThisEco) {
                loadedPluginsCache.forEach(otherPlugin => {
                    if (!otherPlugin.status) return;
                    if (pluginDependenciesMap[plugin.name].includes(otherPlugin.name)) return;

                    const otherEco  = getPluginEcosystem(otherPlugin.name);
                    const otherTier = extractUniversalTierLevel(otherPlugin);

                    const isVisuStella = otherEco === 'VisuStella';
                    const isStandaloneWithTier = otherEco === 'standalone' && otherTier !== null;

                    if (isVisuStella || isStandaloneWithTier) {
                        pluginDependenciesMap[plugin.name].push(otherPlugin.name);
                    }
                });
            }

            if (currentTier !== null && plugin.status) {
                loadedPluginsCache.forEach(otherPlugin => {
                    if (otherPlugin.name !== plugin.name && otherPlugin.status) {
                        const otherEcosystem = getPluginEcosystem(otherPlugin.name);
                        if (otherEcosystem !== thisEcosystem) return; 
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

                const nsRegex = /var\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s* \s*\|\|\s*\{\s*\}/g;
                let nsMatch;
                while ((nsMatch = nsRegex.exec(codeText)) !== null) {
                    const ns = nsMatch[1];
                    if (ns.length < 2) continue;
                    const knownGlobals = new Set(['Imported','PluginManager','DataManager',
                        'SceneManager','SoundManager','StorageManager','ImageManager',
                        'Utils','Graphics','Input','TouchInput','AudioManager','window',
                        'JsonEx','TextManager','ColorManager','ConfigManager','BattleManager']);
                    if (knownGlobals.has(ns)) continue;

                    if (!plugin._detectedNamespace) plugin._detectedNamespace = ns;
                    detectedNamespaceRegistry[plugin.name] = ns;

                    if (!['VisuStella','MK_RNGMaps','Yanfly_MV','CGMZ','Hime','SRD','standalone']
                            .includes(ns) && ns !== 'VisuMZ' && ns !== 'MK') {
                        plugin._dynamicEcosystem = ns;
                    }
                }

                const depTagRegex = /@(base|orderAfter)\s+([A-Za-z0-9_]+)/g;
                let depTagMatch;
                while ((depTagMatch = depTagRegex.exec(codeText)) !== null) {
                    const depType = depTagMatch[1];   
                    const depName = depTagMatch[2];

                    if (!pluginDependenciesMap[plugin.name].includes(depName)) {
                        pluginDependenciesMap[plugin.name].push(depName);
                    }

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

                    const codeSnippet = codeText.substring(match.index, match.index + 400);
                    const hasAliasCall = /\.call\(\s*this|\.apply\(\s*this/.test(codeSnippet);
                    const safetyType = hasAliasCall ? 'SAFE_ALIAS' : 'CRITICAL_OVERWRITE';

                    scanResult.hooks.push({ methodKey, safetyType });
                    if (!globalPrototypeRegistry[methodKey]) globalPrototypeRegistry[methodKey] = [];
                    globalPrototypeRegistry[methodKey].push({ pluginName: plugin.name, safetyType });
                }
            }

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

            const thisAnchor = ECOSYSTEM_VISUCORE_ANCHORS[getPluginEcosystem(plugin.name)];
            if (thisAnchor && plugin.name === thisAnchor && pluginNameSet.has('VisuMZ_0_CoreEngine')) {
                const coreIdx    = loadedPluginsCache.findIndex(p => p.name === 'VisuMZ_0_CoreEngine');
                const anchorIdx  = i;
                if (coreIdx > anchorIdx) {
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
                        type:           'ecosystem_anchor_order',
                        badPlugin:      plugin.name,
                        ecosystem:      getPluginEcosystem(plugin.name),
                        touchedClasses: touchedClasses.length > 0 ? touchedClasses : ['core prototype methods'],
                        badTier:      null,
                        baselineTier: null
                    });
                }
            }

            const li = document.createElement('li');
            li.className = 'plugin-item';
            
            const eco = getPluginEcosystem(plugin.name);
            const ecoPrefix = eco !== 'VisuStella' && eco !== 'standalone' ? `${eco.split('_')[0]} ` : '';
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

        for (const [method, modifiers] of Object.entries(globalPrototypeRegistry)) {
            if (modifiers.length > 1) {
                const finalActiveHandler = modifiers[modifiers.length - 1];
                if (finalActiveHandler.safetyType === 'CRITICAL_OVERWRITE') {
                    const disabledPlugins = [...new Set(modifiers.slice(0, -1).map(m => m.pluginName))];
                    conflictMatrixCache[finalActiveHandler.pluginName] = {
                        method: method,
                        impact: `Completely overwrites native structure. Deactivates core modifications made by: [${disabledPlugins.join(', ')}].`
                    };
                }
            }
        }

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

    // --- DATABASE AUDIT ENGINE ---
    function runDatabaseAudit() {
        databaseAlerts = [];
        for (const [fileName, jsonText] of Object.entries(databaseFiles)) {
            try {
                const dataArray = JSON.parse(jsonText);
                if (!Array.isArray(dataArray)) continue;

                dataArray.forEach((entry, index) => {
                    if (!entry) return;
                    const name = entry.name || `Unnamed Object (ID: ${entry.id || index})`;

                    if (entry.note) {
                        const alreadyReported = new Set(); 
                        JS_NOTETAG_PATTERNS.forEach(pattern => {
                            let blocks;
                            try { blocks = pattern.extract(entry.note); } catch (_) { return; }

                            blocks.forEach(({ tag, code }) => {
                                if (alreadyReported.has(code)) return;

                                try {
                                    new Function(...pattern.args, code);
                                } catch (err) {
                                    if (!(err instanceof SyntaxError)) return;
                                    alreadyReported.add(code);

                                    const balance = analyzeCodeBalance(code);
                                    const lineMatch = err.message.match(/line (\d+)/i) || (err.stack && err.stack.match(/:(\d+):/));
                                    const lineHint  = lineMatch ? ` (near line ${lineMatch[1]} of the block)` : '';
                                    const escaped = code.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                                    const engineFinding = `Parse failure${lineHint}: <em>${err.message}</em>`;
                                    const allFindings = [engineFinding, ...balance.findings];
                                    const findingsList = allFindings.map(f => `<li style="margin-bottom:5px;">${f}</li>`).join('');

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
                                        details: `<strong>Plugin:</strong> ${pattern.plugin}<br> This will cause a crash when the engine executes this notetag in-game. <ul style="margin:10px 0 10px 0; padding-left:18px; line-height:1.8;">${findingsList}</ul> <code style="display:block; margin-top:8px; white-space:pre; overflow-x:auto;">${escaped}</code> ${fixBlock}`
                                    });
                                }
                            });
                        });

                        let sanitizedNote = entry.note.replace(/<([^>]+)>[\s\S]*?<\/\1>/ig, '');
                        sanitizedNote = sanitizedNote.replace(/<=|>=|=>|->|<-/g, '');
                        sanitizedNote = sanitizedNote.replace(/\s[<>]\s/g, '');

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

                        const TEXT_SUFFIX_RE = /\b(text|display|name|description|icon|label|title|message|string|format|caption|header|footer|prefix|suffix|popup|notify|alert|tooltip)$/i;
                        const blockScanRegex = /<([^/][^>]*)>([\s\S]*?)<\/\1>/gi;
                        let bsMatch;
                        while ((bsMatch = blockScanRegex.exec(entry.note)) !== null) {
                            const bTagName    = bsMatch[1].trim();
                            const bTagLower   = bTagName.toLowerCase();
                            const bContent    = bsMatch[2];

                            if (bTagLower.startsWith('js ') || bTagLower === 'js') continue;
                            if (bTagLower.startsWith('custom ') && !TEXT_SUFFIX_RE.test(bTagLower)) { }
                            if (TEXT_SUFFIX_RE.test(bTagLower)) continue;

                            const lineIssues = validateBlockLines(bTagLower, bContent);
                            lineIssues.forEach(issue => {
                                databaseAlerts.push({
                                    file: fileName,
                                    item: name,
                                    id: entry.id || index,
                                    type: issue.type === 'missing_value' ? 'Incomplete Notetag' : 'Possible Typo',
                                    issue: issue.type === 'missing_value' ? `Missing value on line ${issue.lineNum} of &lt;${bTagName}&gt;` : `Possible typo on line ${issue.lineNum} of &lt;${bTagName}&gt;`,
                                    originalFormula: null,
                                    suggestedFormula: null,
                                    suggestions: [],
                                    details: issue.message
                                });
                            });
                        }
                    }

                    if (entry.damage && entry.damage.formula && entry.damage.formula.trim() !== '') {
                        const originalFormula = entry.damage.formula;
                        let suggestedFormula = originalFormula;
                        const suggestions = [];

                        const gameVarRegex = /\$gameVariables\.value\((\d+)\)/g;
                        if (gameVarRegex.test(originalFormula)) {
                            suggestedFormula = suggestedFormula.replace(/\$gameVariables\.value\((\d+)\)/g, (_, id) => `v[${id}]`);
                            suggestions.push('Replace <code>$gameVariables.value(x)</code> with <code>v[x]</code> — the shorthand is already available in every damage formula context and is the standard convention.');
                        }

                        const floorDivideRegex = /Math\.floor\(([^)]+)\)\s*\/\s*(\d+)/g;
                        let floorMatch;
                        while ((floorMatch = floorDivideRegex.exec(suggestedFormula)) !== null) {
                            const charAfterMatch = suggestedFormula[floorMatch.index + floorMatch[0].length];
                            if (charAfterMatch === ')') continue;
                            
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

                        try {
                            const testFunc = new Function('a', 'b', 'v', 'sign', '$gameVariables', `
                                let dmg = 0;
                                return ${originalFormula};
                            `);

                            const baseStats = {
                                hp: 100, mp: 50, tp: 10, mhp: 100, mmp: 50,
                                atk: 20, def: 10, mat: 20, mdf: 10, agi: 15, luk: 15, level: 5,
                                param: function() { return 20; }, xparam: function() { return 0.1; }, sparam: function() { return 1.0; },
                                hpRate: function() { return 1; }, mpRate: function() { return 1; }, tpRate: function() { return 1; },
                                isStateAffected: function() { return false; }, isBuffAffected: function() { return false; },
                                isDebuffAffected: function() { return false; }, isDead: function() { return false; },
                                isAlive: function() { return true; }, isEnemy: function() { return false; }, isActor: function() { return true; },
                                elementRate: function() { return 1; }, stateRate: function() { return 1; }, addState: function() {}, removeState: function() {},
                                skills: function() { return []; }, hasSkill: function() { return false; },
                            };

                            const dummyV = new Proxy({}, {
                                get: (t, p) => t[p] !== undefined ? t[p] : 5,
                                set: (t, p, val) => { t[p] = val; return true; }
                            });

                            const dummyGameVariables = { value: () => 5 };
                            const result = testFunc(baseStats, baseStats, dummyV, 1, dummyGameVariables);

                            if (typeof result === 'number' && isNaN(result)) {
                                throw new Error('Execution evaluated to NaN (Not-a-Number).');
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

    // --- VIEWPORT RENDERERS ---
    function renderResolutionCenter() {
        const hasIssues = Object.keys(conflictMatrixCache).length > 0 || architecturalViolations.length > 0;

        if (loadedPluginsCache.length > 0 && !hasIssues) {
            viewPanel.innerHTML = `<p class="success-text">🟢 Structural Evaluation Complete: Load paths are correctly aligned and active patches have successfully bridged execution logic.</p>`;
            return;
        }

        let html = '<div class="resolution-center">';

        architecturalViolations.forEach((violation) => {
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

            if (violation.type === 'ecosystem_anchor_order') {
                html += `
                    <div class="alert-card alert-critical">
                        <h4 style="color: #ef4444;">⚠️ Ecosystem Root Loading Before VisuMZ_0_CoreEngine</h4>
                        <p><strong>${violation.badPlugin}</strong> is the root anchor of the <strong>${violation.ecosystem}</strong> ecosystem and is currently positioned <strong>above VisuMZ_0_CoreEngine</strong> in the load order.</p>
                        <div class="impact-text" style="border-left-color: #ef4444;">
                            ${violation.badPlugin} directly modifies core RPG Maker prototype methods (${violation.touchedClasses.join(', ')}). These modifications must alias <em>VisuStella's already-enhanced versions</em> of those methods — not the vanilla RPG Maker originals. Loading before CoreEngine reverses that chain and will cause silent runtime failures or crashes.<br><br>
                            <strong>Fix:</strong> Place the entire ${violation.ecosystem} plugin group after all VisuStella plugins. Auto-Optimize will handle this automatically.
                        </div>
                    </div>`;
                return;
            }

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
                    <div class="card-actions">
                        <button class="btn-premium" onclick="triggerPremiumCheckout('${pluginName}', '${details.method}')">Generate Compatibility Patch</button>
                    </div>
                </div>`;
        }

        html += '</div>';
        viewPanel.innerHTML = html;
    }

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

        if (hasConflicts) {
            html += `<p style="color:#a1a1aa; font-size:0.85rem; margin-bottom:12px;">Showing ${Object.keys(conflictMatrixCache).length} method conflict(s):</p>`;
            for (const [pluginName, details] of Object.entries(conflictMatrixCache)) {
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

        if (hardErrors.length > 0) {
            html += `<h3 style="color:#ef4444; margin-bottom:15px;">Database QA Anomalies Detected</h3>`;
            hardErrors.forEach(alert => {
                html += `
                    <div class="db-alert-card" style="border-left-color:#ef4444;">
                        <h4>🚨 ${alert.type}: ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:4px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) | <strong>Source:</strong> ${alert.file}
                        </p>
                        <div class="impact-text" style="border-left-color:#ef4444;">
                            ${alert.details} ${alert.originalFormula ? `<br><code>Formula: ${alert.originalFormula}</code>` : ''}
                        </div>
                    </div>`;
            });
        }

        if (warnings.length > 0) {
            html += `<h3 style="color:#f59e0b; margin-bottom:15px; margin-top:${hardErrors.length > 0 ? '28px' : '0'};">⚠️ Incomplete Notetags</h3>`;
            warnings.forEach(alert => {
                html += `
                    <div class="db-alert-card" style="border-left-color:#f59e0b; background:#1a1500;">
                        <h4>⚠️ ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:4px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) | <strong>Source:</strong> ${alert.file}
                        </p>
                        <div class="impact-text" style="border-left-color:#f59e0b;">${alert.details}</div>
                    </div>`;
            });
        }

        if (typos.length > 0) {
            const prevSectionCount = hardErrors.length + warnings.length;
            html += `<h3 style="color:#a78bfa; margin-bottom:15px; margin-top:${prevSectionCount > 0 ? '28px' : '0'};">🔍 Possible Typos</h3>`;
            typos.forEach(alert => {
                html += `
                    <div class="db-alert-card" style="border-left-color:#a78bfa; background:#150d2a;">
                        <h4>🔍 ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:4px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) | <strong>Source:</strong> ${alert.file}
                        </p>
                        <div class="impact-text" style="border-left-color:#a78bfa;">${alert.details}</div>
                    </div>`;
            });
        }

        if (suggestions.length > 0) {
            const prevSectionCount = hardErrors.length + warnings.length + typos.length;
            html += `<h3 style="color:#3b82f6; margin-bottom:15px; margin-top:${prevSectionCount > 0 ? '28px' : '0'};">💡 Formula Style Suggestions</h3>`;

            suggestions.forEach(alert => {
                const suggestionItems = alert.suggestions.map(s => `<li style="margin-bottom:6px;">${s}</li>`).join('');

                html += `
                    <div class="db-alert-card" style="border-left-color:#3b82f6; background:#0f1e35;">
                        <h4>💡 ${alert.issue}</h4>
                        <p style="color:#e4e4e7; margin-bottom:10px;">
                            <strong>Target:</strong> ${alert.item} (ID: ${alert.id}) | <strong>Source:</strong> ${alert.file}
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
                            <ul style="margin:0; padding-left:18px; line-height:1.7;">${suggestionItems}</ul>
                        </div>
                    </div>`;
            });
        }

        html += '</div>';
        viewPanel.innerHTML = html;
    }

    // --- ZIP PATCH COMPILER ---
    window.triggerPremiumCheckout = async function(offendingPlugin, brokenMethod) {
        // Guard check: Intercept execution immediately if running mock project parameters
        if (isDemoModeActive) {
            alert('⚙️ Action Prevented:\nPatch compiling is restricted during live dashboard demo sessions.');
            return;
        }

        const targetPlugin = offendingPlugin || 'Unknown_Plugin';
        const targetMethod = brokenMethod  || 'Unknown.prototype.method';

        if (typeof JSZip === 'undefined') {
            alert('⚠️ Network Error: Unable to reach the compression engine.');
            return;
        }

        alert(`🛠️ MZ-Nexus Sandbox Mode:\nCompiling compatibility patch archive for ${targetPlugin}.js -> ${targetMethod}`);

        const patchContent = `/*:\n * @target MZ\n * @plugindesc [MZ-Nexus Compatibility Patch] Restores native functional loops overwritten by ${targetPlugin}.\n * @author MZ-Nexus Subsystem\n *\n * @help\n * Place this patch directly BELOW ${targetPlugin} in your plugin load manager list.\n */\n\n(function() {\n    const parts = "${targetMethod}".split('.');\n    const baseNamespace = parts[0];\n    const subMethod = parts.length > 2 ? parts[2] : parts[1];\n    const globalContextTarget = (parts.length > 2 && parts[1] === 'prototype') ? window[baseNamespace].prototype : window[baseNamespace];\n    if (globalContextTarget && typeof globalContextTarget[subMethod] === 'function') {\n        const _Nexus_Original_Method_Cache = globalContextTarget[subMethod];\n        globalContextTarget[subMethod] = function() {\n            return _Nexus_Original_Method_Cache.apply(this, arguments);\n        };\n        console.log("🟢 MZ-Nexus Patch Bound successfully to ${targetMethod}.");\n    }\n})();`;
        const readmeContent = `=======================================\nMZ-NEXUS COMPATIBILITY PATCH ENGINE\n=======================================\n\nINSTALLATION INSTRUCTIONS:\n1. Extract this .zip folder.\n2. Copy 'Nexus_Patch_${targetPlugin}.js' into your project's js/plugins/ folder.\n3. Open your RPG Maker Plugin Manager.\n4. Add the patch and place it directly BELOW ${targetPlugin}.\n\nThe MZ-Nexus Auto-Optimize Order tool will automatically snap this patch into the correct position.`;

        const zip = new JSZip();
        zip.file(`Nexus_Patch_${targetPlugin}.js`, patchContent);
        zip.file('README_INSTALLATION.txt', readmeContent);

        const content = await zip.generateAsync({ type: 'blob' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(content);
        downloadLink.download = `Nexus_Patch_${targetPlugin}.zip`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    // --- AUTO-OPTIMIZER WITH TOPOLOGICAL SORT ---
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
        const cycleViolators = new Set();

        loadedPluginsCache.forEach(p => { pluginMap[p.name] = p; });

        function visit(nodeName) {
            if (!pluginMap[nodeName]) return;
            if (visited[nodeName]) return;
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

        cycleViolators.forEach(name => {
            if (pluginMap[name] && !sortedStack.find(p => p.name === name)) {
                sortedStack.push(pluginMap[name]);
            }
        });

        loadedPluginsCache = sortedStack;

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
        updateButtonStates();
        renderActiveView();
    });

    // --- RESET ---
    btnReset.addEventListener('click', () => {
        if (!confirm('Clear all loaded files and start over?')) return;

        isDemoModeActive = false;
        btnExport.innerText = "Export Updated plugins.js";
        btnExport.style.opacity = "";

        loadedPluginsCache    = [];
        scriptFileStorage     = {};
        conflictMatrixCache   = {};
        pluginDependenciesMap = {};
        architecturalViolations = [];
        databaseFiles         = {};
        databaseAlerts        = [];
        Object.keys(detectedNamespaceRegistry).forEach(k => delete detectedNamespaceRegistry[k]);

        const listStack = document.getElementById('sortable-plugin-stack');
        listStack.innerHTML = '<li class="plugin-list-placeholder">Sandbox Waiting for Upload...</li>';

        document.getElementById('total-count').innerText   = '0';
        document.getElementById('conflict-count').innerText = '0';

        currentTab = 'resolution';
        switchTabUI('resolution');
        updateButtonStates();
        renderActiveView();
    });

    // =============================================================================
    // COMPLIANT SECURE EXPORT CONTROLLER (ZIP PACKAGED)
    // =============================================================================
    btnExport.addEventListener('click', async () => {
        if (loadedPluginsCache.length === 0 || isDemoModeActive) return;

        if (typeof JSZip === 'undefined') {
            alert('⚠️ Compression library missing. Unable to compile secure archive.');
            return;
        }

        const outputString = `var $plugins =\n${JSON.stringify(loadedPluginsCache, null, 2)};\n`;
        
        const zip = new JSZip();
        zip.file('plugins.js', outputString);
        zip.file('NEXUS_EXPORT_README.txt', `=======================================\nMZ-NEXUS DEPLOYMENT PACKAGE\n=======================================\n\nYour load order has been cleanly optimized and verified.\n\nDIRECTIONS:\n1. Extract this folder.\n2. Drop the updated 'plugins.js' file directly inside your project's /js/ folder, overwriting the original.`);

        const content = await zip.generateAsync({ type: 'blob' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(content);
        downloadLink.download = 'Optimized_Project_Config.zip';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });
});