const { remote, ipcRenderer } = require('electron');
const app = angular.module('myappy', []);

const victim = remote.getCurrentWebContents().victim;

app.controller("NotifiCtrl", function($scope, $location) {
    const ctrl = $scope;

    ctrl.victimSocket = `${victim.ip}:${victim.port}`;
    ctrl.victimModel = victim.model;
    ctrl.victimCountry = victim.country;
});
