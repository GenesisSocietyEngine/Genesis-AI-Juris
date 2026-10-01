"""Retain bounded raw command output inside an outer owned process group.

The caller must use phase_deadline.py. Descendants inherit that group, so an
internal command timeout cannot escape the outer wrapper's unconditional cleanup.
No command is started at import, and no successful build is runtime acceptance.
"""
import datetime
import hashlib
import json
import math
import os
import pathlib
import subprocess
import time
import threading


def require(value, message):
    if not value:
        raise RuntimeError(message)


def save(path, value):
    with path.open("xb") as stream:
        stream.write(json.dumps(value, sort_keys=True, indent=2).encode() + b"\n")
        stream.flush()
        os.fsync(stream.fileno())


def run(argv, cwd, seconds, evidence, label, *, env=None, max_bytes=16 * 1024 * 1024):
    require(type(argv) is list and argv and all(type(v) is str and v and "\0" not in v for v in argv),
            "Structured nonempty command required")
    require(type(seconds) in (int, float) and math.isfinite(seconds) and 0 < seconds <= 900,
            "Invalid command deadline")
    require(type(max_bytes) is int and 1 <= max_bytes <= 64 * 1024 * 1024, "Invalid output bound")
    require(label and all(c in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in label), "Invalid evidence label")
    evidence, cwd = pathlib.Path(evidence), pathlib.Path(cwd)
    require(evidence.is_dir() and not evidence.is_symlink() and cwd.is_dir(), "Missing command directories")
    paths = {name: evidence / f"{label}-{name}" for name in (
        "start.json", "terminal.json", "stdout.log", "stderr.log")}
    require(not any(p.exists() or p.is_symlink() for p in paths.values()), "Command evidence already exists")
    start = {"argv": argv, "cwd": str(cwd), "seconds": seconds, "max_bytes": max_bytes,
             "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
             "runtime_acceptance": False}
    save(paths["start.json"], start)
    process = None
    error = None
    exceeded = timed_out = False
    began = time.monotonic()
    lock = threading.Lock()
    overflow = threading.Event()
    frozen = False
    retained_total = 0
    counts = {name: {"observed_bytes": 0, "retained_bytes": 0, "eof": False}
              for name in ("stdout.log", "stderr.log")}
    streams = {}
    readers = []
    reader_errors = []
    cleanup_errors = []

    def collect(pipe, name):
        nonlocal retained_total
        try:
            while True:
                data = pipe.read(65536)
                with lock:
                    if frozen:
                        break
                    if not data:
                        counts[name]["eof"] = True
                        break
                    counts[name]["observed_bytes"] += len(data)
                    piece = data[:max(0, max_bytes - retained_total)]
                    streams[name].write(piece)
                    counts[name]["retained_bytes"] += len(piece)
                    retained_total += len(piece)
                    if len(piece) != len(data):
                        overflow.set()
        except BaseException as caught:
            with lock:
                if not frozen:
                    reader_errors.append(str(caught))
        finally:
            pipe.close()

    try:
        for name in counts:
            streams[name] = paths[name].open("xb")
        process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   shell=False, bufsize=0)
        for pipe, name in ((process.stdout, "stdout.log"), (process.stderr, "stderr.log")):
            thread = threading.Thread(target=collect, args=(pipe, name), daemon=True)
            readers.append(thread)
            thread.start()
        while process.poll() is None:
            if time.monotonic() - began >= seconds:
                timed_out = True
                raise TimeoutError("Command exceeded independent deadline")
            if overflow.is_set():
                exceeded = True
                raise RuntimeError("Command output exceeded bound")
            with lock:
                if reader_errors:
                    raise RuntimeError("Command output capture failed: " + reader_errors[0])
            time.sleep(min(.05, max(0, seconds - (time.monotonic() - began))))
        # The next poll may first observe an exited child after the deadline.
        # A zero exit cannot retroactively extend this command's own budget.
        if time.monotonic() - began >= seconds:
            timed_out = True
            raise TimeoutError("Command completed after independent deadline")
    except BaseException as caught:
        error = caught
    finally:
        if process is not None and process.poll() is None:
            try:
                process.kill()  # exact unreaped child; outer wrapper owns descendants
                process.wait(timeout=2)
            except BaseException as caught:
                cleanup_errors.append(str(caught))
                if error is None:
                    error = caught
        # A descendant may keep an inherited pipe open after the direct child
        # exits. Bound drain separately, freeze files, and fail; the outer owned
        # group cleanup must complete before another phase can start.
        drain_limit = time.monotonic() + 1
        for thread in readers:
            thread.join(timeout=max(0, drain_limit - time.monotonic()))
        with lock:
            frozen = True
            for stream in streams.values():
                try:
                    stream.flush()
                    os.fsync(stream.fileno())
                except BaseException as caught:
                    cleanup_errors.append(str(caught))
                    if error is None:
                        error = caught
                finally:
                    try:
                        stream.close()
                    except BaseException as caught:
                        cleanup_errors.append(str(caught))
                        if error is None:
                            error = caught
            if any(thread.is_alive() for thread in readers) and error is None:
                error = RuntimeError("Command output pipes did not close; descendant cleanup required")
            if reader_errors and error is None:
                error = RuntimeError("Command output capture failed: " + reader_errors[0])
            exceeded = exceeded or overflow.is_set()
            if exceeded and error is None:
                error = RuntimeError("Command output exceeded bound")
            output = {}
            captured = {}
            for name, count in counts.items():
                path = paths[name]
                data = path.read_bytes() if path.is_file() else b""
                captured[name] = data
                output[name] = {**count, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                                "truncated": count["observed_bytes"] != len(data),
                                "capture_complete": count["eof"] and not reader_errors}
        result = {**start, "completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "pid": None if process is None else process.pid,
                  "exit": None if process is None else process.returncode,
                  "timed_out": timed_out, "output_exceeded": exceeded, "output": output,
                  "error": None if error is None else str(error),
                  "cleanup_errors": cleanup_errors,
                  "descendant_cleanup": "required_by_outer_phase_deadline"}
        try:
            save(paths["terminal.json"], result)
        except BaseException as retention_error:
            if error is not None:
                error.add_note("Terminal command receipt could not be retained: " + str(retention_error))
                raise error from retention_error
            raise
    if error is not None:
        raise error
    return subprocess.CompletedProcess(argv, process.returncode, captured["stdout.log"], captured["stderr.log"])
