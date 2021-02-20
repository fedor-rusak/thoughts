import fs from 'fs';
import readline from 'readline';
import MuteStream from './mute-stream.js';

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
		else {
			setTimeout(()=>{callback("Not supported!")},0);
		}
	};
	dataLayer.writeData = (data, callback) => {
		if (dataLayer.mode === "fs") {
			fs.writeFile(dataLayer.dataFilePath, data, callback);
		}
		else {
			setTimeout(()=>{callback("Not supported!")},0);
		}
	};
	dataLayer.useGist = () => {
		throw new Error("Not supported");
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