/* eslint-disable @next/next/no-img-element -- small static SVGs, nothing for next/image to optimize */

// The app's name and art, on the stone above the sign-in and setup forms, optionally with a line on
// what the form below is for
export default function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="pane-inset pb-4 text-center flex flex-col items-center">
      <img src="/hobbit-hole.svg" alt="" className="w-full max-w-xs h-auto" />
      <img src="/title-text.svg" alt="Concerning Habits" className="w-full max-w-xs h-auto mt-2" />
      <img src="/plant-icon.svg" alt="" className="w-12 h-auto -mt-2" />
      {subtitle && <p className="text-ink-muted mt-8 font-medium">{subtitle}</p>}
    </div>
  );
}
