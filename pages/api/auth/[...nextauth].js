// pages/api/auth/[...nextauth].js
// Refresh token αποθηκευμένο στο KV (Upstash) → συγκατάθεση μία φορά, χωρίς prompt:'consent'.
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}
const RT_KEY = (email) => `refresh:${email}`;

async function saveRefresh(email, rt) {
  if (!email || !rt) return;
  try { await getKV().set(RT_KEY(email), rt); } catch (e) { console.error('saveRefresh', e.message); }
}
async function loadRefresh(email) {
  if (!email) return null;
  try { return await getKV().get(RT_KEY(email)); } catch (e) { console.error('loadRefresh', e.message); return null; }
}

async function refreshAccessToken(token) {
  try {
    let refreshToken = token.refreshToken || (await loadRefresh(token.email));
    if (!refreshToken) throw new Error('No refresh token available');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const refreshed = await response.json();
    if (!response.ok) throw refreshed;
    if (refreshed.refresh_token) { await saveRefresh(token.email, refreshed.refresh_token); refreshToken = refreshed.refresh_token; }
    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',
          // Το prompt:'consent' αφαιρέθηκε: συγκατάθεση μία φορά. Το refresh token
          // αποθηκεύεται στο KV και επαναχρησιμοποιείται στις επόμενες συνδέσεις.
        },
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  jwt: { maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn() { return true; },
    async jwt({ token, account, user, profile }) {
      if (account) {
        const email = user?.email || profile?.email || token.email || null;
        let refreshToken = account.refresh_token;
        if (refreshToken) await saveRefresh(email, refreshToken);
        else refreshToken = await loadRefresh(email);
        return {
          ...token,
          email,
          accessToken: account.access_token,
          refreshToken: refreshToken || token.refreshToken,
          accessTokenExpires: Date.now() + account.expires_in * 1000,
          error: undefined,
        };
      }
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 5 * 60 * 1000) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
export default NextAuth(authOptions);
