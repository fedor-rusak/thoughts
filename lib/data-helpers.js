const getBrowseRenderData = () => {
	let value = {
		lines: [],
		viewStartLine: 0,
		index: 0,
		cachedThoughtsLines: [],
		indexPosition: 0,
		navigateTag: "date",
		navigateTagIndex: 0,
		internalIndex: {}
	};

	let helpers = {
		prepareThoughtsAndIndex: function(records, terminalWidth) {
			this.cachedThoughtsLines =
				prepareThoughts(records, terminalWidth, "noTags");
			let browseIndex = buildBrowseIndex(records);
			this.internalIndex = browseIndex.index;
			this.cachedTags = browseIndex.cachedTags;
		},
		hasNextTag: function() {
			let tags = this.cachedTags[this.index];
			return this.navigateTagIndex < (tags.length-1);
		},
		hasPreviousTag: function() {
			return this.navigateTagIndex > 0;
		},
		setNavigateTagIndex: function(navigateTagIndex) {
			this.navigateTagIndex = navigateTagIndex;
			this.navigateTag =
				this.cachedTags[this.index][navigateTagIndex];
			this.indexPosition =
				this.internalIndex[this.navigateTag].indexOf(this.index);
		},
		hasNextTaggedNote: function() {
			let newIndexPosition = this.indexPosition + 1;
			let tagSortIndex = this.internalIndex[this.navigateTag];
			return newIndexPosition < tagSortIndex.length;
		},
		hasPreviousTaggedNote: function() {
			return this.indexPosition > 0;
		},
		setTaggedNoteIndex: function(newIndexPosition) {
			this.indexPosition = newIndexPosition;
			let tagSortIndex = this.internalIndex[this.navigateTag];
			this.index = tagSortIndex[newIndexPosition];
			this.lines = this.cachedThoughtsLines[this.index];
			this.navigateTagIndex =
				this.cachedTags[this.index].indexOf(this.navigateTag);
		}
	}

	for (const [name, helper] of Object.entries(helpers)) {
		value[name] = helper.bind(value);
	}

	return value;
}

const getThoughtsRenderData = () => {
	let value = {
		lines: [],
		viewStartLine: 0,
		index: 0,
		cachedThoughtsLines: []
	};

	let helpers = {
		previousExists: function() {
			return (this.index - 1) >= 0
		},
		nextExists: function() {
			return (this.index +1) < this.cachedThoughtsLines.length;
		},
		setIndex: function(index) {
			this.index = index;
			//we consider setIndex means change thought and we read them from beginning
			this.viewStartLine = 0;
			this.lines = this.cachedThoughtsLines[this.index];
		}
	}

	for (const [name, helper] of Object.entries(helpers)) {
		value[name] = helper.bind(value);
	}

	return value;
}

const createAppState = (opts) => {
	let result = {
		terminalSize:  opts.terminalSize || {width: 80, height: 24},
		mode: "command", //title, content, records, thoughts
		records: [],
		recordsRenderData: {
			lines: [],
			viewStartLine: 0
		},
		commands: opts.initialCommands ? [].concat(opts.initialCommands) : [],
		inputStartDate: new Date(),
		thoughtsRenderData: getThoughtsRenderData(),
		browseRenderData: getBrowseRenderData(),
		currentNoteState: {},
		noteIndex: -1 //for edit feature
	};

	return result;
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

export {
	createAppState,
	prepareLines,
	prepareThoughts,
	buildBrowseIndex
}