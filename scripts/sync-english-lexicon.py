#!/usr/bin/env python3
import csv
import hashlib
import io
import json
import pathlib
import unicodedata
import urllib.request

ECDICT_REPO = "skywind3000/ECDICT"
ECDICT_COMMIT = "82c9872576b23118d7c42e920c11beb77f510ae2"
ECDICT_FILE = "ecdict.csv"
SOURCE_URL = f"https://raw.githubusercontent.com/{ECDICT_REPO}/{ECDICT_COMMIT}/{ECDICT_FILE}"
TARGET_PATH = pathlib.Path("public/data/english/netem-v1.json")
OUTPUT_PATH = pathlib.Path("public/data/english/ecdict-v1.json")
META_PATH = pathlib.Path("public/data/english/ecdict-v1.meta.json")


def normalize(value: str) -> str:
    return unicodedata.normalize("NFKC", (value or "").strip()).lower()


with TARGET_PATH.open("r", encoding="utf-8") as fh:
    target_payload = json.load(fh)

target_ids = {normalize(item.get("id") or item.get("word")) for item in target_payload.get("catalog", [])}
target_ids.discard("")

request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "wenyan-literature-data-sync"})
entries = {}
with urllib.request.urlopen(request, timeout=120) as response:
    stream = io.TextIOWrapper(response, encoding="utf-8", newline="")
    reader = csv.DictReader(stream)
    for row in reader:
        word_id = normalize(row.get("word", ""))
        if not word_id or word_id not in target_ids or word_id in entries:
            continue
        phonetic = (row.get("phonetic") or "").strip()
        pos = (row.get("pos") or "").strip()
        exchange = (row.get("exchange") or "").strip()
        if not (phonetic or pos or exchange):
            continue
        entries[word_id] = {
            "phonetic": phonetic,
            "pos": pos,
            "exchange": exchange,
        }

matched = len(entries)
phonetic_count = sum(bool(item["phonetic"]) for item in entries.values())
pos_count = sum(bool(item["pos"]) for item in entries.values())
exchange_count = sum(bool(item["exchange"]) for item in entries.values())

# A large drop normally means the upstream format changed or the pinned target snapshot is missing.
if matched < 5000:
    raise SystemExit(f"ECDICT coverage unexpectedly low: {matched}/{len(target_ids)}")

payload = {
    "schema": 1,
    "source": {
        "repository": ECDICT_REPO,
        "commit": ECDICT_COMMIT,
        "file": ECDICT_FILE,
        "license": "MIT",
    },
    "targetCount": len(target_ids),
    "matchedCount": matched,
    "phoneticCount": phonetic_count,
    "posCount": pos_count,
    "exchangeCount": exchange_count,
    "entries": dict(sorted(entries.items())),
}

text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
meta = {
    "schema": 1,
    "generatedFrom": SOURCE_URL,
    "sourceCommit": ECDICT_COMMIT,
    "targetCount": len(target_ids),
    "matchedCount": matched,
    "phoneticCount": phonetic_count,
    "posCount": pos_count,
    "exchangeCount": exchange_count,
    "sha256": sha256,
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(text, encoding="utf-8")
META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(
    f"Wrote ECDICT enrichment: matched {matched}/{len(target_ids)}, "
    f"phonetic {phonetic_count}, pos {pos_count}, exchange {exchange_count}, sha256 {sha256[:12]}…"
)
