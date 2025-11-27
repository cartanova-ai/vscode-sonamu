#!/bin/bash

# Sonamu VS Code Extension 설치 스크립트

set -e

echo "🔨 Building extension..."
pnpm run compile

echo "📦 Packaging extension..."
npx @vscode/vsce package --no-dependencies

echo "🚀 Installing extension..."
code --install-extension vscode-sonamu-0.0.1.vsix --force

echo "✅ Installation complete!"
echo ""
echo "🔄 Please restart VS Code to activate the extension."
echo ""
echo "📖 Usage:"
echo "  1. Open VS Code: code ~/Projects/sonamu"
echo "  2. Open any TypeScript file"
echo "  3. Type: Naite.get(\""
echo "  4. See autocomplete suggestions!"
