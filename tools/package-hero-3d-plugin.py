#!/usr/bin/env python3
"""Package the canonical repo skill as one portable, skills-only ChatGPT plugin.

Run from repository root:
  python tools/package-hero-3d-plugin.py --out dist/hero-shooter-3d-studio.zip
"""
from pathlib import Path
import argparse
import json
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins" / "hero-shooter-3d-studio"
SKILL = ROOT / ".agents" / "skills" / "hero-3d-character-studio"


def package(output: Path):
    manifest = json.loads((PLUGIN / "plugin.json").read_text(encoding="utf-8"))
    if not manifest.get("name") or not manifest.get("version"):
        raise ValueError("Plugin missing name or version")
    content = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    if not content.startswith("---\n") or "\nname: hero-3d-character-studio\n" not in content:
        raise ValueError("Skill frontmatter missing or mismatched")
    files = [p for p in SKILL.rglob("*") if p.is_file() and "__pycache__" not in p.parts]
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as zf:
        zf.write(PLUGIN / "plugin.json", "plugin.json")
        for f in files:
            zf.write(f, (Path("skills") / SKILL.name / f.relative_to(SKILL)).as_posix())
    with ZipFile(output) as zf:
        assert zf.namelist()[0] == "plugin.json"
        assert "skills/hero-3d-character-studio/SKILL.md" in zf.namelist()
        assert len(set(zf.namelist())) == len(zf.namelist())
    return len(files)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="dist/hero-shooter-3d-studio.zip")
    opts = parser.parse_args()
    output = Path(opts.out)
    count = package(output)
    print(f"Wrote {output} with {count} skill files")
