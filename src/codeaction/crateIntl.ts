import { ExtensionContext, commands, window, HoverProvider, ViewColumn } from "vscode";
import Commands from '../constants/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import utils from "../utils";
import { debounce } from 'lodash'
import CheckFile from '../services/checkFiles';
import NodeConstants from "../constants/node";
import Task from "../services/Task";
var CRC32 = require('crc-32');

class CodeAction implements vscode.CodeActionProvider {

    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];


    task: any = null;
    configObj: any = {};
    constructor() {
    }
    getKeyByFileAndText(text: any) {
        const currentFilePath = utils.getCurrentFilePath();
        const relativePath = path.relative(this.configObj.baseDir, currentFilePath);
        const dirName = path.dirname(relativePath);
        const fileName = path.basename(relativePath, path.extname(relativePath));
        return dirName.split(/\/|\\/g).slice(-1).concat(fileName, CRC32.str(text)).join('_');
    }
    checkHasCn(cnText: string) {
        const langData = this.task.getLang();
        for (var i in langData[this.configObj.defaultLang]) {
            if (langData[this.configObj.defaultLang].hasOwnProperty(i)) {
                const text = langData[this.configObj.defaultLang][i];
                if (text === cnText) {
                    return i;
                }
            }
        }
        return false;
    }
    getCodeActionFromCommand(commands: any): any[] {
        const arr: vscode.CodeAction[] = []
        commands.forEach((command: any) => {
            const action = new vscode.CodeAction(command[0], vscode.CodeActionKind.QuickFix)
            action.command = {
                command: command[1],
                title: command[0],
                arguments: [command[2]]
            }
            arr.push(action)
        });
        return arr;
    }
    getCodeActions(info: any) {
        if (info.type === NodeConstants.NO_KEY) {
            const startNode = info.data.startNode;
            const endNode = info.data.endNode;
            const range = {
                startLine: startNode.line - 1,
                startColumn: startNode.column,
                endLine: endNode.line - 1,
                endColumn: endNode.column
            };
            const resultKey = this.checkHasCn(info.intlText)
            if (resultKey) {
                return this.getCodeActionFromCommand([
                    [
                        '已经存在Key, 自动填充',
                        Commands.AUTO_FILL_TEXT,
                        {
                            range: range,
                            text: `intl.get('${resultKey}').d('${info.intlText}')`
                        }
                    ],
                    [
                        '已经存在Key, 自动填充, 加大括号',
                        Commands.AUTO_FILL_TEXT,
                        {
                            range: range,
                            text: `{intl.get('${resultKey}').d('${info.intlText}')}`
                        }
                    ]
                ]);
            } else {
                return this.getCodeActionFromCommand([
                    [
                        '添加国际化',
                        Commands.OPEN_WEBVIEW,
                        {
                            replaceParams: info.data.replaceParams,
                            hasParams: info.data.hasParams,
                            getMethod: info.data.getMethod,
                            range: range,
                            text: info.intlText,
                            key: this.getKeyByFileAndText(info.intlText),
                            type: 'replaceWhole'
                        }
                    ]
                ]);
            }
        } else if (info.type === NodeConstants.HAS_KEY) {
            const trans = info.trans;
            const keyLocNode = info.data.keyLocNode;
            const startNode = keyLocNode.start;
            const endNode = keyLocNode.end;
            const range = {
                startLine: startNode.line - 1,
                startColumn: startNode.column,
                endLine: endNode.line - 1,
                endColumn: endNode.column
            }
            if (this.task.hasFalse(trans)) {
                if (trans[this.configObj.defaultLang]) {
                    if (trans[NodeConstants.KEY_SAME] === false) {
                        const textLocNode = info.data.textLocNode;
                        if (textLocNode) {
                            const startNode = textLocNode.start;
                            const endNode = textLocNode.end;
                            const range = {
                                startLine: startNode.line - 1,
                                startColumn: startNode.column,
                                endLine: endNode.line - 1,
                                endColumn: endNode.column
                            }
                            const langData = this.task.getLang();
                            return this.getCodeActionFromCommand([
                                [
                                    '不一致, 自动更新',
                                    Commands.AUTO_FILL_TEXT,
                                    {
                                        range: range,
                                        text: `'${langData[this.configObj.defaultLang][info.intlKey]}'`
                                    }
                                ]
                            ]);
                        }
                    } else {
                        return this.getCodeActionFromCommand([
                            [
                                '已经添加到国际化, 但是缺少英文, 或者繁体',
                                Commands.OPEN_WEBVIEW,
                                {
                                    range: range,
                                    text: info.intlText,
                                    key: this.getKeyByFileAndText(info.intlText),
                                    type: 'replaceWhole'
                                }
                            ]
                        ]);
                    }
                } else {
                    const resultKey = this.checkHasCn(info.intlText);
                    if (resultKey) {
                        return this.getCodeActionFromCommand([
                            [
                                '已经存在Key, 自动填充',
                                Commands.AUTO_FILL_TEXT,
                                {
                                    range: range,
                                    text: `'${resultKey}'`
                                }
                            ]
                        ]);
                    } else {
                        return this.getCodeActionFromCommand([
                            [
                                '不存在Key, 添加到国际化',
                                Commands.OPEN_WEBVIEW,
                                {
                                    range: range,
                                    text: info.intlText,
                                    key: info.intlKey,
                                    type: 'replaceKey'
                                }
                            ]
                        ]);
                    }
                }
            }
        }
    }
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        const position = range.start
        const info = utils.globalFileInfo[document.fileName];
        if (info) {
            this.task = new Task();
            this.configObj = this.task.getConfig();
            const infoAtPositon = Object.values(info).find((item: any) => {
                const offset = document.offsetAt(position);
                return offset >= item.data.start && offset <= item.data.end;
            });
            if (infoAtPositon) {
                return this.getCodeActions(infoAtPositon);
            }
        }
        return
    }
}
export const createCodeAction = (ctx: ExtensionContext) => {
    ctx.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { pattern: '**/*.{ts,js,tsx,jsx}' },
            new CodeAction(),
            {
                providedCodeActionKinds: CodeAction.providedCodeActionKinds
            }
        )
    );
}
