var FileStream = require('../lib/file_stream')
var test = require('tape')


var DATA = [];
for(var i = 0; i < 256; i++) {
    DATA.push(i);
}

function MockStorage() {
    this.data = new Buffer(DATA);
}

MockStorage.prototype.length = DATA.length;

MockStorage.prototype.read = function(offset, length, cb) {
    cb(null, this.data.slice(offset, offset + length));
};

test('streams all data', function (t) {
    t.plan(1);

    var storage = new MockStorage();
    var validator = new process.EventEmitter();
    validator.pieceLength = 4;
    validator.isPieceComplete = function(index) {
        return true;
    };
    var stream = new FileStream(validator, storage, 0, storage.length);
    var bufs = [];
    stream.on('data', function(data) {
        bufs.push(data);
    });
    stream.on('end', function() {
        var buf = Buffer.concat(bufs);
        t.equal(new Buffer(DATA).toString('hex'), buf.toString('hex'));
    });
});

test('streams partial data', function (t) {
    t.plan(1);

    var storage = new MockStorage();
    var validator = new process.EventEmitter();
    validator.pieceLength = 8;
    validator.isPieceComplete = function(index) {
        return true;
    };
    var stream = new FileStream(validator, storage, 15, 42);
    var bufs = [];
    stream.on('data', function(data) {
        bufs.push(data);
    });
    stream.on('end', function() {
        var buf = Buffer.concat(bufs);
        t.equal(new Buffer(DATA).slice(15, 57).toString('hex'), buf.toString('hex'));
    });
});

test('streams data when it becomes available', function (t) {
    t.plan(1);

    var storage = new MockStorage();
    var validator = new process.EventEmitter();
    validator.pieceLength = 16;
    var complete = {};
    validator.isPieceComplete = function(index) {
        return complete[index];
    };
    function makeComplete(index) {
        complete[index] = true;
        validator.emit('piece:complete', index);
    }
    var stream = new FileStream(validator, storage, 0, 64);
    var bufs = [];
    stream.on('data', function(data) {
        bufs.push(data);
    });
    stream.on('end', function() {
        var buf = Buffer.concat(bufs);
        t.equal(new Buffer(DATA).slice(0, 64).toString('hex'), buf.toString('hex'));
    });

    makeComplete(3);
    makeComplete(0);
    makeComplete(2);
    makeComplete(1);
});

test('streams partial data when it becomes available', function (t) {
    t.plan(1);

    var storage = new MockStorage();
    var validator = new process.EventEmitter();
    validator.pieceLength = 64;
    var complete = {};
    validator.isPieceComplete = function(index) {
        return complete[index];
    };
    function makeComplete(index) {
        complete[index] = true;
        validator.emit('piece:complete', index);
    }
    var stream = new FileStream(validator, storage, 23, 100);
    var bufs = [];
    stream.on('data', function(data) {
        bufs.push(data);
    });
    stream.on('end', function() {
        var buf = Buffer.concat(bufs);
        t.equal(new Buffer(DATA).slice(23, 123).toString('hex'), buf.toString('hex'));
    });

    makeComplete(3);
    makeComplete(0);
    makeComplete(2);
    makeComplete(1);
});
