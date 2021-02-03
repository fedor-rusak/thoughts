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
const style = () => {
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
			process.stdout.write(prefix+"["+attributes+"m"+text+prefix+"[0m");
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
				mutableOutput.write(lines[i]);
			}
			else {
				mutableOutput.write(lines[i]+"\n");
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

let mode = "command"; //title, content
let state = {};
let SAVE_FILE_PATH = './data.json';

rl.on('line', (line) => {
	let normalized = line.trim().toLowerCase();

	if (mode === "command") {
		if (normalized === 'clear') {
			commands = [];
			render(terminalSize, commands, process.stdout);
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
			style().bold().cyan().write("forget");
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
			style().bold().cyan().write("forget");
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
	else if (mode === "records") {
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
	else {
		render(terminalSize, commands, mutableOutput);
	}
});