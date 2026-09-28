'use client';

import { useEffect } from 'react';

export default function SWUnregister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);
  
  return null;
}
