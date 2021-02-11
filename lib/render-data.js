const {prepareThoughts, buildBrowseIndex} = require("./data-helpers");

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
		}
	}

	for (const [name, helper] of Object.entries(helpers)) {
		value[name] = helper.bind(value);
	}

	return value;
}

module.exports = {
	getThoughtsRenderData,
	getBrowseRenderData
}