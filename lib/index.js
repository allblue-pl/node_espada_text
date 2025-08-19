'use strict';

const
    fs = require('fs'),
    path = require('path'),

    js0 = require('js0')
;

class espadaText_Class {
    constructor() {
        js0.args(arguments);
    }

    addInis(iniInfos, dirName, fsPath) {
        js0.args(arguments, js0.RawObject, 'string', 'string');

        let fileArr = path.basename(fsPath).split('.');
        if (fileArr[fileArr.length - 1] !== 'ini')
            return;
        fileArr.pop();
        let prefix = fileArr.join('.');

        if (!(dirName in iniInfos))
            iniInfos[dirName] = {};
        if (!(prefix in iniInfos[dirName]))
            iniInfos[dirName][prefix] = [];

        let texts = this.parseIniFile(fsPath);
        for (let title in texts)
            iniInfos[dirName][prefix][title] = texts[title];
    }

    addTexts(langs, textInfos, fsPath) {
        js0.args(arguments, js0.ArrayItems('string'), js0.RawObject, 'string');

        let string = `EC\\HText::_(
                        'Sys:Errors_ActiveUserWithLoginAlreadyExists'`;

        let re = new RegExp(`EC\\\\HText::\\_\\(.*?('|")(.*?)('|")`, 'gms');
        let content = fs.readFileSync(fsPath).toString();
        // let content = `Test EC\\HText::_('Tescik'); EC\\HText::_('Inny Tescik');`;
        let matches = content.matchAll(re);
        for (let match of matches) {
            let textArr = match[2].split(':');
            if (textArr.length !== 2)
                console.error('Wrong Text Format', match[2], fsPath);

            let pkgName = textArr[0];
            let text = textArr[1];
            let prefixArr = text.split('.');

            for (let lang of langs) {
                let prefix = lang;
                if (prefixArr.length > 1) {
                    text = prefixArr.pop();
                    prefix = prefix + '.' + prefixArr.join('.');
                }

                if (!(pkgName in textInfos))
                    textInfos[pkgName] = {};
                if (!(prefix in textInfos[pkgName]))
                    textInfos[pkgName][prefix] = [];

                textInfos[pkgName][prefix].push({
                    fsPath: fsPath,
                    text: text,
                });
            }
        }
    }

    check(langs, packagesFSPath, ignoreClassTexts = [], ignoreIniTexts = []) {
        js0.args(arguments, js0.ArrayItems('string'), 'string', 
                [ js0.ArrayItems('string'), js0.Default ], 
                [ js0.ArrayItems('string'), js0.Default ]);

        let textInfos = {};
        let iniInfos = {};

        let fileNames = fs.readdirSync(packagesFSPath);
        for (let fileName of fileNames) {
            let packageFSPath = path.join(packagesFSPath, fileName);
            if (fs.lstatSync(packageFSPath).isDirectory())
                this.checkPackage(langs, textInfos, iniInfos, packageFSPath);
        }

        this.validateMissingTexts(langs, textInfos, iniInfos, ignoreClassTexts);
        this.validateUnusedInis(langs, textInfos, iniInfos, ignoreIniTexts);
    }

    checkPackage(langs, textInfos, iniInfos, packageFSPath) {
        js0.args(arguments, js0.ArrayItems('string'), js0.RawObject, 
                js0.RawObject, 'string');

        let packageName = path.basename(packageFSPath);
        let dirNames = fs.readdirSync(packageFSPath);
        for (let dirName of dirNames) {
            let dirFSPath = path.join(packageFSPath, dirName);
            if (!fs.lstatSync(dirFSPath).isDirectory())
                continue;

            this.checkPackageDir(langs, textInfos, iniInfos, packageFSPath, 
                    dirName);
        }
    }

    checkPackageDir(langs, textInfos, iniInfos, packageFSPath, dirName) {
        js0.args(arguments, js0.ArrayItems('string'), js0.RawObject, 
                js0.RawObject, 'string', 'string');

        let packageName = path.basename(packageFSPath);

        /* Classes */
        let classesFSPath = path.join(packageFSPath, dirName, 'classes');
        if (fs.existsSync(classesFSPath)) {
            if (fs.lstatSync(classesFSPath).isDirectory()) {
                this.checkPackageDirClasses(langs, textInfos, path.join(
                        packageFSPath, dirName, 'classes'));
            }
        }

        /* Languages */
        this.checkPackageDirInis(iniInfos, packageFSPath, dirName);
    }

    checkPackageDirClasses(langs, textInfos, classesFSPath) {
        js0.args(arguments, js0.ArrayItems('string'), js0.RawObject, 'string');

        let dirFSPaths = [ classesFSPath ];
        while (dirFSPaths.length > 0) {
            let dirFSPath = dirFSPaths.splice(0, 1)[0];
            let fileNames = fs.readdirSync(dirFSPath);
            for (let fileName of fileNames) {
                let fileFSPath = path.join(dirFSPath, fileName);
                let fileLStat = fs.lstatSync(fileFSPath);
                if (fileLStat.isDirectory()) {
                    dirFSPaths.push(fileFSPath);
                    continue;
                }

                if (!fileLStat.isFile())
                    continue;

                this.addTexts(langs, textInfos, fileFSPath);
            }
        }
    }

    checkPackageDirInis(iniInfos, packageFSPath, dirName) {
        js0.args(arguments, js0.RawObject, 'string', 
                'string');

        let langsFSPath = path.join(packageFSPath, dirName, 'languages');
        if (!fs.existsSync(langsFSPath))
            return;
        if (!fs.lstatSync(langsFSPath).isDirectory())
            return;

        let fileNames = fs.readdirSync(langsFSPath);
        for (let fileName of fileNames) {
            this.addInis(iniInfos, dirName, path.join(langsFSPath, 
                    fileName));
        }
    }

    parseIniFile(fsPath) {
        js0.args(arguments, 'string');

        let texts = {};

        let content = fs.readFileSync(fsPath).toString();
        content = content.replaceAll(/\\''/gm, '&apos;');
        content = content.replaceAll(/\\"'/gm, '&quot;');
        while(true) {
            let titleMatch = content.match(/([a-zA-Z0-9_]+)( +)?=/m);
            if (titleMatch === null)
                break;

            let title = titleMatch[1];
            content = content.substring(titleMatch.index + titleMatch[0].length);
            let sign = '\'';
            let start = content.indexOf(sign);
            let startB = content.indexOf('"');
            if ((startB !== -1 && startB < start) || start === -1) {
                sign = '"';
                start = startB;
            }

            if (start === -1)
                break;
            content = content.substring(start + 1);
            let end = content.indexOf(sign);
            if (end === -1)
                break;
            texts[title] = content.substring(0, end);
            content = content.substring(end + 1);
        }

        return texts;
    }

    validateMissingTexts(langs, textInfos, iniInfos, ignoreTexts) {
        js0.args(arguments, js0.ArrayItems('string'), js0.RawObject, 
                js0.RawObject, js0.ArrayItems('string'));

        for (let dirName in textInfos) {
            if (!(dirName in iniInfos)) {
                console.error(`Package '${dirName}' doesn't have languages.`);
                console.warn('Text Infos', textInfos[dirName]);
                continue;
            }

            for (let prefix in textInfos[dirName]) {
                if (!(prefix in iniInfos[dirName])) {
                    console.error(`Package '${dirName}' languages` +
                            ` doesn't have prefix '${prefix}'. `);
                    console.warn('Text Infos', textInfos[dirName][prefix]);
                    continue;
                }

                for (let textInfo of textInfos[dirName][prefix]) {
                    if (textInfo.text in iniInfos[dirName][prefix])
                        continue;

                    let fullText = `${dirName}:${prefix}.${textInfo.text}`;
                    if (ignoreTexts.includes(fullText))
                        continue;

                    console.error(`Text '${fullText}'` +
                            ` does not exist in language files.`);
                    console.warn(`File: ${textInfo.fsPath}`);
                }
            }
        }
    }

    validateUnusedInis(langs, textInfos, iniInfos, ignoreTexts) {
        js0.args(arguments, js0.ArrayItems('string'), js0.RawObject, 
                js0.RawObject, js0.ArrayItems('string'));

         for (let dirName in iniInfos) {
            if (!(dirName in textInfos)) {
                console.error(`Package '${dirName}' languages not used in texts.`);
                continue;
            }

            for (let prefix in iniInfos[dirName]) {
                let prefixArr = prefix.split('.');
                if (!langs.includes(prefixArr[0]))
                    continue;

                if (!(prefix in textInfos[dirName])) {
                    console.error(`'${dirName}' languages` +
                            ` prefix '${prefix}' not used in texts.`);
                    continue;
                }

                for (let text in iniInfos[dirName][prefix]) {
                    let textFound = false;
                    for (let textInfo of textInfos[dirName][prefix]) {
                        if (textInfo.text === text) {
                            textFound = true;
                            break;
                        }
                    }

                    if (textFound)
                        continue;

                    let fullText = `${dirName}:${prefix}.${text}`;
                    if (ignoreTexts.includes(fullText))
                        continue;

                    console.error(`Text '${fullText}' not used.`);
                }
            }
        }
    }
}
module.exports = new espadaText_Class();