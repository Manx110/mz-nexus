/**
 * Global Script Extractor — extractor-ui.js
 * Handles DOM interactions, folder parsing, HTML table rendering, and CSV exports.
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('folder-drop-target');
    const folderInput = document.getElementById('folder-input');
    const viewPanel = document.getElementById('active-view-panel');
    const summaryList = document.getElementById('extraction-summary-list');
    const btnLoadDemo = document.getElementById('btn-load-extractor-demo');
    
    const btnReset = document.getElementById('btn-reset');
    const btnExport = document.getElementById('btn-export-csv');
    const exportFilter = document.getElementById('export-filter');

    let extractedDataCache = [];
    let parsedFilesCount = 0;
    let isDemoModeActive = false;

    // =========================================================================
    // 1. EVENT LISTENERS
    // =========================================================================

    // Click the drop zone to trigger the hidden file input (ignoring if clicking the demo button)
    dropZone.addEventListener('click', (e) => {
        if (e.target !== btnLoadDemo) {
            folderInput.click();
        }
    });

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

        viewPanel.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-spinner"></div>
                <span>Parsing JSON data...</span>
            </div>`;

        const items = e.dataTransfer.items;
        const filesToProcess = [];

        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item) {
                    await traverseFileTree(item, filesToProcess);
                }
            }
        }

        if (filesToProcess.length > 0) {
            isDemoModeActive = false;
            btnExport.innerText = "Export Full Script to CSV";
            btnExport.style.opacity = "";
            processFiles(filesToProcess);
        } else {
            showError("No valid JSON files found in the dropped folder.");
        }
    });

    folderInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            viewPanel.innerHTML = `
                <div class="loading-indicator">
                    <div class="loading-spinner"></div>
                    <span>Parsing JSON data...</span>
                </div>`;
            isDemoModeActive = false;
            btnExport.innerText = "Export Full Script to CSV";
            btnExport.style.opacity = "";
            processFiles(files);
        }
    });

    exportFilter.addEventListener('change', () => {
        renderDataTable();
        if (!isDemoModeActive) {
            if (exportFilter.value === 'dialogue') {
                btnExport.innerText = "Export Dialogue to CSV";
            } else {
                btnExport.innerText = "Export Full Script to CSV";
            }
        }
    });

    // =========================================================================
    // DEMO SANDBOX INJECTOR ENGINE
    // =========================================================================
    btnLoadDemo.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        isDemoModeActive = true;
        parsedFilesCount = 2; // Simulating Map001.json and CommonEvents.json

        // Inject high-fidelity narrative dataset matching standard game project arrays
        extractedDataCache = [
            { file: "Map001.json", event: "Event 3 (Garrison Captain)", page: 1, speaker: "Captain Reid", text: "Stand fast! The mechanical frames are breaching the freight terminal parameters as we speak!" },
            { file: "Map001.json", event: "Event 3 (Garrison Captain)", page: 1, speaker: "Captain Reid", text: "If we don't hold this platform, the internal reactor chamber falls." },
            { file: "Map001.json", event: "Event 3 (Garrison Captain)", page: 1, speaker: "[CHOICE PROMPT]", text: "Draw weapons and join the line" },
            { file: "Map001.json", event: "Event 3 (Garrison Captain)", page: 1, speaker: "[CHOICE PROMPT]", text: "Man the fixed defense turrets" },
            { file: "Map001.json", event: "Event 3 (Garrison Captain)", page: 1, speaker: "", text: "The heavy steel bulkhead doors begin to groan under immense pressure." },
            { file: "CommonEvents.json", event: "Common Event 14 (System: Terminal Alert)", page: 1, speaker: "SYSTEM VOX", text: "Warning: Critical mutation thresholds reached in Subsection B." }
        ];

        updateUI();

        // Lock down exportation utilities during sandbox operation
        btnExport.disabled = true;
        btnExport.innerText = "Export Blocked (Demo Mode)";
        btnExport.style.opacity = "0.4";
    });

    // =========================================================================
    // 2. FOLDER TRAVERSAL & PROCESSING
    // =========================================================================

    function traverseFileTree(item, pathList) {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file((file) => {
                    pathList.push(file);
                    resolve();
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                dirReader.readEntries(async (entries) => {
                    for (let i = 0; i < entries.length; i++) {
                        await traverseFileTree(entries[i], pathList);
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async function processFiles(files) {
        const targetFiles = files.filter(f => 
            f.name === 'CommonEvents.json' || /^Map\d{3}\.json$/.test(f.name)
        );

        if (targetFiles.length === 0) {
            showError("Could not find MapXXX.json or CommonEvents.json files.");
            return;
        }

        parsedFilesCount = targetFiles.length;
        extractedDataCache = await window.MZScriptParser.parseFiles(targetFiles);

        updateUI();
    }

    // =========================================================================
    // 3. UI RENDERING
    // =========================================================================

    function updateUI() {
        document.getElementById('maps-count').innerText = parsedFilesCount;
        document.getElementById('lines-count').innerText = extractedDataCache.length;

        btnReset.disabled = false;
        btnExport.disabled = extractedDataCache.length === 0 || isDemoModeActive;
        exportFilter.disabled = extractedDataCache.length === 0;

        renderSummarySidebar();
        renderDataTable();
    }

    function renderSummarySidebar() {
        summaryList.innerHTML = '';
        
        const fileCounts = extractedDataCache.reduce((acc, curr) => {
            acc[curr.file] = (acc[curr.file] || 0) + 1;
            return acc;
        }, {});

        for (const [file, count] of Object.entries(fileCounts)) {
            const li = document.createElement('li');
            li.className = 'plugin-item';
            li.style.borderLeftColor = '#34d399';
            li.innerHTML = `
                <span class="plugin-name">${file}</span>
                <span style="color:#71717a; font-size:0.8rem; margin-left:auto;">${count} lines</span>
            `;
            summaryList.appendChild(li);
        }
    }

    function renderDataTable() {
        if (extractedDataCache.length === 0) {
            showError("Files parsed successfully, but no dialogue or choices were found.");
            return;
        }

        let dataToRender = extractedDataCache;
        if (exportFilter.value === 'dialogue') {
            dataToRender = extractedDataCache.filter(row => row.speaker !== "" && row.speaker !== "[CHOICE PROMPT]");
        }

        let tableHTML = `
            <table class="script-table">
                <thead>
                    <tr>
                        <th width="15%">File</th>
                        <th width="20%">Event</th>
                        <th width="15%">Speaker</th>
                        <th width="50%">Text</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const displayLimit = Math.min(dataToRender.length, 500);

        if (dataToRender.length === 0) {
            tableHTML += `<tr><td colspan="4" style="text-align:center; color:#71717a; padding: 30px;">No dialogue found. Ensure your text events are using the Name Box feature.</td></tr>`;
        }

        for (let i = 0; i < displayLimit; i++) {
            const row = dataToRender[i];
            const speakerBadge = row.speaker === "[CHOICE PROMPT]" 
                ? `<span style="color:#f59e0b; font-size:0.8rem;">[CHOICE]</span>` 
                : row.speaker;

            const displaySpeaker = speakerBadge === "" 
                ? `<span style="color:#52525b; font-size:0.8rem; font-style: italic;">[NO SPEAKER]</span>` 
                : speakerBadge;

            tableHTML += `
                <tr>
                    <td style="color:#a1a1aa; font-size:0.85rem;">${row.file}</td>
                    <td style="color:#a1a1aa; font-size:0.85rem;">${row.event}<br><span style="font-size:0.7rem; color:#52525b;">Page ${row.page}</span></td>
                    <td style="font-weight:bold; color:#e4e4e7;">${displaySpeaker}</td>
                    <td style="color:#d4d4d8;">${escapeHTML(row.text)}</td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table>`;

        if (dataToRender.length > 500) {
            tableHTML += `<p style="text-align:center; color:#71717a; margin-top:20px; font-size:0.85rem;">
                Showing first 500 rows. Export to CSV to view all ${dataToRender.length} lines.
            </p>`;
        }

        viewPanel.innerHTML = tableHTML;
    }

    function showError(message) {
        viewPanel.innerHTML = `
            <div class="alert-card" style="border-left-color:#ef4444; margin-top: 20px;">
                <h4 style="color:#ef4444;">⚠️ Extraction Failed</h4>
                <p>${message}</p>
            </div>`;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // =========================================================================
    // 4. CSV EXPORT
    // =========================================================================

    btnExport.addEventListener('click', () => {
        if (extractedDataCache.length === 0 || isDemoModeActive) return;

        let dataToExport = extractedDataCache;

        if (exportFilter.value === 'dialogue') {
            const proceed = confirm("WARNING: Exporting 'Dialogue Only' will completely exclude all narrator text, signposts, item notifications, and player choices.\n\nAre you sure you only want to export text that uses the Name Box?");
            if (!proceed) return;

            dataToExport = extractedDataCache.filter(row => row.speaker !== "" && row.speaker !== "[CHOICE PROMPT]");
        }

        let csvContent = "File,Event,Page,Speaker,Text\n";

        dataToExport.forEach(row => {
            const safeText = row.text.replace(/"/g, '""');
            const safeEvent = row.event.replace(/"/g, '""');
            const safeSpeaker = row.speaker.replace(/"/g, '""');

            csvContent += `"${row.file}","${safeEvent}","${row.page}","${safeSpeaker}","${safeText}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        link.setAttribute("href", url);
        link.setAttribute("download", exportFilter.value === 'dialogue' ? "MZ_Dialogue_Only.csv" : "MZ_Global_Script.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // =========================================================================
    // 5. RESET
    // =========================================================================

    btnReset.addEventListener('click', () => {
        isDemoModeActive = false;
        extractedDataCache = [];
        parsedFilesCount = 0;
        
        document.getElementById('maps-count').innerText = '0';
        document.getElementById('lines-count').innerText = '0';
        
        btnReset.disabled = true;
        btnExport.disabled = true;
        btnExport.style.opacity = "";
        
        exportFilter.disabled = true;
        exportFilter.value = 'all';
        btnExport.innerText = "Export Full Script to CSV";
        
        summaryList.innerHTML = '<li class="plugin-list-placeholder">Awaiting /data folder...</li>';
        viewPanel.innerHTML = `
            <div class="welcome-message">
                <h3>Script Extractor Ready</h3>
                <p>Drag and drop your entire MZ <code>/data</code> folder into the sidebar to parse all dialogue and choices.</p>
                <p style="font-size: 0.85rem; color: #71717a; margin-top: 10px;">Supported files: <code>Map*.json</code> and <code>CommonEvents.json</code>.</p>
            </div>`;
    });
});