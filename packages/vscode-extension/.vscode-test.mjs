import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
	label: "unitTests",
	files: "out/**/*.test.js",
	version: "insiders",
	workspaceFolder: "./sampleWorkspace",
});
