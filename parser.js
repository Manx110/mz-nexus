// MZ-Nexus: Advanced Core Engine [MZ Production Stable] - Complete Graph UI Refresh Patched

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
            case 'resolution': renderResolutionCenter(); break;
            case 'conflict-map': renderConflictMap(); break;
            case 'database': renderDatabaseAudit(); break;
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

        let hasDatabaseFiles = false;
        let hasPluginFiles = false;

        await Promise.all(files.map(async file => {
            if (file.name.endsWith('.js') && file.name !== 'plugins.js') {
                scriptFileStorage[file.name] = file;
            } else if (file.name === 'plugins.js') {
                hasPluginFiles = true;
                const text = await file.text();
                try {
                    const startArrayIdx = text.indexOf('[');
                    const endArrayIdx = text.lastIndexOf(']');
                    if (startArrayIdx !== -1 && endArrayIdx !== -1) {
                        loadedPluginsCache = JSON.parse(text.substring(startArrayIdx, endArrayIdx + 1));
                    }
                } catch (err) {
                    console.error("Plugins.js load matrix parsing anomaly", err);
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

    // --- 3. THE TIER EXTRACTION ENGINE WITH ACCIDENTAL OPERATOR FILTERING ---
    function extractUniversalTierLevel(plugin) {
        // Safe Exception Layer: Dragonbones uses '_0_' as a version control flag, not an engine architecture tier
        if (plugin.name.includes('Dragonbones') || plugin.name.includes('DragonBones')) return null;
        
        // Strict Foundational Anchor Protection: VisuMZ_0_CoreEngine must lock securely as the root of Tier 0
        if (plugin.name === 'VisuMZ_0_CoreEngine') return 0;

        const descMatch = plugin.description ? plugin.description.match(/(?:\[Tier\s*|Tier\s*)(\d+)/i) : null;
        if (descMatch) return parseInt(descMatch[1]);
        
        const nameMatch = plugin.name.match(/_(\d+)_/);
        if (nameMatch) return parseInt(nameMatch[1]);
        
        return null; 
    }

    // --- 4. THE SOURCE CODE DEEP CHECKER & RULE PARSER ---
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
                const baseTagRegex = /@base\s+([A-Za-z0-9_]+)/g;
                let baseMatch;
                while ((baseMatch = baseTagRegex.exec(codeText)) !== null) {
                    const depName = baseMatch[1];
                    if (!pluginDependenciesMap[plugin.name].includes(depName)) {
                        pluginDependenciesMap[plugin.name].push(depName);
                    }
                }

                const overwriteRegex = /(\w+)\.prototype\.(\w+)\s*=\s*function/g;
                const aliasCallRegex = /\.call\(\s*this|\.apply\(\s*this/g;
                let match;
                scanResult.status = 'SAFE';

                while ((match = overwriteRegex.exec(codeText)) !== null) {
                    const targetClass = match[1];
                    const targetMethod = match[2];
                    const methodKey = `${targetClass}.${targetMethod}`;
                    const codeSnippet = codeText.substring(match.index, match.index + 400);
                    const hasAliasCall = aliasCallRegex.test(codeSnippet);
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

            const li = document.createElement('li');
            li.className = 'plugin-item';
            let badgeHTML = '<span class="badge" style="color:#71717a; font-size:0.8rem;">⚪ Need Script</span>';
            const tierDisplayLevel = currentTier !== null ? ` [T${currentTier}]` : '';

            if (!plugin.status) {
                li.style.borderLeft = '4px solid #52525b';
                badgeHTML = '<span class="badge" style="color:#71717a; font-size:0.8rem;">⚪ Off</span>';
            } else if (scanResult.status === 'SAFE' || plugin.name.includes('Nexus_Patch_')) {
                li.style.borderLeft = '4px solid #34d399';
                badgeHTML = `<span class="badge" style="color:#34d399; font-size:0.8rem;">🟢 Parsed${tierDisplayLevel}</span>`;
            } else {
                li.style.borderLeft = '4px solid #f59e0b';
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

    // --- 5. THE ADVANCED DATABASE AUDIT ENGINE ---
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
                        let sanitizedNote = entry.note.replace(/<([^>]+)>[\s\S]*?<\/\1>/ig, '');
                        sanitizedNote = sanitizedNote.replace(/<=|>=|=>|->|<-/g, '');
                        sanitizedNote = sanitizedNote.replace(/\s[<>]\s/g, '');
                        
                        const openBrackets = (sanitizedNote.match(/</g) || []).length;
                        const closeBrackets = (sanitizedNote.match(/>/g) || []).length;
                        
                        if (openBrackets !== closeBrackets) {
                            databaseAlerts.push({
                                file: fileName,
                                item: name,
                                id: entry.id || index,
                                type: 'Syntax Error',
                                issue: 'Unclosed Notetag Brackets',
                                details: `The non-script portions of the note box have ${openBrackets} opening '<' brackets and ${closeBrackets} closing '>' brackets. This asymmetry will cause complex plugin parameters to fail.`
                            });
                        }
                    }

                    if (entry.damage && entry.damage.formula && entry.damage.formula.trim() !== '') {
                        try {
                            const testFunc = new Function('a', 'b', 'v', 'sign', `
                                let dmg = 0; 
                                return ${entry.damage.formula};
                            `);
                            
                            const baseStats = { hp:100, mp:50, tp:10, mhp:100, mmp:50, atk:20, def:10, mat:20, mdf:10, agi:15, luk:15, level:5 };
                            
                            baseStats.hpRate = function() { return 1; };
                            baseStats.mpRate = function() { return 1; };
                            baseStats.tpRate = function() { return 1; };
                            baseStats.isStateAffected = function() { return false; };
                            baseStats.isBuffAffected = function() { return false; };
                            baseStats.isDebuffAffected = function() { return false; };
                            baseStats.isDead = function() { return false; };
                            baseStats.isAlive = function() { return true; };
                            baseStats.elementRate = function() { return 1; };
                            baseStats.stateRate = function() { return 1; };
                            baseStats.addState = function() {};
                            baseStats.removeState = function() {};
                            
                            const variableStorageMock = {};
                            const dummyV = new Proxy(variableStorageMock, {
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
                                throw new Error(`Execution evaluated to NaN (Not-a-Number).`);
                            }
                        } catch (err) {
                            databaseAlerts.push({
                                file: fileName,
                                item: name,
                                id: entry.id || index,
                                type: 'Logic Error',
                                issue: 'Broken Damage Formula Execution',
                                details: `Engine test failure: "${err.message}". This usually means a misspelled stat reference (e.g. 'a.atkk' instead of 'a.atk') or incomplete math operators.<br><code style="background:#121214; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block; color:#f87171;">Formula: ${entry.damage.formula}</code>`
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
                    details: 'This file could not be parsed. The data structure may be corrupted.'
                });
            }
        }
    }

    // --- 6. VIEWPORT RENDERER WITH POST-SORT VIEW INTEGRATION ---
    function renderResolutionCenter() {
        if (loadedPluginsCache.length > 0 && Object.keys(conflictMatrixCache).length === 0 && architecturalViolations.length === 0) {
            viewPanel.innerHTML = `<p class="success-text" style="color: #34d399; font-weight: bold;">🟢 Structural Evaluation Complete: Load paths are correctly aligned and active patches have successfully bridged execution logic.</p>`;
            return;
        }

        let html = '<div class="resolution-center">';
        architecturalViolations.forEach((violation) => {
            html += `
                <div class="alert-card" style="border-left: 4px solid #f59e0b;">
                    <h4 style="color: #f59e0b;">⚠️ Sequence Violation: Structural Tier Placement Mismatch</h4>
                    <p>The component <strong>${violation.badPlugin}</strong> is loading <strong>above</strong> foundational component <strong>${violation.baselinePlugin}</strong>.</p>
                    <p class="impact-text" style="border-left-color: #f59e0b;">Impact: Reversing internal vendor architecture frameworks causes runtime memory access failures inside engine instances.</p>
                </div>`;
        });

        for (const [pluginName, details] of Object.entries(conflictMatrixCache)) {
            html += `
                <div class="alert-card" style="border-left: 4px solid #ef4444;">
                    <h4 style="color: #ef4444;">⚠️ Critical Function Overwrite Verified: <code>${details.method}</code></h4>
                    <p>The code inside <strong>${pluginName}.js</strong> explicitly replaces this core routine without an internal backward-compatible alias loop.</p>
                    <p class="impact-text" style="border-left-color: #ef4444;">Impact Statement: ${details.impact}</p>
                    <div class="card-actions" style="margin-top: 15px;">
                        <button class="btn-premium" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;" onclick="triggerPremiumCheckout('${pluginName}', '${details.method}')">Generate Compatibility Patch</button>
                    </div>
                </div>`;
        }
        html += '</div>';
        viewPanel.innerHTML = html;
    }

    function renderConflictMap() {
        viewPanel.innerHTML = `<div style="background:#16161a; border:1px solid #2a2a30; padding:20px; border-radius:8px; height:100%;"><h4 style="color:#3b82f6; margin-top:0;">System Component Vector Nodes</h4><p style="color:#a1a1aa; font-size:0.9rem;">Live map tracing tracking component vectors.</p></div>`;
    }

    document.getElementById('btn-optimize').addEventListener('click', async () => {
        if (loadedPluginsCache.length === 0) {
            alert("No active configuration array found.");
            return;
        }

        alert("⚙️ MZ-Nexus Engine Active:\nRunning Universal Topological Graph Alignment + Snap-to-Grid Pass...");

        const visited = {};
        const tempMark = {};
        const sortedStack = [];
        const pluginMap = {};

        loadedPluginsCache.forEach(p => { pluginMap[p.name] = p; });

        function visit(nodeName) {
            if (!pluginMap[nodeName]) return; 
            if (tempMark[nodeName]) return; 
            if (!visited[nodeName]) {
                tempMark[nodeName] = true;
                const dependencies = pluginDependenciesMap[nodeName] || [];
                dependencies.forEach(dep => visit(dep));
                tempMark[nodeName] = false;
                visited[nodeName] = true;
                sortedStack.push(pluginMap[nodeName]);
            }
        }

        loadedPluginsCache.forEach(p => {
            if (!visited[p.name]) visit(p.name);
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

        // Forced UI Sync Pass: Clears previous sequence layout tracking lists entirely 
        architecturalViolations = [];
        
        // Re-execute deep project scan framework with sorted index matrix positions to force UI update
        await runDeepProjectScan();
        renderActiveView();
        
        alert("🚀 Universal Layout Matrix Alignment Complete!\nAll system tiers sorted and view dashboard fully synced.");
    });

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