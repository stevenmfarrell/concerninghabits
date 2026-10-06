// One of the single-color SVGs in public/ (the hobbit hole, the title, the plant), drawn in the
// theme's ink color. As an <img> it would stay black, invisible in dark mode, so the SVG is used
// as a mask over an ink fill instead. `aspect` is the SVG's width / height (from its viewBox), and
// the size comes from a width in `className`.
export default function InkArt({ src, aspect, alt, className = '' }: { src: string; aspect: number; alt?: string; className?: string }) {
  const mask = `url(${src}) center / contain no-repeat`;
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
      className={`block bg-ink ${className}`}
      style={{ aspectRatio: aspect, mask, WebkitMask: mask }}
    />
  );
}
