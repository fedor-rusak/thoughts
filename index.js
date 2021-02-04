const fs = require('fs');
const readline = require('readline');
const muteStream = require('mute-stream');
const {
	setAlternativeBuffer,
	setMainBuffer,
	beep,
	hideCursor,
	showCursor,
	style
} = require("./lib/vt100-sequences");
const {getThoughtsRenderData} = require("./lib/render-data");
const {prepareLines, prepareThoughts} = require("./lib/data-helpers");
const {render, renderData} = require("./lib/render-helpers");


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

let thoughtsRenderData = getThoughtsRenderData()

let mode = "command"; //title, content, records, thoughts
let state = {};
let SAVE_FILE_PATH = './data.json';

rl.on('line', (line) => {
	let normalized = line.trim().toLowerCase();

	if (mode === "command") {
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
		}
		else if (normalized === 'content') {
			mode = "content";
			rl.write(state.content || "")
		}
		else if (normalized === 'state') {
			mutableOutput.write(JSON.stringify(state, null, 4)+"\n");
		}
		else if (normalized === "now") {
			state.date = new Date().toISOString();
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
			else {
				records.push(state);
				state = {};
			}
		}
		else if (normalized === "records") {
			mode = "records";
			recordsRenderData.lines = prepareLines(records, terminalSize.width);
			let renderFrom = recordsRenderData.lines.length - terminalSize.height;
			recordsRenderData.viewStartLine = renderFrom >= 0 ? renderFrom : 0;
			hideCursor(mutableOutput);
			renderData(terminalSize, recordsRenderData, mutableOutput);
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
			}
		}
		else if (normalized === "save") {
			fs.writeFileSync(SAVE_FILE_PATH, JSON.stringify(records, null, 4));
		}
		else if (normalized === "load") {
			try {
				records = JSON.parse(fs.readFileSync(SAVE_FILE_PATH));
			}
			catch (e) {
				mutableOutput.write("Failed."+"\n");
			}
		}
		else {
			beep(mutableOutput)
			// mutableOutput.write(JSON.stringify(line)+"\n"); //nice debug option
		}
		commands.push(line)
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
			mutableOutput.write("Write non-empty title or ");
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
	else if (mode === "records" || mode === "thoughts") {
		//nothing
	}
	else {
		beep(process.stdout);
	}
})


const exit = () => {setMainBuffer(process.stdout); process.exit();}


rl.on('close', exit);


process.stdin.on('keypress', (s, key) => {
	if (mode === "command" && key && key.name === "escape") {
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

			mutableOutput.unmute();
			render(terminalSize, commands, mutableOutput);
			showCursor(mutableOutput);
			mode = "command";
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

			mutableOutput.unmute();
			render(terminalSize, commands, mutableOutput);
			showCursor(mutableOutput);
			mode = "command";
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
			if (thoughtsRenderData.viewStartLine >0) {
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
		
	}
});


//there is a hidden puzzle here
//When you resize window... 
//How to keep *same* part of records line on the top of the screen?
process.stdout.on('resize', () => {
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
	else {
		render(terminalSize, commands, mutableOutput);
	}
});