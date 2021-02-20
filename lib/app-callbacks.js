"use strict";
import {
	beep,
	hideCursor,
	showCursor,
	deletePreviousLine,
	cursorUp,
	cursorDown,
	style
} from "./vt100-sequences.js";
import {
	render,
	renderData,
	renderDataWithNavigateTags
} from "./render-helpers.js";
import {
	prepareLines,
	prepareThoughts,
	buildBrowseIndex
} from "./data-helpers.js";

const lineListener = function (currentBackend, appState, line) {
	let normalized = line.trim().toLowerCase();

	const dataFilePath = currentBackend.dataLayer.dataFilePath;
	const mutableOutput = currentBackend.mutableOutput;
	let currentNoteState = appState.currentNoteState;
	let browseRenderData = appState.browseRenderData;
	let thoughtsRenderData = appState.thoughtsRenderData;
	let commands = appState.commands;
	let recordsRenderData = appState.recordsRenderData;
	let mode = appState.mode;
	let terminalSize = appState.terminalSize;
	if (mode === "command") {
		let result = "";
		let toPrint = "";
		let asUser = false;

		if (normalized === 'clear') {
			appState.commands = [];
			render(terminalSize, [], mutableOutput);
		}
		else if (normalized === "position") {
			//it will be caught by keypress in async flow
			mutableOutput.write(prefix + "[6n");
		}
		else if (normalized === 'title') {
			appState.mode = "title";
			toPrint = currentNoteState.title || "";
			asUser = true;
			result = "mode = title"
		}
		else if (normalized === 'content') {
			appState.mode = "content";
			toPrint = currentNoteState.content || "";
			asUser = true;
			result = "mode = content";
		}
		else if (normalized === 'tags') {
			appState.mode = "tags";
			toPrint = currentNoteState.tags || "";
			asUser = true;
			result = "mode = tags";
		}
		else if (normalized === "now") {
			currentNoteState.date = new Date().toISOString();
			result = "date set";
		}
		else if (normalized === 'state') {
			toPrint = JSON.stringify(currentNoteState, null, 4).replace(/\n/g,"\r\n")+"\r\n";
		}
		else if (normalized === "push") {
			if (currentNoteState.title === undefined) {
				mutableOutput.write("Title can't be empty"+"\r\n");
			}
			else if (currentNoteState.content === undefined) {
				mutableOutput.write("Content can't be empty"+"\r\n");
			}
			else if (currentNoteState.date === undefined) {
				mutableOutput.write("Date can't be empty"+"\r\n");
			}
			else if (appState.noteIndex !== -1) {
				mutableOutput.write("You have to ");
				style(mutableOutput).bold().cyan().write("drop");
				mutableOutput.write(" current not or create ");
				style(mutableOutput).bold().cyan().write("new");
				mutableOutput.write(" before pushing.\r\n");
			}
			else {
				appState.records.push(currentNoteState);
				appState.currentNoteState = {};
				result = "Note added to records"
			}
		}
		else if (normalized === "records") {
			appState.mode = "records";
			recordsRenderData.lines =
				prepareLines(appState.records, terminalSize.width);
			let renderFrom = recordsRenderData.lines.length - terminalSize.height;
			recordsRenderData.viewStartLine = renderFrom >= 0 ? renderFrom : 0;

			hideCursor(mutableOutput);
			renderData(terminalSize, recordsRenderData, mutableOutput);
			result = "Records over. mode = command"
		}
		else if (normalized === "thoughts") {
			if (appState.records.length === 0) {
				mutableOutput.write("No thoughts to remember now.\r\n")
			}
			else {
				appState.mode = "thoughts";
				thoughtsRenderData.cachedThoughtsLines =
					prepareThoughts(appState.records, terminalSize.width);
				thoughtsRenderData.viewStartLine = 0;
				thoughtsRenderData.setIndex(0);

				hideCursor(mutableOutput);
				renderData(terminalSize, thoughtsRenderData, mutableOutput);
				appState.inputStartDate = new Date();
				result = "Thoughts over. mode = command"
			}
		}
		else if (normalized === "save") {
			appState.mode = "saving";
			result = "mode = saving";
			deletePreviousLine(1, mutableOutput);
			mutableOutput.write(line);
			let resultText = " # "+result;
			style(mutableOutput).grey().write(resultText+"\r\n");
			//will be added to commands history as every other command
			mutableOutput.mute()
			
			let handleWriteData = (err, data) => {
				if (err) {
					appState.commands.push([{color: "grey", text: "# Saving failed. mode = command"}]);
					backToCommands(currentBackend, appState);
					return
				}

				appState.commands.push([{color: "grey", text: "# Saving successful. mode = command"}]);

				backToCommands(currentBackend, appState);
			}

			currentBackend.dataLayer.writeData(JSON.stringify(appState.records, null, 4), handleWriteData);
		}
		else if (normalized === "load") {
			appState.mode = "loading";
			result = "mode = loading";
			deletePreviousLine(1, mutableOutput);
			mutableOutput.write(line);
			let resultText = " # "+result;
			style(mutableOutput).grey().write(resultText+"\r\n");
			//will be added to commands history as every other command
			mutableOutput.mute()
			
			let handleReadData = (err, data) => {
				if (err) {
					appState.commands.push([{color: "grey", text: "# Loading failed. mode = command"}]);
					backToCommands(currentBackend, appState);
					return
				}
				try {
					appState.records = JSON.parse(data);
					appState.commands.push([{color: "grey", text: "# Loading successful. mode = command"}]);
				}
				catch (e) {
					appState.commands.push([{color: "grey", text: "# Parsing failed. mode = command"}]);
				}

				backToCommands(currentBackend, appState);
			}

			currentBackend.dataLayer.readData(handleReadData);
		}
		else if (normalized === "new") {
			appState.currentNoteState = {};
			appState.noteIndex = -1;
			result = "State clear. mode = command"
		}
		else if (normalized === "drop") {
			if (appState.noteIndex === -1) {
				mutableOutput.write("None of existing thoughts was chosen.\r\n");
			}
			else {
				appState.records.splice(appState.noteIndex, 1);
				appState.currentNoteState = {};
				appState.noteIndex = -1;
				result = "Note dropped. mode = command"
			}
		}
		else if (normalized === "browse") {
			if (appState.records.length === 0) {
				mutableOutput.write("No thoughts to browse now.\r\n")
			}
			else {
				appState.mode = "browse";
				browseRenderData.prepareThoughtsAndIndex(appState.records, terminalSize.width);
				browseRenderData.navigateTag = "date";
				browseRenderData.setTaggedNoteIndex(0);

				hideCursor(mutableOutput);
				renderDataWithNavigateTags(terminalSize, browseRenderData, mutableOutput);
				appState.inputStartDate = new Date();
				result = "Browsing over. mode = command"
			}
		}
		else if (normalized === "help") {
			result = "Welcome and have a nice day!\r\n"+
				"# Multiple commands are supported by thoughts:\r\n"+
				"#    development-thoughts - thoughts I got while developing this app\r\n"+
				"#    browse  - use arrows to navigate. Esq or q to exit.\r\n"+
				"#    records - see data in JSON format\r\n"+
				"#    new     - start new note\r\n"+
				"#    title   - write title\r\n"+
				"#    content - write content\r\n"+
				"#    tags    - write tags\r\n"+
				"#    now     - set current date\r\n"+
				"#    push    - add current note to records\r\n"+
				"#    save    - save records in default file\r\n"+
				"#    load    - load records from default file\r\n"+
				"#    clear   - get empty screen";
		}
		else if (normalized === "development-thoughts") {
			try {
				appState.records = JSON.parse(currentBackend.dataLayer.readFileSync("./lib/development-thoughts.json"));
				result = "Successfully loaded development records. mode = command"
			}
			catch (e) {
				result = "Failed to load development records. mode = command";
			}
		}
		else if (normalized === "gist-token") {
			appState.mode = "gist-token";
			result = "No typing is shown. mode = gist-token"
			deletePreviousLine(1, mutableOutput);
			mutableOutput.write(line);
			let resultText = " # "+result;
			style(mutableOutput).grey().write(resultText+"\r\n");
			mutableOutput.mute();
		}
		else if (normalized === "gist-name") {
			appState.mode = "gist-name";
			result = "mode = gist-token"
		}
		else if (normalized === "use-gist") {
			try {
				currentBackend.dataLayer.useGist();
				result = "Gist now used for save/load. mode = command";
			}
			catch(e) {
				result = "Failed to switch to gist. mode = command";
			}
		}
		else if (normalized === "use-fs") {
			try {
				currentBackend.dataLayer.useFs();
				result = "File system now used for save/load. mode = command";
			}
			catch(e) {
				result = "Failed to switch to file system. mode = command";
			}
		}
		else {
			beep(mutableOutput)
			// mutableOutput.write(JSON.stringify(line)+"\n"); //nice debug option
		}

		if (result === "") {
			commands.push(line)
		}
		else {
			deletePreviousLine(1, mutableOutput);
			mutableOutput.write(line);
			let resultText = " # "+result;
			style(mutableOutput).grey().write(resultText+"\r\n");
			commands.push([line, {color: "grey", text: resultText}]);
		}

		//this is needed to print command results like # Success
		//and sometimes like state right in buffer
		if (toPrint !== "") {
			if (asUser) {
				currentBackend.writeAsUser(toPrint);
				
				if (currentBackend.isMacOs) {
					currentBackend.writeAsUser(" ");//whitespace+backpace triggers redrawing of input
					currentBackend.writeAsUser(null, { name: 'backspace' });
					let counter = Math.floor(toPrint.length / terminalSize.width);
					if (counter > 0) {
						cursorUp(counter, mutableOutput);
						deletePreviousLine(counter, mutableOutput);
						cursorDown(counter, mutableOutput);
					}
				}
			}
			else {
				mutableOutput.write(toPrint)
			}
		}
	}
	else if (mode === "title") {
		if (normalized === ""){
			mutableOutput.write("Write non-empty title or ");
			style(mutableOutput).bold().cyan().write("forget");
			mutableOutput.write(".\r\n");
		}
		else if (normalized === "forget") {
			commands.push(line);
			appState.mode = "command";
		}
		else {
			currentNoteState.title = line.trim();
			appState.mode = "command";
		}
	}
	else if (mode === "content") {
		if(normalized === "") {
			mutableOutput.write("Write non-empty contet or ");
			style(mutableOutput).bold().cyan().write("forget");
			mutableOutput.write(".\n");
		}
		else if (normalized === "forget") {
			commands.push(line);
			appState.mode = "command";
		}
		else {
			currentNoteState.content = line.trim();
			appState.mode = "command";
		}
	}
	else if (mode === "tags") {
		if (normalized === ""){
			mutableOutput.write("Write non-empty tags or ");
			style(mutableOutput).bold().cyan().write("forget");
			mutableOutput.write(".\r\n");
		}
		else if (normalized === "forget") {
			commands.push(line);
			appState.mode = "command";
		}
		else {
			currentNoteState.tags = line.trim();
			appState.mode = "command";
		}
	}
	else if (mode === "gist-token") {
		currentBackend.dataLayer.setGistToken(line);
		appState.mode = "command";
		mutableOutput.unmute();
		style(mutableOutput).grey().write("# gist token saved. mode = command\r\n");
	}
	else if (mode === "gist-name") {
		currentBackend.dataLayer.setGistName(line);
		appState.mode = "command";
		style(mutableOutput).grey().write("# gist name saved. mode = command\r\n");
	}
	else if (mode === "records" 
			 || mode === "thoughts"
			 || mode === "browse"
			 || mode === "loading"
			 || mode === "saving") {
		//nothing
	}
	else {
		beep(currentBackend.stdout);
	}
};

const backToCommands = (currentBackend, appState) => {
	//this thing clears irrelevant input from stdin
	//yet it will be saved in built-in readline history
	currentBackend.writeAsUser("\n");

	currentBackend.mutableOutput.unmute();
	render(appState.terminalSize, appState.commands, currentBackend.mutableOutput);
	showCursor(currentBackend.mutableOutput);
	showCursor(currentBackend.mutableOutput);
	appState.mode = "command";
}

const keyListener = function(currentBackend, appState, exitCallback, s, key) {
	let browseRenderData = appState.browseRenderData;
	let thoughtsRenderData = appState.thoughtsRenderData;
	let recordsRenderData = appState.recordsRenderData;
	let terminalSize = appState.terminalSize;
	let mutableOutput = currentBackend.mutableOutput;
	let mode = appState.mode;

	if ((mode !== "records" 
			&& mode !== "thoughts"
			&& mode !== "browse") 
		&& key && key.name === "escape"
		&& exitCallback) {
		exitCallback();
	}

	//to get cursor position
	if (key && key.code === "[R") {
		mutableOutput.write(JSON.stringify(key.sequence) +"\r\n");
	}

	if (mode === "records") {
		if (key.name === "escape" || key.name === "q") {
			backToCommands(currentBackend, appState);
		}
		else if (key.name === "down") {
			if ((recordsRenderData.viewStartLine + terminalSize.height) < (recordsRenderData.lines.length)) {
				recordsRenderData.viewStartLine += 1;

				renderData(terminalSize, recordsRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
		else if (key.name === "up") {
			if (recordsRenderData.viewStartLine > 0) {
				recordsRenderData.viewStartLine -= 1;

				renderData(terminalSize, recordsRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
	}
	else if (mode === "thoughts") {
		if (key.name === "escape" || key.name === "q") {
			backToCommands(currentBackend, appState);
		}
		else if (key.name === "down") {
			if (thoughtsRenderData.previousExists()) {
				thoughtsRenderData.index -=1;
				thoughtsRenderData.setIndex(thoughtsRenderData.index);

				renderData(terminalSize, thoughtsRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
		else if (key.name === "up") {
			if (thoughtsRenderData.nextExists()) {
				thoughtsRenderData.index +=1;
				thoughtsRenderData.setIndex(thoughtsRenderData.index);

				renderData(terminalSize, thoughtsRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
		else if (key.name === "return" && (new Date() - appState.inputStartDate) > 100) {
			appState.noteIndex = thoughtsRenderData.index;
			appState.currentNoteState = appState.records[appState.noteIndex];

			backToCommands(currentBackend, appState)
		}
	}
	else if (mode === "browse") {
		if (key.name === "escape" || key.name === "q") {
			backToCommands(currentBackend, appState);
		}
		else if (key.name === "down") {
			if (browseRenderData.hasPreviousTaggedNote()) {
				browseRenderData.setTaggedNoteIndex(browseRenderData.indexPosition-1);

				renderDataWithNavigateTags(terminalSize, browseRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
		else if (key.name === "up") {
			if (browseRenderData.hasNextTaggedNote()) {
				browseRenderData.setTaggedNoteIndex(browseRenderData.indexPosition+1);

				renderDataWithNavigateTags(terminalSize, browseRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
		else if (key.name === "left") {
			if (browseRenderData.hasPreviousTag()) {
				browseRenderData.setNavigateTagIndex(browseRenderData.navigateTagIndex-1);
				renderDataWithNavigateTags(terminalSize, browseRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
		else if (key.name === "right") {
			if (browseRenderData.hasNextTag()) {
				browseRenderData.setNavigateTagIndex(browseRenderData.navigateTagIndex+1);

				renderDataWithNavigateTags(terminalSize, browseRenderData, mutableOutput);
			}
			else {
				beep(currentBackend.stdout)
			}
		}
		else if (key.name === "return" && (new Date() - appState.inputStartDate) > 100) {
			appState.noteIndex = browseRenderData.index;
			appState.currentNoteState = appState.records[appState.noteIndex];

			backToCommands(currentBackend, appState)
		}
	}
};

//there is a hidden puzzle here
//When you resize window... 
//How to keep *same* line on the top of the screen?
const resizeListener = function(currentBackend, appState) {
	let browseRenderData = appState.browseRenderData;
	let thoughtsRenderData = appState.thoughtsRenderData;
	let commands = appState.commands;
	let recordsRenderData = appState.recordsRenderData;
	let mode = appState.mode;
	let terminalSize = currentBackend.getTerminalSize();
	let mutableOutput = currentBackend.mutableOutput;
	appState.terminalSize = terminalSize;

	if (mode === "records") {
		recordsRenderData.lines =
			prepareLines(appState.records, terminalSize.width);
		let renderFrom = recordsRenderData.lines.length - terminalSize.height;
		recordsRenderData.viewStartLine = renderFrom >= 0 ? renderFrom : 0;

		renderData(terminalSize, recordsRenderData, mutableOutput);
	}
	if (mode === "thoughts") {
		thoughtsRenderData.cachedThoughtsLines =
			prepareThoughts(appState.records, terminalSize.width);
		thoughtsRenderData.setIndex(thoughtsRenderData.index);

		renderData(terminalSize, thoughtsRenderData, mutableOutput);
	}
	else if (mode === "browse") {
		browseRenderData.cachedThoughtsLines =
			prepareThoughts(appState.records, terminalSize.width, "noTags");
		browseRenderData.setTaggedNoteIndex(browseRenderData.indexPosition);

		renderDataWithNavigateTags(terminalSize, browseRenderData, mutableOutput);
	}
	else {
		render(terminalSize, commands, mutableOutput);
	}
};

const getLineListener = (backend, appState) => {
	return lineListener.bind(null, backend, appState);
}
const getKeyListener = (backend, appState, exitCallback) => {
	return keyListener.bind(null, backend, appState, exitCallback);
}
const getResizeListener = (backend, appState) => {
	return resizeListener.bind(null, backend, appState);
}

export {
	getLineListener,
	getKeyListener,
	getResizeListener
};