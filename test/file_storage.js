var FileStorage = require('../lib/file_storage')
var test = require('tape')
var fs = require('fs')
var exec = require('child_process').exec

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


test('FileStorage state', function (t) {
    t.plan(6);

    var base = /*__dirname + "/ */ "test/data/storage-1/";
    var storage = new FileStorage([{
        path: base + "abc.txt",
        length: 3
    }, {
        path: base + "hello_world.txt",
        length: 11
    }, {
        path: base + "xyz.txt",
        length: 3
    }]);

    function rfs(name) {
        return fs.readFileSync(base + name, { encoding: "utf8" });
    }
    storage.write(0, new Buffer("abcHello "), function(err) {
        if (err) {
            t.fail(err);
        }
        t.equals(rfs("abc.txt"), "abc");

        storage.read(0, 3, function(err, data) {
            if (err) {
                t.fail(err);
            }
            t.equals(data.toString(), "abc");

            done();
        });
    });
    storage.write(9, new Buffer("Worldxyz"), function(err) {
        if (err) {
            t.fail(err);
        }
        t.equals(rfs("hello_world.txt"), "Hello World");
        t.equals(rfs("xyz.txt"), "xyz");

        storage.read(11, 6, function(err, data) {
            if (err) {
                t.fail(err);
            }
            t.equals(data.toString(), "rldxyz");

            done();
        });
    });

    var pending = 2;
    function done() {
        pending--;
        if (pending < 1) {
            exec("rm -r " + base, function() {
                t.ok(true, "cleanup");
            });
        }
    }
});
