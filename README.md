# rpmbuild

This is a node package that wraps the rpmbuild cli making integrating rpmbuild into node a little easier.


## Usage

### 1. Install rpmbuild globally:

```
npm install -g rpmbuild
```

### 2. Install rpmbuild in your project dependencies:

```
npm install --save rpmbuild
```

## rpmbuild API

```javascript
var rpm = require('rpmbuild');
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


