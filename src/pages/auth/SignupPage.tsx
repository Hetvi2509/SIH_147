import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SpinnerGap } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { AuthError } from '@/lib/auth';
import Field from '@/components/auth/PasswordField';
import AuthLayout from './AuthLayout';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirm', string>>;

export default function SignupPage() {
  const { user, signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setErrors({ confirm: 'Passwords do not match.' }); return; }
    setErrors({});
    setBusy(true);
    try {
      await signUp({ name, email, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof AuthError && err.field) setErrors({ [err.field]: err.message });
      else setErrors({ email: 'Something went wrong. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up a workspace for your signal analysis."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Full name" value={name} onChange={setName} error={errors.name} autoComplete="name" autoFocus placeholder="Asha Verma" disabled={busy} />
        <Field label="Email" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" placeholder="you@lab.org" disabled={busy} />
        <Field label="Password" type="password" value={password} onChange={setPassword} error={errors.password} hint="At least 8 characters." autoComplete="new-password" disabled={busy} />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" disabled={busy} />
        <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={busy}>
          {busy && <SpinnerGap className="animate-spin" />}
          {busy ? 'Creating account' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
