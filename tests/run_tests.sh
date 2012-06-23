#!/usr/bin/sh

/usr/local/bin/node splockets.js tests/test_project/application.js > output.txt
/usr/local/bin/node splockets.js tests/test_project/application.js --debug > output_with_debug.txt