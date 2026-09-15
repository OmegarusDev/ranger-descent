#!/usr/bin/env python3
"""Dedicated Ranger Descent static server.

Port 8877 is this game only. Sibling games use other ports
(8000, 8080, 8123, 8765, 5173, 5174, 5299, 5300, …) — never bind those,
and never kill a listener that is not serving this repo.

Run in a Cursor/VS Code task or a terminal you leave open:

    python3 scripts/serve.py
    python3 scripts/serve.py --daemon
"""
from __future__ import annotations

import argparse
import http.server
import os
import re
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = "127.0.0.1"
PORT = 8877
PIDFILE = ROOT / ".ranger-serve.pid"
URLFILE = ROOT / ".ranger-serve.url"
LOG = Path("/tmp/ranger-descent-serve.log")
APP_HEADER = "X-Ranger-Descent"


def cache_bust() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    match = re.search(r"styles\.css\?v=(\d+)", html)
    return match.group(1) if match else "0"


def url() -> str:
    return f"http://{HOST}:{PORT}/?v={cache_bust()}"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header(APP_HEADER, "1")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))


def port_listening() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex((HOST, PORT)) == 0


def ours_on_port() -> bool:
    req = urllib.request.Request(f"http://{HOST}:{PORT}/", method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=0.6) as resp:
            return resp.headers.get(APP_HEADER) == "1"
    except urllib.error.HTTPError as err:
        return err.headers.get(APP_HEADER) == "1" if err.headers else False
    except Exception:
        return False


def listener_pid() -> int | None:
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN", "-Fpc"],
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    for line in out.splitlines():
        if line.startswith("p"):
            try:
                return int(line[1:])
            except ValueError:
                return None
    return None


def listener_cwd() -> str | None:
    pid = listener_pid()
    if not pid:
        return None
    try:
        cwd_out = subprocess.check_output(
            ["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"],
            text=True,
        )
    except subprocess.CalledProcessError:
        return None
    for line in cwd_out.splitlines():
        if line.startswith("n"):
            return line[1:]
    return None


def print_foreign_listener() -> None:
    print(
        f"Port {PORT} is in use by another process. "
        f"{ROOT.name} owns {PORT} only — not stealing it.",
        file=sys.stderr,
    )
    try:
        subprocess.run(
            ["lsof", "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN"],
            check=False,
        )
    except FileNotFoundError:
        pass


def is_our_orphan() -> bool:
    cwd = listener_cwd()
    return bool(cwd) and Path(cwd).resolve() == ROOT.resolve()


def write_meta(pid: int) -> None:
    PIDFILE.write_text(str(pid), encoding="utf-8")
    URLFILE.write_text(f"http://{HOST}:{PORT}/\n", encoding="utf-8")


def already_running() -> None:
    print(f"Already serving Ranger Descent at {url()}")
    print("Leave that process running. Do not start another game on this port.")
    pid = listener_pid()
    if pid:
        write_meta(pid)


def daemonize() -> bool:
    if os.fork() > 0:
        for _ in range(30):
            if port_listening():
                return False
            time.sleep(0.1)
        return False
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
    sys.stdout.flush()
    sys.stderr.flush()
    log = open(LOG, "a", buffering=1)
    os.dup2(log.fileno(), 1)
    os.dup2(log.fileno(), 2)
    write_meta(os.getpid())
    return True


def serve() -> None:
    httpd = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    write_meta(os.getpid())
    print(f"Serving Ranger Descent at {url()}")
    print(f"Port {PORT} is reserved for this project. Keep this process running.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="detach so the server survives agent-shell teardown",
    )
    args = parser.parse_args()
    os.chdir(ROOT)

    if port_listening():
        if ours_on_port():
            already_running()
            return
        if is_our_orphan():
            pid = listener_pid()
            if pid:
                os.kill(pid, signal.SIGTERM)
                for _ in range(20):
                    if not port_listening():
                        break
                    time.sleep(0.1)
        if port_listening():
            print_foreign_listener()
            raise SystemExit(1)

    if args.daemon:
        child = daemonize()
        if not child:
            if port_listening() and (ours_on_port() or is_our_orphan()):
                print(f"Serving Ranger Descent at {url()} (daemon, log {LOG})")
                return
            print(f"daemon failed to bind; see {LOG}", file=sys.stderr)
            raise SystemExit(1)
        serve()
        return

    serve()


if __name__ == "__main__":
    main()
