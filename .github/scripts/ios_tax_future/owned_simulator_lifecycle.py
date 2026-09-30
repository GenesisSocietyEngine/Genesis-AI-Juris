"""Exact newly-owned Simulator lifecycle, no CLI entry point.

The caller supplies immutable evidence retention and an authorization/deadline
guard. Tests inject a fake executor. No command runs merely by importing this
module. This lifecycle is not application or financial acceptance.
"""
import base64
import copy
import datetime
import hashlib
import json
import math
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass

MAX_OUTPUT = 8 * 1024 * 1024
DEVICE_LIST = ('xcrun', 'simctl', 'list', 'devices', '--json')
RUNTIME_LIST = ('xcrun', 'simctl', 'list', 'runtimes', '--json')
TYPE_LIST = ('xcrun', 'simctl', 'list', 'devicetypes', '--json')
UUID = re.compile(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}')


class Deadline:
    """Absolute operation allowance, including time spent retaining evidence."""
    def __init__(self, expires_at, *, clock=time.monotonic, permitted=lambda: True):
        require(math.isfinite(expires_at), 'Invalid absolute deadline')
        self.expires_at, self.clock, self.permitted = expires_at, clock, permitted

    def remaining(self):
        return max(0, self.expires_at - self.clock()) if self.permitted() else 0

    def __call__(self):
        return self.remaining() > 0


def require(value, message):
    if not value:
        raise RuntimeError(message)


def raw(data):
    require(type(data) is bytes, 'Command output is not raw bytes')
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'base64': base64.b64encode(data).decode('ascii')}


def unique_json(data):
    require(type(data) is bytes and len(data) <= MAX_OUTPUT, 'Inventory exceeds byte bound')
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate JSON inventory key')
            result[key] = value
        return result
    def constant(value):
        raise RuntimeError(f'Non-finite JSON constant {value}')
    value = json.loads(data.decode('utf-8', errors='strict'), object_pairs_hook=pairs,
                       parse_constant=constant)
    require(type(value) is dict, 'Inventory must be one object')
    return value


def devices(data):
    value = unique_json(data)
    require(type(value.get('devices')) is dict, 'Missing complete device groups')
    found = {}
    for runtime, group in value['devices'].items():
        require(type(runtime) is str and type(group) is list, 'Invalid device group')
        for device in group:
            require(type(device) is dict and type(device.get('udid')) is str and
                    UUID.fullmatch(device['udid']), 'Invalid device UUID')
            key = device['udid'].lower()
            require(key not in found, 'Duplicate UUID across device groups')
            require(type(device.get('name')) is str and type(device.get('state')) is str,
                    'Missing device identity/state')
            found[key] = {'runtime': runtime, 'device': copy.deepcopy(device)}
    require(len(found) <= 2048, 'Too many Simulator records')
    return found


def choose(runtime_bytes, type_bytes, runtime_id, type_id):
    require(type(runtime_id) is str and runtime_id.startswith('com.apple.CoreSimulator.SimRuntime.iOS-'),
            'An exact iOS runtime identifier is required')
    require(type(type_id) is str and type_id.startswith('com.apple.CoreSimulator.SimDeviceType.'),
            'An exact supported device type is required')
    runtimes, types = unique_json(runtime_bytes).get('runtimes'), unique_json(type_bytes).get('devicetypes')
    require(type(runtimes) is list and type(types) is list, 'Missing full runtime/type inventories')
    def indexed(items):
        result = {}
        for item in items:
            require(type(item) is dict and type(item.get('identifier')) is str, 'Missing inventory identifier')
            key = item['identifier']
            require(key not in result, 'Duplicate runtime/type identifier')
            result[key] = item
        return result
    runtime = indexed(runtimes).get(runtime_id)
    device_type = indexed(types).get(type_id)
    require(runtime is not None and runtime.get('isAvailable') is True,
            'Requested runtime is absent or unavailable')
    require(device_type is not None and device_type.get('productFamily') == 'iPhone',
            'Requested type is absent or not an iPhone')
    supported = runtime.get('supportedDeviceTypes')
    require(type(supported) is list, 'Runtime has no supported-device inventory')
    match = indexed(supported).get(type_id)
    require(match is not None and match.get('productFamily') == 'iPhone' and
            match.get('name') == device_type.get('name'), 'Runtime does not support that exact device type')
    return copy.deepcopy(runtime), copy.deepcopy(device_type)


@dataclass(frozen=True)
class CommandResult:
    exit: int | None
    stdout: bytes = b''
    stderr: bytes = b''
    timed_out: bool = False
    error: str | None = None


def execute_simctl(argv, timeout):
    """Real macOS executor, never used by portable controls.

    Raw output goes to temporary files, not inherited pipes. The byte limit
    bounds returned capture; polling can temporarily allow more disk bytes.
    On timeout/output overflow only this Popen child is killed; no process-name
    cleanup. A timed-out command is diagnostic only, even if it printed a UUID.
    """
    require(sys.platform == 'darwin', 'Real Simulator execution requires macOS')
    require(type(argv) is tuple and argv[:2] == ('xcrun', 'simctl'), 'Only structured simctl argv allowed')
    require(0 < timeout <= 180, 'Invalid independent command deadline')
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        process = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=stdout,
                                   stderr=stderr, shell=False)
        deadline = time.monotonic() + timeout
        timed_out, error = False, None
        while process.poll() is None:
            if time.monotonic() >= deadline:
                timed_out, error = True, 'Command deadline exceeded'
                break
            if os.fstat(stdout.fileno()).st_size + os.fstat(stderr.fileno()).st_size > MAX_OUTPUT:
                error = 'Command output exceeds bound'
                break
            time.sleep(min(0.05, max(0, deadline - time.monotonic())))
        if time.monotonic() >= deadline:
            timed_out, error = True, 'Command completed after deadline'
        if process.poll() is None:
            process.kill()  # exact unreaped process returned by this Popen
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                error = (error or '') + '; owned command did not reap within cleanup bound'
        stdout.seek(0); stderr.seek(0)
        out, err = stdout.read(MAX_OUTPUT + 1), stderr.read(MAX_OUTPUT + 1)
        if len(out) + len(err) > MAX_OUTPUT:
            error = 'Output truncated after command output bound; no acceptance'
        return CommandResult(process.returncode, out, err, timed_out, error)


class JsonEvidence:
    """Exclusive immutable records in a newly-created host evidence directory."""
    def __init__(self, directory):
        self.directory = pathlib.Path(directory)
        self.directory.mkdir(parents=False, exist_ok=False)
        self.sequence = 0

    def __call__(self, event):
        self.sequence += 1
        encoded = json.dumps(event, sort_keys=True, ensure_ascii=True, indent=2).encode('utf8') + b'\n'
        with (self.directory / f'{self.sequence:04d}-{event["event"]}.json').open('xb') as output:
            output.write(encoded)
            output.flush()
            os.fsync(output.fileno())


class OwnedSimulator:
    """One freshly-created UUID. Failure is sticky; cleanup cannot restore success.

    execute(argv_tuple, timeout_seconds) must honor the independent bound and
    return CommandResult. retain(event) must persist synchronously outside the
    application container. guard() must freshly permit the current operation.
    The caller owns the outer job deadline and final application assertions.
    """
    def __init__(self, source, nonce, *, execute, retain, guard):
        require(type(source) is str and re.fullmatch(r'[0-9a-f]{40}', source), 'Invalid source SHA')
        require(type(nonce) is str and re.fullmatch(r'[0-9]+-[0-9]+', nonce), 'Invalid run nonce')
        self.source, self.nonce = source, nonce
        self.name = 'Juris Tax Future ' + nonce
        self.execute, self.retain, self.guard = execute, retain, guard
        self.udid = self.runtime = self.type_id = None
        self.original = None
        self.failed = self.created = self.booted = self.completed = False
        self.started = False
        self.sequence = 0
        self.lifecycle = {'source_sha': source, 'run_nonce': nonce}

    def _emit(self, event):
        self.retain(copy.deepcopy({'source_sha': self.source, 'run_nonce': self.nonce,
                                  'application_acceptance': False, **event}))

    def _tick(self, guard=None):
        require((guard or self.guard)() is True, 'Deadline/cancellation authorization refused')

    def _call(self, role, argv, *, timeout=30, guard=None):
        self._tick(guard)
        allowance = guard or self.guard
        if hasattr(allowance, 'remaining'):
            timeout = min(timeout, allowance.remaining())
        require(timeout > 0, 'No command budget remains')
        self.sequence += 1
        sequence = self.sequence
        argv = tuple(argv)
        start = {'event': 'command-start', 'sequence': sequence, 'role': role,
                 'argv': list(argv), 'timeout_seconds': timeout,
                 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        self._emit(start)  # failure to retain intent forbids the command
        invoked = False
        try:
            self._tick(guard)
            remaining = min(timeout, allowance.remaining()) if hasattr(allowance, 'remaining') else timeout
            require(remaining > 0, 'No command budget remains after intent retention')
            invoked = True
            result = self.execute(argv, remaining)
            require(isinstance(result, CommandResult), 'Executor did not return CommandResult')
        except BaseException as error:
            out, err = getattr(error, 'output', b''), getattr(error, 'stderr', b'')
            try:
                self._emit({'event': 'command-terminal', 'sequence': sequence, 'role': role,
                            'argv': list(argv), 'exit': None, 'executor_invoked': invoked,
                            'stdout': raw(out if type(out) is bytes else b''),
                            'stderr': raw(err if type(err) is bytes else b''),
                            'output_capture_incomplete': True,
                            'executor_error': str(error), 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
            except BaseException as retention_error:
                error.add_note('Lifecycle terminal could not be retained: ' + str(retention_error))
                raise error from retention_error
            raise
        record = {'argv': list(argv), 'exit': result.exit, 'stdout': raw(result.stdout),
                  'stderr': raw(result.stderr), 'timed_out': result.timed_out, 'error': result.error,
                  'sequence': sequence, 'executor_invoked': True,
                  'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        self._emit({'event': 'command-terminal', 'role': role, **record})
        self._tick(guard)
        require(type(result.exit) is int and result.exit == 0 and result.timed_out is False and
                result.error is None and len(result.stdout) + len(result.stderr) <= MAX_OUTPUT,
                f'{role} failed, timed out, or exceeded output bounds')
        return record, result.stdout

    def _list(self, role, *, guard=None):
        record, output = self._call(role, DEVICE_LIST, guard=guard)
        observed = devices(output)
        if self.original is not None:
            require(set(self.original) <= set(observed), 'Pre-existing Simulator disappeared')
            for key, item in self.original.items():
                before, after = item['device'], observed[key]['device']
                require(item['runtime'] == observed[key]['runtime'] and before['name'] == after['name'] and
                        before.get('deviceTypeIdentifier') == after.get('deviceTypeIdentifier'),
                        'Pre-existing Simulator identity changed')
        return record, observed

    def _owned(self, role, states, *, guard=None):
        require(self.created and self.udid, 'No proven fresh owned UUID')
        record, observed = self._list(role, guard=guard)
        item = observed.get(self.udid.lower())
        require(item is not None and item['runtime'] == self.runtime and
                item['device']['name'] == self.name and
                item['device'].get('deviceTypeIdentifier') == self.type_id and
                item['device'].get('isAvailable') is True, 'Owned Simulator identity changed')
        require(item['device']['state'] in states, 'Unexpected owned Simulator state')
        self._tick(guard)
        return record, observed

    def _normal(self):
        require(not self.failed and not self.completed, 'Lifecycle already failed or completed')

    def create(self, runtime_id, type_id):
        try:
            self._normal()
            require(not self.started, 'Creation may be attempted only once')
            self.started = True
            before_record, self.original = self._list('before_create')
            self.lifecycle['before_create'] = before_record
            runtime_record, runtime_bytes = self._call('runtimes', RUNTIME_LIST)
            type_record, type_bytes = self._call('device_types', TYPE_LIST)
            choose(runtime_bytes, type_bytes, runtime_id, type_id)
            self.runtime, self.type_id = runtime_id, type_id
            self.lifecycle.update(runtimes=runtime_record, device_types=type_record)
            _, latest = self._list('pre_create')
            require(not any(item['device']['name'] == self.name for item in latest.values()),
                    'The intended task name already exists; never reuse it')
            # Devices appearing during inventory selection also remain protected.
            self.original = copy.deepcopy(latest)
            created, output = self._call('create', ('xcrun', 'simctl', 'create', self.name, type_id, runtime_id))
            self.lifecycle['create'] = created
            identifier = output.decode('ascii', errors='strict').strip()
            require(UUID.fullmatch(identifier), 'Create did not return exactly one UUID')
            require(identifier.lower() not in self.original, 'Create returned a pre-existing UUID')
            self.udid = identifier
            after_record, after = self._list('after_create')
            item = after.get(identifier.lower())
            require(item is not None and item['runtime'] == runtime_id and
                    item['device']['name'] == self.name and item['device'].get('deviceTypeIdentifier') == type_id and
                    item['device'].get('isAvailable') is True and item['device']['state'] == 'Shutdown',
                    'Created UUID does not match the requested fresh Shutdown device')
            self.lifecycle.update(udid=identifier, after_create=after_record)
            self._emit({'event': 'ownership', 'udid': identifier, 'runtime': runtime_id, 'device_type': type_id,
                        'name': self.name, 'before_ids': sorted(self.original), 'observed': item})
            self.created = True
            return identifier
        except BaseException:
            self.failed = True
            raise

    def query(self):
        try:
            self._normal()
            _, found = self._owned('query_owned', {'Shutdown', 'Booted', 'Booting'})
            return copy.deepcopy(found[self.udid.lower()])
        except BaseException:
            self.failed = True
            raise

    def boot(self):
        try:
            self._normal()
            require(not self.booted, 'Boot already completed')
            self._owned('pre_boot', {'Shutdown'})
            record, _ = self._call('boot', ('xcrun', 'simctl', 'boot', self.udid), timeout=60)
            self.lifecycle['boot'] = record
            self._owned('pre_bootstatus', {'Booted', 'Booting'})
            status, _ = self._call('bootstatus', ('xcrun', 'simctl', 'bootstatus', self.udid, '-b'), timeout=180)
            self.lifecycle['bootstatus'] = status
            self._owned('after_boot', {'Booted'})
            self.booted = True
        except BaseException:
            self.failed = True
            raise

    def complete(self):
        """Lifecycle completion only, after caller's separate app/restoration gates."""
        try:
            self._normal()
            require(self.booted, 'Successful boot readiness is absent')
            self._owned('pre_shutdown', {'Booted'})
            shutdown, _ = self._call('shutdown', ('xcrun', 'simctl', 'shutdown', self.udid), timeout=60)
            stopped, _ = self._owned('after_shutdown', {'Shutdown'})
            self.lifecycle.update(shutdown=shutdown, after_shutdown=stopped)
            self._owned('pre_delete', {'Shutdown'})
            deleted, _ = self._call('delete', ('xcrun', 'simctl', 'delete', self.udid), timeout=60)
            after, found = self._list('after_delete')
            require(self.udid.lower() not in found, 'Owned Simulator remains after delete')
            self.lifecycle.update(delete=deleted, after_delete=after)
            result = {'source_sha': self.source, 'run_nonce': self.nonce,
                      'cleanup_mode': 'isolated_simulator_destroyed', 'clipboard_restored': False,
                      'lifecycle_complete': True, 'application_acceptance': False,
                      'simulator_lifecycle': copy.deepcopy(self.lifecycle)}
            self._emit({'event': 'lifecycle-complete', 'result': result})
            self.completed = True
            return result
        except BaseException:
            self.failed = True
            raise

    def failure_shutdown(self, *, cleanup_guard, reason):
        """Stop only a freshly re-proven owned device before failure deletion.

        A separate cleanup deadline cannot restore ordinary execution authority.
        Unknown ownership/state never authorizes a shutdown by name or wildcard.
        """
        require(type(reason) is str and 0 < len(reason) <= 1024, 'Explicit failure reason required')
        require(not self.completed, 'Successful lifecycle is immutable')
        self.failed = True
        before, observed = self._owned('failure_pre_shutdown', {'Shutdown', 'Booted', 'Booting'}, guard=cleanup_guard)
        state = observed[self.udid.lower()]['device']['state']
        command = None
        if state != 'Shutdown':
            command, _ = self._call('failure_shutdown', ('xcrun', 'simctl', 'shutdown', self.udid),
                                    timeout=60, guard=cleanup_guard)
        after, _ = self._owned('failure_after_shutdown', {'Shutdown'}, guard=cleanup_guard)
        result = {'source_sha': self.source, 'run_nonce': self.nonce, 'udid': self.udid,
                  'cleanup_only': True, 'application_acceptance': False, 'reason': reason,
                  'before': before, 'shutdown': command, 'after': after}
        self._emit({'event': 'failure-shutdown-complete', 'result': result})
        return result

    def failure_cleanup(self, *, cleanup_guard, reason):
        """Explicit renewed cleanup authorization; never revives normal acceptance.

        Only an already-proven fresh UUID currently in Shutdown may be deleted.
        Unknown/ambiguous create results and Booted devices are left untouched.
        The orchestrator must first handle any live-app diagnostics/shutdown.
        """
        require(type(reason) is str and 0 < len(reason) <= 1024, 'Explicit failure reason required')
        require(not self.completed, 'Successful lifecycle is immutable')
        self.failed = True
        self._emit({'event': 'failure-cleanup-start', 'reason': reason, 'udid': self.udid})
        before, _ = self._owned('failure_pre_delete', {'Shutdown'}, guard=cleanup_guard)
        deleted, _ = self._call('failure_delete', ('xcrun', 'simctl', 'delete', self.udid),
                                timeout=60, guard=cleanup_guard)
        after, found = self._list('failure_after_delete', guard=cleanup_guard)
        require(self.udid.lower() not in found, 'Failed cleanup left the owned Simulator present')
        result = {'source_sha': self.source, 'run_nonce': self.nonce, 'udid': self.udid,
                  'cleanup_only': True, 'application_acceptance': False, 'lifecycle_complete': False,
                  'pre_delete': before, 'delete': deleted, 'after_delete': after}
        self._emit({'event': 'failure-cleanup-complete', 'result': result})
        return result
