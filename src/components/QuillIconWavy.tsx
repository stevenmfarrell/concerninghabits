export default function QuillIconWavy({ className = "", strokeWidth }: { className?: string, strokeWidth?: number | string }) {
  const resolvedStrokeWidth = strokeWidth || 2;

  return (
    <svg 
      className={className} 
      viewBox="-2 -2 28 28" 
      fill="none"
      stroke="currentColor"
      strokeWidth={resolvedStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M 14.086 18.412 A 2 2 0 0 1 12.67 19 H 5 V 11.328 A 2 2 0 0 1 5.586 9.914 L 11.75 3.75 a 6.003 6.003 0 1 1 8.49 8.49 z" />
      
      {/* Spine continuing continuously into a lower frequency, higher amplitude wavy line */}
      <path d="M 16 8 L 0 24 q 2.625 -3 5.25 0 t 5.25 0 q 2.625 -3 5.25 0 t 5.25 0" />
      
      {/* Pair 1: One third to spine. Pulled slightly inward. */}
      <path d="M 20.4 11 H 18.5" />
      <path d="M 13 3.6 V 5.5" />

      {/* Pair 2: One third to spine. Pulled slightly inward. */}
      <path d="M 16.7 15 H 14.7" />
      <path d="M 9 7.3 V 9.3" />
    </svg>
  );
}
