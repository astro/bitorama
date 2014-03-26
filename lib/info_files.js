module.exports = infoToFiles;

function infoToFiles(info, infoHash) {
    var name = Buffer.isBuffer(info.name) ?
        info.name.toString() : "";
    if (!isValidPath(name)) {
        name = infoHash;
    }

    var files;
    if (typeof info.length === 'number') {
        /* Single-file torrent */
        return [{
            name: name,
            path: name,
            length: info.length
        }];
    } else if (Array.isArray(info.files)) {
        /* Multi-file torrent */
        return info.files.map(function(file) {
            var path = file.path.map(function(buf) {
                return buf.toString();
            }).filter(isValidPath);
            var fileName = path.join("/");
            return {
                name: fileName,
                path: name + "/" + fileName,
                length: file.length
            };
        });
    } else {
        throw new Error("No files in info");
    }
};

function isValidPath(s) {
    return s != "" && s != "." && s != "..";
}
