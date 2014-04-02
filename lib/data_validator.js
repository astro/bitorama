var inherits = require('inherits');
var crypto = require('crypto');
var BitField = require('bitfield')

var SHA1SUM_NULL = "da39a3ee5e6b4b0d3255bfef95601890afd80709";

module.exports = DataValidator;

/**
 * Per-swarm context
 **/
function DataValidator(sha1sums, pieceLength, totalLength) {
    this.pieces = [];
    var pieceAmount = Math.ceil(totalLength / pieceLength);
    for(var n = 0; n < pieceAmount; n++) {
        (function(n) {
            var length = Math.min(pieceLength, totalLength - n * pieceLength);
            var piece = new PieceValidator(sha1sums[n] || SHA1SUM_NULL, length);
            piece.on('read', function(offset, length) {
                this.emit('read', n, offset, length);
            }.bind(this));
            piece.on('complete', function() {
                this.bitfield.set(n);
                this.emit('piece:complete', n);
                this._checkCompleteness();
            }.bind(this));
            piece.on('corrupt', function() {
                this.emit('piece:corrupt', n);
            }.bind(this));
            this.pieces.push(piece);
        }).bind(this)(n);
    }
    this.bitfield = new BitField(pieceAmount);
    // keep pieceLength for users like FileStream
    this.pieceLength = pieceLength;

    // TODO: start recovery
}
inherits(DataValidator, process.EventEmitter);

DataValidator.prototype.isPieceComplete = function(index) {
    return this.pieces[index].complete;
};

DataValidator.prototype.getBytesLeft = function() {
    var result = 0;
    for(var i = 0; i < this.pieces.length; i++) {
        if (!this.pieces[i].complete) {
            result += this.pieces[i].pieceLength;
        }
    }
    return result;
};

DataValidator.prototype.onData = function(index, offset, buffer) {
    var piece;
    if ((piece = this.pieces[index])) {
        piece.onData(offset, buffer);
    }
};

DataValidator.prototype._checkCompleteness = function() {
    /* All complete = not one that is not complete */
    var complete = !this.pieces.some(function(piece) {
        return !piece.complete;
    });
    if (!this.complete && complete) {
        this.complete = true;
        this.emit('complete');
    }
};


/**
 * Per-piece tracking
 **/
function PieceValidator(expectedSha1, pieceLength) {
    this.expectedSha1 = Buffer.isBuffer(expectedSha1) ?
        expectedSha1.toString('hex') :
        expectedSha1;
    this.pieceLength = pieceLength;
    this.sha1pos = 0;
}
inherits(PieceValidator, process.EventEmitter);

PieceValidator.prototype.onData = function(offset, data) {
    if (this.complete) {
        throw new Error("Complete piece received data to validate");
    }
    if (offset !== this.sha1pos) {
        /* Need to read later */
        return;
    }

    if (!this.sha1) {
        this.sha1 = crypto.createHash('sha1');
    }
    this.sha1.update(data);
    this.sha1pos += data.length;

    if (this.sha1pos >= this.pieceLength) {
        var sha1sum = this.sha1.digest('hex');
        delete this.sha1;
        this.sha1pos = 0;
        if (sha1sum === this.expectedSha1) {
            this._onComplete();
        } else {
            console.warn("Piece SHA1 mismatch:", sha1sum, "!=", this.expectedSha1);
            this.emit('corrupt');
        }
    } else {
        /* Written something, may continue hashing */
        this.emit('read', this.sha1pos, this.pieceLength - this.sha1pos);
    }
};

PieceValidator.prototype._onComplete = function() {
    delete this.expectedSha1;
    this.complete = true;
    /* TODO: drop pieces */
    this.emit('complete');
};
