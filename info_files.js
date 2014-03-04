module.exports = infoToFiles;

function infoToFiles(info, infoHash) {
    var name = Buffer.isBuffer(info.name) ?
        info.name.toString() :
        infoHash;
    if (typeof info.length === 'number') {
        return [{
            path: [name],
            length: info.length
        }];
    } else if (Array.isArray(info.files)) {
        return info.files.map(function(file) {
            var path = file.path.map(function(buf) {
                return buf.toString();
            });
            return {
                path: [name].concat(path),
                length: file.length
            };
        });
    } else {
        throw new Error("No files in info");
    }
};
