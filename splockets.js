/*
Example usage: node splockets.js application.js
*/

var packages = {
  fs: require('fs'),
  path: require('path'),
  async: require('async')
};
var async = packages.async;


//These are the kinds of directives that are handled:
//= require templates/hello.js
//= require_tree ../x/y
//= require_tree .
var directiveRegex = new RegExp(/^\/\/=\s(require|require_tree)\s(.*)/i);


//Sugar
var destructure = function(args, block, context) {
  return block.apply(context, args);
};


//TODO alreadyRequired doesn't quite work right.  This global is a temporary workaround.
var req = [];


//Reads a filename and returns the JavaScript for it, with any directives processed and their file contents
//injected in the result.
//Fires callback(err, javascript)
//Throws an error if file or folder is not found.
var processFile = function(cwd, alreadyRequired, filename, callback) {
  if (req.indexOf(filename) !== -1) return callback(null, duplicateOutput);
  console.log('Opening ' + cwd + ':' + filename + '...');
  console.log(' already: ' + req.join(', '));
  req.push(filename);
  packages.fs.readFile(filename, function(err, data) {
    if (err) throw err;

    var lines = data.toString().split("\n");

    //Map each line to its text contents.  This will process any directives and expand them recursively
    //to include the desired files.
    //TODO These each need the results of alreadyRequired
    asyncMapper(lines, async.apply(lineMapper, cwd, alreadyRequired.concat(filename)), function(err, expandedLines) {
      callback(null, expandedLines.join("\n"));
    });
  });
};


//Takes a line and replace it with the required file contents if it is a directive.  If not return the same line.
//Fires callback(err, expandedLine)
//Throws an error if file or folder is not found.
var lineMapper = function(cwd, alreadyRequired, line, callback) {
  console.log('Mapping(cwd: ' + cwd + '): ' + line + '...');
  var lineParts = directiveRegex.exec(line);
  if (lineParts === null) return callback(null, line);

  //This is just sugar to destructure the regex results
  return destructure(lineParts, function(fulline, command, path) {
    var resolvedPath = packages.path.resolve(cwd, path);
    if (command.toLowerCase() === 'require_tree') return processFolder(resolvedPath, alreadyRequired, callback);
    if (command.toLowerCase() === 'require') {
      var newCwd = packages.path.dirname(resolvedPath);
      return processFile(newCwd, alreadyRequired, resolvedPath, callback);
    }
    return callback('error parsing directive for line: ' + line);
  });
};


//Get all directories in the folder
//TODO index.js
//Map each file through #processFile, passing along the new cwd with it
var processFolder = function(folder, alreadyRequired, callback) {
  return packages.fs.readdir(folder, function(err, files) {
    if (err) throw err;

    //Filter down to only JavaScript files
    var javascriptFiles = files.filter(function(files) { return files.substr(-3) === '.js'; });

    //If there's an index.js, put it first
    var index = javascriptFiles.indexOf('index.js');
    var sortedJavascriptFiles = (index === -1) ? javascriptFiles : javascriptFiles.slice(index).concat(javascriptFiles.slice(0, index));

    //Map to full filenames with paths (they were only filenames)
    var fullFilenames = sortedJavascriptFiles.map(function(file) { return packages.path.join(folder, file); });

    //TODO These each need the results of alreadyRequired
    return asyncMapper(fullFilenames, async.apply(processFile, folder, alreadyRequired), function(err, processedFiles) {
      if (err) throw err;
      callback(null, processedFiles.join('\n'));
    });
  });
};


//For debugging, you can set this to see where duplicates would be included.
var duplicateOutput = '';

//Map in series for easier debugging output
var asyncMapper = async.map;


//Start the app.
//Throws an error if file or folder is not found.
(function() {
  var filename = process.argv[2];
  if (!filename) {
    process.stdout.write('Splockets!\nRead a subset of Sprockets directives to concatenate your JavaScript to stdout.\n\nThe following kinds of directives are supported:\n  //= require file\n  //=require ./sub/file.js\n  //=require ../other.js\n  //=require_tree folder\n  //=require_tree .\n\nExample usage: node splockets.js application.js\n');
    return process.exit();
  }

  //Debug flag
  if (process.argv[3] === '--debug') {
    duplicateOutput = '/* duplicate */';
    asyncMapper = async.mapSeries;
  } else {
    console.log = function() {};
  }

  //Process the file
  var resolvedFilename = packages.path.resolve(filename);
  processFile(packages.path.dirname(resolvedFilename), [], resolvedFilename, function(err, javascript) {
    console.log('Done!');
    console.log('-----------output below-----------');
    process.stdout.write(javascript);
  });
})();