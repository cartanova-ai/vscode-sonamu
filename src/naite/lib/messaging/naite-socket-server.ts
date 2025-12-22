import crypto from "crypto";
import fs from "fs/promises";
import net from "net";
import os from "os";
import path from "path";
import type { NaiteMessagingTypes } from "./messaging-types";
import { TraceStore } from "./trace-store";

/**
 * sonamu.config.ts 경로를 받아서 프로젝트별 고유 해시를 생성합니다.
 * 익스텐션과 Sonamu 프레임워크 양쪽에서 동일한 방식으로 계산해야 합니다.
 */
export function getProjectHash(configPath: string): string {
  return crypto.createHash("md5").update(configPath).digest("hex").slice(0, 8);
}

interface SocketInstance {
  server: net.Server;
  socketPath: string;
  configPath: string;
}

/**
 * Sonamu에서 보내는 Naite 메시지를 받아서 처리하는 친구입니다.
 * net이 제공하는 Unix domain socket을 사용합니다.
 *
 * 여러 프로젝트를 동시에 지원하기 위해 여러 소켓을 관리합니다.
 *
 * 주고받는 메시지의 타입은 messaging-types.ts에 정의되어 있습니다.
 * 해당 파일은 동일한 이름과 내용으로 Sonamu에도 존재합니다.
 */
class NaiteSocketServerClass {
  private readonly SOCKET_DIR = path.join(os.homedir(), ".sonamu");

  private sockets: Map<string, SocketInstance> = new Map(); // configPath -> SocketInstance

  /**
   * 여러 프로젝트의 소켓 서버를 시작합니다.
   * @param configPaths unix domain socket 경로들의 배열
   */
  async startAll(configPaths: string[]): Promise<string[]> {
    const socketPaths: string[] = [];

    // 디렉토리 생성 (한 번만)
    if (process.platform !== "win32") {
      try {
        await fs.mkdir(this.SOCKET_DIR, { recursive: true });
      } catch {
        // 이미 존재하면 무시
      }
    }

    for (const configPath of configPaths) {
      // 이미 실행 중인 소켓은 건너뜀
      const existing = this.sockets.get(configPath);
      if (existing) {
        socketPaths.push(existing.socketPath);
        continue;
      }

      const socketPath = await this.startOne(configPath);
      if (socketPath) {
        socketPaths.push(socketPath);
      }
    }

    // 더 이상 필요 없는 소켓 정리 (configPaths에 없는 것들)
    for (const existingConfigPath of this.sockets.keys()) {
      if (!configPaths.includes(existingConfigPath)) {
        await this.stopOne(existingConfigPath);
      }
    }

    return socketPaths;
  }

  /**
   * 단일 프로젝트의 소켓 서버를 시작합니다.
   */
  private async startOne(configPath: string): Promise<string | null> {
    const projectHash = getProjectHash(configPath);
    const socketPath =
      process.platform === "win32"
        ? `\\\\.\\pipe\\naite-${projectHash}`
        : path.join(this.SOCKET_DIR, `naite-${projectHash}.sock`);

    // 기존 소켓 파일 삭제
    if (process.platform !== "win32") {
      try {
        await fs.unlink(socketPath);
      } catch {
        // 파일이 없으면 무시
      }
    }

    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        // 줄바꿈으로 메시지 구분
        let newlineIndex = buffer.indexOf(0x0a);
        while (newlineIndex !== -1) {
          const line = buffer.subarray(0, newlineIndex).toString("utf8");
          buffer = buffer.subarray(newlineIndex + 1);

          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log(`[Naite Socket ${projectHash}] Received:`, data.type);
              this.processMessage(data);
            } catch (err) {
              console.error(`[Naite Socket ${projectHash}] Parse error:`, err);
            }
          }

          newlineIndex = buffer.indexOf(0x0a);
        }
      });

      socket.on("error", () => {
        // 연결 에러는 무시
      });
    });

    return new Promise((resolve) => {
      server.listen(socketPath, () => {
        console.log(`[Naite Socket Server] Listening on ${socketPath}`);
        this.sockets.set(configPath, { server, socketPath, configPath });
        resolve(socketPath);
      });

      server.on("error", (err) => {
        console.error(`[Naite Socket Server] Error on ${socketPath}:`, err);
        resolve(null);
      });
    });
  }

  /**
   * 단일 프로젝트의 소켓 서버를 중지합니다.
   */
  private async stopOne(configPath: string): Promise<void> {
    const instance = this.sockets.get(configPath);
    if (!instance) {
      return;
    }

    instance.server.close();

    if (process.platform !== "win32") {
      try {
        await fs.unlink(instance.socketPath);
      } catch {
        // 파일이 없으면 무시
      }
    }

    this.sockets.delete(configPath);
    console.log(`[Naite Socket Server] Stopped ${instance.socketPath}`);
  }

  /**
   * 모든 소켓 서버를 중지합니다.
   */
  async stop(): Promise<void> {
    for (const configPath of this.sockets.keys()) {
      await this.stopOne(configPath);
    }
  }

  /**
   * 현재 실행 중인 소켓 경로들을 반환합니다.
   */
  getSocketPaths(): string[] {
    return Array.from(this.sockets.values()).map((s) => s.socketPath);
  }

  private processMessage(data: NaiteMessagingTypes.NaiteMessage): void {
    const type = data.type;

    switch (type) {
      case "run/start":
        // 새 테스트 run 시작 - 데이터 클리어
        TraceStore.addRunStart();
        break;

      case "test/result": {
        // 테스트 케이스 결과 추가
        TraceStore.addTestResult({
          suiteName: data.suiteName,
          suiteFilePath: data.suiteFilePath,
          testName: data.testName,
          testFilePath: data.testFilePath,
          testLine: data.testLine,
          status: data.status,
          duration: data.duration,
          error: data.error,
          traces: data.traces ?? [],
          receivedAt: data.receivedAt,
        });
        break;
      }

      case "run/end":
        TraceStore.addRunEnd();
        break;
    }
  }
}

export const NaiteSocketServer = new NaiteSocketServerClass();
