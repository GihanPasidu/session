import * as baileys from "baileys";
import * as Pino from "pino";
import cors from "cors";
import express from "express";
import { Boom } from "@hapi/boom";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { clearFolder, encryptSession, generateAccessKey, getSession, saveSession } from "./functions/index.mjs";

const app = express();

app.set("json spaces", 2);

app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});

app.use(cors());

let PORT: string | number = process.env.PORT || 8000;

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);

const session: string = generateAccessKey();

clearFolder("./session");

app.get("/", async (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, "html", "index.html"));
});

app.get("/pair", async (req: express.Request, res: any) => {
    let phone: string | undefined = req.query.phone as string;
    if (!phone) {
        return res.json({ error: "Provide Valid Phone Number" });
    }
    const code: string = await getPairingCode(phone);
    res.json({ code: code });
});

app.get("/session", async (req: any, res: any) => {
    const accessKey: string | undefined = req.query.session as string;

    if (!accessKey) {
        return res.status(401).json({ error: "No session provided" });
    }
    try {
        const sessionData: object | null = await getSession(accessKey);
        if (!sessionData) {
            return res.status(401).json({ error: "Invalid session" });
        }
        res.json(sessionData);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

async function getPairingCode(phone: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            const logger = Pino.pino({ level: "silent" });
            const { state, saveCreds } = await baileys.useMultiFileAuthState("session");
            const { version } = await baileys.fetchLatestBaileysVersion();

            const conn = baileys.makeWASocket({
                version: version,
                printQRInTerminal: true,
                logger: logger,
                browser: baileys.Browsers.ubuntu("Chrome"),
                auth: {
                    creds: state.creds,
                    keys: baileys.makeCacheableSignalKeyStore(state.keys, logger),
                },
            });

            if (!conn.authState.creds.registered) {
                let phoneNumber: string = phone ? phone.replace(/[^0-9]/g, "") : "";
                if (phoneNumber.length < 11) return reject(new Error("Enter Valid Phone Number"));

                setTimeout(async () => {
                    let code: string = await conn.requestPairingCode(phoneNumber);
                    resolve(code);
                }, 3000);
            }

            conn.ev.on("creds.update", saveCreds);
            conn.ev.on("connection.update", async (update) => {
                console.log("Connection update:", update);
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    await baileys.delay(10000);
                    await conn.sendMessage(conn.user!.id, { text: session });

                    const data: string = encryptSession("session/creds.json");
                    await saveSession(session, { data });
                    await baileys.delay(5000);
                    clearFolder(join(__dirname, "session"));
                    process.send!("reset");
                }

                if (connection === "close") {
                    const reason: number | undefined = new Boom(lastDisconnect?.error)?.output.statusCode;

                    const resetReasons: number[] = [
                        baileys.DisconnectReason.connectionClosed,
                        baileys.DisconnectReason.connectionLost,
                        baileys.DisconnectReason.timedOut,
                        baileys.DisconnectReason.connectionReplaced,
                    ];
                    const resetWithClearStateReasons: number[] = [baileys.DisconnectReason.loggedOut, baileys.DisconnectReason.badSession];

                    if (resetReasons.includes(reason as number)) {
                        process.send!("reset");
                    } else if (resetWithClearStateReasons.includes(reason as number)) {
                        clearFolder("./session");
                        process.send!("reset");
                    } else if (reason === baileys.DisconnectReason.restartRequired) {
                        getPairingCode(phone);
                    } else {
                        process.send!("reset");
                    }
                }
            });

            conn.ev.on("messages.upsert", async ({ messages }) => {
                for (const msg of messages) {
                }
            });
        } catch (error) {
            console.error("Error occurred:", error);
            reject(new Error("An Error Occurred"));
        }
    });
}

app.listen(PORT, () => {
    console.log("Server running at:\nhttp://localhost:" + PORT);
});
