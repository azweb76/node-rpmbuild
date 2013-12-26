var path    = require('path');
var exec    = require('child_process').exec;

function format(s, args){
    var START = '{{', END = '}}', key = null;
    var idx = 0, lastIdx = 0, endIdx = 0;
    var result = '';
    while(true){
        idx = s.indexOf(START, lastIdx);
        if (idx > -1){
            result += s.substr(lastIdx, idx-lastIdx);
            idx = idx+START.length;
            
            endIdx = s.indexOf(END, idx);
            if (endIdx == -1){
                throw new Error('Invalid arg format. Missing "' + END + '".');
            }

            key = s.substr(idx, endIdx - idx);
            result += args[key] ? args[key].toString() : '';
            lastIdx = endIdx + END.length;
        }
        else {
            break;
        }
    }
    result += s.substr(lastIdx);
    return result;
}

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

function rpmbuild(specFile, rpmRoot, cb){
    var cmd = 'rpmbuild -ba ' + specFile;
    var rpms = { rpm: null, srpm: null };
    exec(cmd, { cwd: rpmRoot }, function (error, stdout, stderr) {
        if (stdout) {
            stdout = stdout.trim(); // Trim trailing cr-lf
            var m = stdout.match(/(\/.+\.src\.rpm)/);
            if (m && m.length > 0){
                rpms.srpm = m[0];
            }
            m = stdout.match(/(\/.+\.i686\.rpm)/);
            if (m && m.length > 0){
                rpms.rpm = m[0];
            }
        }
        if (error) {
            cb('rpmbuild failed, exit code '+error.code);
        }

        cb(null, rpms);
    });
}

module.exports = {
    format: format,
    resolve: resolve,
    mkdirp: mkdirp,
    rpmbuild: rpmbuild
};