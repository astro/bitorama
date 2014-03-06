var infoToFiles = require('../info_files')
var test = require('tape')

test('single-file torrent', function (t) {
  t.plan(3);

  var info = {
      name: new Buffer("fnord"),
      length: 23
  };
  files = infoToFiles(info);

  t.equal(files.length, 1);
  t.deepEquals(files[0].path, "fnord");
  t.equal(files[0].length, 23);
});

test('multi-file torrent', function (t) {
  t.plan(7);

  var info = {
      name: new Buffer("fnord"),
      files: [{
          path: [new Buffer("a"), new Buffer("b")],
          length: 23
      }, {
          path: [new Buffer("a"), new Buffer("c")],
          length: 5
      }, {
          path: [new Buffer("d"), new Buffer("e")],
          length: 42
      }]
  };
  var files = infoToFiles(info);

  t.equal(files.length, 3);
  t.deepEquals(files[0].path, "fnord/a/b");
  t.equal(files[0].length, 23);
  t.deepEquals(files[1].path, "fnord/a/c");
  t.equal(files[1].length, 5);
  t.deepEquals(files[2].path, "fnord/d/e");
  t.equal(files[2].length, 42);
});
