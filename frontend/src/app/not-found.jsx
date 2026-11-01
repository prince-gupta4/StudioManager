import Link from "next/link";
import { ArrowLeft, Clapperboard } from "lucide-react";

export default function NotFound() {
  return <main className="not-found-page">
    <div className="not-found-brand">
      <div className="brand-mark"><Clapperboard size={20} strokeWidth={2.2} /></div>
      <span>reelmanager</span>
    </div>
    <section className="not-found-content">
      <p className="eyebrow"><span className="eyebrow-line" /> PAGE NOT FOUND</p>
      <h1>Looks like this scene got cut.</h1>
      <p>The page you’re looking for doesn’t exist or may have moved. Check the address, or head back to your workspace.</p>
      <Link className="button button-primary" href="/"><ArrowLeft size={16} /> Back to workspace</Link>
      <span className="not-found-code" aria-hidden="true">404</span>
    </section>
  </main>;
}
