var CHUNK_SIZE = 16384;

module.exports = DataDownload;

/**
 * Tracks pieces that are currently in progress
 **/
function DataDownload(pieceLength, totalLength) {
    this.pieceLength = pieceLength;
    this.totalLength = totalLength;
    /* Ordered by priority */
    this.pieces = [];
}

DataDownload.prototype.addPiece = function(index) {
    if (this.pieces.some(function(piece) {
        return piece.number === index;
    })) {
        console.log("already added piece", index);
        return false;
    }

    var pieceOffset = index * this.pieceLength;
    var length = Math.min(this.pieceLength, this.totalLength - pieceOffset);
    var piece = new DataPiece(index, length);
    this.pieces.push(piece);
    console.log("added piece", index);
    return true;
};

DataDownload.prototype.removePiece = function(index) {
    this.pieces = this.pieces.filter(function(piece) {
        return piece.number !== index;
    });
};

DataDownload.prototype.getPiece = function(index) {
    for(var i = 0; i < this.pieces.length; i++) {
        if (this.pieces[i].piece === index) {
            return this.pieces[i];
        }
    }
    return null;
};

DataDownload.prototype.isDownloadingPiece = function(index) {
    return !!this.getPiece(index);
};

DataDownload.prototype.onDownloaded = function(chunk) {
    chunk.state = 'downloaded';
};

DataDownload.prototype.onError = function(chunk) {
    chunk.state = 'missing';
};

DataDownload.prototype.onComplete = function(index) {
    this.pieces = this.pieces.filter(function(piece) {
        return piece.number !== index;
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
                    chunk.piece = i;
                    return chunk;
                });
        if (pieceResults.length > 0) {
            result = result.concat(pieceResults);
        }
    }
    return result;
};

function DataPiece(number, length) {
    this.number = number;
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
    if (this.complete || !wire.peerPieces[this.number]) {
        return [];
    }

    var result = [];
    for(var i = 0; result.length < amount && i < this.chunks.length; i++) {
        var chunk = this.chunks[i];
        /* TODO: have previously requested timeout */
        if (chunk.state === 'missing' &&
            wire.peerPieces[this.number]) {

            chunk.state = 'requested';
            chunk.requestedBy[wire.remoteAddress] = Date.now();
            result.push(chunk);
        }
    }
    return result;
};

DataPiece.prototype.onComplete = function(wire, amount) {
    this.complete = true;
    delete this.chunks;
};
