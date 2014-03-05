var Swarm = require('bittorrent-swarm')
var TrackerGroup = require('bittorrent-tracker').TrackerGroup;
var MetadataDownload = require('./metadata_download');

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
        // a relevant wire has appeared, see `bittorrent-protocol` for more info
        wire.on('bitfield', function(b) {
            // wire.interested();
            // console.log("interested")
        });
        // console.log("hooked on bitfield");
        // wire.on('extended', function() {
        //     console.log("extended", arguments);
        // });
        wire.on('unchoke', function() {
            console.log("unchoke");
        });

        // var pieces = 612;
        // var bf = new Buffer(Math.ceil(612 / 8));
        // wire.bitfield(bf);

        wire.on('extended', function(ext, info) {
            if (ext === 'handshake' &&
                Buffer.isBuffer(info.yourip) &&
                info.yourip.length === 4) {

                var myip = [0, 1, 2, 3].map(function(i) {
                    return info.yourip[i];
                }).join(".");
                console.log(wire.remoteAddress, "says my IP is:", myip);
            }
        });
    });
}

TorrentContext.prototype._onInfo = function(info) {
    if (this.info) {
        /* Already set */
        return;
    }

    this.info = info;
    console.log("info", info);
};

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
