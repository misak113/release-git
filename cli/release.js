
var Q = require('q');
var exec = require('child_process').exec;
var fs = require('fs');

var LevelEnum = {
	PATCH: 'patch',
	MINOR: 'minor',
	MAJOR: 'major'
};
var PRODUCTION = 'production';
var MASTER = 'master';
var REMOTE = 'origin';
var basePath = __dirname + '/..';

var level = process.argv[1] || LevelEnum.PATCH;
var config = require(basePath + '/.release.json');

var git = {
	getBranches: function () {
		var deferred = Q.defer();
		exec('git branch', function (e, stdout, stderr) {
			console.log(stdout, stderr);
			if (e) {
				deferred.reject(new Error(e));
			} else {
				var branches = stdout.split("\n");
				deferred.resolve(branches);
			}
		});
		return deferred.promise;
	},

	createBranch: function (name) {
		var deferred = Q.defer();
		exec('git branch ' + name, function (e, stdout, stderr) {
			console.log(stdout, stderr);
			if (e) {
				deferred.reject(new Error(e));
			} else {
				deferred.resolve();
			}
		});
		return deferred.promise;
	},

	checkout: function (name) {
		var deferred = Q.defer();
		exec('git checkout ' + name, function (e, stdout, stderr) {
			console.log(stdout, stderr);
			if (e) {
				deferred.reject(new Error(e));
			} else {
				deferred.resolve();
			}
		});
		return deferred.promise;
	},

	merge: function (name, options) {
		var deferred = Q.defer();
		exec('git merge ' + name + ' ' + options, function (e, stdout, stderr) {
			console.log(stdout, stderr);
			if (e) {
				deferred.reject(new Error(e));
			} else {
				deferred.resolve();
			}
		});
		return deferred.promise;
	},

	commit: function (message) {
		var deferred = Q.defer();
		exec('git commit -m "' + message + '" -a', function (e, stdout, stderr) {
			console.log(stdout, stderr);
			if (e) {
				deferred.reject(new Error(e));
			} else {
				deferred.resolve();
			}
		});
		return deferred.promise;
	},

	tag: function (name) {
		var deferred = Q.defer();
		exec('git tag ' + name, function (e, stdout, stderr) {
			console.log(stdout, stderr);
			if (e) {
				deferred.reject(new Error(e));
			} else {
				deferred.resolve();
			}
		});
		return deferred.promise;
	},

	push: function (options) {
		var deferred = Q.defer();
		exec('git push ' + options, function (e, stdout, stderr) {
			console.log(stdout, stderr);
			if (e) {
				deferred.reject(new Error(e));
			} else {
				deferred.resolve();
			}
		});
		return deferred.promise;
	}
};

var updateVersion = function (level) {
		var deferred = Q.defer();
	var appConfigs = (
		typeof config.appConfigs === 'object' 
			? Object.values(config.appConfigs) 
			: (
				config.appConfigs === 'Array'
				? config.appConfigs
				: []
			)
		);
	var defaultVersion = null;
	appConfigs.forEach(function (appConfigPath) {
		var appConfig = require(basePath + '/' + appConfigPath);
		var version = appConfig.version;
		if (defaultVersion !== null && defaultVersion != version) {
			deferred.reject(new Error(
				'There are different versions ' + version + ' in config ' 
				+ appConfigPath + ' from version ' + defaultVersion
			));
		}
		defaultVersion = version;
	});
	defaultVersion = defaultVersion || '0.0.0';
	var versionParts = defaultVersion.split('.');
	var levelIndex = { patch: 0, minor: 1, major: 2 }[level];
	versionParts[levelIndex]++;
	var newVersion = versionParts.join('.');
	appConfigs.forEach(function (appConfigPath) {
		var appConfig = JSON.parse(fs.readSync(basePath + '/' + appConfig));
		appConfig.version = newVersion;
		fs.writeFile(
			basePath + '/' + appConfigPath, 
			JSON.stringify(appConfig), 
			function (e, stdout, stderr) {
				console.log(stdout, stderr);
				if (e) {
					deferred.reject(new Error(e));
				} else {
					deferred.resolve(newVersion);
				}
			}
		);
	});
	
	return deferred.promise;
};

git.getBranches()
.then(function (branches) {
	if (branches.indexOf(PRODUCTION) === -1) {
		return git.createBranch(PRODUCTION)
			.then(git.checkout(PRODUCTION));
	} else {
		return git.checkout(PRODUCTION);
	}
})
.then(function () {
	return git.merge(MASTER, '--no-commit');
})
.then(function () {
	console.info('Update configs versions');
	return updateVersion(level);
})
.then(function (version) {
	console.info('New version is ' + version);
	return git.add('.').then([version]);
})
.then(function (version) {
	var message = 'Release ' + version;
	console.info('Commit as ' + message);
	return git.commit(message).then([version]);
})
.then(function (version) {
	var tag = 'v' + version;
	console.info('Tag as ' + tag);
	return git.tag(tag).then([version]);
})
.then(function (version) {
	return git.push(REMOTE + ' ' + PRODUCTION).then([version]);
})
.then(function (version) {
	return git.push('--tags --force');
})
.then(function () {
	return git.checkout(MASTER);
})
;
