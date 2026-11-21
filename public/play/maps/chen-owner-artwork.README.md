# Mr. Chen's office — approved illustrated artwork

Asset: [chen-owner-artwork.avif](./chen-owner-artwork.avif)

This is the approved, strictly overhead, pixel-art treatment for Mr. Chen's private Home & More office (desk and computer, paperwork, visitor chairs, lounge/tea corner, document cupboards, concealed safe, and a door at the bottom). The small AVIF export is 600 × 671 pixels (8,160 bytes); the original generated PNG in the ChatGPT conversation is 1186 × 1327 and is intentionally not committed due to size.

**Integration status:** Art asset staged on the office-and-stairwell feature branch. The playable owner room currently renders `chen-owner.svg` at 900 × 640 logical units (via `roomImage(floor)` in `../shop.js`). Keep its existing collision boundaries, doors, furniture interactions, and spawn points functioning until the tall illustrated floorplan can be mapped into gameplay coordinates. Do not simply stretch the portrait artwork into the 900 × 640 room or cover the entrance: the artwork and current walkable room have different aspect ratios, door positions, and furniture layouts.

When integrating it visually, prefer converting or remapping the owner room to fit the art's geometry, and align the floor's colliders and interactive hotspots accordingly. Other rooms (Mrs. Chen's office, boardroom and switchback stairwell) should remain unchanged.
