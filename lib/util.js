var path    = require('path');
var exec    = require('child_process').exec;

function resolve(p){
    p = p.replace(/^~\//, process.env.HOME + '/');
    return path.resolve(p);
}

function mkdirp(p, cb){
    var cmd = 'mkdir -p ' + p;
    exec(cmd, { }, function (error, stdout, stderr) {
        if (error) {
            cb('mkdir failed, exit code '+error.code);
        }

        cb(null, p);
    });
}

function rpmbuild(specFile, rpmRoot, opts, cb){
    var cmd = 'rpmbuild -bb -D "%_topdir ' + rpmRoot + '" ' + specFile;
    var rpms = { rpm: null, srpm: null };
    exec(cmd, { cwd: rpmRoot }, function (error, stdout, stderr) {
        if (error) {
            console.log(error);
            cb('rpmbuild failed, exit code '+error.code);
        }
        
        if (stdout) {
            stdout = stdout.trim(); // Trim trailing cr-lf
            if (opts.verbose){ console.log(stdout); }
            var m = stdout.match(/(\/.+\..+\.rpm)/);
            if (m && m.length > 0){
                rpms.rpm = m[0];
            }
        }
        cb(null, rpms);
    });
}

module.exports = {
    resolve: resolve,
    mkdirp: mkdirp,
    rpmbuild: rpmbuild
};