# rpmbuild

This is a node package that wraps the rpmbuild cli making integrating rpmbuild into node a little easier.

Forked from https://github.com/azweb76/node-rpmbuild which appears to have been abandoned.


## Usage

### 1. Install rpmbuild globally:

```
npm install -g @seangarner/rpmbuild
```

### 2. Install rpmbuild in your project dependencies:

```
npm install --save @seangarner/rpmbuild
```

## rpmbuild API

```javascript
var rpm = require('@seangarner/rpmbuild');
rpm.build({
  name: 'myproject',
  summary: 'myproject RPM',
  description: 'this is an RPM for myproject',
  files: {
    '/var/local/myproject': [ 'lib/**', 'node_modules/**' ],
    '/usr/bin': [ 'bin/**' ]
  },
  installScript: ['chown -R myuser:myuser %{buildroot}', 'echo "test" > %{buildroot}/test.txt'],
  version: '0.0.1',
  release: 1,
  url: 'http://myproject/',
  license: 'GPL+',
  group: 'Development/Tools'
}, function(err, result){
  if (err){
    throw new Error('rpm.build failed' + err.toString());
  }
  console.log('done');
});
```
