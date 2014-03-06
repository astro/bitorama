var fs = require('fs');

module.exports = FileStorage;

/**
 * @param files [{ path: String, length: Number }]
 **/
function FileStorage(files) {
    this.files = files;
    this.states = {};
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

FileStorage.prototype._operate = function(offset, length, f, cb) {
    var ranges = this.offsetToRanges(offset, length);
    var proceed = function() {
        if (ranges.length < 1) {
            cb();
        } else {
            var range = ranges.shift();
            var fileState = this._getState(range.path);
            f(range, fileState, function(err) {
                if (err) {
                    cb(err);
                } else {
                    proceed();
                }
            });
        }
    }.bind(this);
    proceed();
};

FileStorage.prototype._getState = function(path) {
    if (!this.states[path]) {
        this.states[path] = new FileState(path, function stateDone() {
            delete this.states[path];
        }.bind(this));
    }

    return this.states[path];
};

FileStorage.prototype.read = function(offset, length, cb1) {
    var bufs = [];
    this._operate(offset, length, function(range, fileState, cb2) {
        fileState.read(range.offset, range.length, function(err, buf) {
            bufs.push(buf);
            cb2(err);
        });
    }, function(err) {
        if (err) {
            cb1(err);
        } else {
            cb1(null, Buffer.concat(bufs));
        }
    });
};

FileStorage.prototype.write = function(offset, data, cb1) {
    this._operate(offset, data.length, function(range, fileState, cb2) {
        fileState.write(range.offset, data.slice(0, range.length), cb2);
        data = data.slice(range.length);
    }, cb1);
};


function FileState(path, doneCb) {
    this.queue = [];
    this.doneCb = doneCb;

    this._open(path);
}

FileState.prototype._open = function(path) {
    var dirs = path.split(/\//g);
    var _filename = dirs.pop();
    function ensureDir(base, dirs, cb) {
        if (dirs.length > 0) {
            base += (/\/$/.test(base) ? "" : "/") + dirs.shift();
            fs.mkdir(base, function(err) {
                if (err && err.code != 'EEXIST') {
                    cb(err);
                } else {
                    /* Loop to next child directory */
                    ensureDir(base, dirs, cb);
                }
            });
        } else {
            /* Done creating directories */
            cb();
        }
    }

    this.busy = true;
    ensureDir("", dirs, function(err) {
        if (err) {
            this._fail(err);
            return;
        }

        fs.open(path, "r+", function(err, fd) {
            if (err && err.code === 'ENOENT') {
                fs.open(path, "w+", function(err, fd) {
                    if (err) {
                        this._fail(err);
                        return;
                    }

                    this.fd = fd;
                    this.busy = false;
                    this._canWorkQueue();
                }.bind(this));
                return;
            }

            if (err) {
                this._fail(err);
                return;
            }

            this.fd = fd;
            this.busy = false;
            this._canWorkQueue();
        }.bind(this));
    }.bind(this));
}

FileState.prototype._fail = function(err) {
    var queue = this.queue;
    this.queue = [];
    queue.forEach(function(op) {
        op.callback(err);
    });
    if (this.fd) {
        fs.close(this.fd, this.doneCb);
        this.fd = null;
    } else {
        this.doneCb();
    }
};

/**
 * Doesn't coalesce to guarantee write-before-read
 **/
FileState.prototype.read = function(offset, length, cb) {
    this.queue.push({
        type: 'read',
        offset: offset,
        length: length,
        callback: cb
    });
    this._canWorkQueue();
};

FileState.prototype.write = function(offset, data, cb) {
    // TODO: coalesce writes
    this.queue.push({
        type: 'write',
        offset: offset,
        data: data,
        callback: cb
    });
    this._canWorkQueue();
};

FileState.prototype._canWorkQueue = function() {
    if (this.busy) {
        return;
    }

    var op = this.queue.shift();
    if (op) {
        if (op.type === 'read') {
            this.busy = true;
            var data = new Buffer(op.length);
            fs.read(this.fd, data, 0, data.length, op.offset, function(err, bytesRead, data) {
                this.busy = false;
                /* Invoke callback: */
                if (err) {
                    op.callback(err);
                } else if (data.length !== op.length) {
                    op.callback(new Error("Short read: " + data.length + " != expected " + op.length));
                } else {
                    op.callback(null, data);
                }
                /* Loop: */
                this._canWorkQueue();
            }.bind(this));
        } else if (op.type === 'write') {
            this.busy = true;
            fs.write(this.fd, op.data, 0, op.data.length, op.offset, function(err, written) {
                this.busy = false;
                /* Invoke callback: */
                if (err) {
                    op.callback(err);
                } else if (written !== op.data.length) {
                    op.callback(new Error("Short write: " + written + " != expected " + op.data.length));
                } else {
                    op.callback();
                }
                /* Loop: */
                this._canWorkQueue();
            }.bind(this));
        } else {
            op.callback(new Error("Invalid operation"));
            this._canWorkQueue();
        }
    } else {
        fs.close(this.fd, this.doneCb);
    }
};
