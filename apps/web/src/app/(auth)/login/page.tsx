'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const loginSchema = z.object({
  tenantSlug: z.string().min(1, 'Organization ID required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, setUser, isAuthenticated } = useAuthStore();

  // Already logged in → go to dashboard
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await axios.post<{
        data: { accessToken: string; refreshToken: string };
      }>(`${API_URL}/auth/login`, data);

      const { accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);

      // Decode user from JWT payload (middle part)
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1])) as {
          sub: string;
          tenantId: string;
          role: string;
        };
        setUser({ id: payload.sub, tenantId: payload.tenantId, role: payload.role });
      } catch { /* ignore decode errors */ }

      toast.success('Welcome back!');
      const from = searchParams.get('from') ?? '/dashboard';
      router.push(from);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Invalid credentials';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-900">Veritas</span>
          </div>
        </div>

        <div className="card">
          <h1 className="text-base font-semibold text-slate-900 mb-1">Sign in</h1>
          <p className="text-xs text-slate-500 mb-5">
            Access your organization's integrity dashboard
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Organization ID</label>
              <input
                {...register('tenantSlug')}
                className="input"
                placeholder="e.g. demo-hospital"
                autoComplete="organization"
              />
              {errors.tenantSlug && (
                <p className="text-xs text-red-500 mt-1">{errors.tenantSlug.message}</p>
              )}
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                className="input"
                type="email"
                placeholder="you@organization.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Demo credentials</p>
            <p className="text-xs text-slate-400 font-mono">Org: demo-hospital</p>
            <p className="text-xs text-slate-400 font-mono">Email: admin@demo-hospital.com</p>
            <p className="text-xs text-slate-400 font-mono">Pass: Admin@Veritas123!</p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Enterprise Document Integrity Infrastructure
        </p>
      </div>
    </div>
  );
}
