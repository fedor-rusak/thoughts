"use strict";
import {
	setAlternativeBuffer,
	setMainBuffer,
	showCursor
} from "./lib/vt100-sequences.js";
import {createAppState} from "./lib/data-helpers.js";
import {
	getLineListener,
	getKeyListener,
	getResizeListener
} from "./lib/app-callbacks.js";
import {render} from "./lib/render-helpers.js";
import getRealTerminalBackend from "./lib/real-terminal-backend.js";

const currentBackend = getRealTerminalBackend();

let dataFilePath = process.argv.slice(2)[0] || './data.json';
try {
	if (currentBackend.dataLayer.isFile(dataFilePath) === false) {
		dataFilePath = './data.json';
	}
}
catch (e) {
	dataFilePath = './data.json';
}


let appState = createAppState({
	terminalSize: currentBackend.getTerminalSize(),
	dataFilePath: dataFilePath,
	initialCommands: [
		[
			{color: "grey", text: "# Data file: "},
			{color: "cyan", bold: true, text: dataFilePath}
		],
		[
			{color: "grey", text: "# When in doubt use "},
			{color: "cyan", bold: true, text: "help"}
		]
	]
});


//initial setup and first render
setAlternativeBuffer(currentBackend.stdout);
showCursor(currentBackend.stdout);
render(appState.terminalSize, appState.commands, currentBackend.mutableOutput);


const lineListener = getLineListener(currentBackend, appState);
const exit = () => {
	setMainBuffer(currentBackend.stdout);
	process.exit(); //easy-fix for close on Win platform
}
const keyListener = getKeyListener(currentBackend, appState, exit);
const resizeListener = getResizeListener(currentBackend, appState);


currentBackend.onLine(lineListener);
currentBackend.onClose(exit);
currentBackend.onKey(keyListener);
currentBackend.onResize(resizeListener);