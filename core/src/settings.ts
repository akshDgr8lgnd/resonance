import crypto from "node:crypto";
import type { AppDatabase } from "./db.js";
import type { AppSettings } from "./types.js";

export class SettingsService {
  constructor(private readonly db: AppDatabase) {}

  get(): AppSettings {
    const values = this.db.queryAll<{ key: string; value: string }>("SELECT key, value FROM settings");
    const map = new Map(values.map((entry) => [entry.key, entry.value]));

    const apiToken = map.get("apiToken") ?? crypto.randomUUID();
    const serverPort = Number(map.get("serverPort") ?? process.env.APP_PORT ?? 3939);
    const desktopDeviceId = map.get("desktopDeviceId") ?? crypto.randomUUID();

    this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('apiToken', ?)", [apiToken]);
    this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('serverPort', ?)", [String(serverPort)]);
    this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('desktopDeviceId', ?)", [desktopDeviceId]);

    return { apiToken, serverPort, desktopDeviceId };
  }
}
