#!/usr/bin/env python3
"""Bound one future-harness child and reap its owned process group on every exit.

The existing deadline helper supplies scoped TERM/KILL behavior. This wrapper
also checks normal child exits: a failed Flutter command must not orphan its
descendants merely because its Python parent returned before the outer limit.
It never turns timeout, cancellation or uncertain cleanup into success.
"""
import argparse
import importlib.util
import json
import os
import pathlib
import signal
import subprocess
import sys
import time


def load_deadline():
    path = pathlib.Path(__file__).resolve().parents[1] / "run_with_deadline.py"
    spec = importlib.util.spec_from_file_location("future_owned_deadline", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(argv, *, seconds, grace, label, retain, deadline=None):
    deadline = deadline or load_deadline()
    process = None
    primary = None
    code = None
    cleanup = "not_started"
    cancelled = False
    old_handlers = {}
    expires = time.monotonic() + seconds

    def on_signal(number, _frame):
        nonlocal cancelled
        cancelled = True
        raise InterruptedError(f"outer command interrupted by signal {number}")

    try:
        for number in (signal.SIGTERM, signal.SIGINT):
            old_handlers[number] = signal.signal(number, on_signal)
        process = subprocess.Popen(argv, start_new_session=os.name == "posix")
        retain({"event": "started", "label": label, "pid": process.pid,
                "seconds": seconds, "argv": argv})
        try:
            remaining = expires - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(argv, seconds)
            code = process.wait(timeout=remaining)
            if time.monotonic() >= expires:
                raise subprocess.TimeoutExpired(argv, seconds)
        except subprocess.TimeoutExpired as error:
            primary, code = error, 124
        except BaseException as error:
            primary, code = error, 130 if cancelled else 1
    except BaseException as error:
        primary, code = error, 130 if cancelled else 1
    finally:
        # Repeated cancellation may not interrupt the bounded cleanup of the
        # exact group just created above. No later phase can run in this process.
        for number in old_handlers:
            signal.signal(number, signal.SIG_IGN)
        if process is not None:
            try:
                if deadline.group_state(process) != "absent":
                    deadline.stop_owned(process, grace)
                limit = time.monotonic() + grace
                while deadline.group_state(process) == "present" and time.monotonic() < limit:
                    process.poll()
                    time.sleep(0.02)
                cleanup = deadline.group_state(process)
            except BaseException as error:
                cleanup = "unknown"
                if primary is None:
                    primary = error
        for number, previous in old_handlers.items():
            signal.signal(number, previous)
    if code is None or (code == 0 and cleanup != "absent"):
        code = 1
    if code < 0:
        code = 128 - code
    try:
        retain({"event": "terminal", "label": label,
                "pid": None if process is None else process.pid, "exit": code,
                "timed_out": isinstance(primary, subprocess.TimeoutExpired),
                "cancelled": cancelled, "cleanup": cleanup,
                "error": None if primary is None else str(primary),
                "runtime_acceptance": False})
    except BaseException as retention_error:
        if primary is not None:
            primary.add_note("Deadline terminal could not be retained: " + str(retention_error))
            raise primary from retention_error
        raise
    return code


def main():
    generic = load_deadline()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout-seconds", type=generic.positive, required=True)
    parser.add_argument("--grace-seconds", type=generic.positive, default=2.0)
    parser.add_argument("--label", required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if not args.label or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for c in args.label):
        parser.error("Invalid label")
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("Command required")
    return run(command, seconds=args.timeout_seconds, grace=args.grace_seconds,
               label=args.label, retain=lambda event: print(
                   "future_deadline " + json.dumps(event, sort_keys=True), flush=True), deadline=generic)


if __name__ == "__main__":
    sys.exit(main())
