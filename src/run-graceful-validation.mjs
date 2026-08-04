import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

// The workflow's FFmpeg installation supports optional audio/video only. Place a
// narrow sudo shim first on PATH for subsequent steps so an apt mirror failure
// cannot destroy completed report and social output. All non-FFmpeg sudo calls
// still delegate to the system sudo binary.
if (process.env.GITHUB_PATH) {
  const gracefulBin = path.join(ROOT, "scripts", "graceful-bin");
  const sudoShim = path.join(gracefulBin, "sudo");
  if (fs.existsSync(sudoShim)) {
    fs.chmodSync(sudoShim, 0o755);
    fs.appendFileSync(process.env.GITHUB_PATH, `${gracefulBin}\n`, "utf8");
    console.log("Configured optional FFmpeg installation guard for subsequent workflow steps.");
  }
}

const result = spawnSync(process.execPath, ["src/validate-and-approve.mjs"], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit"
});
process.exit(result.status ?? 1);
