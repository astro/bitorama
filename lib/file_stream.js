var stream = require('stream');
var util = require('util');


util.inherits(FileStream, stream.Transform);
module.exports = FileStream;
function FileStream(validator, storage, offset, length) {
    stream.Transform.call(this);
    this.validator = validator;
    this.storage = storage;
    this.offset = offset;
    this.length = length;

    process.nextTick(this.streamNextPiece.bind(this));
}

FileStream.prototype._transform = function(chunk, encoding, cb) {
    cb(null, chunk);
};

FileStream.prototype.streamNextPiece = function() {
    var pieceLength = this.validator.pieceLength;
    var index = Math.floor(this.offset / pieceLength);
    if (this.length < 1) {
        this.emit('end');
        return;
    } else if (this.validator.isPieceComplete(index)) {
        var pieceOffset = this.offset - index * pieceLength;
        var length = Math.min(pieceLength - pieceOffset, this.length);
        var pieceStream = new PieceStream(this.storage, this.offset, length);
        this.offset += length;
        this.length -= length;
        pieceStream.pipe(this, { end: false });
        pieceStream.on('end', this.streamNextPiece.bind(this));
        // TODO: emit 'readable'?
    } else {
        /* Wait for data to become available */
        var onComplete = function(index_) {
            if (index_ === index) {
                this.validator.removeListener('piece:complete', onComplete);
                this.streamNextPiece();
            }
        }.bind(this);
        this.validator.on('piece:complete', onComplete);
        console.log("waiting for piece", index);
    }

    this.emit('prioritize', index);
};

util.inherits(PieceStream, stream.Readable);
function PieceStream(storage, offset, length) {
    stream.Readable.call(this);
    this.storage = storage;
    this.offset = offset;
    this.length = length;
}

PieceStream.prototype._read = function(n) {
    if (this.length < 1) {
        this.push(null);
        return;
    }

    var length = Math.min(this.length, n);
    var offset = this.offset;
    this.offset += length;
    this.length -= length;

    this.storage.read(offset, length, function(err, data) {
        if (err) {
            return this.emit('error', err);
        }
        this.push(data);
    }.bind(this));
};
