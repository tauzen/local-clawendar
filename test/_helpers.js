import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "bin", "clawendar.js");

export function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawendar-test-"));
}

export function run(args, tmpDir) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_PATH, ...args],
      { env: { ...process.env, CLAWENDAR_DATA_DIR: tmpDir } },
      (error, stdout, stderr) => {
        resolve({ exitCode: error ? error.code : 0, stdout, stderr });
      }
    );
  });
}
