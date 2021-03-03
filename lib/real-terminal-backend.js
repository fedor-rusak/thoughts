import fs from 'fs';
import https from 'https';
import readline from 'readline';
import MuteStream from './mute-stream.js';
import {readGistAsync, writeGistAsync} from './gist-helpers.js';

const request = (method, path, token, name, data) => {
    const nameIsWrong =
        name === null || name === undefined || name === '';
    const methodIsModification = method === 'POST' || method === 'PATCH';
    if (nameIsWrong && methodIsModification) {
        return Promise.reject(new Error('gist-name is wrong'));
    }

    return new Promise(
        (resolve, reject) => {
            const options = {
                method: method,
                hostname: 'api.github.com',
                path: path,
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                    Authorization: 'token ' + token,
                    'User-Agent': 'Please make sure your request has a User-Agent header (http://developer.github.com/v3/#user-agent-required).'
                }
            };

            const req = https.request(options, (res) => {
                res.setEncoding('utf8');
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        resolve(data);
                    }
                    else {
                        reject(data);
                    }
                });
                res.on('error', (err) => {
                    reject(err);
                })
            });


            if (method === 'POST' || method === 'PATCH') {
                const dataToSend = {
                    description: name,
                    files: {
                        'data.json': {
                            content: data
                        }
                    }
                }
                req.write(JSON.stringify(dataToSend, null, 4));
            }

            req.end();
        }
    );
}

const getRealTerminalBackend = () => {
    const stdout = process.stdout;
    const stdin = process.stdin;
    const mutableOutput = new MuteStream();
    mutableOutput.pipe(stdout);

    const rl = readline.createInterface({
        input: stdin,
        output: mutableOutput,
        prompt: '',
        //history disabled because random input from browse, records
        //viewing is automatically added and there is no way to control
        //this behavior
        historySize: 0
    });

    const dataLayer = {
        mode: 'fs'
    };

    dataLayer.readBundledData = (path, callback) => {
        fs.readFile('./' + path, callback);
    };
    dataLayer.readFile = (path, callback) => {
        fs.readFile(path, callback);
    };
    dataLayer.writeFile = (path, data, callback) => {
        fs.writeFile(path, data, callback);
    };
    dataLayer.isFile = (path) => {
        return fs.lstatSync(path).isFile();
    };
    dataLayer.readData = (callback) => {
        if (dataLayer.mode === 'fs') {
            fs.readFile(dataLayer.dataFilePath, callback);
        }
        else if (dataLayer.mode === 'gist') {
            readGistAsync(request, dataLayer, callback)
        }
    };
    dataLayer.writeData = (data, callback) => {
        if (dataLayer.mode === 'fs') {
            fs.writeFile(dataLayer.dataFilePath, data, callback);
        }
        else {
            writeGistAsync(request, dataLayer, data, callback);
        }
    };
    dataLayer.useGist = () => {
        dataLayer.mode = 'gist';
    };
    dataLayer.useFs = () => {
        dataLayer.mode = 'fs';
    };
    dataLayer.setGistName = (gistName) => {
        dataLayer.gistName = gistName;
    };
    dataLayer.setGistToken = (gistToken) => {
        dataLayer.gistToken = gistToken;
    }
    dataLayer.setDataFilePath = (filePath) => {
        dataLayer.dataFilePath = filePath;
    }

    const result = {
        dataLayer: dataLayer,
        stdout: stdout,
        mutableOutput: mutableOutput,
        getTerminalSize: () => {
            return {
                width: stdout.columns,
                height: stdout.rows
            };
        },
        writeAsUser: (text, keyEvent) => {
            rl.write(text, keyEvent);
        },
        onLine: (callback) => {
            rl.on('line', callback);
        },
        onClose: (callback) => {
            rl.on('close', callback);
        },
        onResize: (callback) => {
            stdout.on('resize', callback);
        },
        onKey: (callback) => {
            stdin.on('keypress', callback);
        },
        isWindows: process.platform === 'win32',
        isMacOs: process.platform === 'darwin',
        isBrowser: false
    };

    return result;
}

export default getRealTerminalBackend;