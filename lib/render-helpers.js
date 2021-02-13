import {clearScreen, moveCursor, style} from "./vt100-sequences.js";

const renderComplexLine = (input, out) => {
	for (let i = 0; i < input.length; i++) {
		let piece = input[i];

		if (piece.text) {
			let styled = style(out);
			if (piece.color === "grey") {
				styled = styled.grey();
			}
			else if (piece.color === "cyan") {
				styled = styled.cyan();
			}
			if (piece.bold) {
				styled = styled.bold();
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
			out.write("\r\n");
		}

		let lastLine = lines[lines.length-1];

		renderLineElement(lastLine, out);
		if (!noNewLineForLastLine) {
			out.write("\r\n");
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

const printColoredIfChosen = (mutableOut, value, chosen) => {
	if (value === chosen) {
		style(mutableOut).green().write(value);
	}
	else {
		mutableOut.write(value);
	}
}

const renderDataWithNavigateTags = 
	(terminalSize, renderData, mutableOut) => {
	let lines = renderData.lines;
	let from = renderData.viewStartLine;
	var part = lines.slice(from, from+terminalSize.height);

	mutableOut.unmute();
	render(terminalSize, part, mutableOut, "noNewLineForLastLine");

	let tags = renderData.cachedTags[renderData.index];
	let navigateTag = renderData.navigateTag;

	mutableOut.write("\r\n\n");
	
	for (let i = 0; i < tags.length; i++) {
		if (i !== 0) {
			mutableOut.write(", ");
		}

		printColoredIfChosen(mutableOut, tags[i], navigateTag);
	}

	mutableOut.mute()
}

export {
	render,
	renderData,
	renderDataWithNavigateTags
}