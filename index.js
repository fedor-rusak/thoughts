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


setAlternativeBuffer();
const terminalSize = {
	width: process.stdout.columns,
	height: process.stdout.rows
}
// process.stdout.write(hideCursor())
// process.stdout.write(moveCursor(1, terminalSize.height));
// style().cyan().write("*** command mode ***");
// process.stdout.write(moveCursor(1, 1));


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
				console.log(lines[i]);
			}
		}	
	}
}

const renderSubArray = (terminalSize, lines, out, from) => {
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


const mutableOutput = new muteStream();
mutableOutput.pipe(process.stdout);

const rl = readline.createInterface({
  input: process.stdin,
  output: mutableOutput,
  prompt:""
});


let bufferLines = [];
let records = [];
let recordsLines = [];
let mode = "command"; //title, content
let state = {};
let SAVE_FILE_PATH = './data.json';
let viewStartLine = -1; //currently for records command
rl.on('line', (line) => {
	let normalized = line.trim().toLowerCase();

	if (mode === "command") {
		if (normalized === 'clear') {
			bufferLines = [];
			render(terminalSize, bufferLines, process.stdout);
		}
		else if (normalized === "position") {
			//it will be caught by keypress in async flow
			rl.write(prefix + "[6n");
		}
		else if (normalized === 'title') {
			mode = "title";
		}
		else if (normalized === 'content') {
			mode = "content";
		}
		else if (normalized === 'state') {
			console.log(JSON.stringify(state));
		}
		else if (normalized === "now") {
			state.date = new Date().toISOString();
		}
		else if (normalized === "push") {
			if (state.title === undefined) {
				console.log("Title can't be empty");
			}
			else if (state.content === undefined) {
				console.log("Content can't be empty");
			}
			else if (state.date === undefined) {
				console.log("Date can't be empty");
			}
			else {
				records.push(state);
				state = {};
			}
		}
		else if (normalized === "records") {
			mode = "records";
			recordsLines = prepareLines(records, terminalSize.width);
			mutableOutput.write(hideCursor());
			let renderFrom = recordsLines.length - terminalSize.height;//because ends with newline
			viewStartLine = renderFrom >= 0 ? renderFrom : 0;
			renderSubArray(terminalSize, recordsLines, mutableOutput, viewStartLine);

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
				console.log("Failed.");
			}
		}
		else {
			beepNow()
		}
		bufferLines.push(line)
	}
	else if (mode === "title") {
		if (normalized === ""){
			rl.write("Write non-empty title or ");
			style().bold().cyan().write("forget");
			rl.write(".\n");
		}
		else if (normalized === "forget") {
			mode = "command";
		}
		else {
			state.title = line.trim();
			mode = "command";
		}
	}
	else if (mode === "content") {
		if(normalized === "") {
			console.log("Write non-empty content or forget.");
		}
		else if (normalized === "forget") {
			mode = "command";
		}
		else {
			state.content = line.trim();
			mode = "command";
		}
	}
	else {
		beepNow();
	}
})

rl.on('close', () => {setMainBuffer(); process.exit();});

//this is required to get cursor position
let ignoreKeypress = true;
process.stdin.on('keypress', (s, key) => {
	if (!ignoreKeypress) {
		console.log(s, key)
	}

	if (mode === "records") {
		if (key.name === "escape") {
			mode = "command";
			mutableOutput.unmute();
			mutableOutput.write(showCursor())
			render(terminalSize, bufferLines, mutableOutput);
		}
		else if (key.name === "down") {
			if ((viewStartLine + terminalSize.height) < (recordsLines.length)) {
				mutableOutput.unmute();
				viewStartLine += 1;
				renderSubArray(terminalSize, recordsLines, mutableOutput, viewStartLine);
				mutableOutput.mute();
			}
			else {
				beepNow()
			}
		}
		else if (key.name === "up") {
			if (viewStartLine >0) {
				mutableOutput.unmute();
				viewStartLine -= 1;
				renderSubArray(terminalSize, recordsLines, mutableOutput, viewStartLine);
				mutableOutput.mute();
			}
			else {
				beepNow()
			}
		}
	}
});

process.stdout.on('resize', () => {
  // console.log('screen size has changed!');
  // console.log(`${process.stdout.columns}x${process.stdout.rows}`);
});