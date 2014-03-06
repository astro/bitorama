module.exports = RarityMap;

function RarityMap(swarm) {
    this.swarm = swarm;
    this.rarity = [];

    swarm.on('wire', function(wire) {
        wire.on('have', function(index) {
            if (typeof this.rarity[index] !== 'number') {
                this.rarity[index] = 0;
            }
            this.rarity[index]++;
        }.bind(this));
        wire.on('bitfield', this._recalculateAll.bind(this));
        wire.on('end', function() {
            for(var i = 0; i < wire.peerPieces.length; i++) {
                if (wire.peerPieces[i]) {
                    this.rarity[i]--;
                }
            }
        }.bind(this));
    }.bind(this));
    this._recalculateAll();
}

RarityMap.prototype._recalculateAll = function() {
    this.rarity = [];

    this.swarm.wires.forEach(function(wire) {
        for(var i = 0; i < wire.peerPieces.length; i++) {
            if (wire.peerPieces[i]) {
                if (typeof this.rarity[i] !== 'number') {
                    this.rarity[i] = 0;
                }
                this.rarity[i]++;
            }
        }
    }.bind(this));
};

RarityMap.prototype.findRarest = function(pieceFilter) {
    var i, candidates = [], min;
    for(i = 0; i < this.rarity.length; i++) {
        var match;
        if (typeof min !== 'number' || this.rarity[i] < min) {
            candidates = [i];
            min = this.rarity[i];
        } else if (this.rarity[i] === min) {
            candidates.push(i);
        }
    }
    if (candidates.length > 0) {
        i = Math.floor(candidates.length * Math.random());
        return candidates[i];
    } else {
        return null;
    }
};
