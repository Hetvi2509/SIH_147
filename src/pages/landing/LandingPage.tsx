import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, SignIn } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import Wordmark from '@/components/common/Wordmark';
import { useAuth } from '@/context/AuthContext';
import HeroPreview from './HeroPreview';
import { FAMILIES, FEATURES, IO, PIPELINE, STATS } from './content';

const NAV = [
  { href: '#pipeline', label: 'Pipeline' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#modulations', label: 'Modulations' },
  { href: '#formats', label: 'Inputs and outputs' },
];

function Section({ id, kicker, title, lead, children }: { id: string; kicker: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-[1160px] px-6">
        <p className="label-caps text-primary">{kicker}</p>
        <h2 className="mt-3 max-w-[22ch] text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[44px]">{title}</h2>
        {lead && <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-muted-foreground">{lead}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

function IconTile({ icon: Icon, className = '' }: { icon: typeof ArrowRight; className?: string }) {
  return (
    <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary ${className}`}>
      <Icon weight="duotone" className="size-[22px]" />
    </span>
  );
}

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between gap-6 px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="TarangChakra home">
            <img src="/logo.png" alt="" width={40} height={40} className="size-10 object-contain" />
            <Wordmark className="font-display text-[20px] tracking-[-0.01em]" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild><Link to="/dashboard">Open dashboard <ArrowRight weight="bold" /></Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="max-sm:hidden"><Link to="/login">Sign in</Link></Button>
                <Button asChild><Link to="/signup">Get started</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <div className="relative overflow-hidden">
          <svg className="pointer-events-none absolute -top-40 -end-56 size-[820px] text-primary" viewBox="0 0 820 820" fill="none" aria-hidden>
            {[110, 180, 250, 320, 390].map((r, i) => (
              <circle key={r} cx="410" cy="410" r={r} stroke="currentColor" strokeOpacity={0.2 - i * 0.032} strokeWidth="1.5" />
            ))}
          </svg>

          <section className="relative mx-auto max-w-[1160px] px-6 pb-20 pt-16 sm:pt-24">
            <div className="max-w-[820px]">
              <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-accent-foreground">
                <span className="size-1.5 rounded-full bg-primary" /> RF signal intelligence platform
              </p>
              <h1 className="mt-6 text-[44px] leading-[1.04] tracking-[-0.025em] sm:text-[68px]">
                From raw radio signal to <span className="text-primary">recovered data</span>.
              </h1>
              <p className="mt-6 max-w-[62ch] text-[18px] leading-relaxed text-muted-foreground sm:text-[20px]">
                An intelligent, end-to-end platform for automated radio signal analysis, modulation recognition, demodulation, and reliable data recovery.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {user ? (
                  <Button asChild size="lg" className="h-12 px-6 text-[15px]"><Link to="/dashboard">Open dashboard <ArrowRight weight="bold" /></Link></Button>
                ) : (
                  <>
                    <Button asChild size="lg" className="h-12 px-6 text-[15px]"><Link to="/signup">Create free account <ArrowRight weight="bold" /></Link></Button>
                    <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[15px]"><Link to="/login"><SignIn /> Sign in</Link></Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-16">
              <HeroPreview />
            </div>
          </section>
        </div>

        {/* Stats */}
        <div className="border-y border-border bg-card">
          <dl className="mx-auto grid max-w-[1160px] grid-cols-2 gap-y-6 px-6 py-10 sm:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={s.label} className={`px-2 text-center sm:px-6 ${i > 0 ? 'sm:border-s sm:border-border' : ''}`}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="display-num text-[44px] text-primary">{s.value}</dd>
                <p className="mt-2 text-[14px] text-muted-foreground" aria-hidden>{s.label}</p>
              </div>
            ))}
          </dl>
        </div>

        {/* Pipeline */}
        <Section
          id="pipeline"
          kicker="How it works"
          title="One pipeline, from IQ samples to a report."
          lead="Every stage feeds the next. Load a recording once and follow the result through identification, recovery and reporting."
        >
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PIPELINE.map((s, i) => (
              <li key={s.title} className="group rounded-2xl bg-card p-6 smooth-shadow-ring-xs transition-[box-shadow] duration-150 hover:smooth-shadow-ring-md">
                <div className="flex items-start justify-between">
                  <IconTile icon={s.icon} />
                  <span className="display-num text-[15px] text-muted-foreground/70">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-5 text-[20px] leading-tight tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Capabilities */}
        <div className="bg-card">
          <Section
            id="capabilities"
            kicker="Capabilities"
            title="Everything an RF analyst checks, in one place."
            lead="Identify the signal, prove the recovery, and keep the evidence."
          >
            <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <IconTile icon={f.icon} />
                  <h3 className="mt-5 text-[20px] leading-tight tracking-[-0.01em]">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Modulations */}
        <Section
          id="modulations"
          kicker="Modulation coverage"
          title="Fourteen classes across digital and analog schemes."
          lead="The classifier scores every class on each recording, so a close runner-up is visible instead of hidden."
        >
          <div className="grid gap-x-8 gap-y-8 rounded-2xl bg-card p-8 smooth-shadow-ring-xs sm:grid-cols-2 lg:grid-cols-3">
            {FAMILIES.map((f) => (
              <div key={f.name}>
                <p className="label-caps">{f.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.items.map((m) => (
                    <span key={m} className="rounded-full bg-secondary px-3.5 py-1.5 text-[13.5px] font-medium">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Formats */}
        <div className="bg-card">
          <Section id="formats" kicker="Inputs and outputs" title="Bring a recording. Take away the evidence.">
            <div className="grid gap-6 lg:grid-cols-2">
              {([['Accepted inputs', IO.inputs], ['What you get back', IO.outputs]] as const).map(([title, items]) => (
                <div key={title} className="rounded-2xl bg-background p-6 smooth-shadow-ring-xs">
                  <h3 className="text-[20px] tracking-[-0.01em]">{title}</h3>
                  <ul className="mt-5 divide-y divide-border/70">
                    {items.map((it) => (
                      <li key={it.title} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                        <IconTile icon={it.icon} className="size-10" />
                        <div>
                          <p className="text-[15px] font-medium">{it.title}</p>
                          <p className="text-[13.5px] text-muted-foreground">{it.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Call to action */}
        <section className="px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-[1112px] overflow-hidden rounded-[28px] bg-[oklch(0.24_0.02_50)] px-8 py-14 text-center text-white sm:px-16 sm:py-20">
            <h2 className="mx-auto max-w-[20ch] text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[48px]">Analyze your first recording today.</h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-[16px] leading-relaxed text-white/70">
              Create an account, drop in an IQ file, and follow it from modulation recognition to recovered bits.
            </p>
            <ul className="mx-auto mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] text-white/80">
              {['Automated classification', 'Synchronization and demodulation', 'PDF, CSV and JSON export'].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle weight="fill" className="size-4 text-primary" /> {t}</li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-[15px]">
                <Link to={user ? '/dashboard' : '/signup'}>{user ? 'Open dashboard' : 'Create free account'} <ArrowRight weight="bold" /></Link>
              </Button>
              {!user && (
                <Button asChild size="lg" variant="ghost" className="h-12 px-6 text-[15px] text-white hover:bg-white/10 hover:text-white">
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={32} height={32} className="size-8 object-contain" />
            <Wordmark className="font-display text-[17px]" />
          </div>
          <p className="text-[13px] text-muted-foreground">Automated radio signal analysis, modulation recognition and data recovery.</p>
        </div>
      </footer>
    </div>
  );
}
