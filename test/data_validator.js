var DataValidator = require('../lib/data_validator')
var test = require('tape')

SHA1_65536NULLBYTES = "1adc95bebe9eea8c112d40cd04ab7a8d75c4f961";
SHA1_512NULLBYTES = "5c3eb80066420002bc3dcc7ca4ab6efad7ed4ae5";

test('completes hashing by itself', function (t) {
  t.plan(6);

  var nullBytes = new Buffer(512);
  nullBytes.fill(0);

  var validator = new DataValidator(
      [SHA1_65536NULLBYTES, SHA1_65536NULLBYTES, SHA1_512NULLBYTES],
      65536,
      65536 + 65536 + 512
  );
  validator.on('read', function(index, offset, length) {
      validator.onData(index, offset, nullBytes);
  });
  validator.on('piece:complete', function(index) {
      t.assert(true, validator.isPieceComplete(index));
      t.ok(index === 0 ||
           index === 1 ||
           index === 2,
           'pieces completed');
  });
  validator.on('piece:corrupt', function(index) {
      t.fail('corrupt', 'complete');
  });

  validator.onData(0, 0, nullBytes);
  validator.onData(1, 0, nullBytes);
  validator.onData(2, 0, nullBytes);
});
