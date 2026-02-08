use zed_extension_api::{self as zed, LanguageServerId, Result};

struct NaiteExtension;

impl zed::Extension for NaiteExtension {
    fn new() -> Self {
        NaiteExtension
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let node_path = worktree
            .which("node")
            .ok_or_else(|| "node not found in PATH".to_string())?;

        // naite-lsp 서버 스크립트 경로 탐색
        // 1. PATH에서 naite-lsp-server 바이너리
        // 2. 프로젝트 node_modules에서 직접 찾기
        let server_script = worktree
            .which("naite-lsp-server")
            .unwrap_or_else(|| {
                // node_modules/.bin에 없으면 패키지 경로 직접 참조
                "node_modules/naite-lsp/out/server.js".to_string()
            });

        Ok(zed::Command {
            command: node_path,
            args: vec![server_script, "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(NaiteExtension);
