import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { initializeDb } from "../db/index.js";
import { createServer } from "../server/index.js";
import net from "node:net";

function findOpenPort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(preferred, () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on("error", () => {
      // Preferred port busy — let OS pick one
      const server2 = net.createServer();
      server2.listen(0, () => {
        const addr = server2.address() as net.AddressInfo;
        server2.close(() => resolve(addr.port));
      });
      server2.on("error", reject);
    });
  });
}

export function registerUiCommand(program: Command): void {
  program
    .command("ui")
    .description("Launch the story map web UI")
    .option("--port <number>", "Port number (default: auto-detect)", "0")
    .action(async (opts: { port: string }) => {
      const resolved = resolveProject(program.opts().project);
      initializeDb(resolved.slug);

      const preferred = Number(opts.port) || 24242;
      const port = await findOpenPort(preferred);

      await createServer(resolved.slug, resolved.name, port);

      const url = `http://localhost:${port}`;
      console.log(`Tendrils UI for '${resolved.name}' running at ${url}`);

      // Try to open browser
      const { exec } = await import("node:child_process");
      const openCmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      exec(`${openCmd} ${url}`);

      // Keep the process alive — the server runs until killed
      await new Promise(() => {});
    });
}
