import { ExtensionContext, commands, window, ViewColumn } from "vscode";
import * as vscode from "vscode";
import Commands from '../constants/commands';
import NodeConstants from '../constants/node';
import * as fs from 'fs';
import * as path from 'path';
import utils from "../utils";
import { debounce } from 'lodash'
import Task from '../services/Task';
import CheckFile from '../services/checkFiles';
const noKeyDecoration = vscode.window.createTextEditorDecorationType(
    {
        color: 'red'
    }
);
const hasKeyDecoration = vscode.window.createTextEditorDecorationType({
    opacity: '1',
    color: 'yellow',
    borderWidth: '10px'
});
class CheckAnnotation {
    ctx: ExtensionContext;
    constructor(ctx: ExtensionContext) {
        this.ctx = ctx;
    }
    debounceUpdate = debounce(() => this.update(), 500);
    update() {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (!activeTextEditor) return;
        const { document } = activeTextEditor;
        const task = new Task();
        const configObj = task.getConfig();
        if (!configObj.checkFileReg.test(document.fileName)) {
            return;
        }
        const checkFileService = new CheckFile({
            task: task
        });
        activeTextEditor.setDecorations(hasKeyDecoration, [])
        activeTextEditor.setDecorations(noKeyDecoration, [])
        const filepath = utils.getCurrentFilePath();
        checkFileService.checkFile(filepath).then((data: any) => {
            const noKeyRanges: {range: vscode.Range}[] = [];
            const hasKeyRanges: {range: vscode.Range, renderOptions: any}[] = [];
            data.forEach((item: any) => {
                const range = new vscode.Range(
                    document.positionAt(item.data.start),
                    document.positionAt(item.data.end),
                );
                if (item.type === NodeConstants.HAS_KEY) {
                    if (task.isError(item.trans)) {
                        noKeyRanges.push({
                            range,
                        });
                    } else if (task.isWarn(item.trans)){
                        hasKeyRanges.push({
                            range,
                            renderOptions: {
                                after: {
                                    color: 'rgba(153, 153, 153, .7)',
                                    contentText: checkFileService.getStatusText(
                                        item.trans,
                                        task.getConfig().displayWarnLangs
                                    ),
                                    fontWeight: 'normal',
                                    fontStyle: 'normal'
                                }
                            }
                        });
                    }
                } else {
                    noKeyRanges.push({
                        range,
                    });
                }
            });
            let newRange: vscode.Range[] = []
            newRange = newRange.concat(hasKeyRanges.map(it => it.range))
            newRange = newRange.concat(noKeyRanges.map(it => it.range))
            this.ranges = newRange
            activeTextEditor.setDecorations(hasKeyDecoration, hasKeyRanges)
            activeTextEditor.setDecorations(noKeyDecoration, noKeyRanges)
        })
     }
    init() {
        this.ctx.subscriptions.push(commands.registerCommand(Commands.JUMP_TO_NEXT, (params) => {
            jumpToClosestRange("next", this.ranges)
        }));
        this.ctx.subscriptions.push(commands.registerCommand(Commands.JUMP_TO_PREV, (params) => {
            jumpToClosestRange("prev", this.ranges)
        }));
        this.ctx.subscriptions.push(window.onDidChangeActiveTextEditor(() => {
            this.debounceUpdate();
        }));
        this.ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => {
            this.debounceUpdate();
        }));
    }
    ranges: vscode.Range[] = []
}



// 跳转到距离最近的范围函数
function jumpToClosestRange(direction: "prev" | "next", ranges: vscode.Range[]) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
  
    const cursorPosition = editor.selection.active;
    let closestRange: vscode.Range | undefined;
  
    // 过滤掉包含当前光标的 range
    const validRanges = ranges.filter(range => !range.contains(cursorPosition));
  
    if (direction === "prev") {
      // 查找离光标最近的上一个范围
      closestRange = validRanges
        .filter(range => range.end.isBefore(cursorPosition))
        .reduce((prev, curr) => (!prev || curr.end.isAfter(prev.end) ? curr : prev), undefined as any as vscode.Range);
    } else {
      // 查找离光标最近的下一个范围
      closestRange = validRanges
        .filter(range => range.start.isAfter(cursorPosition))
        .reduce((prev, curr) => (!prev || curr.start.isBefore(prev.start) ? curr : prev), undefined as any as vscode.Range);
    }
  
    // 如果找到了最近的范围，则跳转到该范围
    if (closestRange) {
      editor.revealRange(closestRange, vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(closestRange.start, closestRange.start);
    } else {
      vscode.window.showInformationMessage(direction === "prev" ? '没有上一个范围了！' : '没有下一个范围了！');
    }
  }


export const createCheckAnnotation = (ctx: ExtensionContext) => {
    return new CheckAnnotation(ctx).init();
}