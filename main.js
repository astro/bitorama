var Magnet = require('magnet-uri')
var bncode = require('bncode');
var TorrentContext = require('./torrent_context');

process.on('uncaughtException', function(e) {
    console.error(e.stack);
});
var infoToFiles = require('./info_files');


process.argv.slice(2).forEach(function(url) {
    if (/^magnet:/.test(url)) {
        var parsed = Magnet(url)
        console.log(parsed)
        if (parsed.btih) {
            var infoHash = parsed.btih;
            var ctx = new TorrentContext(infoHash);


            parsed.tr.forEach(function(t) {
                ctx.addTrackerGroup([t]);
            });
        } else {
            console.log("Ignoring magnet link", parsed.xt)
        }
    } else {
        console.log("Ignoring url", url)
    }
});

