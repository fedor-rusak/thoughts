import fs from 'fs';
import https from 'https';
import readline from 'readline';
import MuteStream from './mute-stream.js';

const request = (method, url, token, name, data) => {
	let nameIsWrong = 
		name === null || name === undefined || name === "";
	let methodIsModification = method === "POST" || method === "PATCH";
	if (nameIsWrong && methodIsModification) {
		return Promise.reject("gist-name is wrong");
	}

	return new Promise((resolve, reject) => {
			let urlNoProtocol = url.replace("https://", "");
			let firstSlashIndex = urlNoProtocol.indexOf("/");
			let hostname = urlNoProtocol.substring(0, firstSlashIndex);
			let path = urlNoProtocol.substring(firstSlashIndex);
			const options = {
				method: method,
				hostname: hostname,
				path: path,
				headers: {
		          	'Accept': 'application/vnd.github.v3+json',
					'Authorization': 'token '+token,
					'User-Agent': 'Please make sure your request has a User-Agent header (http://developer.github.com/v3/#user-agent-required).'
		      }
			};

			let req = https.request(options, (res) => {
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


			if (method === "POST" || method === "PATCH") {
				let dataToSend = {
					description: name,
					files: {
						"data.json": {
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
	let stdout = process.stdout;
	let stdin = process.stdin;
	let mutableOutput = new MuteStream();
	mutableOutput.pipe(stdout);

	const rl = readline.createInterface({
		input: stdin,
		output: mutableOutput,
		prompt: "",
		//history disabled because random input from browse, records
		//viewing is automatically added and there is no way to control
		//this behavior
		historySize: 0
	});

	let dataLayer = {
		"mode": "fs"
	};

	dataLayer.readFileSync = (path) => {
		return fs.readFileSync(path);
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
		if (dataLayer.mode === "fs") {
			fs.readFile(dataLayer.dataFilePath, callback);
		}
		else if (dataLayer.mode === "gist") {
			request("GET",
					"https://api.github.com/gists",
					dataLayer.gistToken
			).then(
				(allGists) => {
					let gistId = "";
					allGists = JSON.parse(allGists);

					for (let i = 0; i < allGists.length; i++) {
						let gist = allGists[i];
						if (gist.public === true) {
							continue
						}
						if (gist.description === dataLayer.gistName) {
							gistId = gist.id;
							break;
						}
					}

					if (gistId === "") {
						return Promise.reject("Gist not found!");
					}
					else {
						return request("GET",
							"https://api.github.com/gists/"+gistId,
							dataLayer.gistToken
						);
					}
				}
			)
			.then((gistResponse) => {
				let response = JSON.parse(gistResponse);

				return Promise.resolve(response.files["data.json"].content);
			})
			.then((data)=>{callback(null, data);})
			.catch(callback);
		}
	};
	dataLayer.writeData = (data, callback) => {
		if (dataLayer.mode === "fs") {
			fs.writeFile(dataLayer.dataFilePath, data, callback);
		}
		else {
			request("GET",
					"https://api.github.com/gists",
					dataLayer.gistToken
			).then(
				(allGists) => {
					let gistId = "";
					allGists = JSON.parse(allGists);

					for (let i = 0; i < allGists.length; i++) {
						let gist = allGists[i];
						if (gist.public === true) {
							continue
						}
						if (gist.description === dataLayer.gistName) {
							gistId = gist.id;
							break;
						}
					}

					if (gistId === "") {
						return request(
							"POST",
							"https://api.github.com/gists",
							dataLayer.gistToken,
							dataLayer.gistName,
							data
						)
					}
					else {
						return request(
							"PATCH",
							"https://api.github.com/gists/"+gistId,
							dataLayer.gistToken,
							dataLayer.gistName,
							data
						)
					}
				}
			)
			.then((data)=>{callback(null, data);})
			.catch(callback);
		}
	};
	dataLayer.useGist = () => {
		dataLayer.mode = "gist";
	};
	dataLayer.useFs = () => {
		dataLayer.mode = "fs";
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

	let result = {
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
		isWindows: process.platform === "win32",
		isMacOs: process.platform === "darwin",
		isBrowser: false
	};

	return result;
}

export default getRealTerminalBackend;