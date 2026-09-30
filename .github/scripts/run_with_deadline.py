#!/usr/bin/env python3
"""Bound a task-owned command, including its POSIX subprocess group.

Output is inherited unchanged. A timeout is always failure, even if a process
responds to termination with exit zero. iOS CI runs this on macOS; Windows
supports only the direct-child controls used by local unit tests.
"""
import argparse
import math
import os
import signal
import subprocess
import sys
import time


def positive(value):
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise argparse.ArgumentTypeError("must be a finite positive duration")
    return result


def group_alive(process):
    if os.name != "posix":
        return process.poll() is None
    try:
        os.killpg(process.pid, 0)
        return True
    except ProcessLookupError:
        return False


def signal_owned(process, force=False):
    try:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL if force else signal.SIGTERM)
        elif process.poll() is None:
            process.kill() if force else process.terminate()
    except ProcessLookupError:
        pass


def stop_owned(process, grace):
    signal_owned(process)
    limit = time.monotonic() + grace
    while time.monotonic() < limit:
        process.poll()
        if not group_alive(process):
            break
        time.sleep(min(0.05, max(0, limit - time.monotonic())))
    # A parent can exit before an uncooperative descendant. Still kill the
    # original task-owned group; polling only the parent would leak the child.
    if group_alive(process):
        signal_owned(process, force=True)
    try:
        process.wait(timeout=grace)
    except subprocess.TimeoutExpired:
        print("deadline event=unreaped_owned_process", file=sys.stderr, flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout-seconds", type=positive, required=True)
    parser.add_argument("--grace-seconds", type=positive, default=5.0)
    parser.add_argument("--label", required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    if not args.label or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for char in args.label):
        parser.error("label must contain only letters, digits, hyphens or underscores")
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("command is required")
    process = subprocess.Popen(command, start_new_session=os.name == "posix")
    print(f"deadline label={args.label} event=started pid={process.pid} seconds={args.timeout_seconds:g}", flush=True)
    try:
        code = process.wait(timeout=args.timeout_seconds)
    except subprocess.TimeoutExpired:
        print(f"deadline label={args.label} event=timeout pid={process.pid}", file=sys.stderr, flush=True)
        stop_owned(process, args.grace_seconds)
        return 124
    except BaseException:
        stop_owned(process, args.grace_seconds)
        raise
    print(f"deadline label={args.label} event=exited code={code}", flush=True)
    return code if code >= 0 else 128 - code


if __name__ == "__main__":
    sys.exit(main())
