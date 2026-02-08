use std::env;
use std::path::PathBuf;
use zed_extension_api::{self as zed, LanguageServerId, Result};

struct SonamuExtension;

impl SonamuExtension {
    fn resolve_server_path(&self) -> Result<PathBuf> {
        let work_dir = env::current_dir().map_err(|e| e.to_string())?;

        // 1. npm에서 최신 버전 설치 시도
        let npm_result = zed::npm_package_latest_version("@sonamu-kit/lsp")
            .and_then(|version| {
                zed::npm_install_package("@sonamu-kit/lsp", &version)?;
                Ok(work_dir.join("node_modules/@sonamu-kit/lsp/out/server.mjs"))
            });

        if let Ok(path) = npm_result {
            return Ok(path);
        }

        // 2. work 디렉토리에 수동 배치된 서버 사용 (개발용)
        let local_path = work_dir.join("server/server.mjs");
        if local_path.exists() {
            return Ok(local_path);
        }

        Err(format!(
            "@sonamu-kit/lsp npm 패키지를 찾을 수 없습니다. \
            개발 중이라면 server.js를 다음 경로에 복사하세요: {}",
            local_path.display()
        ))
    }
}

impl zed::Extension for SonamuExtension {
    fn new() -> Self {
        SonamuExtension
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_path = self.resolve_server_path()?;

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                server_path.to_string_lossy().to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(SonamuExtension);
