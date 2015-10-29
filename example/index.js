var lib = require('phosphor-plugins/index');
var expect = require('expect.js');

console.log('index imported');

describe('example', () => {
    it('should properly excercise api', (done) => {
        lib.fetchPlugins().then(() => {
            expect(lib.listPlugins()).to.eql(['bar', 'foo']);
            return lib.loadPlugin('foo').then(() => {
                console.log('foo finished loading');
                return lib.loadPlugin('bar').then(() => {
                    console.log('bar finished loading');
                    lib.unloadPlugin('bar');
                    lib.unloadPlugin('foo');
                    console.log('all plugins unloaded');
                    done();
                });
            });   
        }); 
    });
});

mocha.run();
