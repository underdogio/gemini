'use strict';

var q = require('q'),
    inherit = require('inherit'),
    fs = require('q-io/fs'),
    temp = require('temp'),

    Runner = require('./runner'),
    Image = require('./image'),
    NoRefImageError = require('./errors/no-ref-image-error'),

    RunnerEvents = require('./constants/runner-events');

temp.track();

module.exports = inherit(Runner, {

    __constructor: function(config, options) {
        this.__base(config);
        options = options || {};
        this._tempDir = options.tempDir || temp.path('gemini');
    },

    _prepare: function() {
        return fs.makeTree(this._tempDir);
    },

    _processCapture: function(capture) {
        var refPath = this.config.getScreenshotPath(
                capture.suite,
                capture.state.name,
                capture.browser.id
            ),
            tmpPath = this._tempPath(),
            tolerance = capture.state.tolerance,
            _this = this;

        if (!tolerance && tolerance !== 0) {
            tolerance = this.config.tolerance;
        }

        return fs.exists(refPath)
            .then(function(refExists) {
                if (!refExists) {
                    return q.reject(new NoRefImageError(refPath,
                        {
                            suite: capture.suite,
                            suiteName: capture.suite.name,
                            suiteId: capture.suite.id,
                            stateName: capture.state.name,
                            suitePath: capture.suite.path,
                            browserId: capture.browser.id
                        }));
                }
            })
            .then(function() {
                return capture.image.save(tmpPath);
            })
            .then(function() {
                return [tmpPath, Image.compare(tmpPath, refPath, {
                    strictComparison: _this.config.strictComparison,
                    canHaveCaret: capture.canHaveCaret,
                    tolerance: tolerance
                })];
            })
            .spread(function(currentPath, isEqual) {
                _this.emit(RunnerEvents.END_TEST, {
                    suite: capture.suite,
                    state: capture.state,
                    referencePath: refPath,
                    currentPath: currentPath,
                    browserId: capture.browser.id,
                    equal: isEqual,
                    saveDiffTo: function(diffPath) {
                        return Image.buildDiff({
                            reference: refPath,
                            current: currentPath,
                            diff: diffPath,
                            diffColor: _this.config.diffColor,
                            tolerance: tolerance,
                            strictComparison: _this.config.strictComparison
                        });
                    },

                    // Deprecated fields. TODO: remove before next release
                    suiteName: capture.suite.name,
                    suiteId: capture.suite.id,
                    stateName: capture.state.name,
                    suitePath: capture.suite.path
                });
            });
    },

    _tempPath: function() {
        return temp.path({dir: this._tempDir, suffix: '.png'});
    }

});
