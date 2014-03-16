var app = angular.module('bitoramaApp', ['ngRoute']);

app.config(function($locationProvider, $routeProvider) {
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

app.controller('TorrentsController', function($scope, $interval, $http) {
    $scope.torrents = {};

    $interval(function() {
        $http.get('/torrents').
        success(function(result) {
            console.log("torrents:", result);
            result.forEach(function(infoHash) {
                /* Add new */
                if (!$scope.torrents.hasOwnProperty(infoHash)) {
                    $scope.torrents[infoHash] = {};
                }

                /* Refresh */
                $http.get('/torrents/' + infoHash).
                success(function(result) {
                    console.log("r", infoHash, result);
                    for(k in result) {
                        if (result.hasOwnProperty(k)) {
                            $scope.torrents[infoHash][k] = result[k];
                        }
                    }
                    console.log("s", $scope.torrents[infoHash]);
                });
            });
            /* Remove disappeared */
            Object.keys($scope.torrents).forEach(function(infoHash) {
                if (result.indexOf(infoHash) < 0) {
                    delete $scope.torrents[infoHash];
                }
            });
        });
    }, 1000);
});

app.controller('TorrentsTorrentController', function($scope, $interval, $http) {
    console.log("TorrentsTorrentController", $scope.torrent);
});
