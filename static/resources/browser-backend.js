"use strict";

const getMutableStream = (writeable) => {
	let muted = false;

	return {
		mute: () => {muted = true;},
		unmute: () => {muted = false;},
		write: (data) => {
			if (!muted) {writeable.write(data)}
		}
	}
}

const getKeyEvent = (key) => {

	let keyEvent = {name: key};
	if (key === "\u001b") {
		keyEvent.name = "escape";
	}
	else if (key === "\u001b[A") {
		keyEvent.name = "up";
	}
	else if (key === "\u001b[B") {
		keyEvent.name = "down";
	}
	else if (key === "\u001b[C") {
		keyEvent.name = "right";
	}
	else if (key === "\u001b[D") {
		keyEvent.name = "left";
	}
	else if (key === "\r") {
		keyEvent.name = "return";
	}

	return keyEvent;
}

const stopDomEventPropagation = (event) => {
	event.stopPropagation();
	event.preventDefault();
}

const moveLeft = (backend, index) => {
	let width = backend.stdout.cols;

	if (((index+1) % width) === 0) {
		let alternate = backend.stdout.buffer.alternate;
		let resultY = alternate.cursorY;
		backend.mutableOutput.write("\u001b["+resultY+";"+width+"H");
	}
	else {
		backend.mutableOutput.write("\x08");
	}
}

const moveRight = (backend, bufferState, writeAsUserBugWTF) => {
	let index = bufferState.index;
	let width = backend.stdout.cols;
	let height = backend.stdout.rows;

	if ((index % width) === 0) {
		let alternate = backend.stdout.buffer.alternate;
		let resultY = alternate.cursorY+2;
		if (resultY > height) {
			backend.mutableOutput.write("\u001b["+(resultY-height)+"S");
			resultY = height;
		}
		if (writeAsUserBugWTF) {
			//cursor does not match position on screen
			resultY += Math.floor(bufferState.data.length/width);
		}
		backend.mutableOutput.write("\u001b["+resultY+";"+0+"H");
	}
	else {
		backend.mutableOutput.write("\u001b[C");
	}
}

//this part is like the most mess in this whole file
//it should handle situation where elements were removed, added,
//and hardest of them all. Paste may happen!
//Current approach is to redraw all lines + 1 before OLD index
//and some tricks with row to catch when near screen bottom.
const redrawInputPart = (backend, bufferState) => {
	let oldIndex = bufferState.oldIndex;
	let alternate = backend.stdout.buffer.alternate;
	let height = backend.stdout.rows;
	let width = backend.stdout.cols;
	let startCursorY = alternate.cursorY;

	let smallestIndex = 
		bufferState.oldIndex > bufferState.index ?
			bufferState.index : bufferState.oldIndex;

	//we redraw only lines that were affected
	let indexForSubstring = Math.floor(smallestIndex /width)*width;
	let data = bufferState.data.substring(indexForSubstring);
	//first we clean possibly broken buffer lines
	let count = Math.floor(data.length/width)+1;
	backend.mutableOutput.write("\u001b["+count+"M")
	//then we calculate cursor position after insert
	let cursorX = bufferState.index % width;
	let cursorY = startCursorY+1;
	//set cursor in the beginning of current line 
	backend.mutableOutput.write("\u001b["+cursorY+";"+0+"H");
	//render line
	backend.mutableOutput.write(data);
	//restore cursor to where it should be after character insert
	cursorY += Math.floor(bufferState.index/width)-Math.floor(oldIndex/width);
	//TO-DO why +1 here?
	backend.mutableOutput.write("\u001b["+cursorY+";"+(cursorX+1)+"H");
}

const initialKeyCallback = (backend, bufferState, appState, event) => {
	let key = event.key;
	let domEvent = event.domEvent;

	if (domEvent.key === "ArrowRight" && domEvent.altKey === true) {
		//this is alt+left which is move one word left
		console.log("alt+right");
		stopDomEventPropagation(domEvent);
		return
	}
	else if (domEvent.key === "ArrowLeft" && domEvent.altKey === true) {
		//this is alt+left which is move one word left
		console.log("alt+left");
		stopDomEventPropagation(domEvent);
		return
	}
	else if (key === "\u001b[C") {
		//right without modifiers
		stopDomEventPropagation(domEvent);
		if (bufferState.index < bufferState.data.length) {
			bufferState.index += 1;
			moveRight(backend, bufferState);
		}

		return;
	}
	else if (key === "\u001b[D") {
		//left without modifiers
		stopDomEventPropagation(domEvent);
		if (bufferState.index > 0) {
			bufferState.index -= 1;
			moveLeft(backend, bufferState.index);
		}

		return;
	}
	else if (domEvent.key === "ArrowUp" || domEvent.key === "ArrowDown"
			 || domEvent.key === "ArrowLeft" || domEvent.key === "ArrowRight") {
		//these are arrow keys with modifiers (probably)
		stopDomEventPropagation(domEvent);
		return
	}
	else if (key === "\u007f") {
		//backspace
		if (bufferState.index === bufferState.data.length 
			&& bufferState.index > 0) {
			let data = bufferState.data;
			bufferState.data = data.substring(0, data.length-1);
			bufferState.index -= 1;
			moveLeft(backend, bufferState.index)
			backend.mutableOutput.write("\u001b[1P");
		}
		else if (bufferState.index > 0) {
			let data = bufferState.data;
			let index = bufferState.index;
			bufferState.data =
				data.substring(0, index-1) +
				data.substring(index);
			bufferState.oldIndex = bufferState.index;
			bufferState.index -= 1;
			redrawInputPart(backend, bufferState);
		}
		return
	}
	else if (key === "\u001b") {
		return
	}
	else if (key === "\r") {
		backend.mutableOutput.write("\r");
		//workaround for enter when cursor in the middle of multi-line
		let cursorLine = Math.floor(bufferState.index/backend.stdout.cols);
		let linesInInput = Math.floor(bufferState.data.length/backend.stdout.cols);
		let count = linesInInput - cursorLine;
		for (let i = 0; i < count+1; i++) {
			backend.mutableOutput.write("\n");
		}
		return
	}
	else if (appState.mode !== "browse"
			&& appState.mode !== "records"
			&& appState.mode !== "thoughts"){
		
		if (bufferState.index === bufferState.data.length) {
			bufferState.data += key;
			bufferState.index += 1;
			backend.mutableOutput.write(key);

			if ((bufferState.index % backend.stdout.cols === 0)
				&& bufferState.index >= backend.stdout.cols) {
				moveRight(backend, bufferState);
			}
		}
		else {
			let data = bufferState.data;
			bufferState.data = 
				data.substring(0, bufferState.index) +
				key +
				data.substring(bufferState.index);
			bufferState.oldIndex = bufferState.index;
			bufferState.index += 1;
			//redraw for input part needed with cursor position saving
			redrawInputPart(backend, bufferState);
		}
	}
}

const specializedCallbackChainKeyListener =
	(bufferState, callbackChain, backend, appState, event) => {
	let key = event.key;

	let goLine = false;
	let goKey = false;

	if (callbackChain.initial) {
		callbackChain.initial(backend, bufferState, appState, event);

		if (key === "\r") {
			if (appState.mode !== "thoughts" 
				&& appState.mode !== "records"
				&& appState.mode !== "browse") {
				goLine = true;
			}
			else {
				goKey = true;
			}
		}
		if (key === "q" || key === "\u001b" 
			|| key === "\u001b[A" || key === "\u001b[B"
			|| key === "\u001b[C" || key === "\u001b[D") {
			goKey = true;
		}
	}

	if (goLine) {
		let receivedLine = bufferState.data;
		//this looks weird but it is intentional
		//because writeAsUser can modify 
		//bufferState.data during onLine callback
		bufferState.data = "";
		bufferState.index = 0;
		if (callbackChain.onLine) {
			callbackChain.onLine(receivedLine);
		}
	}
	else if (goKey && callbackChain.onKey) {
		let keyEvent = getKeyEvent(key);
		callbackChain.onKey(key, keyEvent);
	}
}

const getBrowserBackend = (appState) => {
	let term = new Terminal({
		rows: 10,
		theme: {
			background: '#EEE',
			foreground: "#000",
			cursor: "#777",
			selection: "#888"
		},
		bellStyle: 'sound'
	});
	const fitAddon = new FitAddon.FitAddon()
	term.loadAddon(fitAddon);
	term.setOption("fontSize", 20);
	term.open(document.getElementById('terminal'));
	let mutableOutput = getMutableStream(term);
	fitAddon.fit();


	//work in progress
	//problem is that in terminal world of nodeJS
	//we handle stdout keypress and readline line events
	//as separate things. But in browser it is handled by
	//terminal key listener
	let callbackChain = {
		"initial": initialKeyCallback, //this one should should imitate readline buffer state editing
		"onLine": undefined, //this one as by readline
		"onKey": undefined   //this one as stdou on keypress 
	}

	let bufferState = {
		data: "", //data
		index: 0
	}

	term.attachCustomKeyEventHandler(
		(event) => {
			bufferState.isData = false;
			if (event.keyCode === 86 && 
				(event.metaKey === true || event.ctrlKey === true)){
				bufferState.isData = true;
				//TO-DO why?
				return false;
			}

			return true;
		}
	)

	term.onData((possiblyPaste) => {
		if (bufferState.isData) {
			let data = bufferState.data;
			bufferState.data = 
				data.substring(0, bufferState.index) +
				possiblyPaste +
				data.substring(bufferState.index);
			bufferState.oldIndex = bufferState.index;
			bufferState.index += possiblyPaste.length;
			redrawInputPart({stdout: term, mutableOutput}, bufferState);
		}
	});

	term.onKey(
		specializedCallbackChainKeyListener.bind(
			null,
			bufferState, callbackChain,
			{stdout: term, mutableOutput}, appState
		)
	);

	let dataLayer = {
		readFileSync: (path) => {
			throw new Error("Not supported!");
		},
		readFile: (path, callback) => {
			setTimeout(()=>{callback("Not supported!");},0);
		},
		writeFile: (path, data, callback) => {
			setTimeout(()=>{callback("Not supported!");},0);
		},
		isFile: (path) => {
			throw new Error("Not supported!");
		}
	};

	let result = {
		dataLayer: dataLayer,
		stdout: term,
		mutableOutput: mutableOutput,
		getTerminalSize: () => {
			return {
				width: term.cols,
				height: term.rows
			};
		},
		writeAsUser: (text, keyEvent) => {
			bufferState.data = text;
			bufferState.index = text.length;
			//this is a hack for some terminal behavior
			if (text === "\n") {
				bufferState.data = "";
				bufferState.index = 0;
			}
			term.write(text);
			//another hack
			if ((bufferState.index % term.cols === 0)
				&& bufferState.index >= term.cols) {
				moveRight({stdout: term, mutableOutput}, bufferState, "wtf");
			}
		},
		onLine: (callback) => {
			callbackChain.onLine = callback;
		},
		onClose: (callback) => {
			//hmmm
		},
		onResize: (callback) => {
			//to-do
		},
		onKey: (callback) => {
			callbackChain.onKey = callback;
		},
		isWindows: false,
		isMacOs: false,
		isBrowser: true
	}

	return result;
}

export default getBrowserBackend;