import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, TABLES } from '../supabase';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import type { Usuario } from '../supabase';

type AuthContextType = {
  user: Usuario | null;
  loading: boolean;
  signUp: (nombre: string, apellido: string, usuario: string, gmail: string, contrasena: string) => Promise<void>;
  signIn: (gmail: string, contrasena: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const signUp = async (nombre: string, apellido: string, usuario: string, gmail: string, contrasena: string) => {
    try {
      const hashedPassword = await hashPassword(contrasena);

      // 1. Crear usuario en la tabla usuarios
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USUARIOS)
        .insert([{
          nombre,
          apellido,
          usuario,
          gmail,
          contrasena: hashedPassword
        }])
        .select()
        .single();

      if (userError) throw userError;

      // 2. Crear billetera para el usuario
      const { error: walletError } = await supabase
        .from(TABLES.BILLETERA)
        .insert([{
          usuario_id: userData.id,
          saldo: 0
        }]);

      if (walletError) {
        // Si falla la creación de la billetera, eliminar el usuario
        await supabase.from(TABLES.USUARIOS).delete().eq('id', userData.id);
        throw walletError;
      }

      setUser(userData);
    } catch (error) {
      console.error('Error en el registro:', error);
      throw error;
    }
  };

  const signIn = async (gmail: string, contrasena: string) => {
    try {
      const hashedPassword = await hashPassword(contrasena);

      // Buscar usuario por gmail y contraseña
      const { data: user, error } = await supabase
        .from(TABLES.USUARIOS)
        .select('*')
        .eq('gmail', gmail)
        .eq('contrasena', hashedPassword)
        .single();

      if (error) {
        throw new Error('Credenciales incorrectas');
      }

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      setUser(user);
    } catch (error) {
      console.error('Error en inicio de sesión:', error);
      throw error;
    }
  };

  const signOut = async () => {
    setUser(null);
  };

  useEffect(() => {
    if (!user && !loading) {
      router.replace('/auth/login');
    }
  }, [user, loading]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
