'use strict';

var regedit = require('regedit');
var _ = require('lodash');
var Q = require('q');
var debug = require('debug')('file-association');

/***
 * Get apps that can open the specified extension
 * @param {string} ext extension
 * @returns {Q.promise} list of apps that can open this extension
 */
var getAppsThatCanOpenExtension = function (ext) {
  if (!ext) {
    return Q.reject(new TypeError('extension must be provided'));
  }

  if (typeof ext !== 'string') {
    return Q.reject(new TypeError('extension must be a string'));
  }

  var extPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\' + ext + '\\OpenWithList';

  debug('Searching apps for %s in %s', ext, extPath);

  return Q.nfcall(regedit.list, extPath)
    .then(function (result) {
      result = result[extPath];

      debug('relevant apps: %j', result.values);

      var relevantKeys = _.filter(Object.keys(result.values), function (key) {
        return key !== 'MRUList';
      });

      var promises = relevantKeys.map(function (key) {
        var appName = result.values[key].value;
        var path = 'Software\\Classes\\Applications';
        var lmPath = 'HKLM\\' + path;
        var cuPath = 'HKCU\\' + path;
        var commandRelativePath = '\\shell\\open\\command';

        debug('app %s in path %s', appName, path);

        return Q.nfcall(regedit.list, [lmPath, cuPath])
          .then(function (result) {
            return (result[cuPath].keys.indexOf(appName) !== -1 ? cuPath : lmPath) + '\\' + appName + commandRelativePath;
          })
          .then(function (commandPath) {
            return Q.nfcall(regedit.list, commandPath)
              .then(function (result) {
                var command = result[commandPath].values[''].value;

                debug('command for app %s is %s', appName, command);

                return {
                  name: appName,
                  command: command
                };
              }, function () {
                return null;
              });
          });
      });

      return Q.all(promises);
    })
    .then(function (apps) {
      var filteredApps = _.filter(apps, function (app) {
        return !!app;
      });

      debug('%d apps can open %s: %j', filteredApps.length, ext, filteredApps);

      return filteredApps;
    });
};

module.exports = {
  getAppsThatCanOpenExtension: getAppsThatCanOpenExtension
};