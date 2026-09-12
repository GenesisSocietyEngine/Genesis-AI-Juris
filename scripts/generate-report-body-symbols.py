"""Regenerate the pinned audit-arrow subset from an installed DejaVu Sans face.

Usage: python scripts/generate-report-body-symbols.py /path/to/DejaVuSans.ttf
The subset is deliberately limited to U+2192; graph font contracts are unchanged.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

source = Path(sys.argv[1]).read_bytes()
font = TTFont(io.BytesIO(source), recalcTimestamp=False)
options = subset.Options()
options.recalc_timestamp = False
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
options.name_legacy = True
options.name_languages = [0x409]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[0x2192])
subsetter.subset(font)
output = io.BytesIO()
font.save(output)
data = output.getvalue()
artifact = {
    "format": "genesis-report-audit-symbol-font-v1",
    "source": "DejaVu Sans, subset for U+2192 only",
    "sourceSha256": hashlib.sha256(source).hexdigest(),
    "sha256": hashlib.sha256(data).hexdigest(),
    "codePoints": [0x2192],
    "fileName": "ReportAuditArrow.ttf",
    "vfs": {"ReportAuditArrow.ttf": base64.b64encode(data).decode("ascii")},
}
target = Path(__file__).resolve().parent.parent / "app/report-audit-symbol-font.v1.json"
target.write_text(json.dumps(artifact, indent=2) + "\n")
print(json.dumps({"bytes": len(data), "sha256": artifact["sha256"]}))
