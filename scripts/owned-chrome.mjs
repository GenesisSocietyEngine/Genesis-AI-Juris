/** Bounded Chrome startup and cleanup for local verification, never a shared browser. */
import { spawn } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

const describe = error => ({ name: error.name, message: error.message, code: error.code ?? null });
const fault = (code, message) => Object.assign(new Error(message), { code });
const stamp = () => new Date().toISOString();
const MAX_LOG_BYTES = 4 * 1024 * 1024;

function endpoint(value, port, kind) {
  const url = new URL(value);
  if (url.protocol !== "ws:" || url.hostname !== "127.0.0.1" || url.port !== String(port) ||
      url.username || url.password || url.search || url.hash ||
      !new RegExp(`^/devtools/${kind}/[A-Za-z0-9-]+$`).test(url.pathname)) {
    throw fault("CHROME_ENDPOINT_INVALID", "Chrome returned an unexpected debugging endpoint.");
  }
  return url.href;
}

async function waitUntil(predicate, milliseconds) {
  const deadline = performance.now() + milliseconds;
  do {
    if (predicate()) return true;
    await delay(Math.min(25, Math.max(1, deadline - performance.now())));
  } while (performance.now() < deadline);
  return predicate();
}

/**
 * All startup stages share one deadline (20 seconds by default). Each invocation
 * retains a separate start/terminal record and bounded raw output. The callback
 * is invoked only after a real loopback DevTools WebSocket has opened.
 * POSIX cleanup owns a new process group; Windows uses only this child's PID tree
 * and reports its weaker, acknowledged-taskkill/direct-child observation.
 */
export async function withOwnedChrome({ command, args, profile, evidence,
  readinessTimeoutMs = 20000, cleanupGraceMs = 2000, cleanupForceMs = 3000,
}, action) {
  for (const duration of [readinessTimeoutMs, cleanupGraceMs, cleanupForceMs]) {
    if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error("Invalid Chrome deadline.");
  }
  const directory = mkdtempSync(join(evidence, "chrome-launch-"));
  const record = {
    schema: "juris.owned-chrome.v1", command, args: [...args], profile,
    platform: process.platform, readinessTimeoutMs, cleanupGraceMs, cleanupForceMs,
    startedAt: stamp(), pid: null, events: [], readiness: { stage: "spawn", complete: false },
    output: {}, cleanup: { complete: false },
  };
  writeFileSync(join(directory, "start.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  const controller = new AbortController();
  const readinessDeadline = performance.now() + readinessTimeoutMs;
  let child; let socket; let closed = false; let failure; let primaryError; let result;
  let cleaning = false;
  const fail = error => { failure ??= error; controller.abort(error); };
  const lifecycle = (event, details = {}) => record.events.push({ event, at: stamp(), ...details });
  const capture = (stream, name) => {
    const file = join(directory, name);
    writeFileSync(file, Buffer.alloc(0), { flag: "wx" });
    const counts = record.output[name] = { totalBytes: 0, retainedBytes: 0, truncated: false };
    stream.on("data", bytes => {
      counts.totalBytes += bytes.length;
      const retained = bytes.subarray(0, Math.max(0, MAX_LOG_BYTES - counts.retainedBytes));
      try { appendFileSync(file, retained); }
      catch (error) { fail(error); }
      counts.retainedBytes += retained.length;
      counts.truncated = counts.totalBytes !== counts.retainedBytes;
    });
    stream.on("error", fail);
  };
  const ensureAlive = () => {
    if (!record.readiness.complete && performance.now() >= readinessDeadline) {
      fail(fault("CHROME_READINESS_TIMEOUT", `Chrome did not become ready within ${readinessTimeoutMs} ms.`));
    }
    if (failure) throw failure;
    if (child.exitCode !== null || child.signalCode !== null || closed) {
      throw fault("CHROME_EXITED", "Chrome exited before verification completed.");
    }
    controller.signal.throwIfAborted();
  };
  const posix = process.platform !== "win32";
  const directChildExited = () => child.exitCode !== null || child.signalCode !== null;
  const groupExists = () => {
    if (!child?.pid) return false;
    if (!posix) return !closed;
    try { process.kill(-child.pid, 0); return true; }
    catch (error) { if (error.code === "ESRCH") return false; throw error; }
  };
  const signalGroup = signal => {
    try { process.kill(-child.pid, signal); lifecycle("group-signal", { signal, processGroup: child.pid }); }
    catch (error) { if (error.code !== "ESRCH") throw error; lifecycle("group-absent", { signal }); }
  };
  const stop = async () => {
    cleaning = true;
    const gracefulDeadline = performance.now() + cleanupGraceMs;
    const cleanupDeadline = gracefulDeadline + cleanupForceMs;
    record.cleanup.startedAt = stamp();
    record.cleanup.scope = posix ? "owned-posix-process-group" : "owned-windows-pid-tree";
    if (!child?.pid) {
      record.cleanup.complete = true;
      record.cleanup.reason = "no-process-spawned";
      return;
    }
    // A graceful browser shutdown lets Chrome reap its own subprocesses first.
    const requestedBrowserClose = socket?.readyState === WebSocket.OPEN;
    if (requestedBrowserClose) {
      socket.onmessage = null;
      try { socket.send(JSON.stringify({ id: 2147483647, method: "Browser.close" })); }
      catch (error) { lifecycle("browser-close-error", describe(error)); }
    }
    socket?.close();
    if (requestedBrowserClose) await waitUntil(() => closed && !groupExists(), Math.min(1000, cleanupGraceMs));
    if (posix) {
      if (groupExists()) signalGroup("SIGTERM");
      if (!await waitUntil(() => closed && !groupExists(), Math.max(1, gracefulDeadline - performance.now()))) {
        if (groupExists()) signalGroup("SIGKILL");
        if (!await waitUntil(() => closed && !groupExists(), cleanupForceMs)) {
          throw fault("CHROME_CLEANUP_TIMEOUT", "Owned Chrome process group did not become absent within the cleanup deadline.");
        }
      }
      record.cleanup.processGroupAbsent = true;
    } else {
      // taskkill /T is explicitly scoped to the child we created. No name sweep.
      if (!directChildExited()) {
        const command = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
        const args = ["/PID", String(child.pid), "/T", "/F"];
        record.cleanup.taskkillCommand = { command, args };
        const killed = await new Promise((resolve, reject) => {
          const killer = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
          let stdout = ""; let stderr = "";
          killer.stdout.on("data", bytes => { stdout += bytes; });
          killer.stderr.on("data", bytes => { stderr += bytes; });
          const timer = setTimeout(() => { killer.kill(); reject(fault("CHROME_CLEANUP_TIMEOUT", "Scoped taskkill did not finish.")); }, Math.min(cleanupForceMs, Math.max(1, cleanupDeadline - performance.now())));
          killer.on("error", error => { clearTimeout(timer); reject(error); });
          killer.on("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
        });
        record.cleanup.taskkill = killed;
      }
      // 'exit' precedes 'close' when a descendant still holds an inherited pipe.
      // A racing taskkill 'not found' is not evidence that Chrome stayed active.
      if (!await waitUntil(() => closed, Math.max(1, cleanupDeadline - performance.now()))) {
        throw fault("CHROME_CLEANUP_TIMEOUT", directChildExited() ? "Chrome exited but its inherited output pipes did not close." : "Owned Chrome child did not exit and close.");
      }
      record.cleanup.directChildClosed = true;
      record.cleanup.descendantAbsenceIndependentlyVerified = false;
    }
    record.cleanup.complete = true;
    record.cleanup.finishedAt = stamp();
  };
  const timer = setTimeout(() => fail(fault("CHROME_READINESS_TIMEOUT", `Chrome did not become ready within ${readinessTimeoutMs} ms.`)), readinessTimeoutMs);
  try {
    child = spawn(command, args, { detached: posix, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    record.pid = child.pid ?? null;
    child.on("spawn", () => lifecycle("spawn"));
    child.on("error", error => { lifecycle("error", describe(error)); fail(fault("CHROME_SPAWN_FAILED", error.message)); });
    child.on("exit", (code, signal) => {
      lifecycle("exit", { code, signal });
      if (!cleaning) fail(fault("CHROME_EXITED", `Chrome exited (code ${code}, signal ${signal}).`));
    });
    child.on("close", (code, signal) => { closed = true; lifecycle("close", { code, signal }); });
    capture(child.stdout, "stdout.log");
    capture(child.stderr, "stderr.log");
    const portFile = join(profile, "DevToolsActivePort");
    let port; let browserPath;
    record.readiness.stage = "port-file";
    while (!port) {
      ensureAlive();
      try {
        if (statSync(portFile).size > 4096) throw fault("CHROME_PORT_INVALID", "DevToolsActivePort is oversized.");
        const raw = readFileSync(portFile, "utf8");
        record.readiness.portFile = raw;
        const match = /^(\d{1,5})\r?\n(\/devtools\/browser\/[A-Za-z0-9-]+)\r?\n?$/.exec(raw);
        if (match) {
          port = Number(match[1]); browserPath = match[2];
          if (port < 1 || port > 65535) throw fault("CHROME_PORT_INVALID", "DevToolsActivePort has an invalid port.");
        }
        // Chrome may have created the file but not yet finished writing it.
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!port) await delay(25, undefined, { signal: controller.signal });
    }
    record.readiness.stage = "http-discovery";
    let pageUrl;
    while (!pageUrl) {
      ensureAlive();
      try {
        const options = { signal: controller.signal, redirect: "error" };
        const versionResponse = await fetch(`http://127.0.0.1:${port}/json/version`, options);
        if (!versionResponse.ok) throw new Error(`Chrome version endpoint returned ${versionResponse.status}.`);
        const version = await versionResponse.json();
        if (endpoint(version.webSocketDebuggerUrl, port, "browser") !== `ws://127.0.0.1:${port}${browserPath}`) {
          throw fault("CHROME_ENDPOINT_INVALID", "Chrome HTTP identity does not match its port file.");
        }
        record.readiness.version = version;
        const response = await fetch(`http://127.0.0.1:${port}/json/list`, options);
        if (!response.ok) throw new Error(`Chrome page endpoint returned ${response.status}.`);
        const pages = await response.json();
        if (!Array.isArray(pages)) throw fault("CHROME_ENDPOINT_INVALID", "Chrome returned an invalid page list.");
        const candidates = pages.filter(page => page.type === "page" && page.url === "about:blank");
        if (candidates.length === 0) throw new Error("Chrome's initial about:blank page is not ready yet.");
        if (candidates.length !== 1) throw fault("CHROME_ENDPOINT_INVALID", "Chrome exposed ambiguous initial about:blank pages.");
        pageUrl = endpoint(candidates[0].webSocketDebuggerUrl, port, "page");
      } catch (error) {
        record.readiness.lastHttpError = describe(error);
        if (error.code === "CHROME_ENDPOINT_INVALID") throw error;
        ensureAlive();
        await delay(25, undefined, { signal: controller.signal });
      }
    }
    record.readiness.stage = "websocket";
    socket = new WebSocket(pageUrl);
    await new Promise((resolve, reject) => {
      const aborted = () => { socket.close(); reject(controller.signal.reason); };
      controller.signal.addEventListener("abort", aborted, { once: true });
      socket.onopen = () => { controller.signal.removeEventListener("abort", aborted); resolve(); };
      socket.onerror = () => { controller.signal.removeEventListener("abort", aborted); reject(fault("CHROME_SOCKET_FAILED", "Chrome debugging WebSocket failed.")); };
      socket.onclose = () => { controller.signal.removeEventListener("abort", aborted); reject(fault("CHROME_SOCKET_FAILED", "Chrome debugging WebSocket closed before readiness.")); };
    });
    ensureAlive();
    clearTimeout(timer);
    record.readiness = { ...record.readiness, stage: "ready", complete: true, pageUrl, at: stamp() };
    result = await action({ socket, pid: child.pid, directory });
    ensureAlive();
  } catch (error) {
    primaryError = failure ?? error;
    record.error = describe(primaryError);
  } finally {
    clearTimeout(timer);
    try { await stop(); }
    catch (error) {
      record.cleanup.error = describe(error);
      primaryError = primaryError ? new AggregateError([primaryError, error], "Chrome verification and cleanup failed.", { cause: primaryError }) : error;
      // A failed cleanup is evidence of failure, not permission to hang the
      // verifier indefinitely on inherited pipes. Never report absence here.
      child?.stdout?.destroy(); child?.stderr?.destroy(); child?.unref();
      record.cleanup.pipesReleasedAfterFailure = true;
    }
    if (failure && !primaryError) {
      primaryError = failure;
      record.error = describe(failure);
    }
    record.finishedAt = stamp();
    writeFileSync(join(directory, "terminal.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
    // Keep the existing artifact's diagnostic path for capture tools.
    try { writeFileSync(join(evidence, "chrome.log"), readFileSync(join(directory, "stderr.log"))); }
    catch (error) { primaryError ??= error; }
  }
  if (primaryError) throw primaryError;
  return result;
}
