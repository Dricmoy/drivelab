// Rendering uses sRGB values; CSS UI tokens express the same semantic roles in OKLCH.
export const scenePalette = {
  ground: '#191b1c', road: '#3d4142', grid: '#282c2d', gridMajor: '#343839',
  lane: '#ded7c7', selected: '#8fdae1', alternative: '#e6bd78',
  feasible: '#93bfae', rejected: '#ee9b8f', inspected: '#d9c7f1',
  traffic: '#c2bcae', glass: '#263b42', paper: '#efe8d8',
  tire: '#101314', trim: '#252b2d', rim: '#cbd2d0',
} as const;
