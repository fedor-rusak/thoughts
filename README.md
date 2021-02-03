# thoughts
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Ever wanted to save your thoughts in some json file using CLI interface?

This is a small node app that tries to be vim-bash-like thing for simple notes.

Should work properly on Mac and Windows.

# How to start

You need NodeJS to run this project.

```
npm install
node index.js
```

# How to use

When you started thoughts process :) you see an empty page (as on 2021 February 3).

You can enter any of these commands:

* clear - clears your screen from commands
* title - next input would be considered title for new note
* content - same as title but for content
* now - adds date to current not
* state - show your current note data on screen
* push - pushes (if no missing fields) you not to internal list of records
* records - allows to look at current records. Use arrows to navigate. ESC or q to exit.
* save - save records to file
* load - load records from file
* position - currently under development. Needed to get cursor position.

Hit ESC or Ctrl-C to exit.