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
var xutil = require('./util');
var EventEmitter = require('events').EventEmitter;
var strings = require('x-util').strings;
var util = require('util');

var SPEC_TEMPLATE = fs.readFileSync(path.join(__dirname, '../spec'), { encoding: 'utf8' });
var mod = new EventEmitter();

function build(opts, cb){
    async.waterfall([
        init.bind(null, opts),
        removeRpmRootDir,
        setupRpmRoot,
        prepTgz,
        doTgz,
        writeSpec,
        performBuild
        ], function(err, result){
            cb(err, result);
    });
}

function init(opts, cb){
    mod.emit('message', 'init', opts);
    
    var spec = new RpmSpec(opts);
    var cwd = xutil.resolve(opts.cwd);
    var ctx = {
        spec: spec,
        specTemplate: opts.specTemplate || SPEC_TEMPLATE,
        buildArch: opts.buildArch || 'noarch',
        installScript: opts.installScript || [],
        cwd: cwd,
        fullname: opts.name + '-' + opts.version,
        _files: opts.files,
        _sources: [],
        verbose: opts.verbose || false,
        rpmRootDir: xutil.resolve(opts.rpmRootDir || '~/rpmbuild')
    };

    cb(null, ctx);
}

function performBuild(ctx, cb){
    mod.emit('message', 'performBuild', ctx.specFileName, ctx.rpmRootDir);
    xutil.rpmbuild(ctx.specFileName, ctx.rpmRootDir, ctx, function(err, rpms){
        ctx.rpms = rpms;
        cb(err, ctx);
    });
}

// delete the RPM directory (usually located at ~/rpmbuild)
function removeRpmRootDir(ctx, cb){
    mod.emit('message', 'removeRpmRootDir', ctx.rpmRootDir);
    fsx.rmrf(ctx.rpmRootDir, function(err){
        cb(err, ctx);
    });
}

// write the spec file which is used by rpmbuild cli
function writeSpec(ctx, cb){
    
    var specOpts = ctx.spec;
    var args = {
        summary: specOpts.summary,
        name: specOpts.name,
        buildArch: ctx.buildArch,
        installScript: ctx.installScript.join('\n'),
        version: specOpts.version,
        release: specOpts.release,
        description: specOpts.description,
        files: specOpts.files.join('\n'),
        url: specOpts.url,
        license: specOpts.license,
        group: specOpts.group,
        rpmRootDir: ctx.rpmRootDir,
        sources: specOpts.sources.map(function(item, idx){ return 'SOURCE' + idx + ': ' + item; }).join('\n'),
        requires: specOpts.requires.map(function(item, idx){ return 'Requires: ' + item; }).join('\n')
    };
    var spec = strings.format(SPEC_TEMPLATE, args);

    var specFileName = path.join(ctx.rpmRootDir, 'SPECS', ctx.fullname + '.spec');
    mod.emit('message', 'writeSpec', specFileName);

    fs.writeFile(specFileName, spec, { encoding: 'utf8' }, function(err){
        if (err) return cb(err);
        ctx.specFileName = specFileName;
        cb(null, ctx);
    });
}

// setup the RPM directory structure
function setupRpmRoot(ctx, cb){
    mod.emit('message', 'setupRpmRoot', ctx.rpmRootDir);
    var root = ['RPMS', 'SRPMS', 'BUILD', 'SOURCES', 'SPECS', 'tmp']
        .map(function(d) { return path.join(ctx.rpmRootDir, d); }).join(' ');
    xutil.mkdirp(root, function(err){ cb(err, ctx); });
}

// make the tarball file
function doTgz(ctx, cb){
    var tgzFile = path.join(ctx.rpmRootDir, 'SOURCES', ctx.fullname + '.tar.gz');
    ctx.spec.sources.push(path.basename(tgzFile));
    
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
function joinGlobPath(p, addedp){
    if (addedp[0] === '!'){
        return '!' + path.join(p, addedp.substr(1));
    }
    return path.join(p, addedp);
}
// copy the files to be tarballed
function prepTgz(ctx, cb){
    var files = ctx._files;
    var tgzDir = path.join(ctx.rpmRootDir, 'tmp', 'tgz');
    mod.emit('message', 'prepTgz', tgzDir);
    
    var items = [];
    
    for (var f in files) {
        var file = files[f];
        var chmod = null;

        var p = [];
        if (util.isArray(file)){
            p = file.map(function(item){
                return joinGlobPath(ctx.cwd, item);
            });
        }
        else if ('object' === typeof(file)){
            if (util.isArray(file.path)){
                p = file.map(function(item){
                    return joinGlobPath(ctx.cwd, item);
                });
            }
            else {
                p = [ joinGlobPath(ctx.cwd, file.path) ];
            }
            chmod = file.chmod;
        }
        else {
            p = [ joinGlobPath(ctx.cwd, file) ];
        }

        var outDir = path.join(tgzDir, ctx.fullname, f);
        
        ctx.spec.files.push(path.join(f, '*'));
        
        items.push({
           outDir: outDir,
           p: p,
           chmod: chmod
        });
    }
    
    async.forEach(items, function(item, cb){
        mkdirp(item.outDir, function(err){
            var globStream = gs.create(item.p);
            var fileStream = es.map(function(file, cb){
                var relPath = 
                    path.join(item.outDir, file.path.substr(file.base.length));
                
                fs.stat(file.path, function(err, stats){
                    if (stats.isDirectory()){
                        if (!fsx.existsSync(relPath)){
                            mkdirp(relPath, function(err){ cb(err, file); });
                        }
                        else {
                            cb(err, file);
                        }
                    }
                    else {
                        fsx.copy(file.path, relPath, function(err){
                            if(item.chmod){
                                fsx.chmod(relPath, item.chmod, function(err){ cb(err, file); });
                            }
                            else {
                                cb(err, file);
                            }
                        });
                    }
                });
            });
            
            globStream
                .pipe(fileStream)
                .pipe(es.wait(function(err){
                    cb(null, item);
                }));
        });
    }, function(err, result){
       ctx.tgzDir = tgzDir;
       cb(err, ctx);
    });
}

function RpmSpec(opts){
    this.summary = opts.summary || 'RPM Summary';
    this.description = opts.description || 'RPM Description';
    this.files = [];
    this.version = opts.version || '0.0.1';
    this.release = opts.release || 1;
    this.sources = [];
    this.url = opts.url || 'nourl';
    this.name = opts.name || 'package';
    this.license = opts.license || 'GPL+';
    this.group = opts.group || 'Applications/Internet';
    this.requires = opts.requires || [];
}

mod.build = build;

module.exports = mod;
