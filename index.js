"use strict";
const {
	setAlternativeBuffer,
	setMainBuffer,
	showCursor
} = require("./lib/vt100-sequences");
const {
	createAppState
} = require("./lib/data-helpers");
const {
	getLineListener,
	getKeyListener,
	getResizeListener
} =  require("./lib/app-callbacks");
const {render} = require("./lib/render-helpers");
const getRealTerminalBackend = require("./lib/real-terminal-backend");

const currentBackend = getRealTerminalBackend();

let dataFilePath = process.argv.slice(2)[0] || './data.json';
try {
	if (fs.lstatSync(dataFilePath).isFile() === false) {
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