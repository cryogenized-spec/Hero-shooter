#!/usr/bin/env python3
"""Read-only mesh overview for Hero Shooter 3D character models.

Dependency: pip install numpy trimesh; accepts formats supported by trimesh
(e.g. GLB, GLTF, OBJ). This is a preliminary topology/proximity audit: a vertex
sample is NOT an accurate geometric proof that two surfaces touch or intersect.

Examples:
    python mesh_audit.py character.glb --output audit.json
    python mesh_audit.py character.obj
"""
import argparse
import json
from pathlib import Path
import sys

import numpy as np
import trimesh

KEY_GROUPS = {
    "face or body skin": ("face", "skin", "head"),
    "lips": ("lip", "mouth"),
    "nose": ("nose",),
    "hair": ("hair", "scalp"),
    "headband": ("headband", "alice", "band"),
    "flowers": ("flower", "floral"),
}


def sample_vertices(vertices, max_count=1500):
    """Sample deterministically without a randomness dependency."""
    points = np.asarray(vertices, dtype=np.float64)
    if len(points) <= max_count:
        return points
    return points[np.linspace(0, len(points) - 1, max_count, dtype=int)]


def nearest_vertex_sample_distance(a, b, max_count=1500):
    """Conservative *proxy* metric, NOT a true point-to-surface gap."""
    a, b = sample_vertices(a, max_count), sample_vertices(b, max_count)
    if len(a) == 0 or len(b) == 0:
        return None
    try:
        from scipy.spatial import cKDTree
        dist, _ = cKDTree(b).query(a, k=1)
        return float(np.min(dist))
    except ImportError:
        best = np.inf
        for chunk in np.array_split(a, max(1, int(np.ceil(len(a) / 50)))):
            distances = ((chunk[:, None, :] - b[None, :, :]) ** 2).sum(axis=2)
            best = min(best, float(distances.min()))
        return float(np.sqrt(best))


def analyze(path):
    loaded = trimesh.load(path, force="scene", process=False)
    if not isinstance(loaded, trimesh.Scene):
        scene = trimesh.Scene(loaded)
    else:
        scene = loaded

    groups = {}
    total_triangles = 0
    warnings = []
    for node in sorted(scene.graph.nodes_geometry):
        transform, geom_name = scene.graph[node]
        geom = scene.geometry.get(geom_name)
        if not isinstance(geom, trimesh.Trimesh):
            continue
        world = geom.copy()
        world.apply_transform(transform)
        faces = int(len(world.faces))
        total_triangles += faces
        groups[node] = {
            "mesh_id": geom_name,
            "vertices": int(len(world.vertices)),
            "triangles": faces,
            "bounds": np.asarray(world.bounds).round(6).tolist(),
            "watertight": bool(world.is_watertight),
            "nonfinite_vertices": int(np.count_nonzero(~np.isfinite(world.vertices).all(axis=1))),
            "_vertices": world.vertices,
        }
        if groups[node]["nonfinite_vertices"]:
            warnings.append(f"{node}: non-finite vertex coordinates")

    result = {
        "source": str(Path(path).resolve()),
        "units": "unknown; verify against model authoring metadata",
        "coordinate_system": "verify before mapping to game world",
        "mesh_groups": len(groups),
        "triangles": total_triangles,
        "scene_bounds": np.asarray(scene.bounds).round(6).tolist() if groups else None,
        "groups": {},
        "feature_distance_proxies": [],
        "warnings": warnings,
        "disclaimer": "Nearest VERTEX SAMPLE distance is a heuristic; it does not establish exact surface contact, intersections, watertightness requirement, rigging or visual approval.",
    }

    for node, stats in groups.items():
        result["groups"][node] = {k: v for k, v in stats.items() if not k.startswith("_")}

    # A group can include the whole body or head: report candidate relationships,
    # never a 'pass' based solely on proximity. Geometry may intentionally overlap.
    names = list(groups)
    def matches_group(name, category, keys):
        lower = name.lower()
        if category == "face or body skin":
            # Avoid treating "headband" as the head surface.
            return lower in {"head", "face"} or lower.startswith(("face_", "skin"))
        return any(key in lower for key in keys)

    category_matches = {
        category: [name for name in names if matches_group(name, category, keys)]
        for category, keys in KEY_GROUPS.items()
    }
    for source_cat, target_cat in [
        ("lips", "face or body skin"),
        ("nose", "face or body skin"),
        ("headband", "hair"),
        ("flowers", "headband"),
    ]:
        for src in category_matches[source_cat]:
            for dst in category_matches[target_cat]:
                if src == dst:
                    continue
                metric = nearest_vertex_sample_distance(groups[src]["_vertices"], groups[dst]["_vertices"])
                result["feature_distance_proxies"].append({
                    "from": src,
                    "to": dst,
                    "distance_model_units": round(metric, 6) if metric is not None else None,
                    "metric": "sampled nearest vertex-to-vertex distance, not exact surface gap",
                })
    if not category_matches["lips"]:
        warnings.append("No semantically named lips group; material groups may not represent anatomy.")
    if not category_matches["headband"]:
        warnings.append("No semantically named headband; inspect manually.")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mesh", help="Existing GLB/GLTF/OBJ or any trimesh-supported asset")
    parser.add_argument("--output", help="Optional JSON report path")
    args = parser.parse_args(argv)
    source = Path(args.mesh)
    if not source.is_file():
        parser.error(f"Missing mesh file: {source}")
    try:
        report = analyze(str(source))
    except Exception as exc:
        parser.error(f"Cannot inspect mesh: {exc}")
    json_out = json.dumps(report, indent=2)
    if args.output:
        Path(args.output).write_text(json_out + "\n", encoding="utf-8")
        print(f"Mesh groups: {report['mesh_groups']}; triangles: {report['triangles']}; wrote {args.output}")
    else:
        print(json_out)


if __name__ == "__main__":
    main()