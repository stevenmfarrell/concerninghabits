export default function QuillIconSimple({ className = "", strokeWidth }: { className?: string, strokeWidth?: number | string }) {
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
      <path d="M 16 8 L 0.5 23.5" />
      
      {/* Ink line shifted right and down for spacing */}
      <path d="M 7 23.5 H 21.5" />
    </svg>
  );
}
