function humanSize(size) {
    var units = ["B", "KB", "MB", "GB", "TB"];
    while(size >= 1024 && units.length > 1) {
        size /= 1024;
        units.shift();
    }
    if (size < 10) {
        return Math.round(size * 100) / 100 + " " + units[0];
    } else if (size < 100) {
        return Math.round(size * 10) / 10 + " " + units[0];
    } else {
        return Math.round(size) + " " + units[0];
    }
};


var app = angular.module('bitoramaApp', ['ngRoute']);

app.config(function($locationProvider, $routeProvider) {
    /* Routing */

    $locationProvider.html5Mode(false).hashPrefix('');

    $routeProvider.
        when('/add', {
            templateUrl: 'partials/add_torrent.html',
            controller: 'AddTorrentController'
        }).
        when('/torrents', {
            templateUrl: 'partials/torrents.html',
            controller: 'TorrentsController'
        }).
        otherwise({
            redirectTo: '/torrents'
        });

});

app.factory('httpPoll', function($http, $timeout) {
    var urlCbs = {};

    function workUrls(urls, cb) {
        var url = urls.shift();
        if (url) {
            $http.get(url)
                .success(function(data) {
                    if (urlCbs.hasOwnProperty(url)) {
                        urlCbs[url].forEach(function(cb) {
                            cb(data);
                        });
                    }
                    /* Loop */
                    workUrls(urls, cb);
                })
                .error(function(data, status) {
                    /* Ignore & loop */
                    workUrls(urls, cb);
                });
        } else {
            /* No url, done */
            cb();
        }
    }
    function start() {
        $timeout(function() {
            workUrls(Object.keys(urlCbs), start);
        }, 1000);
    }
    start();

    return function(url, cb) {
        if (!urlCbs.hasOwnProperty(url)) {
            urlCbs[url] = [];
        }
        urlCbs[url].push(cb);

        return function remove() {
            urlCbs[url] = urlCbs[url].filter(function(cb1) {
                return cb !== cb1;
            });
            if (urlCbs[url].length < 1) {
                delete urlCbs[url];
            }
        };
    };
});

app.filter('humanSize', function() {
    return humanSize;
});

app.controller('AddTorrentController', function($scope, $http, $location) {
    $scope.add = function() {
        $http.post('/torrents', { url: $scope.url }).
        success(function(result) {
            if (result && result.infoHash) {
                $location.url('/torrents/' + result.infoHash);
            }
        });
    };
});

app.controller('TorrentsController', function($scope, httpPoll) {
    $scope.torrents = [];

    $scope.$on('$destroy', httpPoll('/torrents', function(result) {
        result.forEach(function(infoHash) {
            /* Add new */
            if ($scope.torrents.indexOf(infoHash) < 0) {
                $scope.torrents.push(infoHash);
            }
        });
        /* Remove disappeared */
        $scope.torrents = $scope.torrents.filter(function(infoHash) {
            return result.indexOf(infoHash) >= 0;
        });
    }));
});

app.controller('TorrentsTorrentController', function($scope, httpPoll) {
    $scope.torrent = {};

    $scope.$on('$destroy', httpPoll('/torrents/' + $scope.infoHash, function(result) {
        for(k in result) {
            if (result.hasOwnProperty(k)) {
                $scope.torrent[k] = result[k];
            }
        }
    }));
    
    $scope.percentDone = function() {
        var left = $scope.torrent.left;
        var totalLength = $scope.torrent.totalLength;
        return Math.floor(100 * (1 - left / totalLength));
    };
});
