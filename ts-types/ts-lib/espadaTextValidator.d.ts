declare class espadaTextValidator_Class {
    #private;
    constructor();
    check(langs: Array<string>, packagesFSPath: string, ignoreClassTexts?: Array<string>, ignoreIniTexts?: Array<string>): void;
}
declare const espadaTextValidator: espadaTextValidator_Class;
export default espadaTextValidator;
export type IniInfos = {
    [dirName: string]: {
        [prefix: string]: {
            [title: string]: string;
        };
    };
};
export type NamespaceInfos = {
    [pkgName: string]: {
        fsPath: string;
    };
};
export type TextInfos = {
    [pkgName: string]: {
        [prefix: string]: Array<{
            fsPath: string;
            text: string;
        }>;
    };
};
