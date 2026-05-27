/**
 * Global Script Extractor — script-parser.js
 * Isolated logic for parsing MZ JSON files for dialogue and choices.
 */

class ScriptParser {
    constructor() {
        // Regex to match Map001.json, Map023.json, etc. 
        // We explicitly ignore files like System.json or Actors.json
        this.mapFileRegex = /^Map\d{3}\.json$/;
    }

    /**
     * Main entry point. Accepts a FileList array from the drag-and-drop UI.
     */
    async parseFiles(fileList) {
        const extractedScript = [];

        for (const file of fileList) {
            if (this.mapFileRegex.test(file.name) || file.name === 'CommonEvents.json') {
                try {
                    const fileContent = await file.text();
                    const jsonData = JSON.parse(fileContent);

                    if (file.name === 'CommonEvents.json') {
                        this.parseCommonEvents(jsonData, file.name, extractedScript);
                    } else {
                        this.parseMapEvents(jsonData, file.name, extractedScript);
                    }
                } catch (e) {
                    console.error(`Failed to parse ${file.name}:`, e);
                }
            }
        }

        // Returns a flat array of every line of dialogue in the game
        return extractedScript;
    }

    parseMapEvents(mapData, fileName, outputArray) {
        if (!mapData || !mapData.events) return;

        mapData.events.forEach(event => {
            if (!event) return; // MZ map arrays often leave index 0 null
            this.extractFromPages(event.pages, fileName, `Event ${event.id} (${event.name})`, outputArray);
        });
    }

    parseCommonEvents(commonEventsData, fileName, outputArray) {
        if (!Array.isArray(commonEventsData)) return;

        commonEventsData.forEach(event => {
            if (!event) return;
            // Common events don't have pages, just a direct list array
            this.extractFromList(event.list, fileName, `Common Event ${event.id} (${event.name})`, 1, outputArray);
        });
    }

    extractFromPages(pages, fileName, eventName, outputArray) {
        if (!pages) return;
        pages.forEach((page, index) => {
            this.extractFromList(page.list, fileName, eventName, index + 1, outputArray);
        });
    }

    /**
     * The core extraction loop. Hunts for Codes 101, 102, and 401.
     */
    extractFromList(list, fileName, eventName, pageNum, outputArray) {
        if (!list) return;

        let currentSpeaker = "";

        for (let i = 0; i < list.length; i++) {
            const cmd = list[i];

            // Code 101: Show Text Setup
            // MZ stores the Name Box string at index 4
            if (cmd.code === 101) {
                currentSpeaker = cmd.parameters[4] || "";
            }

            // Code 401: The actual text string
            if (cmd.code === 401) {
                outputArray.push({
                    file: fileName,
                    event: eventName,
                    page: pageNum,
                    speaker: currentSpeaker,
                    text: cmd.parameters[0]
                });
            }

            // Code 102: Show Choices
            if (cmd.code === 102) {
                const choices = cmd.parameters[0]; // Array of choice strings
                choices.forEach(choice => {
                    outputArray.push({
                        file: fileName,
                        event: eventName,
                        page: pageNum,
                        speaker: "[CHOICE PROMPT]",
                        text: choice
                    });
                });
            }
            
            // Clear speaker name if a text box ends, just to be safe
            // Code 402 is "When [Choice] is selected", a good reset point
            if (cmd.code === 402) {
                currentSpeaker = "";
            }
        }
    }
}

// Attach to the global window object so extractor-ui.js can call it easily
window.MZScriptParser = new ScriptParser();