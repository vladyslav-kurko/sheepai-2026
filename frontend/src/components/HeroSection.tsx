import { useState, useEffect } from 'react';

interface Props {
  visible?: boolean;
}

const PHRASES = [
  'osobnu iskaznicu?',
  'OIB?',
  'vozačku dozvolu?',
  'registraciju obrta?',
  'putovnicu?',
  'rodni list?',
  'domovnicu?',
];

const PREFIX = 'Trebate ';

export default function HeroSection({ visible = true }: Props) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'deleting'>('typing');

  useEffect(() => {
    const phrase = PHRASES[index];

    if (phase === 'typing') {
      if (displayed.length < phrase.length) {
        const t = setTimeout(
          () => setDisplayed(phrase.slice(0, displayed.length + 1)),
          68,
        );
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('deleting'), 1800);
      return () => clearTimeout(t);
    }

    if (displayed.length > 0) {
      const t = setTimeout(() => setDisplayed((d) => d.slice(0, -1)), 38);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % PHRASES.length);
      setPhase('typing');
    }, 350);
    return () => clearTimeout(t);
  }, [displayed, phase, index]);

  return (
    <section className={`card__hero${visible ? '' : ' card__hero--out'}`}>
      <h1 className="card__title">Uredi svoje papire.</h1>
      <p className="card__typewriter">
        {PREFIX}
        <span className="card__typed">{displayed}</span>
        <span className="card__cursor" aria-hidden="true" />
      </p>
      <p className="card__desc">
        Samo pitajte — dobijete jasne korake, rokove i kontakte.
      </p>
    </section>
  );
}
