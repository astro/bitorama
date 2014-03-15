var fs = require('fs');
var Magnet = require('magnet-uri')
var TorrentContext = require('./lib/torrent_context');
var Remote = require('./lib/remote_stream');
var RemoteAPI = require('./lib/remote_api');


process.on('uncaughtException', function(e) {
    console.error(e.stack);
});


var ctxs = {};

function loadUrl(url, cb) {
    if (/^magnet:/.test(url)) {
        var parsed = Magnet(url)
        var infoHash = parsed && parsed.infoHash;

        if (infoHash && !ctxs.hasOwnProperty(infoHash)) {
            var ctx = ctxs[infoHash] = new TorrentContext(infoHash);
            parsed.tr.forEach(function(t) {
                ctx.addTrackerGroup([t]);
            });

            // ctx.on('end', function() {
            //     delete ctxs[parsed.infoHash];
            // });

            cb(null, infoHash);

        } else if (ctxs.hasOwnProperty(infoHash)) {
            cb(null, infoHash);
        } else {
            console.log("Ignoring magnet link", parsed.xt);
            cb(new Error("Ignored"));
        }
    } else {
        console.log("Ignoring url", url)
        cb(new Error("Ignored"));
    }
}

var SOCK_PATH = "/tmp/bitorama.sock";
fs.unlink(SOCK_PATH, function(err) {
    if (err && err.code != 'ENOENT') {
        console.error("Cannot unlink " + SOCK_PATH + "\n" + err.code);
        process.exit(1);
    }

    Remote.listen(SOCK_PATH, function(stream) {
        console.log("remote");
        var api = new RemoteAPI(stream);
        api.on('loadUrl', function(msg, reply) {
            if (msg.url) {
                loadUrl(msg.url, function(error, infoHash) {
                    reply(error, infoHash && {
                        url: msg.url,
                        infoHash: infoHash
                    });
                });
            } else {
                reply(new Error("No URL"));
            }
        });
        api.on('listTorrents', function(msg, reply) {
            reply(null, Object.keys(ctxs));
        });
        api.on('getTorrentInfo', function(msg, reply) {
            if (msg.infoHash && ctxs.hasOwnProperty(msg.infoHash)) {
                var ctx = ctxs[msg.infoHash];
                var result = {
                    downloadSpeed: ctx.swarm.downloadSpeed(),
                    uploadSpeed: ctx.swarm.uploadSpeed(),
                    peers: ctx.swarm.wires.map(function(wire) {
                        return {
                            remoteAddress: wire.remoteAddress,
                            interested: wire.peerInterested,
                            choking: wire.peerChoking,
                            downloadSpeed: wire.downloadSpeed(),
                            uploadSpeed: wire.uploadSpeed()
                        };
                    })
                };
                if (ctx.validator) {
                    result.left = ctx.validator.getBytesLeft()
                }
                if (ctx.storage) {
                    result.files = ctx.storage.files;
                }
                reply(null, result);
            } else {
                reply(new Error("No such InfoHash"));
            }
        });
    });
});
