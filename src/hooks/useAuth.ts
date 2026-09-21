"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/utils";
import {
    isPlatformAdmin,
    userMunicipioId,
    userRol,
    type MunicipioRol,
} from "@/lib/tenant";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthState {
    user: User | null;
    session: Session | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    municipioId: string | null;
    rol: MunicipioRol | null;
    isPlatformAdmin: boolean;
}

function claimsFromUser(user: User | null) {
    return {
        municipioId: userMunicipioId(user),
        rol: userRol(user),
        isPlatformAdmin: isPlatformAdmin(user),
    };
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        municipioId: null,
        rol: null,
        isPlatformAdmin: false,
    });

    const checkSession = useCallback(async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) throw error;

            setState((prev) => ({
                ...prev,
                user: session?.user ?? null,
                session,
                isAuthenticated: !!session?.user,
                isLoading: false,
                error: null,
                ...claimsFromUser(session?.user ?? null),
            }));
        } catch (error) {
            logger.error("Error al verificar sesión:", error);
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: "Error al verificar la sesión",
            }));
        }
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            setState((prev) => ({
                ...prev,
                user: data.user,
                session: data.session,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                ...claimsFromUser(data.user),
            }));

            return { success: true };
        } catch (error: unknown) {
            logger.error("Error de autenticación:", error);

            let errorMessage = "Error al iniciar sesión";
            if (error instanceof Error) {
                if (error.message.includes("Invalid login credentials")) {
                    errorMessage = "Email o contraseña incorrectos";
                } else if (error.message.includes("Email not confirmed")) {
                    errorMessage = "Email no verificado. Contacta al administrador del sistema";
                } else {
                    errorMessage = error.message;
                }
            }

            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: errorMessage,
            }));

            return { success: false, error: errorMessage };
        }
    }, []);

    const signOut = useCallback(async () => {
        setState((prev) => ({ ...prev, isLoading: true }));

        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            setState({
                user: null,
                session: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
                municipioId: null,
                rol: null,
                isPlatformAdmin: false,
            });

            return { success: true };
        } catch (error) {
            logger.error("Error al cerrar sesión:", error);
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: "Error al cerrar sesión",
            }));
            return { success: false };
        }
    }, []);

    const clearError = useCallback(() => {
        setState((prev) => ({ ...prev, error: null }));
    }, []);

    useEffect(() => {
        checkSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === "SIGNED_IN" && session) {
                    setState((prev) => ({
                        ...prev,
                        user: session.user,
                        session,
                        isAuthenticated: true,
                        isLoading: false,
                        ...claimsFromUser(session.user),
                    }));
                } else if (event === "SIGNED_OUT") {
                    setState({
                        user: null,
                        session: null,
                        isAuthenticated: false,
                        isLoading: false,
                        error: null,
                        municipioId: null,
                        rol: null,
                        isPlatformAdmin: false,
                    });
                }
            }
        );

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, [checkSession]);

    return {
        ...state,
        signIn,
        signOut,
        clearError,
        checkSession,
    };
}

export default useAuth;
