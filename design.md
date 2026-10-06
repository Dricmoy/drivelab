# Technical Noir — DriveLab

An instrument for investigating a driving decision, not a promotional landing page. The replay is the primary visual, the decision inspector explains it, and the recorded run is its evidence.

Use warm ink surfaces, ivory IBM Plex Sans interface typography, restrained vermilion actions and warm apricot selected-trajectory encoding. Instrument Serif is reserved for the DriveLab wordmark; all functional headings, decisions, controls and evidence use Plex. Numeric evidence is tabular. Shared surface, spacing, typography, focus and motion tokens live in `web/src/tokens.css`; apply them across Replay, Evaluation, Dataset, Model and dialogs through `technical-noir.css` and the scoped completeness layer `coherence.css`.

Retain ordinary app navigation: these are four work modes, not marketing links. Sidebar thumbnails are actual scenario route geometry. No intro gate, scroll hijacking, custom cursor, fake telemetry or animated number reveal. Existing camera transitions communicate view changes and respect reduced motion. Buttons have short physical press feedback; sound remains opt-in.

Completed computation, recorded playback, planned settings, running requests, waiting prerequisites and failures must be textually distinct. A previous completed result remains labelled when a new request runs. Synthetic data and concept imagery remain explicitly identified; no safety-certification claims.

Reference influence: Santioni's confident upright type, ink/paper contrast, material depth and strong focal subject. Use original composition and art, not its branding or assets. At narrow widths collapse the library and inspector, compress provenance without removing it, and keep transport and settings actions reachable.

## October 5 refinement

Keep the replay unobstructed: view/camera/actor controls above it, trajectory key
and zoom/follow controls below it. Use original dimensional sedan/van/ego models
with material detail; preserve recorded length, width and pose. Appearance and
height are illustrative. Identical candidate geometry must be labelled, never
visually offset for effect. Costs shown equal at displayed precision are near
ties, not meaningful wins.

Collapse library at 960px and move the inspector below the replay at 1200px.
Below 640px use a native camera select; keep actor selection available. At tablet
widths paired comparison rows become labelled cards. Finished evidence precedes
configuration on small screens; test-method settings remain a native disclosure.
Show whether higher/lower is better and actual deltas, with text as well as color.
Modal bodies scroll; close buttons and action footers remain reachable on short
screens. Global keyboard shortcuts must not override interactive controls.

Framer/Midu informed restrained hierarchy and tactile material detail; Awwwards'
published car-showroom preview informed lighting and framing. No brand assets
were copied. Current evidence and bounded limitations: design/noir-refinement/REPORT.md.

## Coherence pass — October 5

Preserve the selected Technical Noir identity. Shift cyan selections to apricot,
purple inspection to ivory, and cool road/glass materials to warm charcoal.
The sRGB render palette is tested against CSS semantic colors; success remains
sage, warnings amber, errors coral, all with text. Focus is ivory with a dark
separation ring. The outer document background must also consume the surface token.

[Terminal Industries](https://www.awwwards.com/sites/terminal-industries) won
Awwwards Site of the Day on September 3, 2025. Its industrial focal subject and
warm material restraint inform composition, not copied assets or marketing.
[Apple's color guidance](https://developer.apple.com/design/human-interface-guidelines/color)
informs consistent semantic roles.
[Waymo's transparency, freedom and consistency](https://waymo.com/blog/2019/08/driven-by-waymo-designed-with-trust/)
inform the activity/evidence hierarchy.
Restraint inferred from [Tesla's product presentation](https://www.tesla.com/model3)
is inspiration, not a claim about an official Tesla design framework.

Use locally bundled, credited road photographs only in supporting Dataset/Model
content. Never present them as measured output. Keep primary controls before
editorial images; camera imagery remains recorded geometry. On phones the scene
precedes playback and its adjacent decision summary; inspection precedes whole-run
metrics. Explicitly scope comparisons to their actual sample and expose raw
collision counts. Paths refer to the engine computer, not a connected phone.
The Model header provides a direct shortcut to its next-run controls.

Evidence and two independent screenshot review rounds: design/coherence/REPORT.md.
This is bounded browser/unit verification, not an exhaustive design or WCAG certification.

## Fleet and typography refinement — October 5

Keep the existing Workbench layout and Noir palette. The single-family interface
is deliberate: Plex 700 page titles, Plex 600 section titles, Plex 400 reading,
and tabular numeric evidence. Serif only identifies the wordmark. Use the shared
heading/body tokens across every work mode and dialog, not per-screen font choices.

Busy boulevard is a deterministic synthetic fixture with 36 surrounding actors
plus ego: four travel lanes and curbside parking. Every actor participates in
forecasting and collision scoring. Prescribed lane-following is not interactive
driver behavior. Original hatchback/sedan/SUV/van models preserve recorded footprint
and pose; paint, height, buildings and sidewalks are illustrative presentation.
Street context is not an additional obstacle or traffic-rule model.

## Exports

The live source of truth is web/src/tokens.css. These optional portable palette
exports are not new runtime dependencies. DTCG uses structured OKLCH components;
the shadcn mapping uses full color values suitable for current variable aliases.

### Plain CSS
```css
:root {
  --color-paper: oklch(18% .005 65);
  --color-paper-2: oklch(23% .005 65);
  --color-paper-3: oklch(28% .005 65);
  --color-ink: oklch(94% .014 85);
  --color-muted: oklch(76% .01 85);
  --color-rule: oklch(35% .008 65);
  --color-control-rule: oklch(57% .008 65);
  --color-accent: oklch(72% .18 36);
  --color-accent-ink: oklch(17% .008 65);
  --color-focus: oklch(94% .014 85);
  --color-selected: oklch(80% .12 40);
  --color-success: oklch(81% .10 155);
  --color-warning: oklch(82% .11 80);
  --color-error: oklch(78% .13 24);
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'IBM Plex Sans', sans-serif;
}
```

### Tailwind v4
```css
@theme {
  --color-paper: oklch(18% .005 65);
  --color-paper-2: oklch(23% .005 65);
  --color-paper-3: oklch(28% .005 65);
  --color-ink: oklch(94% .014 85);
  --color-muted: oklch(76% .01 85);
  --color-rule: oklch(35% .008 65);
  --color-control-rule: oklch(57% .008 65);
  --color-accent: oklch(72% .18 36);
  --color-accent-ink: oklch(17% .008 65);
  --color-focus: oklch(94% .014 85);
  --color-selected: oklch(80% .12 40);
  --color-success: oklch(81% .10 155);
  --color-warning: oklch(82% .11 80);
  --color-error: oklch(78% .13 24);
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'IBM Plex Sans', sans-serif;
}
```

### DTCG JSON
```json
{
  "color": {
    "paper": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.18,
          0.005,
          65
        ],
        "alpha": 1
      }
    },
    "paper-2": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.23,
          0.005,
          65
        ],
        "alpha": 1
      }
    },
    "paper-3": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.28,
          0.005,
          65
        ],
        "alpha": 1
      }
    },
    "ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.94,
          0.014,
          85
        ],
        "alpha": 1
      }
    },
    "muted": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.76,
          0.01,
          85
        ],
        "alpha": 1
      }
    },
    "rule": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.35,
          0.008,
          65
        ],
        "alpha": 1
      }
    },
    "control-rule": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.57,
          0.008,
          65
        ],
        "alpha": 1
      }
    },
    "accent": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.72,
          0.18,
          36
        ],
        "alpha": 1
      }
    },
    "accent-ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.17,
          0.008,
          65
        ],
        "alpha": 1
      }
    },
    "focus": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.94,
          0.014,
          85
        ],
        "alpha": 1
      }
    },
    "selected": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.8,
          0.12,
          40
        ],
        "alpha": 1
      }
    },
    "success": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.81,
          0.1,
          155
        ],
        "alpha": 1
      }
    },
    "warning": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.82,
          0.11,
          80
        ],
        "alpha": 1
      }
    },
    "error": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [
          0.78,
          0.13,
          24
        ],
        "alpha": 1
      }
    }
  }
}
```

### shadcn CSS variables
```css
:root {
  --background: oklch(18% .005 65);
  --foreground: oklch(94% .014 85);
  --card: oklch(23% .005 65);
  --card-foreground: oklch(94% .014 85);
  --popover: oklch(23% .005 65);
  --popover-foreground: oklch(94% .014 85);
  --primary: oklch(72% .18 36);
  --primary-foreground: oklch(17% .008 65);
  --secondary: oklch(28% .005 65);
  --secondary-foreground: oklch(94% .014 85);
  --muted: oklch(28% .005 65);
  --muted-foreground: oklch(76% .01 85);
  --accent: oklch(80% .12 40);
  --accent-foreground: oklch(17% .008 65);
  --destructive: oklch(78% .13 24);
  --border: oklch(35% .008 65);
  --input: oklch(57% .008 65);
  --ring: oklch(94% .014 85);
  --radius: .35rem;
}
```
