import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { dirname, join } from "node:path";
import fs from "fs-extra";

export function encryptSession(initSession: string = "creds.json"): string {
    const baseDir = dirname(initSession);
    const credsData = JSON.parse(readFileSync(initSession, "utf8"));
    const files = readdirSync(baseDir);
    const appStateFiles = files.filter((file) => file.startsWith("app-state-sync-key-") && file.endsWith(".json"));
    const mergedData = {
        creds: credsData,
        syncKeys: {} as { [key: string]: string },
    };
    for (const file of appStateFiles) {
        const syncKeyData = JSON.parse(readFileSync(join(baseDir, file), "utf8"));
        mergedData.syncKeys[file] = syncKeyData;
    }
    const algorithm = "aes-256-cbc";
    const key = randomBytes(32);
    const iv = randomBytes(16);
    const cipher = createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(mergedData), "utf8", "hex");
    encrypted += cipher.final("hex");
    const sessionData = {
        data: encrypted,
        key: key.toString("hex"),
        iv: iv.toString("hex"),
        files: {
            creds: initSession,
            syncKeys: appStateFiles,
        },
    };
    return JSON.stringify(sessionData, null, 2);
}

export function decryptSession(sessionSource: string = "session.json", outputDir: string = "./session"): any {
    const encryptedData = JSON.parse(readFileSync(sessionSource, "utf8"));
    const algorithm = "aes-256-cbc";
    const key = Buffer.from(encryptedData.key, "hex");
    const iv = Buffer.from(encryptedData.iv, "hex");
    const decipher = createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData.data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    const data = JSON.parse(decrypted);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "creds.json"), JSON.stringify(data.creds, null, 2));
    for (const [filename, syncKeyData] of Object.entries(data.syncKeys)) {
        writeFileSync(join(outputDir, filename), JSON.stringify(syncKeyData, null, 2));
    }
    return data;
}

export function generateAccessKey(): string {
    const formatNumber = (num: number): string => num.toString().padStart(2, "0");
    const r1: string = formatNumber(Math.floor(Math.random() * 100));
    const r2: string = formatNumber(Math.floor(Math.random() * 100));
    const r3: string = formatNumber(Math.floor(Math.random() * 100));
    const key: string = `XSTRO_${r1}_${r2}_${r3}`;
    return key;
}

export function clearFolder(folderPath: string): void {
    if (!fs.existsSync(folderPath)) return;
    const contents: string[] = fs.readdirSync(folderPath);
    for (const item of contents) {
        const itemPath: string = join(folderPath, item);
        if (fs.statSync(itemPath).isDirectory()) {
            fs.rmSync(itemPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(itemPath);
        }
    }
}
