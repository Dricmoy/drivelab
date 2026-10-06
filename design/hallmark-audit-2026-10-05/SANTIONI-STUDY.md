<!-- Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4. Scores concern this reference-study artifact, not a verified app redesign. -->

# Santioni reference study

Source: [Santioni Spirits](https://santionispirits.com/). Public reference supplied by the user. The site credits Active Theory and Plan8. This is a structural and visual study, not permission to reuse their illustrations, models, custom lettering, or brand assets.

The user explicitly confirmed legal age and authorized the Yes action. After entry, the browser showed Experience and Collection modes. Scrolling changed the illustrated composition; selecting Collection opened a product scene, and selecting Mint changed the product lettering and bottle appearance. No purchase, sign-up, external link, or audio toggle was activated.

## Diagnosis

Santioni combines a **Marquee Hero** with a sequential illustrated narrative; Narrative Workflow is the closest secondary catalogue fit, although this tells a brand story rather than a numbered product workflow. The introductory heading dominates the screen, then the artwork becomes the primary content. Its serif display lettering is expressive and high contrast, paired with compact bold sans-serif control labels. Exact font families cannot be inferred reliably from screenshots. Near-black, paper white, and red establish the palette; the red moves from a small mark to a full-field collection background. Visible grain, hatching, irregular outlines, and composited depth make the surface feel authored. Two persistent mode controls provide a route directly to the collection. The collection uses a sculptural bottle in front of large product lettering, with a coordinated visual transition on selection. The footer is a restrained masthead/contact/credit arrangement. Borrow its commitment to a coherent visual language, not its long entrance, immersive scrolling, artwork, or lettering.

A catalogue cousin would be Specimen for the serif/ink/paper relationship, but it misses the animation-led story and red product stage. No catalogue theme is being selected or locked for DriveLab.

## Captured evidence

![Intro: strong display type and ink field](reference-santioni-01-intro.jpg)

![Story: illustration is the main content](reference-santioni-02-story.jpg)

![Depth: scroll changes composition and viewpoint](reference-santioni-03-depth.jpg)

![Collection: foreground product with oversized type](reference-santioni-04-collection.jpg)

![Selection: Mint product state after control activation](reference-santioni-05-selection.jpg)

![Footer: paper-to-ink transition and concise credits](reference-santioni-06-footer.jpg)

## How this changes the DriveLab proposal

**Proposed direction: Technical Noir.** This is a stronger alternative to the earlier light/cobalt treatment, not an implemented or approved replacement.

- **Layout:** retain one real driving canvas, a compact evidence inspector, and a single playback dock. No full-screen story entrance and no scroll-linked route to essential controls.
- **Typography:** an upright editorial display face for the project identity and scenario title; readable sans-serif controls and tabular/mono measurements. Keep expressive type away from dense metrics. Candidate roles could be served by Instrument Serif plus the existing sans-serif stack; font choice remains open, not extracted from Santioni.
- **Palette:** ink, warm paper, and restrained vermilion for brand details. Preserve unambiguous semantic colors/text for completed, running, failed, waiting, and selected trajectories. Do not let the brand red double as every status or selected path.
- **3D:** stronger scene composition and lighting, clearer car silhouettes and trajectory hierarchy. Explore an optional contour/ink treatment only if road boundaries and candidate paths remain easy to read; retain a clean debug view. No fake sensor data.
- **Personality:** create original scientific/road illustrations for genuinely helpful onboarding or scenario differentiation. Any generated art must be labeled concept art, never presented as measured output. Do not reuse Santioni's art or imitate its distinctive bottle lettering.
- **Controls:** compact, consistent bordered controls with subtle pressed depth, immediate keyboard focus, and restrained opt-in sounds. Do not put irregular hand-drawn geometry on precise sliders or a timeline.
- **Motion:** brief camera settling when switching viewpoints or scenes, clear selection transitions, and reduced-motion alternatives. No compulsory intro, idle motion over evidence, or scroll hijacking in the workbench.

The main transfer is visual temperament and authored materials. The functional backbone stays DriveLab's actual research workflow. Foxglove remains useful only as an operational hierarchy reference; Raycast only as a control-state reference. We are not blending three whole-page layouts.

## Structured study fields

```json
{
  "source_mode": "image",
  "source_url": null,
  "source": "public-reference",
  "refusal": "ok",
  "remote_safety": {
    "public_web_url": null,
    "scheme": null,
    "ip_literal_detected": null,
    "redirects_checked": null,
    "fetched": null,
    "scripts_ignored": null,
    "prompt_injection_detected": null
  },
  "macrostructure": "Marquee Hero",
  "macrostructure_alt": "Narrative Workflow (illustrated story, not literal numbered workflow)",
  "hero": {
    "archetype": "H1-Marquee",
    "knobs": { "alignment": "centered", "display": "dominant serif lettering", "background": "illustrated ink field" }
  },
  "pitch": {
    "archetype": "F4-Step sequence (closest fit)",
    "knobs": { "stages": "sequential illustrated scenes", "numbering": "none", "pacing": "scroll-led" }
  },
  "nav": {
    "archetype": "N9-Edge aligned minimal (closest fit)",
    "knobs": { "left": "brand marks", "right": "persistent two-mode switch", "border": "irregular outline" }
  },
  "footer": {
    "archetype": "Ft1-Mast headed",
    "knobs": { "left": "brand marks", "right": "contact and credits", "surface": "ink" }
  },
  "display_role": "roman editorial serif with expressive custom-lettering appearance",
  "display_face": null,
  "body_role": "neutral grotesque",
  "body_face": null,
  "label_role": "uppercase grotesque",
  "label_face": null,
  "pairing_logic": "contrasting serif display and sans-serif labels; exact family count unknown",
  "paper_band": "dark <30 in intro, alternating light >85 story regions",
  "paper_value": null,
  "paper_hue": "neutral; exact warmth unverified",
  "accent_hue_band": "warm-red",
  "accent_value": null,
  "accent_footprint": "small in intro; flood >15% in collection",
  "density": "generous composition with dense illustration texture",
  "asymmetry": "centered display with layered and changing artwork composition",
  "treatments": ["grain", "hatching", "irregular outlines", "foreground/background depth", "large type behind product"],
  "reveal": "scroll-led scene and viewpoint changes observed in browser; exact easing unknown",
  "motion_library": null,
  "anti_patterns": [],
  "evidence_url": "https://santionispirits.com/",
  "limits": "Screenshot-based fallback after text-only retrieval exposed a JS shell. Motion behavior observed by UI actions, not a recording or performance measurement. Sound, mobile behavior, exact fonts, exact colors, rendering technology, shader implementation, and full accessibility were not verified."
}
```

## Scope and next decision

No application source changes, generated assets, shaders, dependency installations, or locked design.md were produced in this pass. This file supplements the previous audit rather than replacing its findings or claiming implementation.

Hallmark Study pauses after this diagnosis for confirmation. Next decision: use Technical Noir on Replay, or keep the light workspace and borrow only Santioni's illustration/typographic personality. A portable design.md is available only if explicitly requested with “lock the DNA.”
