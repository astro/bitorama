var Remote = require('./remote_stream')

function RemoteConnection(path, cb) {
    this.callbacks = {};
    this.remote = Remote.connect("/tmp/bitorama.sock", function() {
        this.remote.on('data', this._onData.bind(this));
        this.remote.on('end', this._onEnd.bind(this));
        cb(this);
    }.bind(this));
}

RemoteConnection.prototype._onData = function(msg) {
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

RemoteConnection.prototype._onEnd = function() {
    for(var id in this.callbacks) {
        var cb = this.callbacks[id];
        cb(new Error("Disconnected"));
    }
};

RemoteConnection.prototype._call = function(msg, cb) {
    var id;
    do {
        id = "" + Math.ceil(999999 * Math.random());
    } while(this.callbacks.hasOwnProperty(id));
    this.callbacks[id] = cb;

    msg.id = id;
    this.remote.write(msg);
};

RemoteConnection.prototype.loadUrl = function(url, cb) {
    this._call({
        command: 'loadUrl',
        url: url
    }, cb);
};

var rem = new RemoteConnection("/tmp/bitorama.sock", function() {
    console.log("Connected to Bitorama \\o/");

    process.argv.slice(2).forEach(function(arg) {
        rem.loadUrl(arg, function(error, res) {
            if (error) {
                console.error(error.message);
                return;
            }
            console.log("loadUrl ->", res.infoHash);
        });
    });
});
