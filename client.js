var Remote = require('./remote_stream')

var rem = Remote.connect("/tmp/bitorama.sock", function() {
    console.log("rem");
    rem.on('data', function(data) {
        console.log("rem:", data);
    });
    rem.write({ fnord: 42 });
});
