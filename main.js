var Swarm = require('bittorrent-swarm')
var Magnet = require('magnet-uri')
var TrackerGroup = require('bittorrent-tracker').TrackerGroup;
var MetadataExtension = require('bittorrent-protocol').MetadataExtension;
var bncode = require('bncode');

process.argv.slice(2).forEach(function(url) {
    if (/^magnet:/.test(url)) {
        var parsed = Magnet(url)
        console.log(parsed)
        if ((m = parsed.xt.match(/^urn:btih:(.{40})/))) {
            var infoHash = m[1];
            var peerId = new Buffer([0x2d, 0x41, 0x51, 0x32, 0x30, 0x36, 0x30, 0x2d, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32]);
            var swarm = new Swarm(infoHash, peerId);

            swarm.on('wire', function(wire) {
                // a relevant wire has appeared, see `bittorrent-protocol` for more info
                var metadata = new MetadataExtension(wire);

                var metadataBufs = [], metadataChunk = 0;
                function reqMetadata() {
                    if (!metadata.metadataSize)
                        return;

                    while(metadataBufs[metadataChunk] &&
                          metadataChunk * metadata.chunkSize < metadata.metadataSize)
                        metadataChunk++;

                    if (metadataChunk * metadata.chunkSize >= metadata.metadataSize &&
                        !metadataBufs.some(function(buf) {
                            return typeof buf === 'undefined';
                        })) {

                        var info = bncode.decode(Buffer.concat(metadataBufs));
                        console.log("info", info);
                        console.log("name", info.name.toString('utf8'));
                    } else {
                        console.log(wire.remoteAddress, "metadata req", metadataChunk);
                        metadata.request(metadataChunk);
                        metadataChunk++;
                    }
                }
                wire.on('bitfield', function(b) {
                    wire.interested();
                    // console.log("interested")
                });
                // console.log("hooked on bitfield");
                // wire.on('extended', function() {
                //     console.log("extended", arguments);
                // });
                wire.on('unchoke', function() {
                    console.log("unchoke");
                });
                wire.on('unchoke', reqMetadata);
                metadata.on('data', function(info, buf) {
                    console.log("metadata data", info, buf);
                    metadataBufs[info.piece] = buf;
                    reqMetadata();
                });

                var pieces = 612;
                var bf = new Buffer(Math.ceil(612 / 8));
                wire.bitfield(bf);

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

            var tgs = parsed.tr.map(function(t) {
                var tg = new TrackerGroup([t]);
                tg.on('info', function(info) {
                    info.info_hash = infoHash;
                    info.peer_id = peerId;
                });
                tg.on('peers', function(peers) {
                    console.log('peers', peers);
                    peers.forEach(function(peer) {
                        /* TODO: fix for ipv6 */
                        console.log("add", peer.ip + ":" + peer.port);
                        swarm.add(peer.ip + ":" + peer.port);
                    });
                });
                tg.start();
                return tg;
            });
        } else {
            console.log("Ignoring magnet link", parsed.xt)
        }
    } else {
        console.log("Ignoring url", url)
    }
});

