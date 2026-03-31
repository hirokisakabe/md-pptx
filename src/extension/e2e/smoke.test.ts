import * as assert from "node:assert";
import * as vscode from "vscode";

suite("VS Code Extension Smoke Tests", () => {
  test("拡張がアクティベーションできること", async () => {
    const extension = vscode.extensions.getExtension("hirokisakabe.md-pptx");
    assert.ok(extension, "拡張が見つかること");

    await extension.activate();
    assert.strictEqual(extension.isActive, true, "拡張がアクティブであること");
  });

  test("md-pptx.build コマンドが登録されていること", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("md-pptx.build"),
      "md-pptx.build コマンドが存在すること",
    );
  });

  test("md-pptx.preview コマンドが登録されていること", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("md-pptx.preview"),
      "md-pptx.preview コマンドが存在すること",
    );
  });
});
