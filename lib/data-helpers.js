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

const prepareThoughts = (input, terminalWidth, noTags) => {
	let result = [];
	for (let i = 0; i < input.length; i++) {
		let thought = 
			new Date(Date.parse(input[i].date)).toUTCString()
			+"\n\n"+input[i].title +"\n\n"+input[i].content;

		if (input[i].tags && !noTags) {
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

const buildBrowseIndex = (input) => {
	let cachedTags = [];
	for (let i = 0; i < input.length; i++) {
		let tags = ["date"];

		let inputTags = input[i].tags || "";
		inputTags = inputTags.trim()

		if (inputTags.length > 0) {
			let tagArray = inputTags.split(",");
			for (let j = 0; j < tagArray.length; j++) {
				let tag = tagArray[j].trim().toLowerCase();
				if (tag.length > 0 && tags.indexOf(tag) === -1) {
					//it is not empty string or duplicate!
					tags.push(tag);
				}
			}
		}

		cachedTags.push(tags);
	}


	let index = {};

	let toSort = [];

	for (let i = 0; i < input.length; i++) {
		toSort.push({
			"toCompare": input[i].date,
			"index": i
		});
	}


	let sortedByDate = toSort.sort(sortByDateASC);
	sortedByDate = sortedByDate.map(e => e.index);
	index["date"] = sortedByDate;

	for (let i = 0; i < sortedByDate.length; i++) {
		let recordsIndex = sortedByDate[i];
		let tags = cachedTags[recordsIndex];

		for (let j = 1; j < tags.length; j++) {
			let tag = tags[j];
			let tagIndex = index[tag];
			if (!tagIndex) {
				tagIndex = [];
				index[tag] = tagIndex;
			}

			tagIndex.push(recordsIndex);
		}
	}

	return {
		index,
		cachedTags
	}
}

module.exports = {
	prepareLines,
	prepareThoughts,
	buildBrowseIndex
}