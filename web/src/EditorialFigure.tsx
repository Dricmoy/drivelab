import { useState } from 'react';

const photographs = {
  geometry: {
    file: 'desert-intersection', width: 1200, height: 900,
    alt: 'An overhead view of a T-junction cutting through copper-colored desert sand.',
    title: 'Geometry, before motion.', photographer: 'Peter Orsel',
    url: 'https://unsplash.com/photos/ZOLzNqcxWvc',
  },
  motion: {
    file: 'night-motion', width: 1200, height: 1802,
    alt: 'Amber and white light trails follow a winding canyon road at night.',
    title: 'Motion, over time.', photographer: 'Jeffrey Clayton',
    url: 'https://unsplash.com/photos/h4qpoe_4VZY',
  },
} as const;

export default function EditorialFigure({ subject }: { subject: keyof typeof photographs }) {
  const photo = photographs[subject];
  const [failed, setFailed] = useState(false);
  return <figure className={`editorial-figure editorial-${subject}`}>
    <div className="editorial-image">
      {failed ? <div className="editorial-unavailable" role="status">Editorial photograph unavailable. Lab controls remain available.</div>
        : <img src={`/photography/${photo.file}.jpg`} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    </div>
    <figcaption><strong>{photo.title}</strong><span>Editorial photograph · not simulation output.</span><a href={photo.url} target="_blank" rel="noreferrer">Photo by {photo.photographer} ↗</a></figcaption>
  </figure>;
}
