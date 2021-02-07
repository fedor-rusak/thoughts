const {clearScreen, moveCursor, style} = require("./vt100-sequences");

const renderComplexLine = (input, out) => {
	for (let i = 0; i < input.length; i++) {
		let piece = input[i];

		if (piece.text) {
			let styled = style(out);
			if (piece.color === "grey") {
				styled = styled.grey();
			}
			styled.write(piece.text);
		}
		else {
			out.write(piece);
		}
	}
}

const renderLineElement = (element, out) => {
	if (Array.isArray(element)) {
		renderComplexLine(element, out);
	}
	else {
		out.write(element);
	}
}

const render = (terminalSize, lines, out, noNewLineForLastLine) => {
	if (lines.length === 0) {
		clearScreen(out);
		moveCursor(1,1, out);
	}
	else {
		clearScreen(out);
		moveCursor(1,1, out);

		for (let i = 0; i < lines.length-1; i++) {
			renderLineElement(lines[i], out);
			out.write("\n");
		}

		let lastLine = lines[lines.length-1];

		renderLineElement(lastLine, out);
		if (!noNewLineForLastLine) {
			out.write("\n");
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

const renderDataWithTags = (terminalSize, renderData, mutableOut) => {
	let lines = renderData.lines;
	let from = renderData.viewStartLine;
	var part = lines.slice(from, from+terminalSize.height);

	mutableOut.unmute();
	render(terminalSize, part, mutableOut, "noNewLineForLastLine");

	mutableOut.write("\n\n");
	style(mutableOut).green().write("date");
	mutableOut.mute()
}

module.exports = {
	render,
	renderData,
	renderDataWithTags
}