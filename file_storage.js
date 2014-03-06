module.exports = FileStorage;

/**
 * @param files [{ path: String, length: Number }]
 **/
function FileStorage(files) {
    this.files = files;
}

FileStorage.prototype.offsetToRanges = function(offset, length) {
    var result = [];
    for(var i = 0; length > 0 && i < this.files.length; i++) {
        var file = this.files[i];
        if (file.length <= offset) {
            offset -= file.length;
        } else {
            var chunkLength = Math.min(length, file.length - offset);
            result.push({
                path: file.path,
                offset: offset,
                length: chunkLength
            });
            offset = 0;
            length -= chunkLength;
        }
    }
    return result;
};

FileStorage.prototype.fileToOffset = function(path, offset) {
    var totalOffset = 0;
    for(var i = 0; i < this.files.length; i++) {
        var file = this.files[i];
        if (file.path === path) {
            if (offset <= file.length) {
                return totalOffset + offset;
            } else {
                return null;
            }
        } else {
            totalOffset += file.length;
        }
    }
    return null;
};

function arrayEq(a1, a2) {
    if (a1.length !== a2.length) {
        return false;
    }
    for(var i = 0; i < a1.length; i++) {
        if (a1[i] !== a2[i]) {
            return false;
        }
    }
    return true;
}
