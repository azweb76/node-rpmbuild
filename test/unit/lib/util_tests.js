var sinon = require('sinon');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('../../../lib/util');

describe("util", function() {
    it("is constructed", function(done) {
        assert.isObject(util);
        done();
    });
});