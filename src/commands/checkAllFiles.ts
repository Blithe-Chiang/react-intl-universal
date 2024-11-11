import { ExtensionContext, commands, window, ViewColumn } from "vscode";
import Commands from '../constants/commands';
import * as fs from 'fs';
import * as path from 'path';
import utils from "../utils";
import Task from '../services/Task';
import CheckFile from '../services/checkFiles'
import NodeConstants from "../constants/node";
import GitUtils from "../GitUtils";
class CheckFiles {
    ctx: any;
    panel: any;
    constructor(ctx: ExtensionContext) {
        this.ctx = ctx;
    }
    init() {
        this.ctx.subscriptions.push(commands.registerCommand(Commands.CHECK_ALL_FILES, () => {
            // 获取当前文件路径, 然后根据路径获取配置文件
            const currentDir = utils.getCurrentFilePath()
            window.showInputBox({
                prompt: '请输入要check的文件夹路径',
                value: currentDir,
                valueSelection: [currentDir.lastIndexOf('/'), currentDir.length]
            }).then(async (dir: any) => {
                const task = new Task();
                const checkFileService = new CheckFile({
                    task: task
                });
                const consoleErrors = (ferrors: any) => {
                    if (task.getConfig().errorHandle) {
                        task.configObj.errorHandle(ferrors);
                    }
                    utils.clearOutput();
                    ferrors = ferrors.filter((item: any) => {
                        if (item.type === NodeConstants.HAS_KEY) {
                            return task.isCheck(item.trans);
                        } else if (item.type === NodeConstants.NO_KEY) {
                            return true;
                        }
                    });
                    
                    if (ferrors.length > 0) {
                        ferrors.forEach((item: any) => {
                            const filePath = item.filePath;
                            const consolePath = `${filePath}:${item.data.startNode.line}:${item.data.startNode.column}`;
                            if (item.type === NodeConstants.HAS_KEY) {
                                checkFileService.consolePath(consolePath, item.trans, item.intlText);
                            } else if (item.type === NodeConstants.NO_KEY) {
                                checkFileService.consolePath(consolePath, {
                                    [task.configObj.defaultLang]: false,
                                }, item.intlText);
                            }
                        });
                    } else {
                        utils.appendOutputLine('此文件正常, 没有国际化问题');
                    }
                    utils.showOutput();
                }
                if (fs.statSync(dir).isFile()) {
                    checkFileService.checkFile(dir).then(consoleErrors)
                } else {
                    const options = [
                        { label: '正常的检查', action: 'checkRepo' },
                        { label: '当前的变化', action: 'currentChanges' },
                        { label: '对比历史变化', action: 'compareHistory' }
                    ];
                    const selectedOption = await window.showQuickPick(options, {
                        placeHolder: '请选择一个操作',
                    });
                    if (!selectedOption) {
                        window.showInformationMessage('未选择任何操作');
                        return;
                    }
                    let gitChangedFiles: undefined | string[]
                    switch (selectedOption.action) {
                        case 'checkRepo':
                        break;
                        case 'currentChanges':
                            gitChangedFiles = await this.getChangedFiles(dir, "status");
                            if (gitChangedFiles?.length === 0) {
                                utils.clearOutput();
                                utils.appendOutputLine('没有变化');
                                utils.showOutput();
                                return
                            }
                        break;
                        case 'compareHistory':
                            gitChangedFiles = await this.getChangedFiles(dir, "diff");
                            if (gitChangedFiles?.length === 0) {
                                utils.clearOutput();
                                utils.appendOutputLine('没有变化');
                                utils.showOutput();
                                return
                            }
                        break;
                    }
                    checkFileService.getFiles(dir, gitChangedFiles).then(consoleErrors)
                }
            });
        }));
    }
    

    private async getChangedFiles(dir: any, type: "status" | "diff") {
        const isInSideRepo = await GitUtils.isInsideGitRepo(dir);
        if (isInSideRepo) {
            try {
                if (type === "status") {
                    return await GitUtils.getStatusChangedFilesInDir(dir);
                }
                if (type === "diff") {
                    return window.showInputBox({
                        prompt: '输入进行diff的target',
                        value: '',
                    }).then(async (target: any) => {
                        const _target = target || ""
                        return await GitUtils.getDiffChangedFilesInDir(dir, _target);
                    })
                }
            } catch (error) {
                window.showWarningMessage(error as string);
            }
        }
    }
}
export const createCheckFiles = (ctx: ExtensionContext) => {
    return new CheckFiles(ctx).init();
}
