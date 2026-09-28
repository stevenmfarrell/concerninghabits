import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export default function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
      <ArrowLeft className="w-4 h-4" /> {children}
    </Link>
  );
}
