'use client';

import dynamic from 'next/dynamic';
import RefineLoading from './RefineLoading';

// The draft lives in sessionStorage, which doesn't exist on the server, so skip server rendering
// entirely: rendering it there would always differ from the browser's first render (a hydration mismatch).
const RefineClient = dynamic(() => import('./RefineClient'), { ssr: false, loading: () => <RefineLoading /> });

export default function RefineLoader({ weekStartsOn }: { weekStartsOn: string }) {
  return <RefineClient weekStartsOn={weekStartsOn} />;
}
