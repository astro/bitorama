var CHUNK_SIZE = 16384;

module.exports = DataDownload;
module.exports.chunkSize = CHUNK_SIZE;

/**
 * Tracks pieces that are currently in progress
 **/
function DataDownload(pieceLength, totalLength) {
    this.pieceLength = pieceLength;
    this.totalLength = totalLength;
    /* Ordered by priority */
    this.pieces = [];
}

DataDownload.prototype._newPiece = function(index) {
    var pieceOffset = index * this.pieceLength;
    var length = Math.min(this.pieceLength, this.totalLength - pieceOffset);
    var piece = new DataPiece(index, length);
    piece.started = Date.now();
    return piece;
};

DataDownload.prototype.addPiece = function(index) {
    if (this.pieces.some(function(piece) {
        return piece.index === index;
    })) {
        console.log("already added piece", index);
        return false;
    }

    this.pieces.push(this._newPiece(index));
    return true;
};

DataDownload.prototype.prioritizePieces = function(indexes) {
    console.log("prioritizePieces", indexes);
    var prioritized = indexes.map(function(index) {
        var i;
        for(i = 0; i < this.pieces.length; i++) {
            if (this.pieces[i].index === index) {
                break;
            }
        }
        if (i < this.pieces.index) {
            return this.pieces[i];
        } else {
            return this._newPiece(index);
        }
    }.bind(this));
    var remaining = this.pieces.filter(function(piece) {
        return indexes.indexOf(piece.index) < 0;
    });
    this.pieces = prioritized.concat(remaining);
};

DataDownload.prototype.removePiece = function(index) {
    this.pieces = this.pieces.filter(function(piece) {
        return piece.index !== index;
    });
};

DataDownload.prototype.getPiece = function(index) {
    for(var i = 0; i < this.pieces.length; i++) {
        if (this.pieces[i].index === index) {
            return this.pieces[i];
        }
    }
    return null;
};

DataDownload.prototype.isDownloadingPiece = function(index) {
    return !!this.getPiece(index);
};

DataDownload.prototype.getValidateableRange = function(index, offset) {
    return this.getPiece(index).getValidateableRange(offset);
};

DataDownload.prototype.onDownloaded = function(chunk) {
    chunk.state = 'downloaded';
};

DataDownload.prototype.onError = function(chunk) {
    chunk.state = 'missing';
};

DataDownload.prototype.pieceCorrupted = function(index) {
    var piece;
    if ((piece = this.getPiece(index))) {
        piece.pieceCorrupted();
    }
};

DataDownload.prototype.onComplete = function(index) {
    this.pieces = this.pieces.filter(function(piece) {
        return piece.index !== index;
    });
};

/**
 * If it doesn't return a list with *amount* items, call addPiece()
 **/
DataDownload.prototype.nextToDownload = function(wire, amount) {
    var result = [];
    for(var i = 0; result.length < amount && i < this.pieces.length; i++) {
        var piece = this.pieces[i];
        var pieceResults = piece.nextToDownload(wire, amount - result.length).
                map(function(chunk) {
                    chunk.index = piece.index;
                    return chunk;
                });
        if (pieceResults.length > 0) {
            result = result.concat(pieceResults);
        }
    }
    return result;
};

function DataPiece(index, length) {
    this.index = index;
    this.complete = false;
    this.chunks = [];
    for(var offset = 0; offset < length; offset += CHUNK_SIZE) {
        var chunkLength = Math.min(CHUNK_SIZE, length - offset);
        this.chunks.push({
            offset: offset,
            length: chunkLength,
            state: 'missing',
            requestedBy: {}
        });
    }
}

DataPiece.prototype.nextToDownload = function(wire, amount) {
    if (this.complete || !wire.peerPieces.get(this.index)) {
        return [];
    }

    var result = [];
    for(var i = 0; result.length < amount && i < this.chunks.length; i++) {
        var chunk = this.chunks[i];
        /* TODO: have previously requested timeout */
        if (chunk.state === 'missing') {

            chunk.state = 'requested';
            chunk.requestedBy[wire.remoteAddress] = Date.now();
            result.push(chunk);
        }
    }
    return result;
};

DataPiece.prototype.getValidateableRange = function(offset) {
    var i, chunk;
    /* Skip over preceding chunks */
    for(i = 0; i < this.chunks.length; i++) {
        chunk = this.chunks[i];
        if (offset >= chunk.offset &&
            offset < chunk.offset + chunk.length
           ) {
           break;
        }
    }
    /* Select matching */
    var length = 0;
    for(; i < this.chunks.length; i++) {
        chunk = this.chunks[i];
        if (chunk.state !== 'downloaded') {
            break;
        }
        if (chunk.offset < offset) {
           length += chunk.length - offset + chunk.offset;
        } else {
            length += chunk.length;
        }
    }
    return {
        offset: offset,
        length: length
    };
};

DataPiece.prototype.onComplete = function(wire, amount) {
    this.complete = true;
    delete this.chunks;
};

DataPiece.prototype.pieceCorrupted = function(index) {
    for(var i = 0; i < this.chunks.length; i++) {
        var chunk = this.chunks[i];
        if (chunk.state === 'downloaded') {
            chunk.state = 'missing';
        }
    }
};
