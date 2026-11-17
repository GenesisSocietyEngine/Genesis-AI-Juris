"""WSGI application for the private EU portal scanner, backed by a local clamd socket."""

import hashlib
import json
import os
import socket
import struct


def scan(data):
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as daemon:
        daemon.settimeout(10)
        daemon.connect(os.environ.get("CLAMD_SOCKET", "/run/clamav/clamd.ctl"))
        daemon.sendall(b"zINSTREAM\0")
        daemon.sendall(struct.pack("!I", len(data)) + data + bytes(4))
        with daemon.makefile("rb") as reply:
            result = reply.read(4097)
    if result == b"stream: OK\0":
        return "clean"
    if result.startswith(b"stream: ") and result.endswith(b" FOUND\0"):
        return "infected"
    raise ValueError("Incomplete scan")


def application(environ, start_response):
    status, payload = "400 Bad Request", {}
    if environ.get("REQUEST_METHOD") != "POST" or environ.get("PATH_INFO") != "/scan":
        status = "404 Not Found"
    else:
        try:
            length = int(environ.get("CONTENT_LENGTH") or 0)
            if 0 < length <= 5 * 1024 * 1024:
                data = environ["wsgi.input"].read(length)
                if len(data) == length:
                    verdict = scan(data)
                    payload = {"digest": "sha256-" + hashlib.sha256(data).hexdigest(), "verdict": verdict}
                    status = "200 OK"
        except (OSError, ValueError):
            status = "503 Service Unavailable"
    start_response(status, [("Content-Type", "application/json"), ("Cache-Control", "no-store")])
    return [json.dumps(payload).encode()]
