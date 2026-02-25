import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { ALLOWED_EMAILS } from '../../../lib/config';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    })
  ],
  // Session 30 ημερών — δεν ζητά ξανά login
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 μέρες σε seconds
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 μέρες σε seconds
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (ALLOWED_EMAILS.includes(email)) {
        return true;
      }
      return false;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
};

export default NextAuth(authOptions);
