import type { ReactNode } from 'react';
import { Binary, Cpu, ShieldCheck } from '@phosphor-icons/react';
import Wordmark from '@/components/common/Wordmark';

const POINTS = [
  { icon: Cpu, text: 'Identify the modulation from a raw IQ recording' },
  { icon: ShieldCheck, text: 'Synchronize, demodulate and correct errors' },
  { icon: Binary, text: 'Inspect the recovered bits and their correlation' },
];

/** Split screen: the form on white, a brand panel in orange. The panel is decorative and hidden on small screens. */
export default function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" width={44} height={44} className="size-11 object-contain" />
          <Wordmark className="font-display text-[20px] tracking-[-0.01em]" />
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[36px] leading-[1.08] tracking-[-0.02em]">{title}</h1>
          <p className="mt-3 text-[15px] text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-center text-[14px] text-muted-foreground">{footer}</p>
        </div>

        <p className="text-center text-[12.5px] text-muted-foreground">Accounts are stored in this browser only.</p>
      </main>

      <aside className="relative hidden overflow-hidden bg-[oklch(0.55_0.13_46)] text-white lg:block" aria-hidden>
        <svg className="absolute -bottom-40 -end-40 size-[760px] text-white" viewBox="0 0 760 760" fill="none">
          {[90, 150, 210, 270, 330, 390].map((r, i) => (
            <circle key={r} cx="380" cy="380" r={r} stroke="currentColor" strokeOpacity={0.34 - i * 0.04} strokeWidth="1.5" />
          ))}
          <path d="M0 380 C 95 250, 190 250, 285 380 S 475 510, 570 380 S 665 250, 760 380" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
        </svg>

        <div className="relative flex h-full flex-col justify-between p-14">
          <p className="text-[12px] font-medium tracking-[0.1em] text-white/75 uppercase">RF signal analysis</p>
          <div>
            <h2 className="max-w-[14ch] font-display text-[52px] leading-[1.05] tracking-[-0.02em]">From raw IQ to recovered bits.</h2>
            <ul className="mt-9 max-w-[38ch] space-y-4">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-[15px] leading-snug text-white/90">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/15"><Icon weight="bold" className="size-4" /></span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
