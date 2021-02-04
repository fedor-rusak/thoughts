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

const prepareThoughts = (input, terminalWidth) => {
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

module.exports = {
	prepareLines,
	prepareThoughts
}