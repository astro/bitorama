var util = require('util');

util.inherits(MSPDuplexStream, process.EventEmitter);

function RemoteAPI(stream) {
    process.EventEmitter.call(this);

    stream.on('data', function(msg) {
        if (msg.command) {
            var reply = function(res) {
                res.reply = msg.command;
                res.id = msg.id;
                stream.send(res);
            };
            this.emit(msg.command, msg, reply);
        }
    }.bind(this));
}

module.exports = RemoteAPI;
