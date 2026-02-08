import crypto from "crypto";
import fs from "fs/promises";
import type { NaiteMessagingTypes } from "naite-types";
import net from "net";
import os from "os";
import path from "path";
import { TraceStore } from "./trace-store.js";

export function getProjectHash(configPath: string): string {
  return crypto.createHash("md5").update(configPath).digest("hex").slice(0, 8);
}

interface SocketInstance {
  server: net.Server;
  socketPath: string;
  configPath: string;
}

class NaiteSocketServerClass {
  private readonly SOCKET_DIR = path.join(os.homedir(), ".sonamu");

  private sockets: Map<string, SocketInstance> = new Map();

  async startAll(configPaths: string[]): Promise<string[]> {
    const socketPaths: string[] = [];

    if (process.platform !== "win32") {
      try {
        await fs.mkdir(this.SOCKET_DIR, { recursive: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
          console.warn(`[Naite Socket Server] Failed to create socket directory:`, err);
        }
      }
    }

    for (const configPath of configPaths) {
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

    for (const existingConfigPath of this.sockets.keys()) {
      if (!configPaths.includes(existingConfigPath)) {
        await this.stopOne(existingConfigPath);
      }
    }

    return socketPaths;
  }

  private async startOne(configPath: string): Promise<string | null> {
    const projectHash = getProjectHash(configPath);
    const socketPath =
      process.platform === "win32"
        ? `\\\\.\\pipe\\naite-${projectHash}`
        : path.join(this.SOCKET_DIR, `naite-${projectHash}.sock`);

    if (process.platform !== "win32") {
      try {
        await fs.unlink(socketPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          console.warn(`[Naite Socket Server] Failed to remove existing socket file:`, err);
        }
      }
    }

    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

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

      socket.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
          console.warn(`[Naite Socket ${projectHash}] Connection error:`, err);
        }
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

  private async stopOne(configPath: string): Promise<void> {
    const instance = this.sockets.get(configPath);
    if (!instance) {
      return;
    }

    instance.server.close();

    if (process.platform !== "win32") {
      try {
        await fs.unlink(instance.socketPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          console.warn(`[Naite Socket Server] Failed to remove socket file on stop:`, err);
        }
      }
    }

    this.sockets.delete(configPath);
    console.log(`[Naite Socket Server] Stopped ${instance.socketPath}`);
  }

  async stop(): Promise<void> {
    for (const configPath of this.sockets.keys()) {
      await this.stopOne(configPath);
    }
  }

  getSocketPaths(): string[] {
    return Array.from(this.sockets.values()).map((s) => s.socketPath);
  }

  private processMessage(data: NaiteMessagingTypes.NaiteMessage): void {
    const type = data.type;

    switch (type) {
      case "run/start":
        TraceStore.addRunStart();
        break;

      case "test/result": {
        TraceStore.addTestResult({
          suiteName: data.suiteName,
          suiteFilePath: data.suiteFilePath,
          testName: data.testName,
          testFilePath: data.testFilePath,
          testLine: data.testLine,
          status: data.status,
          duration: data.duration,
          error: data.error,
          traces: data.traces,
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
