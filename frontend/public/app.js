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
        console.log("tick");
        $http.get('/torrents').
        success(function(result) {
            console.log("got", result);
            result.forEach(function(infoHash) {
                /* Add new */
                if (!$scope.torrents.hasOwnProperty(infoHash)) {
                    $scope.torrents[infoHash] = {};
                }

                /* Refresh */
                $http.get('/torrents/' + infoHash).
                success(function(result) {
                    $scope.torrents[infoHash] = result;
                });
            });
            /* Remove disappeared */
            Object.keys($scope.torrents).forEach(function(infoHash) {
                if (!result.hasOwnProperty(infoHash)) {
                    delete $scope.torrents[infoHash];
                }
            });
        });
    }, 1000);
});
