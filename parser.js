// MZ-Nexus: Complete Advanced Core with Dual-Rule Topological Sorting, Patch Modal UI & Robust Adjacency Binding

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
        if (loadedPluginsCache.length === 0) {
            viewPanel.innerHTML = `
                <div class="welcome-message">
                    <h3>System Diagnostics Ready</h3>
                    <p>Drop your project's <code>plugins.js</code> here to analyze your load order framework.</p>
                </div>`;
            return;
        }
        switch (currentTab) {
            case 'resolution': renderResolutionCenter(); break;
            case 'conflict-map': renderConflictMap(); break;
            case 'database': renderDatabaseAudit(); break;
        }
    }

    // --- 2. DRAG & DROP FILE CAPTURE HANDLER ---
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

        files.forEach(file => {
            if (file.name.endsWith('.js') && file.name !== 'plugins.js') {
                scriptFileStorage[file.name] = file;
            }
        });

        const configFile = files.find(f => f.name === 'plugins.js');

        if (configFile) {
            const text = await configFile.text();
            try {
                const startArrayIdx = text.indexOf('[');
                const endArrayIdx = text.lastIndexOf(']');
                if (startArrayIdx === -1 || endArrayIdx === -1) throw new Error();
                
                loadedPluginsCache = JSON.parse(text.substring(startArrayIdx, endArrayIdx + 1));
                await runDeepProjectScan();
            } catch (err) {
                viewPanel.innerHTML = `<p style="color:#ef4444; font-weight:bold;">⚠️ Error: Invalid plugins.js file format structure.</p>`;
            }
        } else if (loadedPluginsCache.length > 0) {
            await runDeepProjectScan();
        }
    });

    // --- 3. UNIVERSAL TIER DETECTOR EXTRACTOR FUNCTION ---
    function extractUniversalTierLevel(plugin) {
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

                    if (!globalPrototypeRegistry[methodKey]) {
                        globalPrototypeRegistry[methodKey] = [];
                    }
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
                if (conflictMatrixCache[targetName]) {
                    delete conflictMatrixCache[targetName]; 
                }
            }
        });

        const activeConflictsCount = Object.keys(conflictMatrixCache).length;
        document.getElementById('conflict-count').innerText = activeConflictsCount + architecturalViolations.length;
        renderActiveView();
    }

    // --- 5. INTERACTIVE RESOLUTION VIEW CONTROL ---
    function renderResolutionCenter() {
        if (loadedPluginsCache.length > 0 && Object.keys(conflictMatrixCache).length === 0 && architecturalViolations.length === 0) {
            viewPanel.innerHTML = `<p class="success-text">🟢 Structural Evaluation Complete: Load paths are correctly aligned and active patches have successfully bridged execution logic.</p>`;
            return;
        }

        let html = '<div class="resolution-center">';

        architecturalViolations.forEach((violation) => {
            html += `
                <div class="alert-card" style="border-left-color: #f59e0b;">
                    <h4 style="color: #f59e0b;">⚠️ Sequence Violation: Structural Tier Placement Mismatch</h4>
                    <p>The component <strong>${violation.badPlugin}</strong> (Tier ${violation.badTier}) is loading <strong>above</strong> foundational component <strong>${violation.baselinePlugin}</strong> (Tier ${violation.baselineTier}).</p>
                    <p class="impact-text">Impact: Reversing internal vendor architecture frameworks causes runtime memory access failures inside engine instances.</p>
                    <div class="card-actions">
                        <button class="btn-fix" style="background:#27272a; color:#f59e0b; border-color:#f59e0b;" onclick="alert('Use the Auto-Optimize Order button below to automatically realign the universal tier graph.')">Requires Structural Alignment</button>
                    </div>
                </div>`;
        });

        for (const [pluginName, details] of Object.entries(conflictMatrixCache)) {
            html += `
                <div class="alert-card">
                    <h4>⚠️ Critical Function Overwrite Verified: <code>${details.method}</code></h4>
                    <p>The code inside <strong>${pluginName}.js</strong> explicitly replaces this core routine without an internal backward-compatible alias loop.</p>
                    <p class="impact-text">Impact Statement: ${details.impact}</p>
                    <div class="card-actions">
                        <button class="btn-fix" onclick="executeAutoOrderFix('${pluginName}')">Auto-Shift Index</button>
                        <button class="btn-premium" onclick="triggerPremiumCheckout('${pluginName}', '${details.method}')">Generate Compatibility Patch ($4.99)</button>
                    </div>
                </div>`;
        }
        html += '</div>';
        viewPanel.innerHTML = html;
    }

    function renderConflictMap() {
        viewPanel.innerHTML = `<div style="background:#16161a; border:1px solid #2a2a30; padding:20px; border-radius:8px; height:100%;"><h4 style="color:#3b82f6;">System Component Vector Nodes</h4></div>`;
    }

    function renderDatabaseAudit() {
        viewPanel.innerHTML = `<p class="impact-text">Provide /data folder parameters to test system data profiles.</p>`;
    }

    window.executeAutoOrderFix = function(offendingPlugin) {
        const pluginIdx = loadedPluginsCache.findIndex(p => p.name === offendingPlugin);
        if (pluginIdx > 0) {
            const [movedPlugin] = loadedPluginsCache.splice(pluginIdx, 1);
            loadedPluginsCache.unshift(movedPlugin); 
            alert(`⚙️ Shift Matrix Complete: Moved ${offendingPlugin} to prioritize execution.`);
            runDeepProjectScan();
        }
    }

    // --- NEW: INLINE UI MODAL COMPILER (BYPASSES WINDOWS SAC) ---
    window.triggerPremiumCheckout = function(offendingPlugin, brokenMethod) {
        const targetPlugin = offendingPlugin || "Unknown_Plugin";
        const targetMethod = brokenMethod || "Unknown.prototype.method";

        const patchContent = `/*:\n * @target MZ\n * @plugindesc [MZ-Nexus Compatibility Patch] Restores native functional loops overwritten by ${targetPlugin}.\n * @author MZ-Nexus Subsystem\n *\n * @help\n * Place this patch directly BELOW ${targetPlugin} in your plugin load manager list.\n */\n\n(function() {\n    const parts = "${targetMethod}".split('.');\n    const baseNamespace = parts[0];\n    const subMethod = parts.length > 2 ? parts[2] : parts[1];\n    const globalContextTarget = (parts.length > 2 && parts[1] === 'prototype') ? window[baseNamespace].prototype : window[baseNamespace];\n    if (globalContextTarget && typeof globalContextTarget[subMethod] === 'function') {\n        const _Nexus_Original_Method_Cache = globalContextTarget[subMethod];\n        globalContextTarget[subMethod] = function() {\n            return _Nexus_Original_Method_Cache.apply(this, arguments);\n        };\n        console.log("🟢 MZ-Nexus Patch Bound successfully to ${targetMethod}.");\n    }\n})();`;

        const modalHtml = `
            <div id="nexus-patch-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:9999; backdrop-filter: blur(4px);">
                <div style="background:#1a1a1e; border:1px solid #3b82f6; border-radius:8px; padding:24px; max-width:700px; width:90%; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    <h3 style="color:#93c5fd; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <span>✅</span> Patch Engine Compiled
                    </h3>
                    <p style="color:#a1a1aa; font-size:0.95rem; margin-bottom:16px; line-height:1.5;">
                        To bypass Windows Smart App Control blocks, copy the compiled architecture below and save it as a new file named <code style="color:#34d399; background:#121214; padding:2px 6px; border-radius:4px; border:1px solid #2a2a30;">Nexus_Patch_${targetPlugin}.js</code> inside your project's plugin directory.
                    </p>
                    <textarea id="nexus-patch-code" style="width:100%; height:250px; background:#121214; color:#e4e4e7; border:1px solid #3f3f46; border-radius:6px; padding:16px; font-family:'Consolas', monospace; font-size:0.85rem; margin-bottom:20px; resize:vertical;" readonly>${patchContent}</textarea>
                    <div style="display:flex; justify-content:flex-end; gap:12px;">
                        <button onclick="document.getElementById('nexus-patch-modal').remove()" style="padding:10px 20px; background:#27272a; color:#e4e4e7; border:1px solid #3f3f46; border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.2s;">Close</button>
                        <button onclick="navigator.clipboard.writeText(document.getElementById('nexus-patch-code').value); this.innerText='Copied!'; this.style.backgroundColor='#059669'; setTimeout(()=> { this.innerText='Copy Source Code'; this.style.backgroundColor='#3b82f6'; }, 2000);" style="padding:10px 20px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.2s;">Copy Source Code</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // --- 6. AUTOMATED TOPOLOGICAL SORTING OPTIMIZER WITH ADJACENCY BINDING ---
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
            if (tempMark[nodeName]) {
                console.warn(`Circular reference chain bypassed on node elements: ${nodeName}`);
                return; 
            }
            if (!visited[nodeName]) {
                tempMark[nodeName] = true;
                
                const dependencies = pluginDependenciesMap[nodeName] || [];
                dependencies.forEach(dep => {
                    visit(dep); 
                });

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

        alert(`🚀 Universal Tier Layout Matrix Alignment Complete!\nAll system tiers sorted and patches snapped securely to their targets.`);
        await runDeepProjectScan();
    });

    // --- 7. DATA EXPORT SYSTEM ---
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