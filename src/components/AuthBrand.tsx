import InkArt from './ui/InkArt';

// The app's name and art, on the stone above the sign-in and setup forms, optionally with a line on
// what the form below is for
export default function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="pane-inset pb-4 text-center flex flex-col items-center">
      <InkArt src="/hobbit-hole.svg" aspect={446.05 / 97.79} className="w-full max-w-xs" />
      <InkArt src="/title-text.svg" aspect={514.91 / 226.49} alt="Concerning Habits" className="w-full max-w-xs mt-2" />
      <InkArt src="/plant-icon.svg" aspect={131.56 / 70.62} className="w-12 -mt-2" />
      {subtitle && <p className="text-ink-muted mt-8 font-medium">{subtitle}</p>}
    </div>
  );
}
