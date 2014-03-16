var express = require('express');
var bodyParser = require('body-parser');
var RemoteClient = require('./remote_client');

var remote, connecting;

function connectRemote() {
    remote = new RemoteClient("/tmp/bitorama.sock", function() {
        console.log("Connected to Bitorama \\o/");
    });
    function done() {
        console.log("done", arguments);
        if (remote) {
            remote = null;
            setTimeout(connectRemote, 1000);
        }
    }
    remote.on('end', done);
    remote.on('error', done);
}
connectRemote();

var app = express();
app.use(bodyParser());

/* Hook that sets up res.remoteCall() */
app.use(function(req, res, next) {
    if (remote) {
        res.remoteCall = function(msg) {
            console.log("remoteCall", msg);
            remote._call(msg, function(err, result) {
                console.log("_call", err, result);
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

app.use(express.static(__dirname + '/public'));

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
