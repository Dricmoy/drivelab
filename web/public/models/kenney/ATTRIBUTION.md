# Vehicle assets

Kenney **Car Kit 3.1**, downloaded October 3, 2026.

These assets were used by the earlier viewer and are retained with their license
and original hashes. The current renderer uses original procedural geometry in
`web/src/VehicleModel.tsx` instead. Transform/marker notes below describe the
earlier asset renderer, not the current models.

- Official source: https://kenney.nl/assets/car-kit
- Archive: https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip
- License: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/
- Original notice retained in License.txt. No attribution is required, but credit is given here and in the viewer.
- Selected unchanged GLB models and their shared texture are served locally; no runtime third-party model service is required.
- Runtime transform rotates +Z front to +X, centers the model footprint and normalizes it to each observed vehicle length/width. Rendered height is illustrative, not measured. Blue ground outline/roof marker identifies ego. No copied mesh is used for simulation physics.

SHA-256:

    2889c428ca1dd9c975c3ff760eb8757883490410555ab60b818f712f583826d6  sedan-sports.glb
    b532ea7d2c59f7f6b22b138cf1955218a2c1898f1cea932af4d3fd563c3959b7  sedan.glb
    ed4ed56e8e5ed98db050af09ed2062b3b6bb7b93eab1e563cb6774b387b233a1  van.glb
    f3622a03a20c6696065cae9cbe391351be873508af190c2ebd1d420c055787a5  Textures/colormap.png
