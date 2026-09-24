import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SpinnerGap } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { AuthError } from '@/lib/auth';
import Field from '@/components/auth/PasswordField';
import AuthLayout from './AuthLayout';

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await signIn({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AuthError && err.field) setErrors({ [err.field]: err.message });
      else setErrors({ password: 'Something went wrong. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your analysis."
      footer={<>New to TarangChakra? <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Email" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" autoFocus placeholder="you@lab.org" disabled={busy} />
        <Field label="Password" type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" disabled={busy} />
        <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={busy}>
          {busy && <SpinnerGap className="animate-spin" />}
          {busy ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
