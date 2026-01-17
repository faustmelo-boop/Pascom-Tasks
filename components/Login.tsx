import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, Check } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' 
        ? 'E-mail ou senha incorretos.' 
        : 'Ocorreu um erro ao tentar entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-sans">
      
      {/* Left Side - Full Image Cover */}
      <div className="hidden md:block w-1/2 relative overflow-hidden bg-gray-100">
        <img 
            src="https://i.imgur.com/ynBYspt.png" 
            alt="Gestão de Tarefas Pascom" 
            className="absolute inset-0 w-full h-full object-cover" 
        />
        {/* Subtle overlay to ensure the image integrates well if it has transparency or plain white bg */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
            
            {/* Logo on Top */}
            <div className="flex flex-col items-center mb-8">
                <img src="https://i.imgur.com/ofoiwCd.png" alt="Pascom Logo" className="h-20 w-auto object-contain mb-4" />
                <h1 className="text-2xl font-bold text-gray-800 uppercase tracking-wider">Login</h1>
                <p className="text-sm text-gray-500 mt-1">Acesse sua conta Pascom Tasks</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                {error && (
                    <div className="bg-red-50 text-red-500 text-sm p-3 rounded-lg text-center font-medium animate-pulse border border-red-100">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-700 ml-1 mb-1 block uppercase">E-mail</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white text-gray-900 px-5 py-3.5 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm placeholder-gray-500 font-medium"
                            placeholder="seu@email.com"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 ml-1 mb-1 block uppercase">Senha</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white text-gray-900 px-5 py-3.5 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm placeholder-gray-500 font-medium"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div 
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400 group-hover:border-blue-500'}`}
                            onClick={() => setRememberMe(!rememberMe)}
                        >
                            {rememberMe && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-gray-600 font-medium select-none" onClick={() => setRememberMe(!rememberMe)}>Lembrar de mim</span>
                    </label>
                    <a href="#" className="text-blue-600 font-semibold hover:underline">Esqueceu a Senha?</a>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-wide text-sm"
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
                </button>
            </form>

            <div className="mt-8 text-center">
                <p className="text-gray-600 text-sm font-medium">
                    Não tem uma conta? <a href="#" className="text-blue-600 font-bold hover:underline">Inscrever-se</a>
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};