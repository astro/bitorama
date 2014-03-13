var util = require('util');

util.inherits(RemoteAPI, process.EventEmitter);

function RemoteAPI(stream) {
    process.EventEmitter.call(this);

    stream.on('data', function(msg) {
        if (msg.command) {
            var reply = function(err, result) {
                var res = {
                    reply: msg.command,
                    id: msg.id
                }
                if (err) {
                    res.error = err.message;
                } else {
                    res.result = result;
                }
                stream.write(res);
            };
            this.emit(msg.command, msg, reply);
        }
    }.bind(this));
}

module.exports = RemoteAPI;
