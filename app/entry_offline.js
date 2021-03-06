'use strict';

const electron = require('electron');
const ipcMain = electron.ipcMain;
const app = electron.app;  // 어플리케이션 기반을 조작 하는 모듈.
const BrowserWindow = electron.BrowserWindow;  // 네이티브 브라우저 창을 만드는 모듈.
const path = require('path');
const fs = require('fs');
const Menu     = electron.Menu;
const packageJson     = require('./package.json');
const ChildProcess = require('child_process');    

var language;

function logger(msg) {
    if (process.platform !== 'win32') {
        return false;
    }
    var log_path = path.resolve(process.env.APPDATA, 'entry_log');
    if(!fs.existsSync(log_path)) {
        fs.mkdirSync(log_path);
        fs.writeFileSync(path.join(log_path, 'debug.log'), '', 'utf8');
    }
    var data = fs.readFileSync(path.join(log_path, 'debug.log'), 'utf8');
    data += '\n\r' + new Date() + ' : ' + msg;
    fs.writeFileSync(path.join(log_path, 'debug.log'), data, 'utf8');
}

function spawn(command, args, callback) {
    var error, spawnedProcess, stdout;
    stdout = '';
    try {
        spawnedProcess = ChildProcess.spawn(command, args);
    } catch (_error) {
        error = _error;
        process.nextTick(function() {
            return typeof callback === "function" ? callback(error, stdout) : void 0;
        });
        return;
    }
    spawnedProcess.stdout.on('data', function(data) {
        return stdout += data;
    });
    error = null;
    spawnedProcess.on('error', function(processError) {
        return error != null ? error : error = processError;
    });
    return spawnedProcess.on('close', function(code, signal) {
        if (code !== 0) {
            if (error == null) {
                error = new Error("Command failed: " + (signal != null ? signal : code));
            }
        }
    if (error != null) {
        if (error.code == null) {
            error.code = code;
        }
    }
    if (error != null) {
        if (error.stdout == null) {
            error.stdout = stdout;
        }
    }
    return typeof callback === "function" ? callback(error, stdout) : void 0;
    });
};

var extensionPath = 'HKCU\\Software\\Classes\\.ent';
var entryPath = 'HKCU\\Software\\Classes\\Entry';
var defaultIconPath = 'HKCU\\Software\\Classes\\Entry\\DefaultIcon';
var entryShellPath = 'HKCU\\Software\\Classes\\Entry\\Shell\\Open';
var entryShellCommandPath = 'HKCU\\Software\\Classes\\Entry\\Shell\\Open\\Command';
var mimeTypePath = 'HKCU\\Software\\Classes\\MIME\\DataBase\\Content Type\\application/x-entryapp';
var system32Path, regPath, setxPath;

if (process.env.SystemRoot) {
    system32Path = path.join(process.env.SystemRoot, 'System32');
    regPath = path.join(system32Path, 'reg.exe');
    setxPath = path.join(system32Path, 'setx.exe');
} else {
    regPath = 'reg.exe';
    setxPath = 'setx.exe';
}

function spawnReg(args, callback) {
    return spawn(regPath, args, callback);
};

function addToRegistry(args, callback) {
    args.unshift('add');
    args.push('/f');
    return spawnReg(args, callback);
};

function deleteFromRegistry (keyPath, callback) {
    return spawnReg(['delete', keyPath, '/f'], callback);
};

function installRegistry(callback) {
    var args = [extensionPath, '/ve', '/d', 'Entry'];
    addToRegistry(args, function () {
        args = [extensionPath, '/v', 'Content Type', '/d', 'application/x-entryapp'];
        addToRegistry(args, function () {
            args = [defaultIconPath, '/ve', '/d', path.join(__dirname, 'icon', 'icon.ico')];
            addToRegistry(args, function () {
                args = [entryShellPath, '/ve', '/d', '&Open'];
                addToRegistry(args, function () {
                    args = [entryShellCommandPath, '/ve', '/d', '"' + path.join(__dirname, '..', '..', 'Entry.exe') + '" "%1"'];
                    addToRegistry(args, function () {
                        args = [mimeTypePath, '/v', 'Extestion', '/d', '.ent'];
                        addToRegistry(args, function () {
                            callback();
                        });
                    });
                });
            });
        });
    });
}

function unInstallRegistry(callback) {
    deleteFromRegistry(extensionPath, function () {
        deleteFromRegistry(entryPath, function () {
            deleteFromRegistry(mimeTypePath, function () {
                callback();
            });
        });
    });
}

function run(args, done) {
    const updateExe = path.resolve(path.dirname(process.execPath), "..", "Update.exe")
    // log("Spawning `%s` with args `%s`", updateExe, args)
    spawn(updateExe, args, {
        detached: true
    }).on("close", done)
}

function createShortcut(locations, done) {
    var updateExe = path.resolve(path.dirname(process.execPath), "..", "Update.exe"); 
    var target = path.basename(process.execPath);
    var args = ['--createShortcut', target, '-l', locations];
    var child = ChildProcess.spawn(updateExe, args, { detached: true });
    child.on('close', function () {
        language = app.getLocale();
        if(language === 'ko') {
            var sourcePath = path.resolve(process.env.USERPROFILE, 'Desktop', 'Entry.lnk');
            var destPath = path.resolve(process.env.USERPROFILE, 'Desktop', '엔트리.lnk');
            fs.rename(sourcePath, destPath, function (err) {
                sourcePath = path.resolve(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'EntryLabs', 'Entry.lnk');
                destPath = path.resolve(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'EntryLabs', '엔트리.lnk');
                fs.rename(sourcePath, destPath, function (err) {
                    if(done) {
                        done();
                    }
                });
            });
        }
    });
}

function removeShortcut(locations, done) {
    var updateExe = path.resolve(path.dirname(process.execPath), "..", "Update.exe"); 
    var target = path.basename(process.execPath);
    var args = ['--removeShortcut', target, '-l', locations];
    var child = ChildProcess.spawn(updateExe, args, { detached: true });
    child.on('close', function () {
        var desktopEng = path.resolve(process.env.USERPROFILE, 'Desktop', 'Entry.lnk');
        var desktopKo = path.resolve(process.env.USERPROFILE, 'Desktop', '엔트리.lnk');
        var startMenuEng = path.resolve(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'EntryLabs', 'Entry.lnk');
        var startMenuKo = path.resolve(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'EntryLabs', '엔트리.lnk');
        deleteRecursiveSync(desktopEng);
        deleteRecursiveSync(desktopKo);
        deleteRecursiveSync(startMenuEng);
        deleteRecursiveSync(startMenuKo);

        if(done) {
            done();
        }
    });
}


// Parse command line options.
var argv = process.argv.slice(1);
var option = { file: null, help: null, version: null, webdriver: null, modules: [] };
for (var i = 0; i < argv.length; i++) {
    if (argv[i] == '--version' || argv[i] == '-v') {
        option.version = true;
        break;
    } else if (argv[i].match(/^--app=/)) {
        option.file = argv[i].split('=')[1];
        break;
    } else if (argv[i] == '--help' || argv[i] == '-h') {
        option.help = true;
        break;
    } else if (argv[i] == '--test-type=webdriver') {
        option.webdriver = true;
    } else if (argv[i] == '--debug' || argv[i] == '-d') {
        option.debug = true;
        continue;
    } else if (argv[i] == '--require' || argv[i] == '-r') {
        option.modules.push(argv[++i]);
        continue;
    } else if (argv[i][0] == '-') {
        continue;
    } else if (argv[i] == 'app') {
        continue;
    } else {
        option.file = argv[i];
        break;
    }
}

var handleStartupEvent = function() {
    logger('start handleStartupEvent');
    try{
        if (process.platform !== 'win32') {
            return false;
        }

        var squirrelCommand = process.argv[1];
        logger('squirrelCommand : ' + squirrelCommand);
        if(squirrelCommand.indexOf('--squirrel') < 0) return false;
        var defaultLocations = 'Desktop,StartMenu';
        switch (squirrelCommand) {
            case '--squirrel-firstrun':
                return false;
                break;
            case '--squirrel-install':
            case '--squirrel-updated':
                installRegistry(function () {
                    createShortcut(defaultLocations, function () {
                        app.quit();
                        process.exit(0);
                    });
                });
                return true;
                break;
            case '--squirrel-uninstall':
                unInstallRegistry(function () {
                    removeShortcut(defaultLocations, function () {
                        app.quit();
                        process.exit(0);
                    });
                });
                return true;
                break;
            case '--squirrel-obsolete':
                app.quit();
                process.exit(0);
                return true;
        }
    } catch(e) {
        logger(e.stack);
        app.quit();
        process.exit(0);
    }
};


var mainWindow = null;
var hardwareWindow = null;
var isClose = true;

app.on('window-all-closed', function() {
    app.quit();
    process.exit(0);
});

var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
// 어플리케이션을 중복 실행했습니다. 주 어플리케이션 인스턴스를 활성화 합니다.
    if (mainWindow) {
        if (mainWindow.isMinimized()) 
            mainWindow.restore();
        mainWindow.focus();
    }
    return true;
});

if (shouldQuit) {
    app.quit();
    return;
}

app.once('ready', function() {
    language = app.getLocale();
    var title = packageJson.version;
    
    if(language === 'ko') {
        title = '엔트리 v' + title;
    } else {
        title = 'Entry v' + title;
    }

    mainWindow = new BrowserWindow({
        width: 1024, 
        height: 700,
        title: title
    });

    mainWindow.setMenu(null);

    mainWindow.loadURL('file:///' + path.join(__dirname, 'entry_offline.html'));

    if(option.debug) {
        mainWindow.webContents.openDevTools();
    }

    if(option.file) {
        mainWindow.webContents.startFile = option.file;
    }

    mainWindow.webContents.hpopup = hardwareWindow;

    mainWindow.on('page-title-updated', function(e) {
        e.preventDefault();
    });
    mainWindow.on('close', function(e) {
        mainWindow.webContents.send('main-close');
    });
    mainWindow.on('closed', function() {
        mainWindow = null;
    });
});

ipcMain.on('reload', function(event, arg) {
    mainWindow.reload(true);
});

ipcMain.on('openHardware', function(event, arg) {
    if(hardwareWindow == null) {
        var title;
        if(language === 'ko') {
            title = '엔트리 하드웨어';
        } else {
            title = 'Entry HardWare'
        }

        hardwareWindow = new BrowserWindow({
            width: 800, 
            height: 650,
            title: title,
            resizable: false
        });

        hardwareWindow.setMenu(null);
        hardwareWindow.setMenuBarVisibility(false);
        hardwareWindow.loadURL('file:///' + path.join(__dirname, 'bower_components', 'entry-hw', 'app', 'index.html'));
        hardwareWindow.on('closed', function() {
            hardwareWindow = null;
        });

        if(option.debug) {
            hardwareWindow.webContents.openDevTools();
        }

        hardwareWindow.show();
    }

});

// try{
//     if (handleStartupEvent()) {
//         logger('handleStartupEvent = true');
//         app.quit();
//         process.exit(0);
//         // setTimeout(function () {
//         // }, 1000)
//         return;
//     } else {
//         logger('handleStartupEvent = false');
       
//     }    
// } catch(e) {
//     logger(e.stack);
//     app.quit();
//     process.exit(0);
// }