var FileStream = require('../lib/file_stream')
var test = require('tape')


var DATA = [];
for(var i = 0; i < 16; i++) {
    DATA.push(i);
}

function MockStorage() {
    this.data = new Buffer(DATA);
}

MockStorage.prototype.pieceLength = 4;
MockStorage.prototype.length = DATA.length;

MockStorage.prototype.read = function(offset, length, cb) {
    cb(null, this.data.slice(offset, offset + length));
};

test('streams all data', function (t) {
    t.plan(1);

    var storage = new MockStorage();
    var validator = new process.EventEmitter();
    validator.isPieceComplete = function(index) {
        return true;
    };
    var stream = new FileStream(validator, storage, storage.pieceLength, 0, storage.length);
    var bufs = [];
    stream.on('data', function(data) {
        bufs.push(data);
    });
    stream.on('end', function() {
        var buf = Buffer.concat(bufs);
        t.equal(new Buffer(DATA).toString('hex'), buf.toString('hex'));
    });
});

test('streams data when it becomes available', function (t) {
    t.plan(1);

    var storage = new MockStorage();
    var validator = new process.EventEmitter();
    var complete = {};
    validator.isPieceComplete = function(index) {
        return complete[index];
    };
    function makeComplete(index) {
        complete[index] = true;
        validator.emit('piece:complete', index);
    }
    var stream = new FileStream(validator, storage, storage.pieceLength, 0, 16);
    var bufs = [];
    stream.on('data', function(data) {
        bufs.push(data);
    });
    stream.on('end', function() {
        var buf = Buffer.concat(bufs);
        t.equal(new Buffer(DATA).toString('hex'), buf.toString('hex'));
    });

    makeComplete(3);
    makeComplete(0);
    makeComplete(2);
    makeComplete(1);
});
