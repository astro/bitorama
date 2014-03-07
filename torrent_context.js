var Swarm = require('bittorrent-swarm')
var TrackerGroup = require('bittorrent-tracker').TrackerGroup;
var MetadataDownload = require('./metadata_download');
var DataValidator = require('./data_validator');
var DataDownload = require('./data_download');
var infoToFiles = require('./info_files');
var FileStorage = require('./file_storage');
var RarityMap = require('./rarity_map');

module.exports = TorrentContext;

function TorrentContext(infoHash, info) {
    /* TODO: generate: */
    this.peerId = new Buffer([0x2d, 0x41, 0x51, 0x32, 0x30, 0x36, 0x30, 0x2d, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32]);
    this.infoHash = infoHash;
    this.swarm = new Swarm(infoHash, this.peerId);

    var metadata = new MetadataDownload(infoHash, this.swarm, /* TODO: */ info);
    if (info) {
        this._onInfo(info);
    } else {
        metadata.on('complete', this._onInfo.bind(this));
    }

    this.swarm.on('wire', function(wire) {
        wire.setTimeout(3000);
        wire.on('extended', function(ext, info) {
            if (ext === 'handshake' &&
                Buffer.isBuffer(info.yourip) &&
                info.yourip.length === 4) {

                var myip = [0, 1, 2, 3].map(function(i) {
                    return info.yourip[i];
                }).join(".");
                // console.log(wire.remoteAddress, "says my IP is:", myip);
            }
        });
    });
}

TorrentContext.prototype.addTrackerGroup = function(urls) {
    var tg = new TrackerGroup(urls);
    tg.on('info', function(info) {
        info.info_hash = this.infoHash;
        info.peer_id = this.peerId;
    }.bind(this));
    tg.on('peers', function(peers) {
        console.log('peers', peers);
        peers.forEach(function(peer) {
            /* TODO: fix for ipv6 */
            this.swarm.add(peer.ip + ":" + peer.port);
        }.bind(this));
    }.bind(this));
    tg.start();
};

TorrentContext.prototype._onInfo = function(info) {
    if (this.info) {
        /* Already set */
        return;
    }

    this.info = info;
    console.log("info", info);
    var sha1sums = [];
    for(var i = 0; i < info.pieces.length - 19; i += 20) {
        sha1sums.push(info.pieces.slice(i, i + 20));
    }
    this.pieceLength = info['piece length'];
    var files = infoToFiles(info, this.infoHash);
    var totalLength = 0;
    files.forEach(function(file) {
        totalLength += file.length;
    });
    console.log("totalLength", totalLength, "files", files);
    this.storage = new FileStorage(files);

    this.download = new DataDownload(this.pieceLength, totalLength);
    this.validator = new DataValidator(sha1sums, this.pieceLength, totalLength);
    this.rarity = new RarityMap(this.swarm, this.validator.pieces.length);
    this.validator.on('read', function(index, offset, length) {
        var range = this.download.getValidateableRange(index, offset)
        if (range.length > 0) {
            // console.log("validatable range", index, ":", range);
            var totalOffset = index * this.pieceLength + range.offset;
            this.storage.read(totalOffset, range.length, function(err, data) {
                if (data) {
                    this.validator.onData(index, range.offset, data);
                }
            }.bind(this));
        }
    }.bind(this));
    this.validator.on('piece:complete', function(index) {
        console.warn("Piece", index, "complete");
        this.download.removePiece(index);
        this.swarm.wires.forEach(function(wire) {
            wire.have(index);
            this._canInterest(wire);
        }.bind(this));
    }.bind(this));
    this.validator.on('piece:corrupt', function(index) {
        console.warn("Piece", index, "corrupt, must retry...");
        this.download.pieceCorrupted(index);
    }.bind(this));

    var setupWire = function(wire) {
        /* Send bitfield */
        wire.bitfield(this.validator.bitfield);
        /* Change interest status */
        wire.on('bitfield', function() {
            this._canInterest(wire);
        }.bind(this));
        wire.on('have', function() {
            this._canInterest(wire);
        }.bind(this));
        this._canInterest(wire);

        /* Start requesting */
        wire.on('unchoke', function() {
            this._canRequest(wire);
        }.bind(this));
        this._canRequest(wire);

        wire.on('interested', function() {
            console.log(wire.remoteAddress, "peer is interested");
        }.bind(this));

        wire.on('end', function() {
            wire.requests.forEach(function(req) {
                this.download.onError({
                    piece: req.index,
                    offset: req.offset,
                    length: req.length
                });
            });
        }.bind(this));
    }.bind(this);
    this.swarm.wires.forEach(setupWire);
    this.swarm.on('wire', setupWire);

    /* Stats print loop */
    setInterval(function() {
        this.download.pieces.forEach(function(piece) {
            var requested = 0, downloaded = 0, total = 0;
            piece.chunks.forEach(function(chunk) {
                total += chunk.length;
                if (chunk.state === 'requested')
                    requested += chunk.length;
                else if (chunk.state === 'downloaded')
                    downloaded += chunk.length;
            });
            function p(l) {
                return Math.floor(100 * l / total) + "%";
            }
            // console.log(piece.index + ":", p(requested), "requested", p(downloaded), "downloaded, since", Math.floor((Date.now() - piece.started) / 100) / 10, "rarity:", this.rarity.rarity[piece.index]);
        }.bind(this));
        var unchoked = this.swarm.wires.filter(function(wire) {
            return !wire.peerChoking;
        }).length;
        var interested = this.swarm.wires.filter(function(wire) {
            return wire.peerInterested;
        }).length;
        console.log(Math.floor(100 * (1 - this.validator.getBytesLeft() / totalLength)) + "% Interested in", this.download.pieces.length, "pieces with", this.swarm.wires.length, "peers,", unchoked, "unchoked", this.swarm.downloadSpeed(), "down", interested, "interested", this.swarm.uploadSpeed(), "up");
    }.bind(this), 1000);
};

TorrentContext.prototype._canInterest = function(wire) {
    var interested = false;
    var piecesAmount = this.validator.pieces.length;
    for(var i = 0; !interested && i < piecesAmount; i++) {
        interested =
            wire.peerPieces.get(i) &&
            !this.validator.isPieceComplete(i);
    }
    if (interested) {
        wire.interested();
    } else {
        wire.uninterested();
    }
};

TorrentContext.prototype._canRequestAll = function(wire) {
    this.swarm.wires.forEach(this._canRequest.bind(this));
};

TorrentContext.prototype._canRequest = function(wire) {
    /* Pieces per second */
    var pps = wire.downloadSpeed() / DataDownload.chunkSize;
    var minReqs = Math.max(2, Math.ceil(0.2 * pps));
    var maxReqs = Math.max(minReqs + 1, Math.ceil(0.5 * pps));

    if (wire.peerChoking || wire.requests.length >= minReqs || wire._finished) {
        return;
    }

    var pieceFilter = function(index) {
        return wire.peerPieces.get(index) &&
            !this.validator.isPieceComplete(index) &&
            !this.download.isDownloadingPiece(index);
    }.bind(this);

    var needMore = true;
    while(needMore) {
        var chunks = this.download.nextToDownload(wire, maxReqs - wire.requests.length);
        // console.log(wire.remoteAddress, "will be requested with", chunks.length, "chunks for bandwidth:", wire.downloadSpeed());
        chunks.forEach(function(chunk) {
            // console.log(wire.remoteAddress, "request", chunk.index, ":", chunk.offset, "+", chunk.length);
            wire.request(chunk.index, chunk.offset, chunk.length, function(error, data) {
                if (error) {
                    // console.warn(wire.remoteAddress, "cb", error.message, { destroyed: wire.destroyed, _finished: wire._finished });
                    if (error.message == 'request has timed out') {
                        wire.cancel(chunk.index, chunk.offset, chunk.length);
                    }
                    this.download.onError(chunk);
                    this._canRequestAll();
                } else {
                    // console.warn(wire.remoteAddress, "cb", data.length);
                    this.storage.write(chunk.index * this.pieceLength + chunk.offset, data, function(err) {
                        if (err) {
                            console.error(err.stack);
                            return;
                        }
                        this.download.onDownloaded(chunk);
                        this.validator.onData(chunk.index, chunk.offset, data);
                        this._canRequest(wire);
                    }.bind(this));
                }
            }.bind(this));
        }.bind(this));

        needMore = wire.requests.length < maxReqs;
        if (needMore) {
            var index = this.rarity.findRarest(pieceFilter);
            if (typeof index === 'number') {
                if (this.download.addPiece(index)) {
                    // console.log("needed more, added piece", index);
                } else {
                    console.log("is already downloading", index, ":", this.download.getPiece(index));
                    needMore = false;
                }
            } else {
                /* Nothing left, TODO: go piece stealing */
                // console.log("needed more but nothing left");
                needMore = false;
            }
        }
    }
};
