var CHUNK_SIZE = 16384;

function DataDownload(pieceLength, totalLength) {
    this.pieceLength = pieceLength;
    this.totalLength = totalLength;
    this.pieces = [];
}

DataDownload.prototype.addPiece = function(index) {
    if (this.pieces.some(function(piece) {
        return piece.number === index;
    })) {
        return;
    }

    var pieceOffset = index * this.pieceLength;
    var length = Math.min(this.pieceLength, this.totalLength - pieceOffset);
    var piece = new DataPiece(index, length);
    this.pieces.push(piece);
};

/**
 * If it doesn't return a list with *amount* items, call addPiece()
 **/
DataDownload.prototype.nextToDownload = function(wire, amount) {
    var result = [];
    for(var i = 0; result.length < amount && i < this.pieces.length; i++) {
        var piece = this.piece;
        var pieceResults = piece.nextToDownload(wire, amount - result.length);
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
        if (chunk.state === 'missing' &&
            wire.peerPieces[this.number]) {

            chunk.state = 'requested';
            chunk.requestedBy[wireAddress] = Date.now();
            result.push(chunk);
        }
    }
    return result;
};

DataPiece.prototype.onComplete = function(wire, amount) {
    this.complete = true;
    delete this.chunks;
};
