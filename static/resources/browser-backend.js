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
const initialKeyCallback = (backend, bufferState, appState, event) => {
	let key = event.key;
	if (key === "\u001b[A" || key === "\u001b[B"
		|| key === "\u001b[C" || key === "\u001b[D") {
		//ignore arrow keys
		event.domEvent.stopPropagation();
		event.domEvent.preventDefault();
		return;
	}
	else if (key === "\u007f") {
		console.log("backspace not supported yet!");
		return
	}
	else if (key === "\u001b") {
		console.log("escape pressed!");
		return
	}
	else if (key === "\r") {
		console.log("enter pressed!");
		backend.mutableOutput.write("\r\n");
		return
	}
	else if (appState.mode !== "browse"
			&& appState.mode !== "records"
			&& appState.mode !== "thoughts"){
		bufferState.line += key;
		backend.mutableOutput.write(key);
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

	let callbackChain = {
		"initial": initialKeyCallback, //this one should should imitate readline buffer state editing
		"onLine": undefined, //this one as by readline
		"onKey": undefined   //this one as stdou on keypress 
	}

	//work in progress
	//problem is that in terminal world of nodeJS
	//we handle stdout keypress and readline line events
	//as separate things. But in browser it is handled by
	//terminal key listener
	let bufferState = {
		line: ""
	}
	const specializedCallbackChainKeyListener = (event) => {
		let key = event.key;

		let goLine = false;
		let goKey = false;

		if (callbackChain.initial) {
			callbackChain.initial({stdout: term, mutableOutput}, bufferState, appState, event);

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
			let receivedLine = bufferState.line;
			//this looks weird because writeAsUser can modify it as part of onLine
			bufferState.line = "";
			if (callbackChain.onLine) {
				console.log("line!" + bufferState.line);
				callbackChain.onLine(receivedLine);
			}
		}
		else if (goKey && callbackChain.onKey) {
			let keyEvent = {name: key}
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
			callbackChain.onKey(key, keyEvent);
		}
	}
	term.onKey(specializedCallbackChainKeyListener);

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
			bufferState.line = text;
			//this is a hack for some terminal behavior
			if (text === "\n") {
				bufferState.line = "";
			}
			term.write(text);
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