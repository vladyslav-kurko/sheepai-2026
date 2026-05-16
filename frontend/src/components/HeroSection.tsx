import { SheepLogo } from './icons';

export default function HeroSection() {
  return (
    <section className="card__hero">
      <SheepLogo size={52} />
      <h1 className="card__title">Uredi svoje papire.</h1>
      <p className="card__tagline">Trebate osobnu iskaznicu? OIB? </p>
      <p className="card__tagline">Registraciju obrta?
        Vozačku? Putovnicu?</p>
      <p className="card__tagline">Samo pitajte —
        dobijete jasne korake, rokove i kontakte.</p>
      <p className="card__desc">
        Pitajte na hrvatskom ili engleskom —<br />
        dobijete jasan, korak-po-korak plan.
      </p>
    </section>
  );
}
