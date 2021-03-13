'use strict';

import {
    moveCursor,
    deleteLine,
    cursorUp,
    scrollTextUpper
} from '../lib/vt100-sequences.js';
import {readGistAsync, writeGistAsync} from '../lib/gist-helpers.js';

const getMutableStream = (writeable) => {
    let muted = false;

    return {
        mute: () => { muted = true; },
        unmute: () => { muted = false; },
        write: (data) => {
            if (!muted) { writeable.write(data) }
        }
    }
}

const getKeyEvent = (key) => {
    const keyEvent = {name: key};

    if (key === '\u001b') {
        keyEvent.name = 'escape';
    }
    else if (key === '\u001b[A') {
        keyEvent.name = 'up';
    }
    else if (key === '\u001b[B') {
        keyEvent.name = 'down';
    }
    else if (key === '\u001b[C') {
        keyEvent.name = 'right';
    }
    else if (key === '\u001b[D') {
        keyEvent.name = 'left';
    }
    else if (key === '\r') {
        keyEvent.name = 'return';
    }
    else if (key === ' ') {
        keyEvent.name = 'space';
    }

    return keyEvent;
}

const stopDomEventPropagation = (event) => {
    event.stopPropagation();
    event.preventDefault();
}

const moveLeft = (backend, index) => {
    const width = backend.stdout.cols;

    if (((index + 1) % width) === 0) {
        const alternate = backend.stdout.buffer.alternate;
        //works because xterm API returns starting from 0 while
        //vt100 sequence starts from 1
        const resultY = alternate.cursorY;
        moveCursor(width, resultY, backend.mutableOutput);
    }
    else {
        backend.mutableOutput.write('\u001b[D');
    }
}

const moveRight = (backend, bufferState, writeAsUserBugWTF) => {
    const index = bufferState.index;
    const width = backend.stdout.cols;
    const height = backend.stdout.rows;

    //in case of move right that goes to a new line with empty element
    if ((index % width) === 0) {
        const alternate = backend.stdout.buffer.alternate;
        let resultY = alternate.cursorY + 2;
        //when happens near bottom
        if (resultY > height) {
            scrollTextUpper(1, backend.mutableOutput);
            resultY = height;
        }
        if (writeAsUserBugWTF) {
            //cursor does not match position on screen
            resultY += Math.floor(bufferState.data.length / width);
        }
        moveCursor(0, resultY, backend.mutableOutput);
    }
    else {
        backend.mutableOutput.write('\u001b[C');
    }
}

//this code handles redraw for parts of data in case of paste,
//backspace and insert in the middle of data.
//it also keeps hacks for working around alternate buffer scrolling
//when you type close to bottom
const redrawInputPart = (backend, bufferState) => {
    const oldIndex = bufferState.oldIndex;
    const alternate = backend.stdout.buffer.alternate;
    const height = backend.stdout.rows;
    const width = backend.stdout.cols;
    const startCursorY = alternate.cursorY;

    //hack to support backspace
    // that leads cursor to previous line end
    let backspaceFix = 0;
    if ((oldIndex > bufferState.index) && ((oldIndex % width) === 0)) {
        backspaceFix = 1;
    }

    //this is a way to handle backspace and insert and redraw of only
    //affected substring
    const smallestIndex =
        bufferState.oldIndex > bufferState.index
            ? bufferState.index
            : bufferState.oldIndex;
    const indexForSubstring = Math.floor(smallestIndex / width) * width;
    const data = bufferState.data.substring(indexForSubstring);
    //first we clean possibly broken buffer lines
    const count = Math.floor(data.length / width) + 1;
    deleteLine(count, backend.mutableOutput);
    //then we calculate cursor position after insert
    //xterm API gives it like it starts from 0
    //while vt100 sequences assume it starts from 1
    const cursorX = bufferState.index % width + 1;
    let cursorY = startCursorY + 1 - backspaceFix;
    //set cursor in the beginning of current line
    moveCursor(0, cursorY, backend.mutableOutput);
    //render line
    backend.mutableOutput.write(data);
    //calculate final line
    cursorY += Math.ceil(data.length / width) - 1 - backspaceFix;
    //set cursor to final position
    moveCursor(cursorX, cursorY, backend.mutableOutput);


    //this is a fix for pasting at the end of input
    //if it ends in a way that cursor should be in the beginning of
    // a new line. This code handles autoscroll effect.
    const newLinesAfterOldIndex =
        Math.floor((bufferState.data.length - oldIndex + (oldIndex % width)) / width);
    const scrolledLines = (startCursorY + 1 + newLinesAfterOldIndex) - height;
    const indexJump = bufferState.index - oldIndex;

    if ((bufferState.index === bufferState.data.length) &&
        (indexJump > 0) &&
        ((bufferState.index % width) === 0) &&
        (scrolledLines > 0)) {
        scrollTextUpper(1, backend.mutableOutput);
    }

    //this code moves cursor up to match the edited line
    const newLinesAfterCurrentIndex =
        Math.ceil((bufferState.data.length - bufferState.index + (bufferState.index % width)) / width) - 1;
    const cursorUps = newLinesAfterCurrentIndex - backspaceFix;

    if (cursorUps > 0) {
        cursorUp(cursorUps, backend.mutableOutput);
    }
}

const initialKeyCallback = (backend, bufferState, appState, event) => {
    const key = event.key;
    const domEvent = event.domEvent;

    if (key === '\u0000') {
        //it is triggered on language change on android
    }
    else if (domEvent.key === 'ArrowRight' && domEvent.altKey === true) {
        //this is alt+left which is move one word left
        console.log('alt+right');
        stopDomEventPropagation(domEvent);
    }
    else if (domEvent.key === 'ArrowLeft' && domEvent.altKey === true) {
        //this is alt+left which is move one word left
        console.log('alt+left');
        stopDomEventPropagation(domEvent);
    }
    else if (key === '\u001b[C') {
        //right without modifiers
        stopDomEventPropagation(domEvent);
        if (bufferState.index < bufferState.data.length) {
            bufferState.index += 1;
            moveRight(backend, bufferState);
        }
    }
    else if (key === '\u001b[D') {
        //left without modifiers
        stopDomEventPropagation(domEvent);
        if (bufferState.index > 0) {
            bufferState.index -= 1;
            moveLeft(backend, bufferState.index);
        }
    }
    else if (domEvent.key === 'ArrowUp' || domEvent.key === 'ArrowDown' ||
            domEvent.key === 'ArrowLeft' || domEvent.key === 'ArrowRight') {
        //these are arrow keys with modifiers (probably)
        stopDomEventPropagation(domEvent);
    }
    else if (key === '\u007f') {
        //backspace
        if (bufferState.index === bufferState.data.length &&
            bufferState.index > 0) {
            const data = bufferState.data;
            bufferState.data = data.substring(0, data.length - 1);
            bufferState.index -= 1;
            moveLeft(backend, bufferState.index);
            //delete character
            backend.mutableOutput.write('\u001b[1P');
        }
        else if (bufferState.index > 0) {
            const data = bufferState.data;
            const index = bufferState.index;
            bufferState.data =
                data.substring(0, index - 1) +
                data.substring(index);
            bufferState.oldIndex = bufferState.index;
            bufferState.index -= 1;
            redrawInputPart(backend, bufferState);
        }
    }
    // else if (key === '\u001b') {
    //     //escape
    // }
    else if (key === '\r') {
        backend.mutableOutput.write('\r');
        //workaround for enter when cursor in the middle of multi-line
        //TO-DO sometimes works poorly when multi-line near bottom
        const cursorLine = Math.floor(bufferState.index / backend.stdout.cols);
        const linesInInput = Math.floor(bufferState.data.length / backend.stdout.cols);
        const count = linesInInput - cursorLine;
        for (let i = 0; i < count + 1; i++) {
            backend.mutableOutput.write('\n');
        }
    }
    else if (appState.mode !== 'browse' &&
            appState.mode !== 'records' &&
            appState.mode !== 'thoughts' &&
            appState.mode !== 'search' &&
            appState.mode !== 'search-results') {
        if (bufferState.index === bufferState.data.length) {
            bufferState.data += key;
            bufferState.index += 1;
            backend.mutableOutput.write(key);

            if ((bufferState.index % backend.stdout.cols === 0) &&
                bufferState.index >= backend.stdout.cols) {
                moveRight(backend, bufferState);
            }
        }
        else {
            const data = bufferState.data;
            bufferState.data =
                data.substring(0, bufferState.index) +
                key +
                data.substring(bufferState.index);
            bufferState.oldIndex = bufferState.index;
            bufferState.index += 1;
            //redraw for input part needed with cursor position saving
            redrawInputPart(backend, bufferState);
        }
    }
}

const specializedCallbackChainKeyListener =
    (bufferState, callbackChain, backend, appState, event) => {
        const key = event.key;

        let goLine = false;
        let goKey = false;

        if (callbackChain.initial) {
            callbackChain.initial(backend, bufferState, appState, event);

            if (key === '\r') {
                if (appState.mode !== 'thoughts' &&
                    appState.mode !== 'records' &&
                    appState.mode !== 'browse' &&
                    appState.mode !== 'search' &&
                    appState.mode !== 'search-results') {
                    goLine = true;
                }
                else {
                    goKey = true;
                }
            }
            if (key === 'q' || key === 'й' || key === '\u001b' ||
                key === '\u001b[A' || key === '\u001b[B' ||
                key === '\u001b[C' || key === '\u001b[D') {
                goKey = true;
            }
            if (key === ' ' && appState.mode === 'search') {
                goKey = true;
            }
        }

        if (goLine) {
            const receivedLine = bufferState.data;
            //this looks weird but it is intentional
            //because writeAsUser can modify
            //bufferState.data during onLine callback
            bufferState.data = '';
            bufferState.index = 0;
            if (callbackChain.onLine) {
                callbackChain.onLine(receivedLine);
            }
        }
        else if (goKey && callbackChain.onKey) {
            const keyEvent = getKeyEvent(key);
            callbackChain.onKey(key, keyEvent);
        }
    };

/**
 * Request to Github Gist service
 * @param {string} [name] - Description field value of gist
 *
 * @return {Promise<string>} - Response text
 */
const request = (method, path, token, name, data) => {
    const nameIsWrong =
        name === null || name === undefined || name === '';
    const methodIsModification = method === 'POST' || method === 'PATCH';
    if (nameIsWrong && methodIsModification) {
        return Promise.reject(new Error('gist-name is wrong'));
    }

    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open(method, 'https://api.github.com' + path);
        xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
        xhr.setRequestHeader('Authorization', 'token ' + token);

        xhr.onreadystatechange = function () {
            if (this.readyState !== 4) return;

            if (this.status === 200 || this.status === 201) {
                resolve(xhr.responseText);
            }
            else {
                reject(this.status);
            }
        };
        if (method === 'POST' || method === 'PATCH') {
            const dataToSend = {
                description: name,
                files: {
                    'data.json': {
                        content: data
                    }
                }
            }
            xhr.send(JSON.stringify(dataToSend, null, 4));
        }
        else {
            xhr.send();
        }
    });
}

const xhrGet = (path, callback) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', path);

    xhr.onreadystatechange = function () {
        if (this.readyState !== 4) return;

        if (this.status === 200) {
            callback(null, xhr.responseText);
        }
        else {
            callback(this.status);
        }
    };

    xhr.send();
}

const getBrowserBackend = (appState) => {
    const term = new Terminal({
        rows: 10,
        theme: {
            background: '#EEE',
            foreground: '#000',
            cursor: '#777',
            selection: '#888'
        },
        bellStyle: 'sound'
    });
    const fitAddon = new FitAddon.FitAddon()
    term.loadAddon(fitAddon);
    term.setOption('fontSize', 20);
    term.open(document.getElementById('terminal'));
    const mutableOutput = getMutableStream(term);
    fitAddon.fit();


    //work in progress
    //problem is that in terminal world of nodeJS
    //we handle stdout keypress and readline line events
    //as separate things. But in browser it is handled by
    //terminal key listener
    const callbackChain = {
        initial: initialKeyCallback, //this one should should imitate readline buffer state editing
        onLine: undefined, //this one as by readline
        onKey: undefined //this one as stdout on keypress
    }

    const bufferState = {
        data: '', //data
        index: 0
    }

    let hackFlag = false;
    const russianLetters = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

    term.attachCustomKeyEventHandler(
        (event) => {
            bufferState.isData = false;
            if (event.keyCode === 86 &&
                (event.metaKey === true || event.ctrlKey === true)) {
                bufferState.isData = true;
                //TO-DO why?
                return false;
            }

            if (hackFlag === false && event.type === 'keyup' && event.keyCode === 229) {
                hackFlag = true;
            }

            if (hackFlag && event.type === 'keyup' && russianLetters.indexOf(event.key) !== -1) {
                initialKeyCallback({stdout: term, mutableOutput}, bufferState, appState, {key: event.key, domEvent: {}});

                if (event.key === 'й' && callbackChain.onKey) {
                    const keyEvent = getKeyEvent(event.key);
                    callbackChain.onKey(event.key, keyEvent);
                }
            }

            return true;
        }
    )

    term.onData((possiblyPaste) => {
        if (bufferState.isData) {
            const data = bufferState.data;
            bufferState.data =
                data.substring(0, bufferState.index) +
                possiblyPaste +
                data.substring(bufferState.index);
            bufferState.oldIndex = bufferState.index;
            bufferState.index += possiblyPaste.length;
            redrawInputPart({stdout: term, mutableOutput}, bufferState);
        }
    });

    term.onKey(
        specializedCallbackChainKeyListener.bind(
            null,
            bufferState, callbackChain,
            {stdout: term, mutableOutput}, appState
        )
    );

    const dataLayer = {
        mode: 'gist'
    }

    dataLayer.readBundledData = (path, callback) => {
        xhrGet('../' + path, callback);
    };
    dataLayer.readFile = (path, callback) => {
        setTimeout(() => { callback(new Error('Not supported!')); }, 0);
    };
    dataLayer.writeFile = (path, data, callback) => {
        setTimeout(() => { callback(new Error('Not supported!')); }, 0);
    };
    dataLayer.readData = (callback) => {
        if (dataLayer.mode === 'gist') {
            readGistAsync(request, dataLayer, callback);
        }
        else {
            setTimeout(() => { callback(new Error('Not supported!')); }, 0);
        }
    };
    dataLayer.writeData = (data, callback) => {
        if (dataLayer.mode === 'gist') {
            writeGistAsync(request, dataLayer, data, callback);
        }
        else {
            setTimeout(() => { callback(new Error('Not supported!')); }, 0);
        }
    };
    dataLayer.isFile = (path) => {
        throw new Error('Not supported!');
    };
    dataLayer.useGist = () => {
        dataLayer.mode = 'gist';
    };
    dataLayer.useFs = () => {
        throw new Error('Not supported');
    };
    dataLayer.setGistName = (gistName) => {
        dataLayer.gistName = gistName;
    };
    dataLayer.setGistToken = (gistToken) => {
        dataLayer.gistToken = gistToken;
    }
    dataLayer.setDataFilePath = (filePath) => {
        throw new Error('Not supported!');
    }

    const result = {
        dataLayer: dataLayer,
        stdout: term,
        mutableOutput: mutableOutput,
        getTerminalSize: () => {
            return {
                width: term.cols,
                height: term.rows
            };
        },
        writeAsUser: (text, keyEvent) => {
            bufferState.data = text;
            bufferState.index = text.length;
            //this is a hack for some terminal behavior
            if (text === '\n') {
                bufferState.data = '';
                bufferState.index = 0;
            }
            term.write(text);
            //another hack
            if ((bufferState.index % term.cols === 0) &&
                bufferState.index >= term.cols) {
                moveRight({stdout: term, mutableOutput}, bufferState, 'wtf');
            }
        },
        onLine: (callback) => {
            callbackChain.onLine = callback;
        },
        onClose: (callback) => {
            //hmmm
        },
        onResize: (callback) => {
            //to-do
        },
        onKey: (callback) => {
            callbackChain.onKey = callback;
        },
        isWindows: false,
        isMacOs: false,
        isBrowser: true
    }

    return result;
}

export default getBrowserBackend;