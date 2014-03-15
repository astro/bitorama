var util = require('util');
var Remote = require('../lib/remote_stream')

util.inherits(RemoteClient, process.EventEmitter);

function RemoteClient(path, cb) {
    process.EventEmitter.call(this);

    this.callbacks = {};
    this.remote = Remote.connect("/tmp/bitorama.sock", function() {
        this.remote.on('data', this._onData.bind(this));
        this.remote.on('end', this._onEnd.bind(this));
        cb(this);
    }.bind(this));
}
module.exports = RemoteClient;

RemoteClient.prototype._onData = function(msg) {
    console.log("onData", msg);
    var cb;
    if (msg.id &&
        (cb = this.callbacks[msg.id])) {
        
        delete this.callbacks[msg.id];
        if (msg.error) {
            cb(new Error(msg.error));
        } else {
            cb(null, msg.result);
        }
    }
};

RemoteClient.prototype._onEnd = function() {
    for(var id in this.callbacks) {
        var cb = this.callbacks[id];
        cb(new Error("Disconnected"));
    }
    this.emit('end');
};

RemoteClient.prototype._call = function(msg, cb) {
    var id;
    do {
        id = "" + Math.ceil(999999 * Math.random());
    } while(this.callbacks.hasOwnProperty(id));
    this.callbacks[id] = cb;

    msg.id = id;
    this.remote.write(msg);
};

RemoteClient.prototype.loadUrl = function(url, cb) {
    this._call({
        command: 'loadUrl',
        url: url
    }, cb);
};

RemoteClient.prototype.listTorrents = function(cb) {
    this._call({
        command: 'listTorrents'
    }, cb);
};

RemoteClient.prototype.getTorrentInfo = function(infoHash, cb) {
    this._call({
        command: 'getTorrentInfo',
        infoHash: infoHash
    }, cb);
};
