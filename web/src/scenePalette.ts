// Rendering uses sRGB values; CSS UI tokens express the same semantic roles in OKLCH.
export const scenePalette = {
  ground: '#191715', road: '#403d38', grid: '#282521', gridMajor: '#34302b',
  lane: '#ded7c7', selected: '#ffa282', alternative: '#eabc6e',
  feasible: '#8bd4a5', rejected: '#ff958e', inspected: '#efebe1',
  traffic: '#c2bcae', glass: '#272521', paper: '#efe8d8',
  tire: '#11100f', trim: '#292622', rim: '#cbc5b8',
  fleet: ['#d4cec0', '#77766e', '#8b9392', '#6f776b', '#80635d', '#b9aa8a'],
  sidewalk: '#777166', building: '#4c4942', rooftop: '#686157', window: '#a89d85',
} as const;

export function vehiclePaint(id: string, ego: boolean) {
  if (ego) return scenePalette.selected;
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return scenePalette.fleet[(hash >>> 0) % scenePalette.fleet.length];
}
