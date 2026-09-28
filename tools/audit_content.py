#!/usr/bin/env python3
"""Audit Wenyan Android seed against a small public-course anchor set.

Zero dependencies. This is intentionally a migration/research helper rather
than application infrastructure.

Usage:
    python tools/audit_content.py /path/to/seed_data.json
    python tools/audit_content.py /path/to/seed_data.json --json
    python tools/audit_content.py /path/to/seed_data.json --anchors docs/content-anchors-v1.json
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

PLACEHOLDER_SOURCES = {
    "", "其他", "未知", "待补", "无", "n/a", "na", "none", "unknown",
}
SUBJECTS = ("中国古代文学", "中国现当代文学", "外国文学", "文学理论")


def normalize(value: Any) -> str:
    text = str(value or "").lower()
    return re.sub(r"[\s《》“”\"'·,.，。:：；;（）()\-—]", "", text)


def valid_source(value: Any) -> bool:
    return isinstance(value, str) and value.strip().casefold() not in PLACEHOLDER_SOURCES


def kp_has_source(item: dict[str, Any]) -> bool:
    candidates = [item.get("source_ref"), item.get("source")]
    textbook_sources = item.get("textbook_sources")
    if isinstance(textbook_sources, list):
        candidates.extend(textbook_sources)
    return any(valid_source(value) for value in candidates)


def writing_has_source(item: dict[str, Any]) -> bool:
    return any(
        valid_source(item.get(key))
        for key in ("source", "source_ref", "exam_source")
    )


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def distribution(values: list[Any]) -> dict[str, int]:
    counts = Counter(str(value) for value in values)
    return dict(sorted(counts.items(), key=lambda row: (-row[1], row[0])))


def normalized_title_duplicates(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, str]]] = {}
    for item in points:
        key = normalize(item.get("title"))
        if not key:
            continue
        groups.setdefault(key, []).append(
            {
                "id": str(item.get("id", "")),
                "title": str(item.get("title", "")),
                "subject": str(item.get("subject", "")),
            }
        )
    result = [
        {"normalized_title": key, "items": items}
        for key, items in groups.items()
        if len(items) > 1
    ]
    return sorted(result, key=lambda row: (-len(row["items"]), row["normalized_title"]))


def point_search_text(item: dict[str, Any]) -> str:
    tags = item.get("tags")
    tag_text = " ".join(str(x) for x in tags) if isinstance(tags, list) else str(tags or "")
    return normalize(
        " ".join(
            str(item.get(key) or "")
            for key in ("title", "summary", "core_conclusion")
        )
        + " "
        + tag_text
    )


def audit_anchors(
    points: list[dict[str, Any]],
    questions: list[dict[str, Any]],
    anchors: dict[str, Any],
) -> dict[str, Any]:
    point_docs = [(item, point_search_text(item)) for item in points]
    question_docs = [
        (item, normalize(item.get("content")))
        for item in questions
    ]

    result: dict[str, Any] = {}
    for subject, rows in anchors.get("subjects", {}).items():
        audited = []
        for name, terms in rows:
            needles = [normalize(term) for term in terms if normalize(term)]
            kp_matches = [
                item
                for item, text in point_docs
                if item.get("subject") == subject
                and any(needle in text for needle in needles)
            ]
            q_matches = [
                item
                for item, text in question_docs
                if item.get("subject") == subject
                and any(needle in text for needle in needles)
            ]
            audited.append(
                {
                    "name": name,
                    "matched": len(kp_matches),
                    "source_backed": sum(kp_has_source(item) for item in kp_matches),
                    "high": sum(item.get("exam_frequency") == "HIGH" for item in kp_matches),
                    "question_hits": len(q_matches),
                    "sample_ids": [item.get("id") for item in kp_matches[:8]],
                }
            )

        result[subject] = {
            "anchor_total": len(audited),
            "present": sum(row["matched"] > 0 for row in audited),
            "source_backed": sum(row["source_backed"] > 0 for row in audited),
            "question_touched": sum(row["question_hits"] > 0 for row in audited),
            "missing": [row for row in audited if row["matched"] == 0],
            "present_but_unsourced": [
                row for row in audited
                if row["matched"] > 0 and row["source_backed"] == 0
            ],
            "items": audited,
        }
    return result


def audit(seed: dict[str, Any], anchors: dict[str, Any] | None) -> dict[str, Any]:
    points = seed.get("knowledge_points", [])
    questions = seed.get("exam_questions", [])
    writing = seed.get("writing_materials", [])
    essays = [q for q in questions if q.get("question_type") == "ESSAY"]
    high = [k for k in points if k.get("exam_frequency") == "HIGH"]
    explicit_related = [
        q for q in questions
        if isinstance(q.get("related_point_ids"), list) and q["related_point_ids"]
    ]

    by_subject: dict[str, Any] = {}
    for subject in SUBJECTS:
        sp = [item for item in points if item.get("subject") == subject]
        sq = [item for item in questions if item.get("subject") == subject]
        by_subject[subject] = {
            "knowledge_points": len(sp),
            "high": sum(item.get("exam_frequency") == "HIGH" for item in sp),
            "source_valid": sum(kp_has_source(item) for item in sp),
            "high_source_valid": sum(
                item.get("exam_frequency") == "HIGH" and kp_has_source(item)
                for item in sp
            ),
            "questions": len(sq),
            "essays": sum(item.get("question_type") == "ESSAY" for item in sq),
        }

    missing_essay_structure = [
        {
            "id": q.get("id"),
            "year": q.get("year"),
            "subject": q.get("subject"),
            "exam_paper_code": q.get("exam_paper_code"),
            "content": q.get("content"),
        }
        for q in essays
        if not nonempty(q.get("angle")) or not nonempty(q.get("notes"))
    ]

    report: dict[str, Any] = {
        "seed": {
            "version": seed.get("metadata", {}).get("version"),
            "generated_at": seed.get("metadata", {}).get("generated_at"),
        },
        "counts": {
            "subjects": len(seed.get("subjects", [])),
            "knowledge_points": len(points),
            "exam_questions": len(questions),
            "essays": len(essays),
            "writing_materials": len(writing),
        },
        "knowledge": {
            "frequency": distribution([item.get("exam_frequency") for item in points]),
            "source_valid": sum(kp_has_source(item) for item in points),
            "source_missing_or_placeholder": sum(not kp_has_source(item) for item in points),
            "high_total": len(high),
            "high_source_valid": sum(kp_has_source(item) for item in high),
            "high_source_missing_or_placeholder": sum(not kp_has_source(item) for item in high),
            "exact_normalized_title_duplicate_groups": normalized_title_duplicates(points),
        },
        "questions": {
            "by_type": distribution([item.get("question_type") for item in questions]),
            "answer_framework_present": sum(nonempty(item.get("answer_framework")) for item in questions),
            "score_zero": sum(float(item.get("score") or 0) == 0 for item in questions),
            "score_positive": sum(float(item.get("score") or 0) > 0 for item in questions),
            "explicit_related_question_count": len(explicit_related),
            "explicit_related_reference_count": sum(len(item["related_point_ids"]) for item in explicit_related),
            "essay_angle_present": sum(nonempty(item.get("angle")) for item in essays),
            "essay_notes_present": sum(nonempty(item.get("notes")) for item in essays),
            "missing_essay_structure": missing_essay_structure,
        },
        "writing": {
            "source_valid": sum(writing_has_source(item) for item in writing),
            "source_missing_or_placeholder": sum(not writing_has_source(item) for item in writing),
            "by_source": distribution([item.get("source") for item in writing]),
        },
        "by_subject": by_subject,
    }

    recent = [q for q in questions if int(q.get("year") or 0) >= 2023]
    report["recent_questions_2023_plus"] = {
        "total": len(recent),
        "score_zero": sum(float(q.get("score") or 0) == 0 for q in recent),
        "without_explicit_related_points": sum(
            not (isinstance(q.get("related_point_ids"), list) and q["related_point_ids"])
            for q in recent
        ),
    }

    if anchors is not None:
        report["anchors"] = audit_anchors(points, questions, anchors)
    return report


def markdown(report: dict[str, Any]) -> str:
    c = report["counts"]
    k = report["knowledge"]
    q = report["questions"]
    w = report["writing"]

    lines = [
        "# Content audit",
        "",
        f"- seed: {report['seed']['version']}",
        f"- knowledge: {c['knowledge_points']}",
        f"- questions: {c['exam_questions']} (ESSAY {c['essays']})",
        f"- writing materials: {c['writing_materials']}",
        "",
        "## Source debt",
        "",
        f"- knowledge with source: {k['source_valid']} / {c['knowledge_points']}",
        f"- HIGH with source: {k['high_source_valid']} / {k['high_total']}",
        f"- writing with source: {w['source_valid']} / {c['writing_materials']}",
        "",
        "## Question metadata",
        "",
        f"- answer framework: {q['answer_framework_present']} / {c['exam_questions']}",
        f"- score == 0: {q['score_zero']} / {c['exam_questions']}",
        f"- explicit related-point questions: {q['explicit_related_question_count']} / {c['exam_questions']}",
        f"- essay angle: {q['essay_angle_present']} / {c['essays']}",
        f"- essay notes: {q['essay_notes_present']} / {c['essays']}",
    ]

    anchors = report.get("anchors")
    if anchors:
        lines.extend(["", "## Anchor coverage", ""])
        for subject, data in anchors.items():
            lines.append(
                f"- {subject}: present {data['present']}/{data['anchor_total']}; "
                f"source-backed {data['source_backed']}/{data['anchor_total']}; "
                f"question-touched {data['question_touched']}/{data['anchor_total']}"
            )
            if data["missing"]:
                lines.append(
                    "  - missing: " + "、".join(item["name"] for item in data["missing"])
                )

    lines.extend([
        "",
        "> Anchor matching is heuristic. It measures structural coverage, not correctness and not official exam-syllabus coverage.",
        "",
    ])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("seed", type=Path)
    parser.add_argument(
        "--anchors",
        type=Path,
        default=Path("docs/content-anchors-v1.json"),
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    seed = json.loads(args.seed.read_text(encoding="utf-8"))
    anchors = None
    if args.anchors.exists():
        anchors = json.loads(args.anchors.read_text(encoding="utf-8"))

    report = audit(seed, anchors)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(markdown(report))


if __name__ == "__main__":
    main()
