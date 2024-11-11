import * as vscode from "vscode";
import * as path from "path";
import { exec } from "child_process";

class _GitUtils {
  /**
   * 检查某个目录是否在 Git 仓库下
   * @param dirPath - 要检查的目录路径
   * @returns 是否在 Git 仓库下
   */
  isInsideGitRepo(dirPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      exec("git rev-parse --is-inside-work-tree", { cwd: dirPath }, (error) => {
        resolve(!error); // 如果没有错误，说明在 Git 仓库下
      });
    });
  }

  /**
   * 获取某个目录下发生变动的文件
   * @param dirPath - 要检查变动文件的目录路径
   * @returns 变动文件的相对路径数组
   */
  async getStatusChangedFilesInDir(dirPath: string): Promise<string[]> {
    const repoRoot = await this.getRepoRoot(dirPath);
    return new Promise((resolve, reject) => {
      // 获取相对路径，限制输出变更文件仅在指定目录中
      // const relativeDirPath = path.relative(repoRoot, dirPath);
      const command = `git status --porcelain --untracked-files=all`;

      exec(command, { cwd: dirPath }, (error, stdout) => {
        if (error) {
          reject(`Error fetching changed files: ${error.message}`);
          return;
        }

        const allChangedFiles = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => line.slice(3)) // 移除状态代码的前2个字符和1个空格
          .map((name) => path.resolve(repoRoot, name).toUpperCase());

        const _dirPath =dirPath.toUpperCase()
        // 只包含改变的...
        const changedFilesInDir = allChangedFiles.filter((it) =>
          it.startsWith(_dirPath)
        );

        resolve(changedFilesInDir);
      });
    });
  }

  /**
   * 获取某个目录下发生变动的文件
   * @param dirPath - 要检查变动文件的目录路径
   * @returns 变动文件的相对路径数组
   */
  async getDiffChangedFilesInDir(dirPath: string, target: string): Promise<string[]> {
    // 需要获取
    const repoRoot = await this.getRepoRoot(dirPath);
    return new Promise((resolve, reject) => {
      const command = `git diff ${target} --name-only`;
      exec(command, { cwd: dirPath }, (error, stdout) => {
        if (error) {
          reject(`Error fetching changed files: ${error.message}`);
          return;
        }
        const allChangedFiles = stdout
          .split("\n")
          .map((file) => file.trim())
          .filter((file) => file.length > 0) // 过滤空行
          .map((name) => path.resolve(repoRoot, name).toUpperCase());
        resolve(allChangedFiles);
      });
    });
  }

  /**
   * 获取 Git 仓库的根路径
   * @param dirPath - 要检查的目录路径
   * @returns Git 仓库根路径
   */
  private getRepoRoot(dirPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(
        "git rev-parse --show-toplevel",
        { cwd: dirPath },
        (error, stdout) => {
          if (error) {
            reject(`Error finding Git root: ${error.message}`);
            return;
          }
          resolve(stdout.trim());
        }
      );
    });
  }
}

const GitUtils = new _GitUtils();
export default GitUtils;
