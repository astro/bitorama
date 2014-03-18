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
    $scope.torrents = [];

    $interval(function() {
        $http.get('/torrents').
        success(function(result) {
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
        });
    }, 1000);
});

app.controller('TorrentsTorrentController', function($scope, $interval, $http) {
    $scope.torrent = {};

    $interval(function() {
        $http.get('/torrents/' + $scope.infoHash).
        success(function(result) {
            for(k in result) {
                if (result.hasOwnProperty(k)) {
                    $scope.torrent[k] = result[k];
                }
            }
        });
    }, 1000);
    
    $scope.humanSize = humanSize;
});
