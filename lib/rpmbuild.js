'use strict';
/* jshint node:true */

var async = require('async');
var path = require('path');
var gs = require('glob-stream');
var es = require('event-stream');
var fsx = require('fs.extra');
var mkdirp = fsx.mkdirRecursive;
var fs = require('graceful-fs');
var exec = require('child_process').exec;
var util = require('./util');
var EventEmitter = require('events').EventEmitter;

var SPEC_TEMPLATE = fs.readFileSync(path.join(__dirname, '../spec'), { encoding: 'utf8' });
var mod = new EventEmitter();

function build(opts, cb){
    async.waterfall([
        init.bind(null, opts),
        removeTempDir,
        removeRpmRootDir,
        prepTgz,
        doTgz,
        setupRpmRoot,
        moveSources,
        writeSpec,
        performBuild
        ], function(err, result){
            cb(err, result);
    });
}

function init(opts, cb){
    mod.emit('message', 'init', opts);
    
    var spec = new RpmSpec(opts);
    var cwd = util.resolve(opts.cwd);
    var ctx = {
        spec: spec,
        specTemplate: opts.specTemplate || SPEC_TEMPLATE,
        tempDir: path.join(cwd, '_rpmtmp'),
        cwd: cwd,
        fullname: opts.name + '-' + opts.version,
        _files: opts.files,
        _sources: [],
        rpmRootDir: util.resolve(opts.rpmRootDir || '~/rpmbuild')
    };

    cb(null, ctx);
}

function performBuild(ctx, cb){
    mod.emit('message', 'performBuild', ctx.specFileName, ctx.rpmRootDir);
    util.rpmbuild(ctx.specFileName, ctx.rpmRootDir, function(err, rpms){
        ctx.rpms = rpms;
        cb(err, ctx);
    });
}

function removeTempDir(ctx, cb){
    mod.emit('message', 'removeTempDir', ctx.tempDir);
    fsx.rmrf(ctx.tempDir, function(err){
        cb(err, ctx);
    });
}

function removeRpmRootDir(ctx, cb){
    mod.emit('message', 'removeRpmRootDir', ctx.rpmRootDir);
    fsx.rmrf(ctx.rpmRootDir, function(err){
        cb(err, ctx);
    });
}

function writeSpec(ctx, cb){
    
    var specOpts = ctx.spec;
    var args = {
        summary: specOpts.summary,
        name: specOpts.name,
        version: specOpts.version,
        release: specOpts.release,
        description: specOpts.description,
        files: specOpts.files.join('\n'),
        url: specOpts.url,
        license: specOpts.license,
        group: specOpts.group,
        sources: specOpts.sources.map(function(item, idx){ return 'SOURCE' + idx + ': ' + item; }).join('\n')
    };
    var spec = util.format(SPEC_TEMPLATE, args);

    var specFileName = path.join(ctx.rpmRootDir, 'SPECS', ctx.fullname + '.spec');
    mod.emit('message', 'writeSpec', specFileName);
    
    fs.writeFile(specFileName, spec, { encoding: 'utf8' }, function(err){
        if (err) return cb(err);
        ctx.specFileName = specFileName;
        cb(null, ctx);
    });
}



function setupRpmRoot(ctx, cb){
    mod.emit('message', 'setupRpmRoot', ctx.rpmRootDir);
    var root = path.join(ctx.rpmRootDir, '/{RPMS,SRPMS,BUILD,SOURCES,SPECS,tmp}');
    util.mkdirp(root, function(err){ cb(err, ctx); });
}

function moveSources(ctx, cb){
    mod.emit('message', 'moveSources', ctx._sources);
    async.each(ctx._sources, function(item, acb){
        var basename = path.basename(item);
        var targetFile = path.join(ctx.rpmRootDir, 'SOURCES', basename);
        mod.emit('message', 'moveSources-move', item, targetFile);
        
        fsx.move(item, targetFile, function(err){
            ctx.spec.sources.push(basename);
            acb(err, ctx);
        });

    }, function(err){
        cb(err, ctx);
    });
}

function doTgz(ctx, cb){
    var tgzFile = path.join(ctx.tempDir, ctx.fullname + '.tar.gz');
    mod.emit('message', 'doTgz', tgzFile, ctx.tgzDir);
    
    var cmd = 'tar -czf ' + tgzFile + ' .';
    exec(cmd, {cwd:ctx.tgzDir}, function (error, stdout, stderr) {
        if (stdout) {
            stdout = stdout.trim(); // Trim trailing cr-lf
        }
        if (error) {
            cb('tgz failed, exit code '+error.code);
        }
        
        ctx._sources.push(tgzFile);
        cb(null, ctx);
    });
}

function prepTgz(ctx, cb){
    var files = ctx._files;
    var tgzDir = path.join(ctx.tempDir, 'tgz');
    mod.emit('message', 'prepTgz', tgzDir);
    
    for (var f in files) {
        var p =  path.join(ctx.cwd, files[f]);
        var outDir = path.join(tgzDir, ctx.fullname, f);
        
        ctx.spec.files.push(path.join(f, '*'));
        mkdirp(outDir, function(err){
            var globStream = gs.create(p);
            var fileStream = es.map(function(file, cb){
                var relPath = 
                    path.join(outDir, file.path.substr(file.base.length));
                fs.stat(file.path, function(err, stats){
                    if (stats.isDirectory()){
                        mkdirp(relPath, function(err){ cb(err, file); });
                    }
                    else {
                        fsx.copy(file.path, relPath, function(err){ cb(err, file); });
                    }
                });
            });
            globStream
                .pipe(fileStream)
                .pipe(es.wait(function(err){
                    ctx.tgzDir = tgzDir;
                    cb(null, ctx);
                }));
        });
    }
}

function RpmSpec(opts){
    this.summary = opts.summary || 'RPM Summary';
    this.description = opts.description || 'RPM Description';
    this.files = [];
    this.version = opts.version || '0.0.1';
    this.release = opts.release || 1;
    this.sources = [];
    this.url = opts.url;
    this.name = opts.name || 'package';
    this.license = opts.license || 'GPL+';
    this.group = opts.group || 'Development/Tools';
}

mod.build = build;

module.exports = mod;