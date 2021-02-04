const {clearScreen, moveCursor} = require("./vt100-sequences");

const render = (terminalSize, lines, out, noNewLineForLastLine) => {
	if (lines.length === 0) {
		clearScreen(out);
		moveCursor(1,1, out);
	}
	else {
		clearScreen(out);
		moveCursor(1,1, out);

		for (let i = 0; i < lines.length-1; i++) {
			out.write(lines[i]+"\n");
		}

		let lastLine = lines[lines.length-1];

		if (noNewLineForLastLine) {
			out.write(lastLine);
		}
		else {
			out.write(lastLine+"\n");
		}
	}
}

const renderData = (terminalSize, renderData, mutableOut) => {
	let lines = renderData.lines;
	let from = renderData.viewStartLine;
	var part = lines.slice(from, from+terminalSize.height);

	mutableOut.unmute();
	render(terminalSize, part, mutableOut, "noNewLineForLastLine");
	mutableOut.mute()
}

module.exports = {
	render,
	renderData
}