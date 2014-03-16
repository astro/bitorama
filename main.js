var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var Magnet = require('magnet-uri')
var TorrentContext = require('./lib/torrent_context');


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

var app = express();
app.use(bodyParser());

app.use(express.static(__dirname + '/public'));

app.post('/torrents', function(req, res) {
    var url = req.body.url;
    loadUrl(msg.url, function(error, infoHash) {
        if (error) {
            res.status(500);
            res.send(err.message);
            return;
        }

        res.json({
            infoHash: infoHash
        });
    });

});

app.get('/torrents', function(req, res) {
    res.json(Object.keys(ctxs));
});

app.get('/torrents/:infoHash', function(req, res) {
    var infoHash = req.params.infoHash;

    if (infoHash && ctxs.hasOwnProperty(infoHash)) {
        var ctx = ctxs[infoHash];
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
        res.json(result);
    } else {
        res.status(500);
        res.send("No such torrent");
    }
});

app.listen(4000);
