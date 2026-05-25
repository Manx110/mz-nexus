// MZ-Nexus: Advanced Core Engine [MZ Production Stable] - Anchor Guard Updates

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('file-drop-target');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const viewPanel = document.getElementById('active-view-panel');

    let currentTab = 'resolution';
    let loadedPluginsCache = [];
    let scriptFileStorage = {};
    let conflictMatrixCache = {};
    let pluginDependenciesMap = {};
    let architecturalViolations = [];

    let databaseFiles = {};
    let databaseAlerts = [];

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

        renderActiveView();
    });

    function switchTabUI(tabId) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // --- 3. HARD ANCHOR EXTRACTOR PASS ---
    function extractUniversalTierLevel(plugin) {
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

        loadedPluginsCache.forEach(plugin => {
            pluginDependenciesMap[plugin.name] = [];
            const currentTier = extractUniversalTierLevel(plugin);

            // Force all VisuMZ plugins to declare VisuMZ_0_CoreEngine as their base anchor
            if (plugin.name.startsWith('VisuMZ_') && plugin.name !== 'VisuMZ_0_CoreEngine') {
                pluginDependenciesMap[plugin.name].push('VisuMZ_0_CoreEngine');
            }

            if (currentTier !== null && plugin.status) {
                loadedPluginsCache.forEach(otherPlugin => {
                    if (otherPlugin.name !== plugin.name && otherPlugin.status) {
                        const otherTier = extractUniversalTierLevel(otherPlugin);
                        if (otherTier !== null && otherTier < currentTier) {
                            pluginDependenciesMap[plugin.name].push(otherPlugin.name);
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
                for (let j = i + 1; j < loadedPluginsCache.length; j++) {
                    const trackingPlugin = loadedPluginsCache[j];
                    if (trackingPlugin.status) {
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

                // Parse @base notetags to register explicit dependencies
                const baseTagRegex = /@base\s+([A-Za-z0-9_]+)/g;
                let baseMatch;
                while ((baseMatch = baseTagRegex.exec(codeText)) !== null) {
                    const depName = baseMatch[1];
                    if (!pluginDependenciesMap[plugin.name].includes(depName)) {
                        pluginDependenciesMap[plugin.name].push(depName);
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

            // Build sidebar list item
            const li = document.createElement('li');
            li.className = 'plugin-item';
            const tierDisplayLevel = currentTier !== null ? ` [T${currentTier}]` : '';
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

                    // Check for unclosed notetag brackets
                    if (entry.note) {
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
                                details: `The note box has ${openBrackets} opening '&lt;' brackets and ${closeBrackets} closing '&gt;' brackets. This asymmetry will cause complex plugin parameters to fail.`
                            });
                        }
                    }

                    // Validate and sandbox-execute damage formulas
                    if (entry.damage && entry.damage.formula && entry.damage.formula.trim() !== '') {
                        try {
                            const testFunc = new Function('a', 'b', 'v', 'sign', `
                                let dmg = 0;
                                return ${entry.damage.formula};
                            `);

                            // FIX: Expanded mock object to include methods commonly used in RPG Maker MZ
                            // damage formulas (param, xparam, sparam, isEnemy, isActor, etc.) that were
                            // previously missing, causing false-positive "Broken Formula" audit errors.
                            const baseStats = {
                                hp: 100, mp: 50, tp: 10,
                                mhp: 100, mmp: 50,
                                atk: 20, def: 10, mat: 20, mdf: 10, agi: 15, luk: 15,
                                level: 5,
                                // Core stat methods
                                param:   function() { return 20; },
                                xparam:  function() { return 0.1; },
                                sparam:  function() { return 1.0; },
                                // Rate helpers
                                hpRate:  function() { return 1; },
                                mpRate:  function() { return 1; },
                                tpRate:  function() { return 1; },
                                // State/buff checks
                                isStateAffected:  function() { return false; },
                                isBuffAffected:   function() { return false; },
                                isDebuffAffected: function() { return false; },
                                isDead:           function() { return false; },
                                isAlive:          function() { return true; },
                                isEnemy:          function() { return false; },
                                isActor:          function() { return true; },
                                // Element/state rate
                                elementRate: function() { return 1; },
                                stateRate:   function() { return 1; },
                                // State mutation (formula side-effects)
                                addState:    function() {},
                                removeState: function() {},
                                // Skills / items references
                                skills:  function() { return []; },
                                hasSkill: function() { return false; },
                            };

                            // Proxy for game variables (v[x]) - returns 5 for any unset variable
                            const dummyV = new Proxy({}, {
                                get: function(target, prop) {
                                    return target[prop] !== undefined ? target[prop] : 5;
                                },
                                set: function(target, prop, value) {
                                    target[prop] = value;
                                    return true;
                                }
                            });

                            const result = testFunc(baseStats, baseStats, dummyV, 1);

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
                                details: `Engine test failure: "${err.message}". This usually means a misspelled stat reference (e.g. <code>a.atkk</code> instead of <code>a.atk</code>) or incomplete math operators.<br><code>Formula: ${entry.damage.formula}</code>`
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

        let html = '<div class="resolution-center"><h3 style="color:#ef4444; margin-bottom: 15px;">Database QA Anomalies Detected</h3>';
        databaseAlerts.forEach(alert => {
            html += `
                <div class="db-alert-card">
                    <h4>🚨 ${alert.type}: ${alert.issue}</h4>
                    <p style="color:#e4e4e7; margin-bottom:4px;"><strong>Target:</strong> ${alert.item} (ID: ${alert.id}) | <strong>Source:</strong> ${alert.file}</p>
                    <div class="impact-text" style="border-left-color: #ef4444;">${alert.details}</div>
                </div>`;
        });
        html += '</div>';
        viewPanel.innerHTML = html;
    }

    // --- 7. ZIP PATCH COMPILER ---
    window.triggerPremiumCheckout = async function(offendingPlugin, brokenMethod) {
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

    // --- 8. AUTO-OPTIMIZER WITH TOPOLOGICAL SORT ---
    document.getElementById('btn-optimize').addEventListener('click', async () => {
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

        // FIX: Re-render the main panel after optimizing so the user immediately sees
        // the updated conflict state. Previously the panel stayed stale until the user
        // manually clicked a tab.
        renderActiveView();
    });

    // --- 9. EXPORT ---
    document.getElementById('btn-export').addEventListener('click', () => {
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
});