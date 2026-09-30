#!/usr/bin/env python3
"""Verify retained application journeys; an uploaded artifact is not a pass."""
import hashlib
import json
import pathlib
import re
import sys


def verify(root: pathlib.Path, source: str, nonce: str) -> dict:
    assert re.fullmatch(r"[0-9a-f]{40}", source)
    assert nonce
    phases = ("write", "read", "incomplete-write", "incomplete-read", "legacy-write", "legacy-read")
    identity = (root / "source.identity").read_text()
    assert f"sha={source}\n" in identity and f"nonce={nonce}\n" in identity
    process_log = (root / "process.log").read_text()
    receipts = {}
    previous_pid = None
    bundle = (root / "write-bundle.json").read_bytes()
    assert json.loads(bundle)
    for index, phase in enumerate(phases):
        receipt = json.loads((root / f"{phase}.json").read_text())
        assert receipt["schema"] == "tax-mobile-application-acceptance-v2"
        assert receipt["source_sha"] == source and receipt["run_nonce"] == nonce
        assert receipt["phase"] == phase and receipt["platform"] == "ios"
        assert receipt["phase_index"] == index and receipt["completed_phase"] == phase
        assert receipt["entry_method"] == "programmatic_flutter_test"
        assert isinstance(receipt["pid"], int) and receipt["pid"] > 0
        assert receipt["previous_pid"] == previous_pid and receipt["pid"] != previous_pid
        previous_pid = receipt["pid"]
        assert f"phase={phase} driver_exit=0" in process_log
        assert f"phase={phase} event=process_absent pid={receipt['pid']}" in process_log
        phase_log = (root / f"{phase}.log").read_text()
        assert f"production application tax {phase} across process restart" in phase_log
        assert "All tests passed." in phase_log
        assert f"tax_application phase={phase} source={source}" in phase_log
        assert (root / f"{phase}-bundle.json").read_bytes() == bundle
        shot = receipt["screenshot"]
        assert shot["filename"] == f"{phase}-editor.png"
        png = (root / shot["filename"]).read_bytes()
        assert png[:8] == b"\x89PNG\r\n\x1a\n" and len(png) == shot["bytes"] > 32
        assert hashlib.sha256(png).hexdigest() == shot["sha256"]
        exports = (root / f"{phase}-exports.log").read_text()
        architectures = re.findall(r"archive architectures \((\d+)\): ([^\n]+)", exports)
        assert len(architectures) == 1
        count, names = architectures[0]
        assert len(set(names.split())) == int(count) > 0
        for name in names.split():
            assert f"architecture {name} exact export set: PASS" in exports
        assert f"all {count} architecture slices exact export set: PASS" in exports
        receipts[phase] = receipt

    assert len({receipt["pid"] for receipt in receipts.values()}) == len(phases)

    def calculations(phase: str) -> list:
        return [call for call in receipts[phase]["native_calls"] if call["request"]["command"] == "tax_calculate"]

    for write, read in (("write", "read"), ("incomplete-write", "incomplete-read"), ("legacy-write", "legacy-read")):
        for key in ("artifact", "scenario", "workspace_progress"):
            assert receipts[write][key] == receipts[read][key], (write, read, key)
    for phase in ("write", "read", "legacy-write", "legacy-read"):
        assert len(calculations(phase)) == 1
        assert calculations(phase)[0]["response"]["type"] == "tax_calculated"
    assert calculations("write") == calculations("read")
    assert calculations("legacy-write") == calculations("legacy-read")
    incomplete = calculations("incomplete-write")
    assert len(incomplete) == 2
    assert incomplete[0]["response"]["type"] == "tax_calculated"
    assert incomplete[1]["response"]["type"] == "tax_error"
    assert "missing_tax_base" in json.dumps(incomplete[1]["response"]["detail"])
    assert calculations("incomplete-read") == []
    for phase in ("incomplete-write", "incomplete-read"):
        artifact = receipts[phase]["artifact"]
        assert artifact["calculation"] is None
        assert artifact["edit"]["baseline_tax_rate_bps"] == ""
        assert artifact["request"]["input"]["tax_input_basis"] == "rates"
    imports = [call for call in receipts["legacy-write"]["native_calls"] if call["request"]["command"] == "tax_import"]
    assert len(imports) == 1 and imports[0]["response"]["type"] == "tax_imported"
    legacy = imports[0]["response"]["legacy"]
    assert legacy["status"]["status"] == "converted"
    assert legacy["original_json"] == imports[0]["request"]["original_json"]
    assert hashlib.sha256(legacy["original_json"].encode()).hexdigest() == legacy["original_sha256"]
    for phase in ("legacy-write", "legacy-read"):
        artifact = receipts[phase]["artifact"]
        assert artifact["legacy"] == legacy
        assert artifact["request"]["input"]["override_owner"] == "SyntheticReviewer"
        assert artifact["request"]["input"]["override_as_of"] == "2026-09-30"
        assert legacy["status"]["draft"]["request"]["input"]["override_owner"] is None
        assert legacy["status"]["draft"]["request"]["input"]["override_as_of"] is None
    return {"schema": "tax-mobile-application-verification-v2", "source_sha": source, "run_nonce": nonce,
            "phases": list(phases), "pids": [receipts[p]["pid"] for p in phases],
            "same_bundle_sha256": hashlib.sha256(bundle).hexdigest(),
            "complete_pairs_equal": True, "fresh_native_reopen": True,
            "incomplete_native_error": True, "legacy_record_preserved": True}


if __name__ == "__main__":
    directory = pathlib.Path(sys.argv[1])
    result = verify(directory, sys.argv[2], sys.argv[3])
    (directory / "verification.json").write_text(json.dumps(result, indent=2) + "\n")
    print("tax application six-process acceptance: PASS")
    print(json.dumps(result))
