var http = require("http");
//var cheerio = require("cheerio");
var ytdl = require('youtube-dl');
var StreamCounter = require('stream-counter');
var path = require('path');
var fs = require('fs');

// won't close instantly
process.stdin.resume();

// to track wether the last print appended a new line or not
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
	anime: null,
	start: 1,
	count: 4,
	mirrorpref: ['proxer-stream','streamcloud2','mp4upload'],
	output: null,
	version: 0
};

// validate JSON options, show help otherwise
try {
	var opts = JSON.parse(process.argv[2]);
	for (var key in opts) {
		options[key] = opts[key];
	}
	if (options.anime === null) {
		warn('   /!\\ No anime specified!\n');
		printhelp();
		process.exit(1);
	} else if (options.output === null) {
		warn('   /!\\ No output name specified!\n');
		printhelp();
		process.exit(1);
	}
} catch(e) {
	printhelp();
	process.exit();
}

// TODO

// parse urls and fetch mirror info
// download in respect of preferance
// output status

step(options.start);

function step(i) {
	if (i >= options.start+options.count) {
		process.exit();
		return;
	}
	getMirrors(proxerurl(options.anime, i, options.version), function(mirrors){
		if (mirrors === null || mirrors.length == 0) {
			error('['+i+'] Couldn\'t find mirrors. Skipping...');
			step(i+1);
			return;
		}
		mirrors = sortMirrors(mirrors);
		
		var url = mirrors[0].replace.replace('#',mirrors[0].code);
		var file = options.output.replace('#',i);

		var bdownloaded = 0;
		if (fs.existsSync(file) && fs.statSync(file).size != 0) {
			log('file://'+file+' already finished. Skipping...');
			step(i+1);
			return;
			//process.exit();
		} else if (fs.existsSync(file+'.part')) {
			bdownloaded = fs.statSync(file+'.part').size;
		}
		
		var counter = new StreamCounter();
		var dl = ytdl(url,[],{start: bdownloaded});
		dl.on('info', function(info) {
			log('  Started file://'+file+' ('+((info.size+bdownloaded)/1024/1024).toFixed(2)+' MiB) | Mirror: '+mirrors[0].name);
			if (bdownloaded > 0) {
				log('  '+(bdownloaded/(info.size+bdownloaded)*100).toFixed(2)+'% | Resuming from: '+bdownloaded/1024/1024+' MiB | Remaining: '+info.size/1024/1024+' MiB');
			}
			counter.on('progress', function() {
				var out = '  Downloading '+path.basename(file)+' ('+((counter.bytes+bdownloaded)/(info.size+bdownloaded)*100).toFixed(2)+'% | '+((bdownloaded+counter.bytes)/1024/1024).toFixed(2)+' MiB/'+((info.size+bdownloaded)/1024/1024).toFixed(2)+' MiB)';
				var reset = '\r';
				if (Math.floor((out.length/process.stdout.columns)) > 0) {
					reset += '\033['+Math.floor((out.length/process.stdout.columns))+'A';
				}
				process.stdout.write(out+reset);
				nl=true;
			});
		});
		dl.on('end', function() {
			fs.rename(file+'.part', file, function(err) {
				if (err) log('ERROR renaming *.part: '+err);
			});
			log('  Finished file://'+file);
			step(i+1);
			return;
			//process.exit();
		});
		dl.pipe(fs.createWriteStream(file+'.part',{flags:'a'}));
		dl.pipe(counter);
	});
}

/***** functions *****/

function proxerurl(anime, episode, version) {
	if (typeof anime === 'number' && typeof episode === 'number' && (version == 0 || version == 1 || version == 2 || version == 3)) {
		if (version == 0) {
			version = 'engsub';
		} else if (version == 1) {
			version = 'engdub';
		} else if (version == 2) {
			version = 'gersub';
		} else if (version == 3) {
			version = 'gerdub';
		}
		return 'http://proxer.me/watch/'+anime+'/'+episode+'/'+version;
	} else {
		return false;
	}
}

function printhelp() {
	log('Usage:\tnodejs index.js "{OPTIONS}" "[YTDL]"\n  where OPTIONS is an JSON object of:\n    anime:       [number]              Proxer ID of anime\n    start:       [number]              first episode to start with\n    count:       [number]              count of episodes to download\n    mirrorpref:  [array] of [string]s  list of preferred mirrors\n    output:      [string]              path/file.name to save to, with "#" episode counter\n    version:     [number]              0: EngSub, 1: EngDub, 2: GerSub, 3: GerDub\n\n    YTDL is an [array] of options passed to youtube-dl');
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

function getMirrors(url, callback) {
	wget(url, function(d){
		if (d.match(/var streams = \s*([^;\n\r]*)/) === null) {
			if (d.match(/<input type="submit" id="checkCaptcha" value="Weiter">/)) {
				error('A wild CAPTCHA appeared! Aborting!');
				process.exit();
				return;
			}
			callback(null);
			return;
		}
	//	log(d.match(/var streams = \s*([^;\n\r]*)/));
	//	log(JSON.parse(d.match(/var streams = \s*([^;\n\r]*)/)[1]));
		//var $ = cheerio.load(d);
		//var e = $('link[href="/templates/proxer14/css/shariff.min.css"]').next('script')[0];
		//var mirrors = JSON.parse(e.children[0].data.split('\n')[2].split('var streams = ')[1].slice(0,-1));
		var mirrors = JSON.parse(d.match(/var streams = \s*([^;\n\r]*)/)[1]);
		callback(mirrors);
	});
}

function sortMirrors(mirrors) {
	var newm = [];
	for (var p = 0; p < options.mirrorpref.length; p++) {
		for (var m = 0; m < mirrors.length; m++) {
			if (mirrors[m].type == options.mirrorpref[p]) {
				newm.push(mirrors[m]);
				mirrors = mirrors.slice(0,m).concat(mirrors.slice(m+1,mirrors.length));
				m--;
			}
		}
	}
	// add other mirrors to the end
	return newm.concat(mirrors);
}

//ytdl.getInfo('http://streamcloud.eu/r8gg15kfeabf',[],function(err,inf){console.log(err);console.log(inf);});

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