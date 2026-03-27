import * as vscode from "vscode";
import { registerBuildCommand } from "./commands/build";
import { registerPreviewCommand } from "./commands/preview";

export function activate(context: vscode.ExtensionContext): void {
  registerBuildCommand(context);
  registerPreviewCommand(context);
}

export function deactivate(): void {
  // cleanup if needed
}
