var Swarm = require('bittorrent-swarm')
var TrackerGroup = require('bittorrent-tracker').TrackerGroup;
var MetadataDownload = require('./metadata_download');
var DataValidator = require('./data_validator');
var DataDownload = require('./data_download');
var infoToFiles = require('./info_files');
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
    var pieceLength = info['piece length'];
    var files = infoToFiles(info, this.infoHash);
    var totalLength = 0;
    files.forEach(function(file) {
        totalLength += file.length;
    });

    this.validator = new DataValidator(sha1sums, pieceLength, totalLength);
    this.rarity = new RarityMap(this.swarm);
    this.download = new DataDownload(pieceLength, totalLength);

    this.swarm.wires.forEach(function(wire) {
        wire.on('bitfield', function() {
            this._canInterest(wire);
        }.bind(this));
        wire.on('have', function() {
            this._canInterest(wire);
        }.bind(this));
        this._canInterest(wire);

        wire.on('unchoke', function() {
            this._canRequest(wire);
        }.bind(this));
        this._canRequest(wire);
    }.bind(this));
};

TorrentContext.prototype._canInterest = function(wire) {
    var interested = false;
    var piecesAmount = this.validator.pieces.length;
    for(var i = 0; !interested && i < piecesAmount; i++) {
        interested =
            wire.peerPieces[i] &&
            !this.validator.isPieceComplete(i);
    }
    console.log(wire.remoteAddress, "interested", !!interested);
    if (interested) {
        wire.interested();
    } else {
        wire.uninterested();
    }
};

TorrentContext.prototype._canRequest = function(wire) {
    var minReqs = 2, maxReqs = Math.max(minReqs, 10);

    if (wire.peerChoking || wire.requests.length >= minReqs) {
        return;
    }
    console.log("_canRequest", wire.remoteAddress);

    var pieceFilter = function(index) {
        // TODO: + not already requested
        return wire.peerPieces[index] &&
            !this.validator.isPieceComplete(index);
    }.bind(this);

    var needMore = true;
    while(needMore) {
        var chunks = this.download.nextToDownload(wire, maxReqs - wire.requests.length);
        chunks.forEach(function(chunk) {
            console.log(wire.remoteAddress, "request", chunk);
            wire.request(chunk.piece, chunk.offset, chunk.length, function(error, data) {
                console.log("request cb", arguments);
                this._canRequest(wire);
            }.bind(this));
        }.bind(this));

        needMore = wire.requests.length < maxReqs;
        if (needMore) {
            var index = this.rarity.findRarest(pieceFilter);
            if (typeof index === 'number') {
                this.download.addPiece(index);
            } else {
                /* Nothing left, TODO: go piece stealing */
                needMore = false;
            }
        }
    }
};
