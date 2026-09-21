'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useMunicipio } from '@/components/MunicipioProvider';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const municipio = useMunicipio();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Autenticar con Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (data.user) {
        // Login exitoso
        onLoginSuccess();
      }
    } catch (err: unknown) {
      console.error('Error de autenticación:', err);
      
      // Mensajes de error personalizados
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      if (errorMessage.includes('Invalid login credentials')) {
        setError('Email o contraseña incorrectos');
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Email no verificado. Contacta al administrador del sistema');
      } else {
        setError(errorMessage || 'Error al iniciar sesión');
      }
      
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#076633] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
      
      <div className="relative w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-lg rounded-3xl mb-4 shadow-2xl">
            <ShieldCheck className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Panel Administrativo
          </h1>
          <p className="text-white/90">
            {municipio.nombre}
          </p>
        </div>

        {/* Formulario de Login */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Iniciar Sesión
            </h2>
            <p className="text-gray-600">
              Acceso exclusivo para personal de Recursos Humanos
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder-gray-400"
                  placeholder="tu-email@municipio.gob.ar"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder-gray-400"
                  placeholder="Ingrese su contraseña"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Botón de Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#b6c544] hover:bg-[#9fb338] text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Acceder al Panel</span>
                </>
              )}
            </button>
          </form>

          {/* Info adicional */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              Sistema de gestión de fichadas v2.0
              <br />
              <span className="text-gray-400">Para soporte contactar a sistemas</span>
            </p>
          </div>
        </div>

        {/* Link de regreso */}
        <div className="text-center mt-6">
          <Link
            href={`/m/${municipio.slug}`}
            className="text-white/80 hover:text-white text-sm font-medium transition"
          >
            ← Volver al registro de fichadas
          </Link>
        </div>
      </div>
    </div>
  );
}
