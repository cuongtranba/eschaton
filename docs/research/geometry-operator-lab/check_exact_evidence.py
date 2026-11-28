"""Recompute the EXACT parts of the committed laboratory evidence and compare them byte for byte.

RESEARCH ARTEFACT ONLY (owner decisions D-3, D-6, D-7 and the laboratory CI job, decision packet
section 0.4). It reads the committed evidence files and never writes them. Float measurements and
timing are not compared: they are platform-dependent and no cross-platform float agreement is claimed.
The exact parts (digests, error codes, kinds, rationals) are compared on whatever interpreter and
platform run this script, which is evidence of agreement for exactly those inputs.

Exit status 0 if every exact field matches, 1 otherwise. Run from the repository root:
    python3 docs/research/geometry-operator-lab/check_exact_evidence.py
"""
import json
import os
import platform
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import o1  # noqa: E402


def load(name):
    with open(os.path.join(HERE, name)) as fh:
        return json.load(fh)


def m1_exact():
    """The exact fields of evidence/m1-evidence.json, recomputed from fixtures.json with o1.py."""
    fx = load("fixtures.json")
    bands = {}
    for name, f in sorted(fx["bands"].items()):
        res = o1.section_transition(f["a"], f["b"], min_altitude=f.get("min_altitude"))
        entry = {"digest": o1.digest(res), "ok": res["ok"]}
        if res["ok"]:
            b = res["band"]
            entry.update({"topology": b["topology"], "faces": len(b["faces"]), "kinds": [x["kind"] for x in b["faces"]],
                          "area_mid": b["area_mid"], "volume": b["volume"]})
        else:
            entry["code"] = res["error"]["code"]
        bands[name] = entry
    chains = {}
    for name, f in sorted(fx["chains"].items()):
        res = o1.chain(f["stations"])
        ring = res["chain"]["rings"][0]
        chains[name] = {"digest": o1.digest(res), "kind": ring["kind"], "on_path": ring["on_path"],
                        "edges": [c for _, c in ring["edges"]]}
    codes = {name: o1.section_transition(f["a"], f["b"], min_altitude=f.get("min_altitude"))["error"]["code"]
             for name, f in sorted(fx["negative_bands"].items())}
    codes.update({name: o1.chain(f["stations"])["error"]["code"] for name, f in sorted(fx["negative_chains"].items())})
    return {"bands": bands, "chains": chains, "negative_controls": codes}


def committed_m1():
    ev = load(os.path.join("evidence", "m1-evidence.json"))
    keys = {"digest", "ok", "topology", "faces", "kinds", "area_mid", "volume", "code"}
    bands = {n: {k: v for k, v in e.items() if k in keys} for n, e in ev["bands"].items()}
    chains = {n: {k: e[k] for k in ("digest", "kind", "on_path", "edges")} for n, e in ev["chains"].items()}
    return {"bands": bands, "chains": chains, "negative_controls": ev["negative_controls"]}


def checks():
    """(name, recomputed, committed) for every evidence file with exact parts."""
    out = [("m1-evidence.json", m1_exact(), committed_m1())]
    extra = os.path.join(HERE, "run_evidence_lab2.py")
    if os.path.exists(extra):
        import run_evidence_lab2 as lab2  # noqa: E402
        for fname, fn in (("m2-evidence.json", lab2.m2_exact), ("m1b-evidence.json", lab2.m1b_exact)):
            out.append((fname, fn(), load(os.path.join("evidence", fname))["exact"]))
    return out


def main():
    print("interpreter: CPython %s, %s %s" % (platform.python_version(), platform.system(), platform.machine()))
    failed = 0
    for name, got, want in checks():
        a = json.dumps(got, sort_keys=True, separators=(",", ":"))
        b = json.dumps(want, sort_keys=True, separators=(",", ":"))
        status = "match" if a == b else "MISMATCH"
        failed += a != b
        print("%s: exact parts %s (%d bytes)" % (name, status, len(a)))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
