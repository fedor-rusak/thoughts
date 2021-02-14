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

const redrawInputPart = (backend, bufferState) => {
	let alternate = backend.stdout.buffer.alternate;
	let height = backend.stdout.rows;
	let width = backend.stdout.cols;
	let startCursorY = alternate.cursorY;

	let bugfixLine = 0;
	if ((bufferState.index % width) === 0 && bufferState.data.length >= width) {
		bugfixLine = 1;
	}
	//we redraw only lines that were affected
	let indexForSubstring = Math.floor(bufferState.index /width - bugfixLine)*width;
	let data = bufferState.data.substring(indexForSubstring);
	//first we clean possibly broken buffer lines
	let count = Math.floor(data.length/width)+1;
	backend.mutableOutput.write("\u001b["+count+"M")
	//then we calculate cursor position after character insert
	let cursorX = bufferState.index % width;
	let cursorY = startCursorY+1;
	//set cursor in the beginning of current line 
	backend.mutableOutput.write("\u001b["+cursorY+";"+0+"H");
	//render line
	backend.mutableOutput.write(data);
	//restore cursor to where it should be after character insert
	cursorY += cursorX === 0 ? 1 : 0;
	//TO-DO why +1 here?
	backend.mutableOutput.write("\u001b["+cursorY+";"+(cursorX+1)+"H");

	//this one really specific edge case for multiline user input that is
	//near bottom and causes automatic scroll up
	let linesInInput = Math.ceil(data.length/width);
	console.log(startCursorY + " " + linesInInput + " " + height)
	if ((startCursorY + linesInInput) > height) {
		console.log((startCursorY + linesInInput))
		backend.mutableOutput.write("\u001b[1A");
	}
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
			console.log("before "+bufferState.index)
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
		console.log("backspace pressed!");
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
			bufferState.index -= 1;
			redrawInputPart(backend, bufferState);
		}
		return
	}
	else if (key === "\u001b") {
		console.log("escape pressed!");
		return
	}
	else if (key === "\r") {
		console.log("enter pressed!");
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
			console.log(bufferState.index)
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
			bufferState.index += 1;
			//add whitespace
			backend.mutableOutput.write("\u001b[1@");
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
			console.log("line! " + receivedLine);
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
		theme: {
			background: '#FFF',
			foreground: "#000",
			cursor: "#777",
			selection: "#888"
		}
	});
	term.open(document.getElementById('terminal'));
	let mutableOutput = getMutableStream(term)

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

	term.onKey(
		specializedCallbackChainKeyListener.bind(
			null,
			bufferState, callbackChain,
			{stdout: term, mutableOutput}, appState
		)
	);

	let result = {
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