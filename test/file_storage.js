var FileStorage = require('../file_storage')
var test = require('tape')

test('offsetToRanges (1 file)', function (t) {
  t.plan(2);

  var storage = new FileStorage([{
      path: 'a',
      length: 512
  }]);

  t.deepEquals(storage.offsetToRanges(128, 384),
               [{ path: 'a', offset: 128, length: 384 }],
               'subset');
  t.deepEquals(storage.offsetToRanges(500, 16),
               [{ path: 'a', offset: 500, length: 12 }],
               'superset');
});

test('offsetToRanges (3 files)', function (t) {
  t.plan(4);

  var storage = new FileStorage([{
      path: 'a/b',
      length: 512
  }, {
      path: 'a/c',
      length: 65536
  }, {
      path: 'd/e',
      length: 512
  }]);

  t.deepEquals(storage.offsetToRanges(128, 384),
               [{ path: 'a/b', offset: 128, length: 384 }],
               '1 file');
  t.deepEquals(storage.offsetToRanges(512, 66048),
               [{ path: 'a/c', offset: 0, length: 65536 },
                { path: 'd/e', offset: 0, length: 512 }],
               '2 files');
  t.deepEquals(storage.offsetToRanges(500, 65568),
               [{ path: 'a/b', offset: 500, length: 12 },
                { path: 'a/c', offset: 0, length: 65536 },
                { path: 'd/e', offset: 0, length: 20 }],
               '3 files');
  t.deepEquals(storage.offsetToRanges(0, 131072),
               [{ path: 'a/b', offset: 0, length: 512 },
                { path: 'a/c', offset: 0, length: 65536 },
                { path: 'd/e', offset: 0, length: 512 }],
               'superset');
});

test('fileToOffset (1 file)', function (t) {
  t.plan(3);

  var storage = new FileStorage([{
      path: 'a',
      length: 512
  }]);

  t.equals(storage.fileToOffset('a', 0), 0, 'match 0');
  t.equals(storage.fileToOffset('a', 384), 384, 'match 384');
  t.equals(storage.fileToOffset('a', 513), null, 'out of bounds');
});

test('fileToOffset (3 files)', function (t) {
  t.plan(4);

  var storage = new FileStorage([{
      path: 'a/b',
      length: 512
  }, {
      path: 'a/c',
      length: 65536
  }, {
      path: 'd/e',
      length: 512
  }]);

  t.equals(storage.fileToOffset('a/b', 0), 0);
  t.equals(storage.fileToOffset('a/c', 65535), 66047);
  t.equals(storage.fileToOffset('d/e', 4), 66052);
  t.equals(storage.fileToOffset('d/e', 1024), null);
});


