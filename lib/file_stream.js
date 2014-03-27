var stream = require('stream');
var util = require('util');


util.inherits(FileStream, stream.Transform);
module.exports = FileStream;
function FileStream(validator, storage, pieceLength, offset, length) {
    stream.Transform.call(this);
    this.validator = validator;
    this.storage = storage;
    this.pieceLength = pieceLength;
    this.offset = offset;
    this.length = length;

    process.nextTick(this.streamNextPiece.bind(this));
}

FileStream.prototype._transform = function(chunk, encoding, cb) {
    console.log("FileStream transform", chunk && chunk.length);
    cb(null, chunk);
};

FileStream.prototype.streamNextPiece = function() {
    var index = Math.floor(this.offset / this.pieceLength);
    if (this.length < 1) {
        this.emit('end');
        return;
    } else if (this.validator.isPieceComplete(index)) {
        console.log("streaming piece", index);
        var pieceOffset = this.offset - index * this.pieceLength;
        var length = Math.min(this.pieceLength - pieceOffset, this.length);
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

    console.log("read", offset, "+", length);
    this.storage.read(offset, length, function(err, data) {
        if (err) {
            return this.emit('error', err);
        }
        console.log("PieceStream", offset, "+", data.length);
        this.push(data);
    }.bind(this));
};
