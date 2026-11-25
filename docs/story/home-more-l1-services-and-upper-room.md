# Hero Shooter — Home & More floor, door circulation and upper family room

**State:** Playable 2D test scene in `public/c-shop/`, based on the *user-supplied Pine Ridge overhead HTML*, not the separate 3D mall proof-of-concept.

## Visual authority

The approved **Home & More** image and its placement notes in `docs/art/home-and-more-shop-approved.md` are authoritative. The original artwork is retained in the user's ChatGPT Library, not currently committed as a binary into this GitHub repository. The playable branch currently uses **new procedural Canvas pixel art that follows its geometry and palette**, NOT the original bitmap. Avoid claiming those are identical. The original HTML game is preserved verbatim at `public/c-shop/pine-ridge-original.html`.

Rendering: fixed 640 × 360 source game viewport; scrolling world measures 1670 × 1100 game units, with the 1670 × 942 approved artwork as layout coordinate basis and an extra southern mall concourse.

## L1 ground-floor circulation

- **Customer entrance (south/centre):** large folding-glass doors with an electronic shutter. Access to the mall concourse.
- **Checkout (southeast of entrance):** long south-facing terminal counter, queue lanes and nested trolleys, referencing the approved artwork.
- **Retail:** six rear aisles, six middle aisles and three shorter front aisles: cookware, lamps, cleaning products, tools, appliances/electronics, textiles, paint and boxes. The rear brand mural and shipping display use **Home & More**, not the deprecated Golden Dragon sign.
- **Receiving/stockholding (northwest):** pallets and cartons, separate service door into the staff corridor. Rear service access may connect to a freight lift in a later chapter; do not invent a playable lift here.
- **Staff-only entrance:** distinct door from the retail aisle into a narrow **service corridor**. This is not the entrance to a WC or the office.
- **Mrs Chen's L1 administration/payroll office:** a separate enclosed room with its **own door** from the staff corridor. The NPC remains in the office; payroll and confidential business records stay off the shop floor.
- **Two WCs:** genuinely separate compartments, partitioned from one another, each with a different door from the service corridor.
- **Staff break room/canteen:** separate private room with its own service-corridor door, chairs, table and beverage fridge.
- **Stairwell:** has its own service-corridor door and connects to a different upstairs scene; it does not automatically place C in Mrs Chen's office.

### Upstairs room: story purpose

The upstairs space is a **family gathering and respite room**, *not* a second office or payroll room. It contains seating, an ordinary tea table, small storage shelves and drinking water. Before the crisis, the Chens can use it for a private conversation, a brief rest or to meet a relative. As the situation outside changes, it can become a temporary meeting point, providing a view over part of the store without being an invulnerable stronghold. The family may decide to gather elsewhere later; do not pre-empt the Chapter 1 plot through environmental text. Mrs Chen's actual administrative work remains in her **L1 ground-floor back office**.

## C, weapon state and visuals

C begins in the shop **unarmed in presentation (pistol holstered, neither hand holding it)**. `G` switches between holstered and drawn. Holding right mouse while drawn displays a subtle **cosmetic** red sightline attached to her current sprite bearing; it tapers to zero brightness and **does not affect shots, collisions or enemy targeting**. `F` operates the attached visible flashlight, `T` applies a timed strobe, and `V` cycles normal / simulated NVG / simulated thermal screen palettes. All are representations for gameplay only, with no claim about real-world optical performance. The flashlight uses a small game battery. Holstering turns it off.

The gunshot file inventory currently contains three local `p226-report-*.wav` recordings and original Pine Ridge embedded pistol samples. No standalone verified *Glock 26* WAV was found. The current scene uses the CC0 recorded **P226** WAVs as a provisional audio proxy when available and falls back to the original Pine Ridge .380 effect. This is a pending media-replacement task, not a claim to have imported a Glock 26 recording.

## QA

The workflow `test-c-shop-overhead.yml` runs real Chromium playthroughs. Checks cover W/A/S/D movement, holstered and drawn state, light/strobe/view modes, the site-preserved Pine Ridge HTML, seven independently opening doors, route reachability from the public floor to service destinations, upstairs-and-back navigation, and a short Mr Chen/shopfront/return conversation. Screenshots and a 1670 × 1100 map overview are uploaded to GitHub Actions.

The stage is a sandbox/working opening, not a locked story release. Architectural dimensions are estimates from the painted reference and require revision if a more detailed approved architectural plan is supplied.
