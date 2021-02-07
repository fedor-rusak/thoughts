const fs = require('fs');
const readline = require('readline');
const muteStream = require('mute-stream');
const {
	setAlternativeBuffer,
	setMainBuffer,
	beep,
	hideCursor,
	showCursor,
	deletePreviousLine,
	style
} = require("./lib/vt100-sequences");
const {
	getThoughtsRenderData,
	getBrowseRenderData
} = require("./lib/render-data");
const {prepareLines, prepareThoughts, buildBrowseIndex} = require("./lib/data-helpers");
const {render, renderData, renderDataWithTags} = require("./lib/render-helpers");


setAlternativeBuffer(process.stdout);
showCursor(process.stdout);


const terminalSize = {
	width: process.stdout.columns,
	height: process.stdout.rows
}

const mutableOutput = new muteStream();
mutableOutput.pipe(process.stdout);

const rl = readline.createInterface({
	input: process.stdin,
	output: mutableOutput,
	prompt: ""
});


let commands = [];
let records = [];

let recordsRenderData = {
	lines: [],
	viewStartLine: 0
}

let thoughtsRenderData = getThoughtsRenderData();

let browseRenderData = getBrowseRenderData();

let mode = "command"; //title, content, records, thoughts
let inputDelay = 300;
let inputStartDate = 0;
let noteIndex = -1; //for edit feature
let state = {};
let SAVE_FILE_PATH = './data.json';

const lineListener = (line) => {
	let normalized = line.trim().toLowerCase();

	if (mode === "command") {
		let result = "";
		if (normalized === 'clear') {
			commands = [];
			render(terminalSize, commands, mutableOutput);
		}
		else if (normalized === "position") {
			//it will be caught by keypress in async flow
			mutableOutput.write(prefix + "[6n");
		}
		else if (normalized === 'title') {
			mode = "title";
			rl.write(state.title || "")
			result = "mode = title"
		}
		else if (normalized === 'content') {
			mode = "content";
			rl.write(state.content || "")
			result = "mode = content";
		}
		else if (normalized === 'tags') {
			mode = "tags";
			rl.write(state.tags || "")
			result = "mode = tags";
		}
		else if (normalized === "now") {
			state.date = new Date().toISOString();
			result = "date set";
		}
		else if (normalized === 'state') {
			mutableOutput.write(JSON.stringify(state, null, 4)+"\n");
		}
		else if (normalized === "push") {
			if (state.title === undefined) {
				mutableOutput.write("Title can't be empty"+"\n");
			}
			else if (state.content === undefined) {
				mutableOutput.write("Content can't be empty"+"\n");
			}
			else if (state.date === undefined) {
				mutableOutput.write("Date can't be empty"+"\n");
			}
			else if (noteIndex !== -1) {
				mutableOutput.write("You have to ");
				style(mutableOutput).bold().cyan().write("drop");
				mutableOutput.write(" current not or create ");
				style(mutableOutput).bold().cyan().write("new");
				mutableOutput.write(" before pushing.\n");
			}
			else {
				records.push(state);
				state = {};
				result = "Note added to records"
			}
		}
		else if (normalized === "records") {
			mode = "records";
			recordsRenderData.lines = prepareLines(records, terminalSize.width);
			let renderFrom = recordsRenderData.lines.length - terminalSize.height;
			recordsRenderData.viewStartLine = renderFrom >= 0 ? renderFrom : 0;
			hideCursor(mutableOutput);
			renderData(terminalSize, recordsRenderData, mutableOutput);
			result = "Records over. mode = command"
		}
		else if (normalized === "thoughts") {
			if (records.length === 0) {
				mutableOutput.write("No thoughts to remember now.\n")
			}
			else {
				mode = "thoughts";
				thoughtsRenderData.cachedThoughtsLines =
					prepareThoughts(records, terminalSize.width);
				thoughtsRenderData.viewStartLine = 0;
				thoughtsRenderData.setIndex(0);
				hideCursor(mutableOutput);
				renderData(terminalSize, thoughtsRenderData, mutableOutput);
				inputStartDate = new Date();
				result = "Thoughts over. mode = command"
			}
		}
		else if (normalized === "save") {
			fs.writeFileSync(SAVE_FILE_PATH, JSON.stringify(records, null, 4));
			result = "Success"
		}
		else if (normalized === "load") {
			try {
				records = JSON.parse(fs.readFileSync(SAVE_FILE_PATH));
				result = "Success"
			}
			catch (e) {
				result = "Failed";
			}
		}
		else if (normalized === "new") {
			state = {};
			noteIndex = -1;
			result = "State clear. mode = command"
		}
		else if (normalized === "drop") {
			if (noteIndex === -1) {
				mutableOutput.write("None of existing thoughts was chosen."+"\n");
			}
			else {
				records.splice(noteIndex, 1);
				state = {};
				noteIndex = -1;
				result = "Note dropped. mode = command"
			}
		}
		else if (normalized === "browse") {
			if (records.length === 0) {
				mutableOutput.write("No thoughts to browse now.\n")
			}
			else {
				mode = "browse";
				browseRenderData.cachedThoughtsLines =
					prepareThoughts(records, terminalSize.width);
				browseRenderData.internalIndex = buildBrowseIndex(records);
				browseRenderData.tagForOrdering = "date";
				let firstThoughtOrderByDateASC = browseRenderData.internalIndex["date"][0];
				browseRenderData.index = firstThoughtOrderByDateASC;
				browseRenderData.indexPosition = 0;
				browseRenderData.lines =
					browseRenderData.cachedThoughtsLines[firstThoughtOrderByDateASC];

				hideCursor(mutableOutput);
				renderDataWithTags(terminalSize, browseRenderData, mutableOutput);
				result = "Browsing over. mode = command"
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
			deletePreviousLine(mutableOutput);
			mutableOutput.write(line);
			let resultText = " # "+result;
			style(mutableOutput).grey().write(resultText+"\n");
			commands.push([line, {color: "grey", text: resultText}]);
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
			mode = "command";
		}
		else {
			state.title = line.trim();
			mode = "command";
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
			mode = "command";
		}
		else {
			state.content = line.trim();
			mode = "command";
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
			mode = "command";
		}
		else {
			state.tags = line.trim();
			mode = "command";
		}
	}
	else if (mode === "records" || mode === "thoughts" || mode === "browse") {
		//nothing
	}
	else {
		beep(process.stdout);
	}
};

const exit = () => {setMainBuffer(process.stdout); process.exit();}

rl.on('line', lineListener);
rl.on('close', exit);


const backToCommands = () => {
	mutableOutput.unmute();
	render(terminalSize, commands, mutableOutput);
	showCursor(mutableOutput);
	mode = "command";
}

const keyPressListener = (s, key) => {
	if ((mode !== "records" 
			&& mode !== "thoughts"
			&& mode !== "browse") 
		&& key && key.name === "escape") {
		exit();
	}

	//to get cursor position
	if (key && key.code === "[R") {
		mutableOutput.write(JSON.stringify(key.sequence) +"\n");
	}

	if (mode === "records") {
		if (key.name === "escape" || key.name === "q") {
			//this thing clears irrelevant input from stdin
			//yet it will be saved in built-in readline history
			rl.write("\n");

			backToCommands();
		}
		else if (key.name === "down") {
			if ((recordsRenderData.viewStartLine + terminalSize.height) < (recordsRenderData.lines.length)) {
				recordsRenderData.viewStartLine += 1;

				renderData(terminalSize, recordsRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
		else if (key.name === "up") {
			if (recordsRenderData.viewStartLine > 0) {
				recordsRenderData.viewStartLine -= 1;

				renderData(terminalSize, recordsRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
	}
	else if (mode === "thoughts") {
		if (key.name === "escape" || key.name === "q") {
			//this thing clears irrelevant input from stdin
			//yet it will be saved in built-in readline history
			rl.write("\n");

			backToCommands();
		}
		else if (key.name === "down") {
			if ((thoughtsRenderData.viewStartLine + terminalSize.height) < (thoughtsRenderData.lines.length)) {
				thoughtsRenderData.viewStartLine += 1;

				renderData(terminalSize, thoughtsRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
		else if (key.name === "up") {
			if (thoughtsRenderData.viewStartLine > 0) {
				thoughtsRenderData.viewStartLine -= 1;

				renderData(terminalSize, thoughtsRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
		else if (key.name === "left") {
			if (thoughtsRenderData.previousExists()) {
				thoughtsRenderData.index -=1;
				thoughtsRenderData.setIndex(thoughtsRenderData.index);

				renderData(terminalSize, thoughtsRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
		else if (key.name === "right") {
			if (thoughtsRenderData.nextExists()) {
				thoughtsRenderData.index +=1;
				thoughtsRenderData.setIndex(thoughtsRenderData.index);

				renderData(terminalSize, thoughtsRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
		else if (key.name === "return" && (new Date() - inputStartDate) > 100) {
			noteIndex = thoughtsRenderData.index;
			state = records[noteIndex];

			backToCommands()
		}
	}
	else if (mode === "browse") {
		if (key.name === "escape" || key.name === "q") {
			//this thing clears irrelevant input from stdin
			//yet it will be saved in built-in readline history
			rl.write("\n");

			backToCommands();
		}
		else if (key.name === "down") {
			if ((browseRenderData.indexPosition - 1) >= 0) {
				browseRenderData.indexPosition -= 1;
				let tagSortIndex = 
					browseRenderData.internalIndex[browseRenderData.tagForOrdering];
				browseRenderData.index = tagSortIndex[browseRenderData.indexPosition];
				browseRenderData.lines = 
					browseRenderData.cachedThoughtsLines[browseRenderData.index];

				renderDataWithTags(terminalSize, browseRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
		else if (key.name === "up") {
			let newIndexPosition = browseRenderData.indexPosition + 1;
			let tagSortIndex = 
					browseRenderData.internalIndex[browseRenderData.tagForOrdering];

			if (newIndexPosition < tagSortIndex.length) {
				browseRenderData.indexPosition = newIndexPosition;
				browseRenderData.index = tagSortIndex[newIndexPosition];
				browseRenderData.lines = 
					browseRenderData.cachedThoughtsLines[browseRenderData.index];

				renderDataWithTags(terminalSize, browseRenderData, mutableOutput);
			}
			else {
				beep(process.stdout)
			}
		}
	}
};

process.stdin.on('keypress', keyPressListener);


//there is a hidden puzzle here
//When you resize window... 
//How to keep *same* part of records line on the top of the screen?
const resizeListener = () => {
	terminalSize.width = process.stdout.columns;
	terminalSize.height = process.stdout.rows;

	if (mode === "records") {
		recordsRenderData.lines =
			prepareLines(records, terminalSize.width);
		let renderFrom = recordsRenderData.lines.length - terminalSize.height;
		recordsRenderData.viewStartLine = renderFrom >= 0 ? renderFrom : 0;

		renderData(terminalSize, recordsRenderData, mutableOutput);
	}
	if (mode === "thoughts") {
		thoughtsRenderData.cachedThoughtsLines =
			prepareThoughts(records, terminalSize.width);
		thoughtsRenderData.setIndex(thoughtsRenderData.index);

		renderData(terminalSize, thoughtsRenderData, mutableOutput);
	}
	else if (mode === "browse") {
		browseRenderData.cachedThoughtsLines =
			prepareThoughts(records, terminalSize.width);
		let tagSortIndex = 
			browseRenderData.internalIndex[browseRenderData.tagForOrdering];
		browseRenderData.lines =
			browseRenderData.cachedThoughtsLines[tagSortIndex[browseRenderData.indexPosition]];

		renderDataWithTags(terminalSize, browseRenderData, mutableOutput);
	}
	else {
		render(terminalSize, commands, mutableOutput);
	}
};

process.stdout.on('resize', resizeListener);