// ============================================================
// Conversational assistant widget — floating chat over the
// current analysis (data, graphs, classification, BER, ...)
// ============================================================

import { useRef, useState, useEffect } from 'react';
import { ChatCircleDots, X as XIcon, PaperPlaneRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAnalysis } from '@/context/AnalysisContext';
import { sendChatMessage, type ChatMessage } from '@/services/chatService';

const LAUNCHER_LABEL = 'Ask TarangChakra';
const AUTO_COLLAPSE_MS = 3200;

export default function ChatWidget() {
  const { state } = useAnalysis();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Ask me anything about this signal's data, graphs, or results." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Launcher label: pops out on mount, auto-collapses to an icon-only bubble, and
  // re-expands on hover — mirrors the "Ask Samvaad" chat launcher.
  const [labelExpanded, setLabelExpanded] = useState(true);
  const [revealKey, setRevealKey] = useState(0);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    collapseTimer.current = setTimeout(() => setLabelExpanded(false), AUTO_COLLAPSE_MS);
    return () => clearTimeout(collapseTimer.current);
  }, []);

  function expandLabel() {
    clearTimeout(collapseTimer.current);
    setRevealKey((k) => k + 1);
    setLabelExpanded(true);
  }
  function scheduleLabelCollapse() {
    clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setLabelExpanded(false), 400);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const reply = await sendChatMessage(next, state);
      // Belt-and-suspenders: the model is told not to use markdown, but strip stray
      // ** emphasis markers if it slips one in — this bubble renders plain text only.
      setMessages((m) => [...m, { role: 'assistant', content: reply.replace(/\*\*(.+?)\*\*/g, '$1') }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseEnter={expandLabel}
        onMouseLeave={scheduleLabelCollapse}
        aria-label="Open assistant"
        className={cn(
          'animate-launcher-pop fixed bottom-6 right-6 z-50 flex h-14 items-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg transition-[box-shadow,transform,opacity] duration-300 ease-out',
          'hover:scale-105 hover:shadow-xl',
          open ? 'pointer-events-none scale-75 opacity-0' : 'scale-100 opacity-100',
        )}
      >
        <span
          className="grid overflow-hidden transition-[grid-template-columns] duration-300 ease-out"
          style={{ gridTemplateColumns: labelExpanded ? '1fr' : '0fr' }}
        >
          <span className="min-w-0 overflow-hidden">
            <span key={revealKey} className="flex items-center whitespace-nowrap pl-5 pr-1 text-sm font-semibold">
              {[...LAUNCHER_LABEL].map((ch, i) => (
                <span
                  key={i}
                  className="animate-letter-in inline-block"
                  style={{ animationDelay: `${i * 18}ms` }}
                >
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))}
            </span>
          </span>
        </span>
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center">
          <ChatCircleDots className="size-7" />
        </span>
      </button>

      <div
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden',
          'origin-bottom-right rounded-lg border bg-card shadow-xl transition-all duration-200 ease-out',
          open
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-3 scale-90 opacity-0',
        )}
      >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
          <div>
            <p className="text-sm font-semibold">Tarang Bot</p>
            <p className="text-xs text-muted-foreground">Grounded in the current run</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close assistant">
          <XIcon className="size-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                m.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground',
              )}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="max-w-[85%] rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
              Thinking…
            </div>
          )}
        </div>
      </div>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the SNR, spectrum, BER…"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          disabled={sending}
        />
        <Button type="submit" size="icon-sm" disabled={sending || !input.trim()} aria-label="Send">
          <PaperPlaneRight className="size-4" />
        </Button>
      </form>
      </div>
    </>
  );
}
