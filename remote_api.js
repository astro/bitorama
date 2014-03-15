var util = require('util');

util.inherits(RemoteAPI, process.EventEmitter);

function RemoteAPI(stream) {
    process.EventEmitter.call(this);

    stream.on('data', function(msg) {
        if (msg.command) {
            var reply = function(err, result) {
                reply = function() { };
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
            try {
                this.emit(msg.command, msg, reply);
            } catch (e) {
                reply(e);
            }
        }
    }.bind(this));
}

module.exports = RemoteAPI;
