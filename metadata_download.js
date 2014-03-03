var inherits = require('inherits');
var crypto = require('crypto');
var bncode = require('bncode');
var MetadataExtension = require('bittorrent-protocol').MetadataExtension;

module.exports = MetadataDownloader;

var CHUNK_SIZE = 16384;

function MetadataDownloader(infoHash, swarm) {
    this.infoHash = infoHash;
    this.complete = false;
    this.pieces = [];
    this.sizes = [];

    swarm.on('wire', this._onWire.bind(this));
}
inherits(MetadataDownloader, process.EventEmitter);

MetadataDownloader.prototype._onWire = function(wire) {
    var metadata = new MetadataExtension(wire);
    metadata.on('enabled', function(metadataSize) {
        /* Seeding metadata */
        metadata.on('request', function(info) {
            if (wire.amChoking) {
                /* Ignore everything */
                return;
            }
        
            if (typeof info.piece === 'number' &&
                this.pieces[info.piece] &&
                this.pieces[info.piece].data) {

                console.log("Sending metadata piece", info.piece);
                metadata.data(info.piece, this.pieces[info.piece].data, this.size);
            } else {
                console.log("Rejecting metadata piece", info.piece);
                metadata.reject(info.piece);
            }
        }.bind(this));
        wire.on('extended-handshake', function(info) {
            if (typeof this.size === 'number') {
                /* Include size in outgoing extended hanshake as per
                 * BEP-0009 */
                info.metadata_size = this.size;
            }
        }.bind(this));

        /* Leeching metadata */
        if (this.complete) {
            /* Nothing to do, could leech & seed actual data */
            return;
        }
        wire.interested();
        var uninterested = function() {
            console.log("now uninterested in", wire.remoteAddress);
            wire.uninterested();
        };
        this.on('complete', uninterested);
        wire.on('end', function() {
            this.removeListener('complete', uninterested);
        }.bind(this));
        

        if (this.sizes.indexOf(metadataSize) < 0)
            this.sizes.push(metadataSize);

        wire.on('unchoke', function() {
            this.canRequest(wire.remoteAddress, metadata);
        }.bind(this));

        metadata.on('data', function(info, data) {
            console.log("metadata data", info, data.length);
            if (info && typeof info.piece === 'number') {
                console.log("set metadata", info.piece);
                this.pieces[info.piece].data = data;
                this.pieces[info.piece].blacklist.push(wire.remoteAddress);
            
                this.checkHashes();
            }

            this.canRequest(wire.remoteAddress, metadata);
        }.bind(this));
        metadata.on('reject', function(info, data) {
            if (info && typeof info.piece === 'number') {
                if (!this.pieces[info.piece]) {
                    /* Weird, we didn't request that one. Anyhow: */
                    this.pieces[info.piece] = {
                        number: i,
                        blacklist: []
                    };
                }
                this.pieces[info.piece].blacklist.push(wire.remoteAddress);
            }
            
            this.canRequest(wire.remoteAddress, metadata);
        }.bind(this));
    }.bind(this));
};

MetadataDownloader.prototype.nextToDownload = function(wireAddress) {
    if (this.sizes.length < 1 || this.complete) {
        return null;
    }

    var piece;
    var now = Date.now();
    var minLastRequest = now, minLastRequestIdx = -1;
    for(var i = 0; i < Math.ceil(Math.max(this.sizes) / CHUNK_SIZE); i++) {
        if (!this.pieces[i]) {
            /* Never before requested */
            piece = this.pieces[i] = {
                number: i,
                lastRequest: now,
                blacklist: []
            };
            return piece;
        }

        var lastRequest;
        if (!this.pieces[i].data &&
            (lastRequest = (this.pieces[i].lastRequest || 0)) < minLastRequest &&
            this.pieces[i].blacklist.indexOf(wireAddress) < 0) {

            minLastRequest = lastRequest;
            minLastRequestIdx = i;
        }
    }
    if (minLastRequestIdx >= 0) {
        piece = this.pieces[minLastRequestIdx];
        piece.lastRequest = now;
        return piece;
    }

    return null;
};

MetadataDownloader.prototype.canRequest = function(wireAddress, wireMetadata) {
    var piece;
    if ((piece = this.nextToDownload(wireAddress))) {
        console.log("Req metadata", piece.number, "from", wireAddress);
        wireMetadata.request(piece.number);
    }
};

MetadataDownloader.prototype.checkHashes = function() {
    if (this.complete) {
        return;
    }

    var allContinuous = true;
    var i;
    for(i = 0; i < this.sizes.length; i++) {
        var size = this.sizes[i];
        var pieceAmount = Math.ceil(size / CHUNK_SIZE);
        var j;
        var continuous = true;
        for(j = 0; continuous && j < pieceAmount; j++) {
            continuous = this.pieces[j] && !!this.pieces[j].data;
        }
        console.log("size is continuous", size, pieceAmount, continuous);
        if (!continuous) {
            allContinuous = false;
            continue;
        }

        var sha1sum = crypto.createHash('sha1');
        for(j = 0; j < pieceAmount; j++) {
            sha1sum.update(this.pieces[j].data);
        }
        var sum = sha1sum.digest('hex');
        if (sum === this.infoHash) {
            var buf, info;
            try {
                buf = Buffer.concat(
                    this.pieces.slice(0, pieceAmount).
                    map(function(piece){
                        return piece.data;
                    }));
                info = bncode.decode(buf);
                this.size = buf.length;
            } catch (e) {
                console.warn(e.stack);
            }
            if (info) {
                this.onComplete(info);
                return;
            }
        } else {
            console.log("metadata infoHash mismatch:", sum, "!=", this.infoHash);
        }
    }

    if (allContinuous) {
        /* complete but found no matching infoHash, drop a piece */
        i = Math.floor(this.pieces.length * Math.random());
        console.log("complete but no matching infoHash for", this.infoHash, "dropping metadata piece", i);
        delete this.pieces[i].data;
        this.pieces[i].lastRequest = 0;
    }
};

MetadataDownloader.prototype.onComplete = function(info) {
    this.complete = true;
    this.emit('complete', info);
};
