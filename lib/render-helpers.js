import {clearScreen, moveCursor, style} from './vt100-sequences.js';

import {getSearchResultsLines} from './data-helpers.js';

const renderComplexLine = (input, out) => {
    for (let i = 0; i < input.length; i++) {
        const piece = input[i];

        if (piece.text) {
            let styled = style(out);
            if (piece.color === 'grey') {
                styled = styled.grey();
            }
            else if (piece.color === 'green') {
                styled = styled.green();
            }
            else if (piece.color === 'cyan') {
                styled = styled.cyan();
            }
            else if (piece.color === 'white') {
                styled = styled.white();
            }
            else if (piece.color === 'black') {
                styled = styled.black();
            }
            if (piece.bgColor === 'grey') {
                styled = styled.bgGrey();
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


const renderLines = (terminalSize, lines, out, noNewLineForLastLine) => {
    for (let i = 0; i < lines.length - 1; i++) {
        renderLineElement(lines[i], out);
        out.write('\r\n');
    }

    const lastLine = lines[lines.length - 1];

    renderLineElement(lastLine, out);
    if (!noNewLineForLastLine) {
        out.write('\r\n');
    }
}

const render = (terminalSize, lines, out, noNewLineForLastLine) => {
    if (lines.length === 0) {
        clearScreen(out);
        moveCursor(1, 1, out);
    }
    else {
        clearScreen(out);
        moveCursor(1, 1, out);

        renderLines(terminalSize, lines, out, noNewLineForLastLine);
    }
}

const renderData = (terminalSize, renderData, mutableOut) => {
    const lines = renderData.lines;
    const from = renderData.viewStartLine;
    const part = lines.slice(from, from + terminalSize.height);

    mutableOut.unmute();
    render(terminalSize, part, mutableOut, 'noNewLineForLastLine');
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

const renderDataWithNavigateTags = (terminalSize, renderData, mutableOut) => {
    const lines = renderData.lines;
    const from = renderData.viewStartLine;
    const part = lines.slice(from, from + terminalSize.height);

    mutableOut.unmute();
    render(terminalSize, part, mutableOut, 'noNewLineForLastLine');

    const tags = renderData.cachedTags[renderData.index];
    const navigateTag = renderData.navigateTag;

    mutableOut.write('\r\n\n');

    for (let i = 0; i < tags.length; i++) {
        if (i !== 0) {
            mutableOut.write(', ');
        }

        printColoredIfChosen(mutableOut, tags[i], navigateTag);
    }

    mutableOut.mute()
}

const space = (times) => {
    return ' '.repeat(times);
}

const renderSearchData = (terminalSize, records, searchRenderData, mutableOut) => {
    const {
        uniqueTags,
        index,
        renderingOffset,
        maxRows,
        numberOfColumns,
        columnWidth,
        leftPadding,
        chosenTags,
        searchResults,
        cachedThoughtsLines
    } = searchRenderData;

    mutableOut.unmute();

    clearScreen(mutableOut);
    moveCursor(1, 1, mutableOut);

    mutableOut.write('Enter to scroll results. Spacebar to toggle tag:' + '\r\n\n');

    for (let i = renderingOffset; (i < (maxRows + renderingOffset)) && (i < uniqueTags.length); i++) {
        let tag = uniqueTags[i];
        const line = [leftPadding];

        let bgColor = 'default'
        let color = 'default';
        if (index === i) {
            bgColor = 'grey';
            color = 'black'
        }
        if (chosenTags.indexOf(i) !== -1) {
            color = 'green';
        }

        line.push({text: tag, color, bgColor});
        line.push(space(columnWidth - tag.length));
        for (let j = 1; ((j * maxRows + i) < uniqueTags.length) && (j < numberOfColumns); j++) {
            const tagIndex = j * maxRows + i;
            tag = uniqueTags[tagIndex];

            bgColor = 'default'
            color = 'default';
            if (index === tagIndex) {
                bgColor = 'grey';
                color = 'black'
            }
            if (chosenTags.indexOf(tagIndex) !== -1) {
                color = 'green';
            }

            line.push({text: tag, color, bgColor});
            line.push(space(columnWidth - tag.length));
        }
        line.push('\r\n');
        renderComplexLine(line, mutableOut);
    }

    mutableOut.write('\r\nChosen tags:' + '\r\n\n  ');
    let chosen = 'none'
    if (chosenTags.length > 0) {
        chosen = uniqueTags[chosenTags[0]];
        for (let i = 1; i < chosenTags.length; i++) {
            chosen += ', ' + uniqueTags[chosenTags[i]];
        }
    }
    mutableOut.write(chosen);

    mutableOut.write('\r\n\nSearch results:' + '\r\n\n');
    if (searchResults.length > 0) {
        const tagRows = uniqueTags.length < maxRows
            ? uniqueTags.length
            : maxRows;
        const alreadyPrintedLines = 2 + tagRows + 3 +
            (Math.ceil(chosen.length / terminalSize.width)) + 3;

        const toRender = getSearchResultsLines(searchResults, cachedThoughtsLines);

        const part = toRender.slice(0, terminalSize.height - alreadyPrintedLines);

        renderLines(terminalSize, part, mutableOut, 'noNewLineForLastLine');
    }
    else {
        mutableOut.write('  none');
    }

    mutableOut.mute();
}

const renderSearchResultsData = (terminalSize, records, searchRenderData, mutableOut) => {
    const {
        uniqueTags,
        chosenTags,
        searchResults,
        cachedThoughtsLines,
        scrollPosition
    } = searchRenderData;

    mutableOut.unmute();

    clearScreen(mutableOut);
    moveCursor(1, 1, mutableOut);

    mutableOut.write('ESQ or q to go back to search tags. UP and DOWN to scroll.' + '\r\n\n');

    mutableOut.write('Chosen tags:' + '\r\n\n  ');
    let chosen = uniqueTags[chosenTags[0]];
    for (let i = 1; i < chosenTags.length; i++) {
        chosen += ', ' + uniqueTags[chosenTags[i]];
    }
    mutableOut.write(chosen);

    mutableOut.write('\r\n\nSearch results:' + '\r\n\n');

    const alreadyPrintedLines = 2 + 2 +
        (Math.ceil(chosen.length / terminalSize.width)) + 3;

    const toRender = getSearchResultsLines(searchResults, cachedThoughtsLines);

    const part = toRender.slice(scrollPosition, scrollPosition + terminalSize.height - alreadyPrintedLines);

    renderLines(terminalSize, part, mutableOut, 'noNewLineForLastLine');

    mutableOut.mute();
}

export {
    render,
    renderData,
    renderDataWithNavigateTags,
    renderSearchData,
    renderSearchResultsData
}