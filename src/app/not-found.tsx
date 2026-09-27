import Link from 'next/link';
import { ArrowLeft, Map } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <Map className="w-10 h-10 text-stone-500" />
        </div>
        
        <h1 className="text-4xl font-bold text-stone-900">404</h1>
        <h2 className="text-xl font-semibold text-stone-800">Page Not Found</h2>
        
        <p className="text-stone-600">
          The habit or page you are looking for doesn't exist, or it might have been deleted.
        </p>

        <div className="pt-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
