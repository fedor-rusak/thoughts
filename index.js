const fs = require('fs');
const readline = require('readline');

const prefix = String.fromCharCode(27);
const setAlternativeBuffer = () => {
	process.stdout.write(prefix+"[?1049h");
}

const setMainBuffer = () => {
	process.stdout.write(String.fromCharCode(27)+"[?1049l");
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
  return prefix + '?25l'
}

const showCursor = () => {
  return prefix + '?25h'
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
showCursor();


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


let records = [];
let mode = "command"; //title, content
let state = {};
let SAVE_FILE_PATH = './data.json';
rl.on('line', (line) => {
	let normalized = line.trim().toLowerCase();

	if (mode === "command") {
		if (normalized === 'clear') {
			console.clear()
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
			cursorToPreviousLine()
			eraseLine();
		}
		else if (normalized === "push") {
			if (state.title === undefined) {
				console.log("Title can't be empty");
				return
			}
			else if (state.content === undefined) {
				console.log("Content can't be empty");
				return
			}
			else if (state.date === undefined) {
				console.log("Date can't be empty");
				return
			}
			else {
				records.push(state);
				state = {};
			}
		}
		else if (normalized === "records") {
			console.log(JSON.stringify(records, null, 4));
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

//for upcoming feature
// process.stdin.on('keypress', (s, key) => {console.log(s, key)});