var fs = require('fs');
var crypto = require('crypto');
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var bncode = require('bncode');
var Magnet = require('magnet-uri');
var TorrentContext = require('./lib/torrent_context');


process.on('uncaughtException', function(e) {
    console.error(e.stack);
});


function parseTorrent(data) {
    var torrent = bncode.decode(data);
    console.log("decoded", torrent);
    var info = torrent.info;
    var announceList =
        torrent['announce-list'] ||
        [[torrent['announce']]];
    var sha1 = crypto.createHash('sha1');
    sha1.update(bncode.encode(info));
    return {
        info: info,
        infoHash: sha1.digest('hex'),
        announce: announceList
    };
}

var ctxs = {};

function loadUrl(url, cb) {
    var parsed;
    if (/^magnet:/.test(url)) {
        parsed = Magnet(url);
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
    } else if (/^https?:\/\//.test(url)) {
        request({
            url: url,
            encoding: null
        }, function(err, res, body) {
            if (err) {
                return cb(err);
            }
            if (res.statusCode == 200) {
                var infoHash;
                try {
                    parsed = parseTorrent(body);
                    infoHash = parsed.infoHash;

                    if (infoHash && !ctxs.hasOwnProperty(infoHash)) {
                        var ctx = ctxs[infoHash] = new TorrentContext(infoHash, parsed.info);
                        parsed.announce.forEach(function(ts) {
                            var urls = ts.map(function(t) {
                                return t.toString();
                            });
                            ctx.addTrackerGroup(urls);
                        });

                        // ctx.on('end', function() {
                        //     delete ctxs[parsed.infoHash];
                        // });

                    } else if (infoHash) {
                        /* Ignore existing */
                    } else {
                        throw new Error("No infoHash");
                    }
                } catch (e) {
                    return cb(e);
                }
                cb(null, infoHash);
            } else {
                cb(new Error("HTTP " + res.statusCode));
            }
        });
    } else {
        cb(new Error("Invalid URL"));
    }
}

var app = express();
app.use(bodyParser());

app.use(express.static(__dirname + '/public'));

app.post('/torrents', function(req, res) {
    var url = req.body.url;
    loadUrl(url, function(err, infoHash) {
        if (err) {
            console.error(err.stack || err);
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
            uploadSpeed: ctx.swarm.uploadSpeed()
        };
        result.name =
            (ctx.info && ctx.info.name) ?
            ctx.info.name.toString() :
            infoHash;
        if (ctx.validator) {
            result.left = ctx.validator.getBytesLeft();
        }
        if (ctx.storage) {
            result.totalLength = ctx.totalLength;
        }
        res.json(result);
    } else {
        res.status(500);
        res.send("No such torrent");
    }
});

app.get('/torrents/:infoHash/files', function(req, res) {
    var infoHash = req.params.infoHash;

    if (infoHash && ctxs.hasOwnProperty(infoHash)) {
        var ctx = ctxs[infoHash];
        var files =
            (ctx.storage ? ctx.storage.files : [])
            .map(function(file) {
                file.href = '/torrents/' + infoHash + '/files/' + encodeURIComponent(file.name);
                return file;
            });
        res.json(files);
    } else {
        res.status(404);
        res.send("No such torrent");
    }
});

app.get('/torrents/:infoHash/files/:fileName*', function(req, res) {
    var infoHash = req.params.infoHash;
    var fileName = req.params.fileName;
    console.log("fileName", fileName);

    var offset = 0;
    var length;
    var range = req.headers.range;
    var m;
    if (range &&
        (m = range.match(/^bytes=(\d+)-(\d+)/))) {
        offset = parseInt(m[1], 10);
        length = parseInt(m[2], 10) - offset + 1;
    } else if (range &&
               (m = range.match(/^bytes=(\d+)/))) {
        offset = parseInt(m[1], 10);
    }
    console.log("range", range, "offset", offset, "length", length);

    if (infoHash && ctxs.hasOwnProperty(infoHash)) {
        var ctx = ctxs[infoHash];
        var stream = ctx.streamFile(fileName, offset, length);

        if (stream) {
            if (!range || (offset === 0 && isNaN(length))) {
                res.writeHead(200, {
                    'Content-Type': stream.mime,
                    'Content-Length': stream.fileLength,
                    'Accept-Ranges': 'bytes'
                });
            } else {
                res.writeHead(206, {
                    'Content-Type': stream.mime,
                    'Content-Range': offset + "-" + (offset + stream.length - 1) + "/" + stream.fileLength,
                    'Accept-Ranges': 'bytes'
                });
            }
            /* Flush header */
            // res.write("");
            /* Begin streaming */
            stream.pipe(res);
        } else {
            res.status(404);
            res.send("No such file in torrent");
        }
    } else {
        res.status(404);
        res.send("No such torrent");
    }
});

app.listen(4000);
