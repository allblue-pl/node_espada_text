import fs from "node:fs";
import path from "node:path";

class espadaTextValidator_Class {
    constructor() {
        
    }

    check(langs               , packagesFSPath        , ignoreClassTexts                = [], 
            ignoreIniTexts                = [])       {
        let textInfos = {};
        let iniInfos = {};

        let namespaceInfos                 = {};

        let fileNames = fs.readdirSync(packagesFSPath);
        for (let pkgName of fileNames) {
            let pkgFSPath = path.join(packagesFSPath, pkgName);
            let namespaceNames = fs.readdirSync(pkgFSPath);
            for (let namespaceName of namespaceNames) {
                let namespaceFSPath = path.join(pkgFSPath, namespaceName);
                if (!fs.lstatSync(namespaceFSPath).isDirectory())
                    continue;

                namespaceInfos[namespaceName] = {
                    fsPath: namespaceFSPath,
                };

                this.#checkNamespaceDir(langs, textInfos, iniInfos, pkgFSPath, 
                        namespaceName);
            }
        }

        this.#validateUnusedInis(langs, textInfos, iniInfos, ignoreIniTexts);
        this.#validateMissingTexts(langs, textInfos, iniInfos, ignoreClassTexts,
                namespaceInfos);
    }


    #addInis(iniInfos          , dirName        , fsPath        )       {
        let fileArr = path.basename(fsPath).split('.');
        if (fileArr[fileArr.length - 1] !== 'ini')
            return;
        fileArr.pop();
        let prefix = fileArr.join('.');

        if (!(dirName in iniInfos))
            iniInfos[dirName] = {};
        if (!(prefix in iniInfos[dirName]))
            iniInfos[dirName][prefix] = {};

        let texts = this.#parseIniFile(fsPath);
        for (let title in texts)
            iniInfos[dirName][prefix][title] = texts[title];
    }

    #addTexts(langs               , textInfos           , fsPath        )       {
        let re = new RegExp(`HText::\\_\\(.*?('|")(.*?)('|")`, 'gms');
        let content = fs.readFileSync(fsPath).toString();
        // let content = `Test EC\\HText::_('Tescik'); EC\\HText::_('Inny Tescik');`;
        let matches = content.matchAll(re);
        for (let match of matches) {
            let textArr = match[2].split(':');
            if (textArr.length !== 2) {
                console.error('Wrong Text Format', match[2], fsPath);
                continue;
            }

            let pkgName = textArr[0];
            let text         = textArr[1];
            let prefixArr = text.split('.');

            for (let lang of langs) {
                let prefix = lang;
                if (prefixArr.length > 1) {
                    text = prefixArr.pop() ;
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

    #checkNamespaceDir(langs               , textInfos           , iniInfos          , 
            packageFSPath        , dirName        )       {
        let packageName = path.basename(packageFSPath);

        /* Classes */
        let classesFSPath = path.join(packageFSPath, dirName, 'classes');
        if (fs.existsSync(classesFSPath)) {
            if (fs.lstatSync(classesFSPath).isDirectory()) {
                this.#checkPackageDirClasses(langs, textInfos, path.join(
                        packageFSPath, dirName, 'classes'));
            }
        }

        /* Languages */
        this.#checkPackageDirInis(iniInfos, packageFSPath, dirName);
    }

    #checkPackageDirClasses(langs               , textInfos           , 
            classesFSPath        )       {
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

                this.#addTexts(langs, textInfos, fileFSPath);
            }
        }
    }

    #checkPackageDirInis(iniInfos          , packageFSPath        , dirName        )       {
        let langsFSPath = path.join(packageFSPath, dirName, 'languages');
        if (!fs.existsSync(langsFSPath))
            return;
        if (!fs.lstatSync(langsFSPath).isDirectory())
            return;

        let fileNames = fs.readdirSync(langsFSPath);
        for (let fileName of fileNames) {
            this.#addInis(iniInfos, dirName, path.join(langsFSPath, 
                    fileName));
        }
    }

    #parseIniFile(fsPath        )                            {
        let texts                            = {};

        let content = fs.readFileSync(fsPath).toString();
        content = content.replaceAll(/\\''/gm, '&apos;');
        content = content.replaceAll(/\\"'/gm, '&quot;');
        while(true) {
            let titleMatch = content.match(/([a-zA-Z0-9_]+)( +)?=/m);
            if (titleMatch === null)
                break;
            if (titleMatch.index === undefined)
                continue;

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

    #validateMissingTexts(langs               , textInfos           , iniInfos          , 
            ignoreTexts               , namespaceInfos                )       {
        let missingTextsTemplates                                = {};

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

                    let iniFSPath = path.join(namespaceInfos[dirName].fsPath, "languages", `${prefix}.ini`);
                    if (!(iniFSPath in missingTextsTemplates))
                        missingTextsTemplates[iniFSPath] = "";
                    missingTextsTemplates[iniFSPath] += `${textInfo.text} = \r\n`;
                }
            }
        }

        if (Object.keys( missingTextsTemplates).length > 0) {
            console.info("\r\n MISSING TEXTS")
            for (let iniFSPath in missingTextsTemplates) {
                console.info("\r\n### " + iniFSPath + " ###\r\n");
                console.info(missingTextsTemplates[iniFSPath]);
            }
        } else {
            console.info("\r\nNo missing texts.");
        }
    }

    #validateUnusedInis(langs               , textInfos           , iniInfos          , 
            ignoreTexts               )       {
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
const espadaTextValidator = new espadaTextValidator_Class();
export default espadaTextValidator;

                        
                        
                           
                                    
          
       

                              
                        
                       
      
  

                         
                        
                                 
                           
                        
          
     
  