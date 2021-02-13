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


	let result = {
		rl: rl,
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
		isMacOs: process.platform === "darwin"
	};

	return result;
}

export default getRealTerminalBackend;