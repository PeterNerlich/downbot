var http = require("http");
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');

// won't close instantly
process.stdin.resume();

// to track whether the last print appended a new line or not
var nl = false;

process.on('exit', exitHandler.bind(null,{cleanup:true}));
// ctrl+c event
process.on('SIGINT', exitHandler.bind(null,{exit:true}));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {/*exit:true*/}));
process.stdout.on('resize', function() {
	if(nl){process.stdout.write('\r');}
});

// Default options
var options = {
	manga: null,
	start: 1,
	count: 4,
	output: null,
	version: 0
};

// validate JSON options, show help otherwise
try {
	var opts = JSON.parse(process.argv[2]);
	for (var key in opts) {
		options[key] = opts[key];
	}
	if (options.manga === null) {
		warn('   /!\\ No manga specified!\n');
		printhelp();
		process.exit(1);
	} else if (options.output === null) {
		warn('   /!\\ No output dir specified!\n');
		printhelp();
		process.exit(1);
	} else if (fs.existsSync(options.output) && !fs.statSync(options.output).isDirectory()) {
		warn('   /!\\ Specified output is not a directory!\n');
		printhelp();
		process.exit(1);
	}
} catch(e) {
	printhelp();
	process.exit();
}

step(options.start);

function step(i) {
	if (i >= options.start+options.count) {
		process.exit();
		return;
	}
	getPages(proxerurl(options.manga, i, options.version), function(pages){
		if (pages === null || pages.length == 0) {
			error('['+i+'] Couldn\'t find pages. Skipping...');
			step(i+1);
			return;
		}

		var dir = options.output.replace('#', leadzero(i, 3));
		mkdirp(dir, function(err) {
			if (err) {
				error('  /!\\ ERROR creating dir '+dir);
				process.exit(1);
				return;
			} else {
				//log('  Downloading chapter '+i+' to file://'+options.output.replace('#', leadzero(i, 3)));
			}
			var pa = [];
			var remaining = pages.length;
			pages.forEach(function(e, p) {
				var file = path.join(dir, leadzero(p+1, 3)+'.'+e[0].split('.')[e[0].split('.').length-1]);
				pa[p] = [file, e[1], e[2]];
				if (fs.existsSync(file)) {
					log('['+i+'] Page '+(p+1)+' already exists... file://'+file);
					remaining--;
					if (remaining <= 0) {
						log('  Completed chapter '+i+' to file://'+dir);
						step(i+1);
					}
				} else {
					http.get(e[0], function(res) {
						res.pipe(fs.createWriteStream(file).on('error', function(err) {
							error('['+i+'] ERROR saving page '+(p+1));
							remaining--;
							if (remaining <= 0) {
								log('  Completed chapter '+i+' to file://'+dir);
								step(i+1);
							}
						}).on('close', function() {
							//log('['+i+'] saved page '+(p+1));
							remaining--;
							if (remaining <= 0) {
								log('  Completed chapter '+i+' to file://'+dir);
								step(i+1);
							}
						}));
					});
				}
			});
			fs.writeFile(path.join(dir, 'pages.json'), JSON.stringify(pa), function(err) {
				if (err) {
					error('ERROR writing chapter index');
				}
			});
		});
	});
}

/***** functions *****/

function proxerurl(manga, chapter, version) {
	if (typeof manga === 'number' && typeof chapter === 'number' && (version == 0 || version == 1)) {
		if (version == 0) {
			version = 'en';
		} else if (version == 1) {
			version = 'de';
		}
		return 'http://proxer.me/read/'+manga+'/'+chapter+'/'+version+'/1';
	} else {
		return false;
	}
}

function printhelp() {
	log('Usage:\tnodejs manga.js "{OPTIONS}"\n  where OPTIONS is an JSON object of:\n    manga:       [number]              Proxer ID of manga\n    start:       [number]              first chapter to start with\n    count:       [number]              count of chapters to download\n    output:      [string]              path/ to save to, with "#" chapter counter\n    version:     [number]              0: English, 1: German');
}

// Utility function that downloads a URL and invokes
// callback with the data.
function wget(url, callback) {
	http.get(url, function(res) {
		var data = "";
		res.on('data', function (chunk) {
			data += chunk;
		});
		res.on("end", function() {
			callback(data);
		});
	}).on("error", function() {
		callback(null);
	});
}

function getPages(url, callback) {
	wget(url, function(d){
		var pages = d.match(/var pages = \s*([^;\n\r]*)/);
		var server = d.match(/var serverurl = \s*([^;\n\r]*)/);
		if (pages === null || server === null) {
			if (d.match(/<input type="submit" id="checkCaptcha" value="Weiter">/)) {
				error('A wild CAPTCHA appeared! Aborting!');
				process.exit();
				return;
			}
			callback(null);
			return;
		}
		server = server[1].slice(1,3) == '//' ?
			'http:'+server[1].slice(1,-1) :
			server[1].slice(1,-1);
		pages = JSON.parse(pages[1]);
		pages.forEach(function(e, i) {
			pages[i] = [server+e[0], e[1], e[2]];
		});
		callback(pages);
	});
}

function leadzero(i, z) {
	if (typeof i !== 'number' || i%1 !== 0 || i < 0) {
		return false;
	} else {
		i = i.toString();
	}
	if (typeof z === 'undefined') {
		z = 2;
	} else if (typeof z !== 'number' || z%1 !== 0 || z < 1) {
		return false;
	}

	while (i.length < z) {
		i = '0'+i;
	}
	return i;
}


function log(e) {
	if (nl) {console.log();nl=false;}
	console.log(e);
}
function warn(e) {
	if (nl) {console.log();nl=false;}
	console.warn(e);
}
function error(e) {
	if (nl) {console.log();nl=false;}
	console.error(e);
}

function exitHandler(options, err) {
	if (err) console.log(err.stack);
	if (nl) {console.log();nl=false;}
	if (options.exit) process.exit();
}