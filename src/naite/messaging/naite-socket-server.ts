import fs from "fs/promises";
import net from "net";
import os from "os";
import path from "path";
import type { NaiteMessagingTypes } from "./messaging-types";
import { TraceStore } from "./trace-store";

/**
 * Sonamu에서 보내는 Naite 메시지를 받아서 처리하는 친구입니다.
 * net이 제공하는 Unix domain socket을 사용합니다.
 *
 * 주고받는 메시지의 타입은 messaging-types.ts에 정의되어 있습니다.
 * 해당 파일은 동일한 이름과 내용으로 Sonamu에도 존재합니다.
 */
class NaiteSocketServerClass {
  private readonly SOCKET_DIR = path.join(os.homedir(), ".sonamu");
  private readonly SOCKET_PATH =
    process.platform === "win32" ? "\\\\.\\pipe\\naite" : path.join(this.SOCKET_DIR, "naite.sock");
  private readonly DEBOUNCE_DELAY = 100;

  private server: net.Server | null = null;
  private pendingMessages: NaiteMessagingTypes.NaiteMessage[] = [];
  private processDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  async start(): Promise<string> {
    if (this.server) {
      return this.SOCKET_PATH;
    }

    // 디렉토리 생성
    if (process.platform !== "win32") {
      try {
        const stat = await fs.stat(this.SOCKET_DIR);
        if (!stat.isDirectory()) {
          await fs.mkdir(this.SOCKET_DIR, { recursive: true });
        }
      } catch {
        // 디렉토리가 없으면 생성
        await fs.mkdir(this.SOCKET_DIR, { recursive: true });
      }
      // 기존 소켓 파일 삭제
      try {
        const stat = await fs.stat(this.SOCKET_PATH);
        if (stat.isFile()) {
          await fs.unlink(this.SOCKET_PATH);
        }
      } catch {
        // 파일이 없으면 무시
      }
    }

    this.server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        console.log("[Naite Socket] Received chunk, buffer length:", buffer.length);

        // 줄바꿈으로 메시지 구분
        let newlineIndex = buffer.indexOf(0x0a);
        while (newlineIndex !== -1) {
          const line = buffer.subarray(0, newlineIndex).toString("utf8");
          buffer = buffer.subarray(newlineIndex + 1);

          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log("[Naite Socket] Parsed message type:", data.type);
              this.queueMessage(data);
            } catch (err) {
              console.error("[Naite Socket] Parse error:", err);
            }
          }

          newlineIndex = buffer.indexOf(0x0a);
        }
      });

      socket.on("error", (_err) => {
        // extension 서버가 안 떠 있으면 여기로 올 겁니다.
        // 무시합니다.
      });
    });

    return new Promise((resolve, reject) => {
      this.server?.listen(this.SOCKET_PATH, () => {
        console.log(`[Naite Socket Server] Listening on ${this.SOCKET_PATH}`);
        resolve(this.SOCKET_PATH);
      });

      this.server?.on("error", (err) => {
        console.error("[Naite Socket Server] Error:", err);
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;

      // 소켓 파일 삭제
      if (process.platform !== "win32") {
        try {
          const stat = await fs.stat(this.SOCKET_PATH);
          if (stat.isFile()) {
            await fs.unlink(this.SOCKET_PATH);
          }
        } catch {
          // 파일이 없으면 무시
        }
      }

      console.log("[Naite Socket Server] Stopped");
    }
  }

  private queueMessage(data: NaiteMessagingTypes.NaiteMessage): void {
    // run/start는 즉시 처리 (데이터 클리어 + 리스너 알림)
    if (data.type === "run/start") {
      // 대기 중인 메시지 즉시 처리
      if (this.processDebounceTimer) {
        clearTimeout(this.processDebounceTimer);
        this.processDebounceTimer = null;
      }
      if (this.pendingMessages.length > 0) {
        for (const msg of this.pendingMessages) {
          this.processMessage(msg);
        }
        this.pendingMessages = [];
      }

      // run/start 즉시 처리
      this.processMessage(data);
      TraceStore.notifyTestResultChange();
      return;
    }

    this.pendingMessages.push(data);

    // 이전 타이머 취소
    if (this.processDebounceTimer) {
      clearTimeout(this.processDebounceTimer);
    }

    // 새 타이머 설정
    this.processDebounceTimer = setTimeout(() => {
      this.processDebounceTimer = null;

      for (const msg of this.pendingMessages) {
        this.processMessage(msg);
      }
      this.pendingMessages = [];

      // 리스너 알림
      TraceStore.notifyTestResultChange();
    }, this.DEBOUNCE_DELAY);
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
