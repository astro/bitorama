module.exports = RarityMap;

function RarityMap(swarm, piecesAmount) {
    this.swarm = swarm;
    this.piecesAmount = piecesAmount;
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
            for(var i = 0; i < this.piecesAmount; i++) {
                if (wire.peerPieces.get(i)) {
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
        for(var i = 0; i < this.piecesAmount; i++) {
            if (wire.peerPieces.get(i)) {
                if (typeof this.rarity[i] !== 'number') {
                    this.rarity[i] = 0;
                }
                this.rarity[i]++;
            }
        }
    }.bind(this));
    // console.log("rarity", this.swarm.wires.length, "wires", this.rarity.join(","));
};

RarityMap.prototype.findRarest = function(pieceFilter) {
    var i, candidates = [], min;
    for(i = 0; i < this.rarity.length; i++) {
        if (pieceFilter && !pieceFilter(i)) {
            /* Not acceptable, skip */
            continue;
        }

        var match;
        if (typeof min !== 'number' || this.rarity[i] < min) {
            candidates = [i];
            min = this.rarity[i];
        } else if (this.rarity[i] === min) {
            candidates.push(i);
        }
    }
    // console.log("rarity min:", min, "candidates:", candidates.join(","));
    if (candidates.length > 0) {
        i = Math.floor(candidates.length * Math.random());
        return candidates[i];
    } else {
        return null;
    }
};
