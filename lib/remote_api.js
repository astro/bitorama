var util = require('util');

util.inherits(RemoteAPI, process.EventEmitter);

function RemoteAPI(stream) {
    process.EventEmitter.call(this);

    stream.on('data', function(msg) {
        if (msg.command) {
            var replied = false;
            var reply = function(err, result) {
                if (replied) {
                    console.log("ignore dup reply", err, result);
                    return;
                }
                replied = true;

                console.log("reply", err, result);
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
                console.log("handle command", msg.command);
                this.emit(msg.command, msg, reply);
            } catch (e) {
                reply(e);
            }
            if (!replied) {
                setTimeout(function() {
                    reply(new Error("Timeout for " + msg.command));
                }, 1000);
            }
        }
    }.bind(this));
}

module.exports = RemoteAPI;
