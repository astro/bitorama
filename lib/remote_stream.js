var net = require('net');
var stream = require('stream');
var util = require('util');
var MSP = require('msgpack-stream');

util.inherits(MSPDuplexStream, stream.Duplex);
function MSPDuplexStream(sock) {
    stream.Duplex.call(this, {
        decodeStrings: false,
        objectMode: true
    });
    this.encode = new MSP.createEncodeStream();
    this.encode.pipe(sock);

    this.decode = new MSP.createDecodeStream();
    sock.pipe(this.decode);
    this.decode.on('data', function(data) {
        this.push(data);
        this.decode.pause();
    }.bind(this));
    sock.on('end', function() {
        this.push(null);
    }.bind(this));
    sock.on('error', this.emit.bind(this, 'error'));
}

MSPDuplexStream.prototype._read = function(size) {
    this.decode.resume();
};

MSPDuplexStream.prototype._write = function(chunk, encoding, cb) {
    if (this.encode.write(chunk)) {
        cb();
        return true;
    } else {
        this.encode.once('drain', cb);
        return false;
    }
};

module.exports.listen = function(path, cb) {
    net.createServer(function(c) {
        cb(new MSPDuplexStream(c));
    }).listen(path);
};

module.exports.connect = function(path, cb) {
    var stream;
    var sock = net.connect(path, function() {
        cb(stream);
    });
    stream = new MSPDuplexStream(sock);
    return stream;
};
