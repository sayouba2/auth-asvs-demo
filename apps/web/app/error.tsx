'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="welcome"><h1>Un instant, s’il vous plaît.</h1>
    <p>Le service est momentanément indisponible.</p>
    <button className="primary" onClick={reset}>Réessayer</button></section>;
}
