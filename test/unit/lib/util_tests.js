var sinon = require('sinon');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('../../../lib/util');

describe("util", function() {
    it("is constructed", function(done) {
        assert.isObject(util);
        done();
    });
    
    it(":format is valid", function(done) {
        var expected = 'dan clayton';
        var actual = util.format('dan {{lastname}}', { lastname: 'clayton' });
        assert.equal(actual, expected);
        done();
    });
});