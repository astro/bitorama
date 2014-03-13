var fs = require('fs');
var Magnet = require('magnet-uri')
var TorrentContext = require('./torrent_context');
var Remote = require('./remote_stream');


process.on('uncaughtException', function(e) {
    console.error(e.stack);
});


var ctxs = {};

function loadUrl(url) {
    if (/^magnet:/.test(url)) {
        var parsed = Magnet(url)
        console.log(parsed)
        if (parsed.infoHash) {
            var ctx = new TorrentContext(parsed.infoHash);
            ctxs[parsed.infoHash] = ctx;

            parsed.tr.forEach(function(t) {
                ctx.addTrackerGroup([t]);
            });

            ctx.on('end', function() {
                delete ctxs[parsed.infoHash];
            });
        } else {
            console.log("Ignoring magnet link", parsed.xt)
        }
    } else {
        console.log("Ignoring url", url)
    }
}

var SOCK_PATH = "/tmp/bitorama.sock";
fs.unlink(SOCK_PATH, function(err) {
    if (err) {
        console.error("Cannot unlink " + SOCK_PATH + "\n" + err.message);
        process.exit(1);
    }

    Remote.listen(SOCK_PATH, function(remote) {
        console.log("remote");
        remote.on('data', function(msg) {
            console.log("d", msg);
        });
        var i = 0;
        function spam() {
            while(remote.write({ hello: ++i })) { }
        }
        remote.on('drain', spam);
        spam();
        // remote.end();
    });
});
