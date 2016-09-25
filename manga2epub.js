var http = require("http");
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var Epub = require('epub-gen');

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


var dir = path.join(options.output, '.downbot', 'm'+options.manga);
mkdirp(dir, function(err) {
	if (err) {
		error('  /!\\ ERROR creating dir '+dir);
		process.exit(1);
		return;
	}
	if (fs.existsSync(path.join(dir, 'cover.jpg'))) {
		log('Cover already exists...');
	} else {
		http.get('http://cdn.proxer.me/cover/'+options.manga+'.jpg', function(res) {
			res.pipe(fs.createWriteStream(path.join(dir, 'cover.jpg')).on('error', function(err) {
				error('ERROR saving cover');
			}).on('close', function() {}));
		});
	}
});

var epubdata = {
	title: 'Manga '+options.manga,
	author: 'Proxer.me',
	cover: path.join(dir, 'cover.jpg'),
	appendChapterTitles: false,
	content: [
		/*{
			title: '',
			data: ''
		}*/
	]
};

function finishEpub() {
	//clear empty chapters
	for (var i = 0; i < epubdata.content.length; i++) {
		if (!epubdata.content[i]) {         
			epubdata.content.splice(i, 1);
			i--;
		}
	}
	//epubdata.content = [{title: 'no title', data: '<p>fooled you!</p>'}];

	function sum(c) {
		var s = 0;
		c.forEach(function(e, i) {
			s += e.data.split(' alt="image-placeholder"></img><img src="images/').length;
		});
		return s;
	}

	new Epub(epubdata, path.join(options.output, epubdata.title+'.epub')).promise.then(function() {
		log('Ebook Generated Successfully! ('+epubdata.content.length+' chapters, '+sum(epubdata.content)+' pages)');
		//step(i+1);
		process.exit();
	}, function(err) {
		error("Failed to generate Ebook because of", err);
		//step(i+1);
		process.exit();
	});
}

step(options.start);

function step(i) {
	if (i >= options.start+options.count) {
		//process.exit();
		finishEpub();
		return;
	}
	getPages(proxerurl(options.manga, i, options.version), function(pages){
		//var dir = options.output.replace('#', leadzero(i, 3));
		var dir = path.join(options.output, '.downbot', 'm'+options.manga, leadzero(i, 3));

		function finishChapter() {
			epubdata.content[i] = {
				title: 'Chapter '+i,
				data: ''
			};

			for (var o = 0; o < pages.length; o++) {
				//var div = '<p>Page '+o+'</p><div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: #fff; background-repeat: no-repeat; background-position: center; background-size: contain; background-image: url(file://'+path.resolve(path.join(dir, leadzero(o+1, 3)+'.'+pages[o][0].split('.')[pages[o][0].split('.').length-1]))+')"></div>';
				var img = '<img src="'+path.resolve(path.join(dir, leadzero(o+1, 3)+'.'+pages[o][0].split('.')[pages[o][0].split('.').length-1]))+'" />';
				/*epubdata.content[o] = {
					title: 'Page '+o,
					data: div
				};*/
				epubdata.content[i].data += img;
			};

//			var chapter = options.output.replace('#', leadzero(i, 3));
//			var output = (chapter.slice(-1) === '/' ? chapter.slice(0, -1) : chapter) + '.epub';
		}

		if (pages === null || pages.length == 0) {
			var p = false;
			if (fs.existsSync(path.join(dir, '001.jpg'))) {
				p = '.jpg';
			} else if (fs.existsSync(path.join(dir, '001.png'))) {
				p = '.png';
			}
			if (pages === null && p) {
				warn('['+i+'] Reusing local files...');
				var o = 1;
				pages = [['001'+p, 0, 0]];
				while (p) {
					pages.push([leadzero(o+1, 3)+p, 0, 0]);

					o++;
					p = false;
					if (fs.existsSync(path.join(dir, leadzero(o+1, 3)+'.jpg'))) {
						p = '.jpg';
					} else if (fs.existsSync(path.join(dir, leadzero(o+1, 3)+'.png'))) {
						p = '.png';
					}
				}
				finishChapter();
				step(i+1);
				return;
			} else {
				error('['+i+'] Couldn\'t find pages. Skipping... file://'+path.join(dir, '001.png'));
				step(i+1);
				return;
			}
		}

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
						finishChapter();
						step(i+1);
					}
				} else {
					log('+++ http.get('+e[0]+', [...]) +++');
					http.get(e[0], function(res) {
						res.pipe(fs.createWriteStream(file).on('error', function(err) {
							error('['+i+'] ERROR saving page '+(p+1));
							remaining--;
							if (remaining <= 0) {
								log('  Completed chapter '+i+' to file://'+dir);
								finishChapter();
								step(i+1);
							}
						}).on('close', function() {
							//log('['+i+'] saved page '+(p+1));
							remaining--;
							if (remaining <= 0) {
								log('  Completed chapter '+i+' to file://'+dir);
								finishChapter();
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
	//log('+++ proxerurl('+manga+', '+chapter+', '+version+') +++');
	if (typeof manga === 'number' && typeof chapter === 'number' && (version == 0 || version == 1)) {
		if (version == 0) {
			version = 'en';
		} else if (version == 1) {
			version = 'de';
		}
		//log('+++ proxerurl() return http://proxer.me/read/'+manga+'/'+chapter+'/'+version+'/1 +++');
		return 'http://proxer.me/read/'+manga+'/'+chapter+'/'+version+'/1';
	} else {
		//log('+++ proxerurl() return false +++');
		return false;
	}
}

function printhelp() {
	log('Usage:\tnodejs manga.js "{OPTIONS}"\n  where OPTIONS is an JSON object of:\n    manga:       [number]              Proxer ID of manga\n    start:       [number]              first chapter to start with\n    count:       [number]              count of chapters to download\n    output:      [string]              path/ to save to, with "#" chapter counter\n    version:     [number]              0: English, 1: German');
}

// Utility function that downloads a URL and invokes
// callback with the data.
function wget(url, callback) {
	//log('+++ wget('+url+', '+callback+') +++');
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
				error('A wild CAPTCHA appeared!');// Aborting!');
				//process.exit(1);
				//return;
			}
			callback(null);
			return;
		}
		//return log(server[1].slice(1,3));
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