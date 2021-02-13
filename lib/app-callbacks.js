"use strict";
import fs from 'fs';
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

	const dataFilePath = appState.dataFilePath;
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
			render(terminalSize, commands, mutableOutput);
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
			toPrint = JSON.stringify(currentNoteState, null, 4)+"\n";
		}
		else if (normalized === "push") {
			if (currentNoteState.title === undefined) {
				mutableOutput.write("Title can't be empty"+"\n");
			}
			else if (currentNoteState.content === undefined) {
				mutableOutput.write("Content can't be empty"+"\n");
			}
			else if (currentNoteState.date === undefined) {
				mutableOutput.write("Date can't be empty"+"\n");
			}
			else if (appState.noteIndex !== -1) {
				mutableOutput.write("You have to ");
				style(mutableOutput).bold().cyan().write("drop");
				mutableOutput.write(" current not or create ");
				style(mutableOutput).bold().cyan().write("new");
				mutableOutput.write(" before pushing.\n");
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
				mutableOutput.write("No thoughts to remember now.\n")
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
			fs.writeFileSync(dataFilePath, JSON.stringify(appState.records, null, 4));
			result = "Success"
		}
		else if (normalized === "load") {
			try {
				appState.records = JSON.parse(fs.readFileSync(dataFilePath));
				result = "Success"
			}
			catch (e) {
				result = "Failed";
			}
		}
		else if (normalized === "new") {
			appState.currentNoteState = {};
			appState.noteIndex = -1;
			result = "State clear. mode = command"
		}
		else if (normalized === "drop") {
			if (appState.noteIndex === -1) {
				mutableOutput.write("None of existing thoughts was chosen."+"\n");
			}
			else {
				appState.records.splice(noteIndex, 1);
				appState.currentNoteState = {};
				appState.noteIndex = -1;
				result = "Note dropped. mode = command"
			}
		}
		else if (normalized === "browse") {
			if (appState.records.length === 0) {
				mutableOutput.write("No thoughts to browse now.\n")
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
			result = "Welcome and have a nice day!\n"+
				"# Multiple commands are supported by thoughts:\n"+
				"#    development-thoughts - thoughts I got while developing this app\n"+
				"#    browse  - use arrows to navigate. Esq or q to exit.\n"+
				"#    records - see data in JSON format\n"+
				"#    new     - start new note\n"+
				"#    title   - write title\n"+
				"#    content - write content\n"+
				"#    tags    - write tags\n"+
				"#    now     - set current date\n"+
				"#    push    - add current note to records\n"+
				"#    save    - save records in default file\n"+
				"#    load    - load records from default file\n"+
				"#    clear   - get empty screen";
		}
		else if (normalized === "development-thoughts") {
			try {
				appState.records = JSON.parse(fs.readFileSync("./lib/development-thoughts.json"));
				result = "Successfully load test records"
			}
			catch (e) {
				result = "Failed to load test records";
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
			style(mutableOutput).grey().write(resultText+"\n");
			commands.push([line, {color: "grey", text: resultText}]);
		}

		//this is needed to print command results like # Success
		//and sometimes like state right in buffer
		if (toPrint !== "") {
			if (asUser) {
				currentBackend.writeAsUser(toPrint);//whitespace+backpace triggers redrawing of input
				
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
			mutableOutput.write(".\n");
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
			mutableOutput.write(".\n");
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
	else if (mode === "records" || mode === "thoughts" || mode === "browse") {
		//nothing
	}
	else {
		beep(currentBackend.stdout);
	}
};

const backToCommands = (currentBackend, appState) => {
	currentBackend.mutableOutput.unmute();
	render(appState.terminalSize, appState.commands, currentBackend.mutableOutput);
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
		mutableOutput.write(JSON.stringify(key.sequence) +"\n");
	}

	if (mode === "records") {
		if (key.name === "escape" || key.name === "q") {
			//this thing clears irrelevant input from stdin
			//yet it will be saved in built-in readline history
			currentBackend.writeAsUser("\n");

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
			//this thing clears irrelevant input from stdin
			//yet it will be saved in built-in readline history
			currentBackend.writeAsUser("\n");

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
			//this thing clears irrelevant input from stdin
			//yet it will be saved in built-in readline history
			currentBackend.writeAsUser("\n");

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