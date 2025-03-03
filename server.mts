console.log("Server Started...");

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import cluster from "cluster";
import { watchFile, unwatchFile } from "fs";
import { createInterface } from "readline";
import yargs from "yargs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rl = createInterface(process.stdin, process.stdout);

let isRunning = false;

/**
 * Start a js file
 * @param {string} file - The file to start
 */
function start(file: string): void {
    if (isRunning) return;
    isRunning = true;

    const args: string[] = [join(__dirname, file), ...process.argv.slice(2)];
    console.log([process.argv[0], ...args].join(" "));

    cluster.setupPrimary({
        exec: args[0],
        args: args.slice(1),
    });

    const p = cluster.fork();

    p.on("message", (data: string) => {
        console.log("[RECEIVED]", data);
        switch (data) {
            case "reset":
                p.process.kill();
                isRunning = false;
                start(file);
                break;
            case "uptime":
                p.send(process.uptime());
                break;
        }
    });

    p.on("exit", (_: any, code: number) => {
        isRunning = false;
        console.error("An Error occurred:", code);
        if (code === 0) return;
        watchFile(args[0], () => {
            unwatchFile(args[0]);
            start(file);
        });
    });

    const opts: Record<string, unknown> = yargs(process.argv.slice(2)).exitProcess(false).parseSync();
    if (!opts["test"]) {
        if (!rl.listenerCount("")) {
            rl.on("line", (line: string) => {
                p.emit("message", line.trim());
            });
        }
    }
}

start("main.mjs");
