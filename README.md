# thoughts
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Ever wanted to save your thoughts in some json file using CLI interface?

This is a small node app that tries to be vim-bash-like thing for simple notes. Yet interconnected thoughts!

Should work properly on Mac and Windows.

# How to start

It uses ES6 modules so you need modern NodeJS (>=14) to run this project.

```
node index.js <optional existing data file name>
```

# How to use

When you started (as of 2021 February 12) thoughts process :) you see:

```
# Data file: ./data.json
# when in doubt use help
```

You can enter any of these commands:

* clear - clears your screen from commands
* title - next input would be considered title for new note. And shows current title if exists.
* content - same as title but for content
* tags - for adding options tag information
* now - adds date to current note
* state - show your current note data on screen
* push - pushes (if no missing fields OR no thought was chosen) your note to internal list of records
* records - allows to look at current notes in technical format. Use arrows to navigate. ESC or q to exit.
* save - save records to file
* load - load records from file
* thoughts - nice style of visualizing notes one by one. Up/down arrows to navigate and ESQ/q to exit. Enter to choose note for editing.
* drop - for deleting chosen note
* new - to start new note from scratch
* position - currently under development. Needed to get cursor position.
* browse - to see thoughts sorted by tag (date by default). Up and down to navigate across tag index. Left and right to choose tag for index. Enter to choose note for editing.
* help - to see list of supported commands
* development-thoughts - thoughts I got while developing this app

Hit ESC or Ctrl-C to exit.

# Thanks

Big thanks to Isaac Z. Schlueter for his package [mute-stream](https://github.com/isaacs/mute-stream#readme). It was really useful in terminal version of this app.