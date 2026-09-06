import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function syncUserToBackend(user: { id: string; name?: string | null; email?: string | null; image?: string | null }) {
  try {
    await fetch(`${API_BASE_URL}/api/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleId: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.image,
      }),
    });
  } catch (err) {
    console.warn('[NextAuth] Could not sync user to backend:', (err as Error).message);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      id: 'demo-login',
      name: 'Demo Evaluation Session',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'demo@reachinbox.test' },
        name: { label: 'Name', type: 'text', placeholder: 'Alex Mercer' },
      },
      async authorize(credentials) {
        const email = credentials?.email || 'alex.mercer@reachinbox.test';
        const name = credentials?.name || 'Alex Mercer';
        const user = {
          id: 'demo-user-id',
          name,
          email,
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
        };
        await syncUserToBackend(user);
        return user;
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        await syncUserToBackend(user);
      }
      return true;
    },
    async session({ session, token }) {
      if (session?.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'reachinbox-scheduler-super-secret-jwt-key-2026',
};
