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
		if (input[i].tags) {
			thought += "\n\n"+input[i].tags;
		}

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

const buildBrowseIndex = (input) => {
	let index = {};

	let toSort = [];

	for (let i = 0; i < input.length; i++) {
		toSort.push({
			"toCompare": input[i].date,
			"index": i
		});
	}

	const sortByDateASC = (first, second) => {
		if (second.toCompare < first.toCompare) {
			return 1;
		}
		else if (second.toCompare > first.toCompare) {
			return -1;
		}
		else {
			if (second.index < first.index) {
				return 1;
			}
			else if (second.index > first.index) {
				return -1;
			}
			else {
				return 0;
			}
		}
	}

	let sortedByDate = toSort.sort(sortByDateASC);
	index["date"] = sortedByDate.map(e => e.index);

	return index;
}

module.exports = {
	prepareLines,
	prepareThoughts,
	buildBrowseIndex
}