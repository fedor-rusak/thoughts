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
		green: () => {
			semicolonAwareAppend("32");
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
	style
}