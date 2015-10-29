/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';

import {
  Plugin, Extension, ExtensionPoint
} from '../../lib/index';

import expect = require('expect.js');

describe('phosphor-plugins', () => {
  
  describe('#Plugin.validate', () => {

    it('should return true for valid input', () => {
      var options = {
        module: "test",
        initializer: "test",
        extensionPoints: <any>[],
        extensions: <any>[]
      };

      // If anything throws an error in the validation, the 
      // next line will fail.
      return Plugin.validate('', options);
    });

    it('should return false with incorrect types', () => {
      var options = {
        module: 5,
        initializer: 5,
        extensionPoints: <any>[],
        extensions: <any>[]
      };

      // Here we want to ensure that an error *is* thrown 
      // so we have an assertion in the error path,
      // and raise our own error if the non-error path is taken.
      return Plugin.validate('', options)
        .then(() => { throw ""; })
        .catch((error: any) => { 
          expect(error).to.be(false);
      });
    });
  });

});
