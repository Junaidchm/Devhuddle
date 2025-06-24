import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OAuthUser } from '../types/auth';
import logger from '../utils/logger.util';

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.CALLBACK_URL}/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const oauthUser: OAuthUser = {
          id: profile.id,
          email: profile.emails![0].value,
          username: profile.emails![0].value.split('@')[0],
          name: profile.displayName
        };
        done(null, oauthUser);
      } catch (err: any) {
        logger.error('Google OAuth error', { error: err.message });
        done(err);
      }
    }
  )
);

export default passport;