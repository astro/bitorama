var express = require('express');
var bodyParser = require('body-parser');
var RemoteClient = require('./remote_client');

var remote;

function connectRemote() {
    var rem = new RemoteClient("/tmp/bitorama.sock", function() {
        console.log("Connected to Bitorama \\o/");
        remote = rem;
    });
    rem.on('end', function() {
        remote = null;
        setTimeout(connectRemote, 1000);
    });
}
connectRemote();

var app = express();
app.use(bodyParser());

app.use(function(req, res, next) {
    if (remote) {
        res.remoteCall = function(msg) {
            remote._call(msg, function(err, result) {
                if (err) {
                    res.status(500);
                    res.send(err.message);
                } else {
                    console.log("result", result);
                    res.json(result);
                }
            });
        };
        next();
    } else {
        res.status(500);
        res.send('Not connected to Bitorama');
    }
});

app.post('/torrents', function(req, res) {
    res.remoteCall({
        command: 'loadUrl',
        url: req.body.url
    });
});

app.get('/torrents', function(req, res) {
    res.remoteCall({
        command: 'listTorrents'
    });
});

app.get('/torrents/:infoHash', function(req, res) {
    res.remoteCall({
        command: 'getTorrentInfo',
        infoHash: req.params.infoHash
    });
});

app.listen(4000);
