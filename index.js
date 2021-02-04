const fs = require('fs');
const readline = require('readline');
const muteStream = require('mute-stream');


const prefix = String.fromCharCode(27);

const clearScreen = () => {
	return prefix+"[2J";
}

const setAlternativeBuffer = () => {
	process.stdout.write(prefix+"[?1049h");
}

const setMainBuffer = () => {
	process.stdout.write(prefix+"[?1049l");
}

const beepNow = () => {
	process.stdout.write('\x07');
}

const cursorToPreviousLine =() => {
	process.stdout.write(prefix+"[A");
}

const eraseLine = () => {
	process.stdout.write(prefix+"[K");
}

const hideCursor = () => {
	return prefix + '[?25l';
}
 
const showCursor = () => {
	return prefix + '[?25h';
}

const moveCursor = (element, row) => {
	return prefix + '[' + row + ";"+element+"H"	
}

//more at http://ascii-table.com/ansi-escape-sequences-vt-100.php
const style = (stream) => {
	let writeStream = stream;

	let	attributes = "";
	//semicolons used when MORE than one attribute is set
	let semicolonAwareAppend = (styleValue) => {
		//previous appended attribute must get semicolon
		attributes += attributes === "" ? "" : ";";
		attributes += styleValue;
	}

	let value = {
		bold: () => {
			semicolonAwareAppend("1");
			return value;
		},
		cyan: () => {
			semicolonAwareAppend("36");
			return value;
		},
		write: (text) => {
			writeStream.write(prefix+"["+attributes+"m"+text+prefix+"[0m");
		}
	}

	return value;
}


const render = (terminalSize, lines, out, noNewLineForLastLine) => {
	if (lines.length === 0) {
		out.write(clearScreen());
		out.write(moveCursor(1,1));
	}
	else {
		out.write(clearScreen());
		out.write(moveCursor(1,1));
		for (let i =0; i < lines.length;i++) {
			if ((i+1) === lines.length && noNewLineForLastLine) {
				out.write(lines[i]);
			}
			else {
				out.write(lines[i]+"\n");
			}
		}	
	}
}

const renderData = (terminalSize, renderData, out) => {
	let lines = renderData.lines;
	let from = renderData.viewStartLine;
	var part = lines.slice(from, from+terminalSize.height);

	render(terminalSize, part, out, "noNewLineForLastLine");
}


const prepareLines = (input, terminalWidth) => {
	let temp = JSON.stringify(input, null, 4).split("\n");

	let result = [];
	for (let i = 0; i < temp.length; i++) {
		let parts = Math.floor(temp[i].length/terminalWidth)+1;

		for (let j = 0; j < parts; j++) {
			result.push(temp[i].substr(j*terminalWidth, terminalWidth));
		}
	}

	return result;
}

const prepareThoughts =(input, terminalWidth) => {
	let result = [];
	for (let i = 0; i < input.length; i++) {
		let thought = 
			new Date(Date.parse(input[i].date)).toUTCString()
			+"\n\n"+input[i].title +"\n\n"+input[i].content;

		let temp = thought.split("\n")

		let thoughtLines = [];
		for (let j = 0; j < temp.length; j++) {
			let parts = Math.floor(temp[j].length/terminalWidth)+1;

			for (let k = 0; k < parts; k++) {
				let line = temp[j].substr(k*terminalWidth, terminalWidth);
				thoughtLines.push(line);
			}
		}

		result.push(thoughtLines);
	}

	return result;
}

setAlternativeBuffer();
process.stdout.write(showCursor())


const terminalSize = {
	width: process.stdout.columns,
	height: process.stdout.rows
}

const mutableOutput = new muteStream();
mutableOutput.pipe(process.stdout);

const rl = readline.createInterface({
  input: process.stdin,
  output: mutableOutput,
  prompt:""
});


let commands = [];
let records = [];

let recordsRenderData = {
	lines: [],
	viewStartLine: 0
}


const getThoughtsRenderData = () => {
	let value = {
		lines: [],
		viewStartLine: 0,
		index: -1,
		cachedThoughtsLines: []
	};

	let helpers = {
		previousExists: () => {
			return (value.index - 1) >= 0
		},
		nextExists: () => {
			return (value.index +1) < value.cachedThoughtsLines.length;
		}
	}

	for (const [name, helper] of Object.entries(helpers)) {
		value[name] = helper;
	}

	return value;
}
let thoughtsRenderData = getThoughtsRenderData()

let mode = "command"; //title, content
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
			rl.write(prefix + "[6n");
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
			mutableOutput.write(hideCursor());
			renderData(terminalSize, recordsRenderData, mutableOutput);
			mutableOutput.mute();
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
				thoughtsRenderData.index = 0;
				thoughtsRenderData.lines = thoughtsRenderData.cachedThoughtsLines[0];
				mutableOutput.write(hideCursor());
				renderData(terminalSize, thoughtsRenderData, mutableOutput);
				mutableOutput.mute();
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
			beepNow()
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
		beepNow();
	}
})


const exit = () => {setMainBuffer(); process.exit();}


rl.on('close', exit);


process.stdin.on('keypress', (s, key) => {
	if (mode === "command" && key && key.name === "escape") {
		exit();
	}

	//to get position data
	if (key && key.code === "[R") {
		mutableOutput.write(JSON.stringify(key.sequence) +"\n");
	}

	if (mode === "records") {
		if (key.name === "escape" || key.name === "q") {
			rl.write("\n");//this thing clears irrelevant input from stdin
			mutableOutput.unmute();
			render(terminalSize, commands, mutableOutput);
			mutableOutput.write(showCursor())
			mode = "command";
		}
		else if (key.name === "down") {
			if ((recordsRenderData.viewStartLine + terminalSize.height) < (recordsRenderData.lines.length)) {
				mutableOutput.unmute();
				recordsRenderData.viewStartLine += 1;
				renderData(terminalSize, recordsRenderData, mutableOutput);
				mutableOutput.mute();
			}
			else {
				beepNow()
			}
		}
		else if (key.name === "up") {
			if (recordsRenderData.viewStartLine >0) {
				mutableOutput.unmute();
				recordsRenderData.viewStartLine -= 1;
				renderData(terminalSize, recordsRenderData, mutableOutput);
				mutableOutput.mute();
			}
			else {
				beepNow()
			}
		}
	}
	else if (mode === "thoughts") {
		if (key.name === "escape" || key.name === "q") {
			rl.write("\n");//this thing clears irrelevant input from stdin
			mutableOutput.unmute();
			render(terminalSize, commands, mutableOutput);
			mutableOutput.write(showCursor())
			mode = "command";
		}
		else if (key.name === "down") {
			if ((thoughtsRenderData.viewStartLine + terminalSize.height) < (thoughtsRenderData.lines.length)) {
				mutableOutput.unmute();
				thoughtsRenderData.viewStartLine += 1;
				renderData(terminalSize, thoughtsRenderData, mutableOutput);
				mutableOutput.mute();
			}
			else {
				beepNow()
			}
		}
		else if (key.name === "up") {
			if (thoughtsRenderData.viewStartLine >0) {
				thoughtsRenderData.viewStartLine -= 1;
				mutableOutput.unmute();
				renderData(terminalSize, thoughtsRenderData, mutableOutput);
				mutableOutput.mute();
			}
			else {
				beepNow()
			}
		}
		else if (key.name === "left") {
			if (thoughtsRenderData.previousExists()) {
				thoughtsRenderData.index -=1;
				thoughtsRenderData.viewStartLine = 0;
				thoughtsRenderData.lines =
					thoughtsRenderData.cachedThoughtsLines[thoughtsRenderData.index];
				mutableOutput.unmute();
				renderData(terminalSize, thoughtsRenderData, mutableOutput);
				mutableOutput.mute();
			}
			else {
				beepNow()
			}
		}
		else if (key.name === "right") {
			if (thoughtsRenderData.nextExists()) {
				thoughtsRenderData.index +=1;
				thoughtsRenderData.viewStartLine = 0;
				thoughtsRenderData.lines =
					thoughtsRenderData.cachedThoughtsLines[thoughtsRenderData.index];
				mutableOutput.unmute();
				renderData(terminalSize, thoughtsRenderData, mutableOutput);
				mutableOutput.mute();
			}
			else {
				beepNow()
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
		recordsRenderData.lines = prepareLines(records, terminalSize.width)
		let renderFrom = recordsRenderData.lines.length - terminalSize.height;
		recordsRenderData.viewStartLine = renderFrom >= 0 ? renderFrom : 0;
		mutableOutput.unmute();
		renderData(terminalSize, recordsRenderData, mutableOutput);
		mutableOutput.mute();
	}
	if (mode === "thoughts") {
		thoughtsRenderData.cachedThoughtsLines =
			prepareThoughts(records, terminalSize.width)
		thoughtsRenderData.viewStartLine = 0;
		thoughtsRenderData.index = 0;
		thoughtsRenderData.lines = thoughtsRenderData.cachedThoughtsLines[0];

		mutableOutput.unmute();
		renderData(terminalSize, thoughtsRenderData, mutableOutput);
		mutableOutput.mute();
	}
	else {
		render(terminalSize, commands, mutableOutput);
	}
});