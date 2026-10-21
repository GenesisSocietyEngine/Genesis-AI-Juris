import assert from "node:assert/strict";
import { ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { mock, test } from "node:test";
import { withOwnedChrome } from "../scripts/owned-chrome.mjs";

// A real child with a tiny HTTP/WebSocket transport. No Chrome or tax result is
// mocked in the packaging proof; this fixture tests process lifecycle only.
const program = `
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
const [profile, mode] = process.argv.slice(2);
console.error("fixture stderr PID=" + process.pid);
console.log("fixture stdout");
if (mode === "exit") process.exit(7);
if (mode === "descendant") {
  process.on("SIGTERM", () => {});
  const child = spawn(process.execPath, ["-e", "process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"], { stdio: ["ignore", "pipe", "inherit"] });
  child.stdout.once("data", () => writeFileSync(join(profile, "descendant-ready"), String(child.pid)));
}
if (mode === "no-port") {
  setInterval(() => {}, 1000);
} else {
  let lists = 0;
  const server = createServer((request, response) => {
    if (mode === "http-hang") return;
    const base = "ws://127.0.0.1:" + server.address().port;
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/json/version") response.end(JSON.stringify({ Browser: "fixture", webSocketDebuggerUrl: base + "/devtools/browser/owned" }));
    else response.end(JSON.stringify(mode === "partial" && lists++ < 2 ? [] : [{ type: "page", url: "about:blank", webSocketDebuggerUrl: (mode === "foreign" ? "ws://example.org:1234" : base) + "/devtools/page/owned" }]));
  });
  server.on("upgrade", (request, socket) => {
    if (mode === "socket-hang") return;
    const accept = createHash("sha1").update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write("HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: " + accept + "\\r\\n\\r\\n");
    socket.on("data", () => { if (mode !== "descendant") process.exit(0); });
    socket.on("error", () => {});
  });
  server.listen(0, "127.0.0.1", () => {
    const file = join(profile, "DevToolsActivePort");
    const value = server.address().port + "\\n/devtools/browser/owned\\n";
    if (mode === "partial") {
      writeFileSync(file, "");
      setTimeout(() => writeFileSync(file, value.split("\\n")[0]), 40);
      setTimeout(() => writeFileSync(file, value), 80);
    } else writeFileSync(file, value);
  });
}
`;

function fixture(mode: string, options: Record<string, number> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "juris-owned-chrome-"));
  const profile = join(directory, "profile");
  mkdirSync(profile);
  const script = join(directory, "child.mjs");
  writeFileSync(script, program);
  return {
    directory, profile,
    options: { command: process.execPath, args: [script, profile, mode], profile, evidence: directory, ...options },
    terminal() {
      const launch = readdirSync(directory).find(name => name.startsWith("chrome-launch-"));
      assert.ok(launch);
      return JSON.parse(readFileSync(join(directory, launch, "terminal.json"), "utf8"));
    },
    dispose() { rmSync(directory, { recursive: true, force: true }); },
  };
}

function assertStopped(receipt: ReturnType<ReturnType<typeof fixture>["terminal"]>) {
  assert.equal(receipt.cleanup.complete, true);
  if (receipt.pid !== null) {
    assert.throws(() => process.kill(receipt.pid, 0), { code: "ESRCH" });
    assert.ok(receipt.events.some((event: { event: string }) => event.event === "close"));
  }
  if (process.platform !== "win32" && receipt.pid !== null) assert.equal(receipt.cleanup.processGroupAbsent, true);
}

test("owned Chrome waits for a partial port file, real endpoint and socket; keeps the 20s default", async () => {
  const f = fixture("partial");
  try {
    const result = await withOwnedChrome(f.options, async ({ socket, pid }: { socket: WebSocket; pid: number }) => {
      assert.equal(socket.readyState, WebSocket.OPEN);
      assert.ok(pid > 0);
      return "verified";
    });
    assert.equal(result, "verified");
    const receipt = f.terminal();
    assert.equal(receipt.readinessTimeoutMs, 20000);
    assert.equal(receipt.readiness.complete, true);
    assert.equal(receipt.readiness.stage, "ready");
    assert.match(readFileSync(join(f.directory, "chrome.log"), "utf8"), /fixture stderr PID=/);
    assertStopped(receipt);
  } finally { f.dispose(); }
});

test("spawn error is retained and cannot invoke verification", async () => {
  const f = fixture("ready");
  try {
    await assert.rejects(withOwnedChrome({ ...f.options, command: join(f.directory, "missing-executable") }, () => assert.fail("must not run")), { code: "CHROME_SPAWN_FAILED" });
    const receipt = f.terminal();
    assert.equal(receipt.pid, null);
    assert.equal(receipt.readiness.complete, false);
    assert.ok(receipt.events.some((event: { event: string }) => event.event === "error"));
    assertStopped(receipt);
  } finally { f.dispose(); }
});

test("early nonzero exit retains code and raw stderr without waiting for a nonexistent port", async () => {
  const f = fixture("exit");
  try {
    await assert.rejects(withOwnedChrome(f.options, () => assert.fail("must not run")), { code: "CHROME_EXITED" });
    const receipt = f.terminal();
    assert.ok(receipt.events.some((event: { event: string; code: number }) => event.event === "exit" && event.code === 7));
    assert.equal(receipt.error.code, "CHROME_EXITED");
    assertStopped(receipt);
  } finally { f.dispose(); }
});

for (const [mode, stage] of [["no-port", "port-file"], ["http-hang", "http-discovery"], ["socket-hang", "websocket"]]) {
  test(`one readiness deadline bounds ${stage} and awaits cleanup`, async () => {
    const f = fixture(mode, { readinessTimeoutMs: 5000 });
    try {
      await assert.rejects(withOwnedChrome(f.options, () => assert.fail("must not run")), { code: "CHROME_READINESS_TIMEOUT" });
      const receipt = f.terminal();
      assert.equal(receipt.readiness.complete, false);
      assert.equal(receipt.readiness.stage, stage);
      assertStopped(receipt);
    } finally { f.dispose(); }
  });
}

test("unexpected remote endpoint fails closed before any socket or callback", async () => {
  const f = fixture("foreign");
  try {
    await assert.rejects(withOwnedChrome(f.options, () => assert.fail("must not run")), { code: "CHROME_ENDPOINT_INVALID" });
    assert.equal(f.terminal().readiness.stage, "http-discovery");
    assertStopped(f.terminal());
  } finally { f.dispose(); }
});

test("callback failure remains the primary error and unrelated child is untouched", async () => {
  const f = fixture("ready");
  const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const unrelatedClosed = new Promise<void>(resolve => unrelated.once("close", () => resolve()));
  const expected = new Error("parity failed");
  try {
    await assert.rejects(withOwnedChrome(f.options, () => { throw expected; }), error => error === expected);
    assertStopped(f.terminal());
    assert.equal(process.kill(unrelated.pid!, 0), true);
  } finally { unrelated.kill(); await unrelatedClosed; f.dispose(); }
});

test("an observed process exit is distinct from delayed inherited-pipe close", async () => {
  const f = fixture("ready");
  let ownedPid = 0;
  let delayed = false;
  const emit = ChildProcess.prototype.emit;
  // Retain a real process/exit. Delay only delivery of its close event to model
  // Node's documented independent stdio-close ordering deterministically.
  const closeDelivery = mock.method(ChildProcess.prototype, "emit", function (this: ChildProcess, event: string | symbol, ...args: unknown[]) {
    if (event === "close" && this.pid === ownedPid && !delayed) {
      delayed = true;
      setTimeout(() => Reflect.apply(emit, this, [event, ...args]), 1400);
      return true;
    }
    return Reflect.apply(emit, this, [event, ...args]);
  });
  try {
    await withOwnedChrome(f.options, async ({ pid }: { pid: number }) => { ownedPid = pid; });
    const receipt = f.terminal();
    const exit = receipt.events.find((event: { event: string }) => event.event === "exit");
    const close = receipt.events.find((event: { event: string }) => event.event === "close");
    assert.equal(exit.code, 0);
    assert.equal(delayed, true);
    assert.ok(Date.parse(close.at) > Date.parse(exit.at));
    assertStopped(receipt);
  } finally { closeDelivery.mock.restore(); f.dispose(); }
});

test("POSIX cleanup forces only the owned group when descendants ignore TERM", { skip: process.platform === "win32" }, async () => {
  const f = fixture("descendant", { cleanupGraceMs: 150, cleanupForceMs: 3000 });
  try {
    let descendant = 0;
    await withOwnedChrome(f.options, async () => {
      const deadline = Date.now() + 5000;
      while (!descendant && Date.now() < deadline) {
        try { descendant = Number(readFileSync(join(f.profile, "descendant-ready"), "utf8")); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        if (!descendant) await delay(25);
      }
      assert.ok(descendant > 0, "TERM-ignoring descendant must prove readiness before cleanup is exercised");
    });
    assert.throws(() => process.kill(descendant, 0), { code: "ESRCH" });
    assert.ok(f.terminal().events.some((event: { signal: string }) => event.signal === "SIGKILL"));
    assertStopped(f.terminal());
  } finally { f.dispose(); }
});

test("POSIX unsuccessful cleanup is retained and does not replace the startup failure", { skip: process.platform === "win32" }, async () => {
  const f = fixture("no-port", { readinessTimeoutMs: 500, cleanupGraceMs: 50, cleanupForceMs: 50 });
  const kill = process.kill.bind(process);
  const mocked = mock.method(process, "kill", (pid: number, signal?: string | number) => {
    if (pid < 0 && signal !== 0) return true;
    return kill(pid, signal);
  });
  try {
    await assert.rejects(withOwnedChrome(f.options, () => assert.fail("must not run")), error => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0].code, "CHROME_READINESS_TIMEOUT");
      assert.equal(error.errors[1].code, "CHROME_CLEANUP_TIMEOUT");
      return true;
    });
    assert.equal(f.terminal().cleanup.complete, false);
  } finally {
    mocked.mock.restore();
    kill(-f.terminal().pid, "SIGKILL");
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      try { kill(f.terminal().pid, 0); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") break; throw error; }
      await delay(25);
    }
    assert.throws(() => kill(f.terminal().pid, 0), { code: "ESRCH" });
    f.dispose();
  }
});
