'use strict';

var regedit = require('regedit');
var async = require('async');
var _ = require('lodash');

var getAppsThatCanOpenExtension = function (ext, callback) {
  var extPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\' + ext + '\\OpenWithList';

  regedit.list(extPath, function (err, result) {
    if (err) {
      return callback(err);
    }

    result = result[extPath];

    var relevantKeys = _.filter(Object.keys(result.values), function (key) {
      return key !== 'MRUList';
    });

    async.map(relevantKeys, function (key, callback) {
      var appName = result.values[key].value;
      var path = 'Software\\Classes\\Applications';
      var lmPath = 'HKLM\\' + path;
      var cuPath = 'HKCU\\' + path;
      var commandRelativePath = '\\shell\\open\\command';

      regedit.list([lmPath, cuPath], function (err, result) {
        if (err) {
          // If app doesn't exists we don't want to bubble the error, we want to silently kill it
          callback(null, null);
        }
        else {
          var commandPath = (result[cuPath].keys.indexOf(appName) !== -1 ? cuPath : lmPath) + '\\' + appName + commandRelativePath;

          regedit.list(commandPath, function (err, result) {
            if (err) {
              callback(null, null);
            }
            else {
              var command = result[commandPath].values[''].value;

              callback(null, {
                name: appName,
                command: command
              });
            }
          });
        }
      });
    }, function (err, apps) {
      if (err) {
        return callback(err);
      }
      else {
        var filteredApps = _.filter(apps, function (app) {
          return !!app;
        });

        callback(null, filteredApps);
      }
    });
  });
};

module.exports = {
  getAppsThatCanOpenExtension: getAppsThatCanOpenExtension
};