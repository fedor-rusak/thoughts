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
		tagForOrdering: "date",
		internalIndex: {}
	};

	return value;
}

module.exports = {
	getThoughtsRenderData,
	getBrowseRenderData
}