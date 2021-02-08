const prefix = String.fromCharCode(27);

const orRun = (sequence, out) => {
	if (out) {
		out.write(sequence)
	}
	else {
		return sequence;
	}
}

const clearScreen = (out) => {
	return orRun(prefix+"[2J", out);
}

const moveCursor = (element, row, out) => {
	return orRun(prefix + '[' + row + ";"+element+"H", out);
}

const setAlternativeBuffer = (out) => {
	return orRun(prefix+"[?1049h", out);
}

const setMainBuffer = (out) => {
	return orRun(prefix+"[?1049l", out);
}

const beep = (out) => {
	return orRun('\x07', out);
}

const hideCursor = (out) => {
	return orRun(prefix + '[?25l', out);
}

const showCursor = (out) => {
	return orRun(prefix + '[?25h', out);
}

const deletePreviousLine = (count, out) => {
	return orRun(cursorUp(count) + prefix + "["+(count || 1)+"M", out);
}

const cursorUp = (count, out) => {
	return orRun(prefix + "["+(count || 1)+"A", out);
}

const cursorDown = (count, out) => {
	return orRun(prefix + "["+(count || 1)+"B", out);
}

//more at 
//https://stackoverflow.com/questions/32523613/can-you-use-hex-color-values-with-vt100-escape-codes-c
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
		green: () => {
			semicolonAwareAppend("32");
			return value;
		},
		//can't be bold with this implementation
		grey: () => {
			attributes = "38;2;128;128;128";
			return value;
		},
		write: (text) => {
			writeStream.write(prefix+"["+attributes+"m"+text+prefix+"[0m");
		}
	}

	return value;
}

module.exports = {
	clearScreen,
	moveCursor,
	setAlternativeBuffer,
	setMainBuffer,
	beep,
	hideCursor,
	showCursor,
	deletePreviousLine,
	cursorUp,
	cursorDown,
	style
}