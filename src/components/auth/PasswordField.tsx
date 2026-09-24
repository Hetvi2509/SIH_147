import { useId, useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  disabled?: boolean;
}

/** Label, input and inline error in one unit. `type="password"` adds a show/hide toggle. */
export default function Field({ label, value, onChange, error, hint, autoComplete, autoFocus, type = 'text', placeholder, disabled }: FieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13.5px] font-medium">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && shown ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn('h-11 rounded-lg bg-card text-[15px] smooth-shadow-ring-xs border-0', isPassword && 'pe-11', error && 'ring-2 ring-destructive/40')}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-lg text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-primary"
          >
            {shown ? <EyeSlash className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[13px] text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
