const getBrowseRenderData = () => {
    const value = {
        lines: [],
        viewStartLine: 0,
        index: 0,
        cachedThoughtsLines: [],
        indexPosition: 0,
        navigateTag: 'date',
        navigateTagIndex: 0,
        internalIndex: {}
    };

    const helpers = {
        prepareThoughtsAndIndex: function (records, terminalWidth) {
            this.cachedThoughtsLines =
                prepareThoughts(records, terminalWidth, 'noTags');
            const browseIndex = buildBrowseIndex(records);
            this.internalIndex = browseIndex.index;
            this.cachedTags = browseIndex.cachedTags;
        },
        hasNextTag: function () {
            const tags = this.cachedTags[this.index];
            return this.navigateTagIndex < (tags.length - 1);
        },
        hasPreviousTag: function () {
            return this.navigateTagIndex > 0;
        },
        setNavigateTagIndex: function (navigateTagIndex) {
            this.navigateTagIndex = navigateTagIndex;
            this.navigateTag =
                this.cachedTags[this.index][navigateTagIndex];
            this.indexPosition =
                this.internalIndex[this.navigateTag].indexOf(this.index);
        },
        hasNextTaggedNote: function () {
            const newIndexPosition = this.indexPosition + 1;
            const tagSortIndex = this.internalIndex[this.navigateTag];
            return newIndexPosition < tagSortIndex.length;
        },
        hasPreviousTaggedNote: function () {
            return this.indexPosition > 0;
        },
        setTaggedNoteIndex: function (newIndexPosition) {
            this.indexPosition = newIndexPosition;
            const tagSortIndex = this.internalIndex[this.navigateTag];
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
    const value = {
        lines: [],
        viewStartLine: 0,
        index: 0,
        cachedThoughtsLines: []
    };

    const helpers = {
        previousExists: function () {
            return (this.index - 1) >= 0
        },
        nextExists: function () {
            return (this.index + 1) < this.cachedThoughtsLines.length;
        },
        setIndex: function (index) {
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

const getSearchData = (records) => {
    const uniqueTags = [];

    const {index, cachedTags} = buildBrowseIndex(records);

    const reversedIndex = {};
    let maxTagLength = 0;

    for (let i = 0; i < index.date.length; i++) {
        const recordsIndex = index.date[i];
        const tags = cachedTags[recordsIndex];

        for (let j = 1; j < tags.length; j++) {
            const tag = tags[j];
            if (uniqueTags.indexOf(tag) === -1) {
                uniqueTags.push(tag);
            }

            if (reversedIndex[tag] === undefined) {
                reversedIndex[tag] = [];
                if (maxTagLength < tag.length) {
                    maxTagLength = tag.length;
                }
            }

            reversedIndex[tag].push(recordsIndex);
        }
    }

    const result = {
        uniqueTags: uniqueTags.sort(),
        reversedIndex,
        maxTagLength
    };

    return result;
}

const getSearchResults = (uniqueTags, selectedTags, reversedIndex) => {
    let result = [];

    if (selectedTags.length === 0) {
        return result;
    }

    result = [].concat(reversedIndex[uniqueTags[selectedTags[0]]]);
    for (let i = 1; i < selectedTags.length; i++) {
        const tag = uniqueTags[selectedTags[i]];

        result = reversedIndex[tag].filter(index => result.indexOf(index) !== -1);
    }

    return result;
}

const getSearchResultsLines = (thoughtsIndices, cachedThoughtsLines) => {
    let toRender = [];

    for (let i = 0; i < thoughtsIndices.length; i++) {
        const resultIndex = thoughtsIndices[i];
        const thought = cachedThoughtsLines[resultIndex];
        toRender = toRender.concat(thought);
        if (i !== thoughtsIndices.length - 1) {
            toRender = toRender.concat(['']); //to force new line between notes
        }
    }

    return toRender;
}

const getSearchRenderData = () => {
    const result = {
        index: -1,
        renderingOffset: 0,
        maxRows: 5,
        numberOfColumns: -1,
        leftPadding: '  ',
        distance: 3, //spaces between columns of tags
        chosenTags: [],
        searchResults: [],
        scrollPosition: 0,
        terminalSize: {}
    };

    const helpers = {
        prepare: function (terminalSize, records) {
            this.terminalSize = terminalSize;
            const {uniqueTags, reversedIndex, maxTagLength} =
                getSearchData(records);
            this.uniqueTags = uniqueTags;
            this.reversedIndex = reversedIndex;
            this.maxTagLength = maxTagLength;
            this.numberOfColumns =
                Math.floor((terminalSize.width - this.leftPadding.length) / (maxTagLength + this.distance));
            this.columnWidth = maxTagLength + this.distance;

            this.cachedThoughtsLines =
                prepareThoughts(records, terminalSize.width, 'noTags');

            this.searchResults =
                getSearchResults(uniqueTags, this.chosenTags, reversedIndex);
        },
        chooseFirstTag: function () {
            this.index = 0;
            this.renderingOffset = 0;
        },
        clearChosenTags: function () {
            this.chosenTags = [];
            this.searchResults = [];
        },
        hasNextTag: function () {
            return this.index + 1 < this.uniqueTags.length;
        },
        hasPreviousTag: function () {
            return this.index - 1 >= 0;
        },
        chooseNext: function () {
            if (this.index + 1 < this.uniqueTags.length) {
                this.index += 1;
                if (this.index >= this.renderingOffset + this.numberOfColumns * this.maxRows) {
                    this.renderingOffset += this.maxRows;
                }
            }
        },
        choosePrevious: function () {
            if (this.index - 1 >= 0) {
                this.index -= 1;
                if (this.index < this.renderingOffset) {
                    this.renderingOffset -= this.maxRows;
                }
            }
        },
        toggleTag: function () {
            const indexOfCurrentTag =
                this.chosenTags.indexOf(this.index);
            if (indexOfCurrentTag !== -1) {
                //remove from chosen
                this.chosenTags.splice(indexOfCurrentTag, 1);
            }
            else {
                this.chosenTags.push(this.index);
            }

            this.searchResults =
                getSearchResults(this.uniqueTags, this.chosenTags, this.reversedIndex);
            this.scrollPosition = 0;
        },
        canScrollResultsDown: function () {
            let chosen = this.uniqueTags[this.chosenTags[0]];
            for (let i = 1; i < this.chosenTags.length; i++) {
                chosen += ', ' + this.uniqueTags[this.chosenTags[i]];
            }

            const alreadyPrintedLines = 2 + 2 +
                (Math.ceil(chosen.length / this.terminalSize.width)) + 3;
            let maxLines =
                getSearchResultsLines(this.searchResults, this.cachedThoughtsLines).length;
            maxLines -= this.terminalSize.height;
            maxLines += alreadyPrintedLines;

            return (this.scrollPosition + 1) <= maxLines;
        },
        scrollResultsDown: function () {
            this.scrollPosition += 1;
        },
        canScrollResultsUp: function () {
            return this.scrollPosition > 0;
        },
        scrollResultsUp: function () {
            this.scrollPosition -= 1;
        }
    };

    for (const [name, helper] of Object.entries(helpers)) {
        result[name] = helper.bind(result);
    }

    return result;
}

const createAppState = (opts) => {
    const result = {
        terminalSize: opts.terminalSize || {width: 80, height: 24},
        mode: 'command', //title, content, records, thoughts
        records: [],
        recordsRenderData: {
            lines: [],
            viewStartLine: 0
        },
        commands: opts.initialCommands ? [].concat(opts.initialCommands) : [],
        inputStartDate: new Date(),
        thoughtsRenderData: getThoughtsRenderData(),
        browseRenderData: getBrowseRenderData(),
        searchRenderData: getSearchRenderData(),
        currentNoteState: {},
        noteIndex: -1 //for edit feature
    };

    return result;
}


const prepareLines = (input, terminalWidth) => {
    const temp = JSON.stringify(input, null, 4).split('\n');

    const result = [];
    for (let i = 0; i < temp.length; i++) {
        const parts = Math.floor(temp[i].length / terminalWidth) + 1;

        for (let j = 0; j < parts; j++) {
            result.push(temp[i].substr(j * terminalWidth, terminalWidth));
        }
    }

    return result;
}

const prepareThoughts = (input, terminalWidth, noTags) => {
    const result = [];
    for (let i = 0; i < input.length; i++) {
        let thought =
            new Date(Date.parse(input[i].date)).toUTCString() +
            '\n\n' + input[i].title + '\n\n' + input[i].content;

        if (input[i].tags && !noTags) {
            thought += '\n\n' + input[i].tags;
        }

        const temp = thought.split('\n')

        const thoughtLines = [];
        for (let j = 0; j < temp.length; j++) {
            const parts = Math.floor(temp[j].length / terminalWidth) + 1;

            for (let k = 0; k < parts; k++) {
                const line = temp[j].substr(k * terminalWidth, terminalWidth);
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
    const cachedTags = [];
    for (let i = 0; i < input.length; i++) {
        const tags = ['date'];

        const inputTags = (input[i].tags || '').trim();

        if (inputTags.length > 0) {
            const tagArray = inputTags.split(',');
            for (let j = 0; j < tagArray.length; j++) {
                const tag = tagArray[j].trim().toLowerCase();
                if (tag.length > 0 && tags.indexOf(tag) === -1) {
                    //it is not empty string or duplicate!
                    tags.push(tag);
                }
            }
        }

        cachedTags.push(tags);
    }


    const index = {};

    const toSort = [];

    for (let i = 0; i < input.length; i++) {
        toSort.push({
            toCompare: input[i].date,
            index: i
        });
    }


    let sortedByDate = toSort.sort(sortByDateASC);
    sortedByDate = sortedByDate.map(e => e.index);
    index.date = sortedByDate;

    for (let i = 0; i < sortedByDate.length; i++) {
        const recordsIndex = sortedByDate[i];
        const tags = cachedTags[recordsIndex];

        for (let j = 1; j < tags.length; j++) {
            const tag = tags[j];
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
    getSearchResultsLines
}