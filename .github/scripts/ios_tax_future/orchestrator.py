"""Ordered future application execution and exact owned-device failure cleanup.

Concrete host operations are supplied by the source-owned entry point. Portable
tests exercise ordering and failure propagation, never Simulator acceptance.
"""
import time

import future_phase_transport as t
from owned_simulator_lifecycle import Deadline


def exercise(owner, runtime, device_type, *, phase, verify, retain, diagnostics,
             cleanup_seconds=180, clock=time.monotonic):
    """A failed stage can only proceed to bounded diagnostics and owned cleanup."""
    try:
        device = owner.create(runtime, device_type)
        owner.boot()
        phase("prepare", device)
        for name in t.PHASES:
            phase(name, device)
        phase("restore-original", device)
        lifecycle = owner.complete()
        retain("lifecycle-complete.json", lifecycle)
        result = verify(device)
        t.require(result.get("runtime_acceptance") is True, "Final verifier did not accept complete application evidence")
        return result
    except BaseException as primary:
        cleanup_failures = []
        # A separate cleanup allowance never authorizes another application
        # launch, filesystem fixture, restoration of an incomplete chain, or a
        # mutation of a pre-existing Simulator.
        limit = clock() + cleanup_seconds
        guard = Deadline(limit, clock=clock)
        if owner.created and not owner.completed:
            try:
                diagnostics(owner.udid, max(1, min(90, limit - clock())))
            except BaseException as error:
                cleanup_failures.append({"stage": "diagnostics", "error": str(error)})
            try:
                owner.failure_shutdown(cleanup_guard=guard, reason=str(primary)[:1024] or type(primary).__name__)
                owner.failure_cleanup(cleanup_guard=guard, reason=str(primary)[:1024] or type(primary).__name__)
            except BaseException as error:
                cleanup_failures.append({"stage": "owned-device-cleanup", "error": str(error)})
        try:
            retain("failure.json", {"runtime_acceptance": False, "error": str(primary),
                "error_type": type(primary).__name__, "cleanup_failures": cleanup_failures,
                "owned_device_created": owner.created, "owned_device_completed": owner.completed})
        except BaseException as error:
            # Preserve the actionable primary error even when storage failed.
            primary.add_note("Failure receipt could not be retained: " + str(error))
        raise
