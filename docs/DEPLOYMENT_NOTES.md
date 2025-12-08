# Deployment Notes - Admin Panel & UploadThing

## Environment Variables

### Required for Admin Panel
```env
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000  # Dev
# NEXTAUTH_URL=https://yourdomain.com  # Production
```

### Required for UploadThing
```env
UPLOADTHING_SECRET=your-uploadthing-secret
UPLOADTHING_APP_ID=your-uploadthing-app-id

# Callback URL - MUST be publicly accessible
# For local development, use ngrok:
UPLOADTHING_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/uploadthing

# For production:
# UPLOADTHING_CALLBACK_URL=https://yourdomain.com/api/uploadthing
```

### API Gateway
```env
LOCAL_APIGATEWAY_URL=http://localhost:8080  # Dev
# LOCAL_APIGATEWAY_URL=https://api.yourdomain.com  # Production
```

## Local Development Setup

### 1. ngrok Setup (Required for UploadThing)

```bash
# Install ngrok
npm install -g ngrok
# or
brew install ngrok

# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Set it in your .env file:
UPLOADTHING_CALLBACK_URL=https://abc123.ngrok.io/api/uploadthing
```

**Important:** 
- ngrok URL changes every time you restart (unless using paid plan)
- Update `UPLOADTHING_CALLBACK_URL` in `.env` after each ngrok restart
- Use the HTTPS URL, not HTTP

### 2. Start Services

```bash
# Terminal 1: Start API Gateway
cd api-gateway
npm run dev

# Terminal 2: Start Auth Service
cd auth-service
npm run dev

# Terminal 3: Start Client
cd client
npm run dev

# Terminal 4: Start ngrok (if using UploadThing)
ngrok http 3000
```

## Production Deployment

### 1. Set Environment Variables

All environment variables must be set in your hosting platform (Vercel, Railway, etc.)

**Critical:**
- `UPLOADTHING_CALLBACK_URL` must be your production domain
- `NEXTAUTH_URL` must match your production domain
- All secrets must be strong and unique

### 2. Verify UploadThing Configuration

1. Go to UploadThing dashboard
2. Verify callback URL matches your production domain
3. Test upload functionality

### 3. Verify NextAuth Configuration

1. Ensure `NEXTAUTH_SECRET` is set and strong
2. Verify `NEXTAUTH_URL` matches your domain
3. Test admin login flow

## Testing Checklist

### Admin Panel
- [ ] Login as admin → dashboard loads immediately
- [ ] Navigate to users page → users list loads
- [ ] Navigate to reports page → reports load
- [ ] Logout → redirects to login
- [ ] Login again → no bouncing between pages

### UploadThing
- [ ] Upload image → completes successfully
- [ ] Check server logs → correlation IDs present
- [ ] Test with slow network → timeout handled
- [ ] Test with callback failure → retry works

## Troubleshooting

### Admin Pages Not Loading Data
1. Check browser console for errors
2. Verify `NEXTAUTH_SECRET` is set
3. Check TanStack Devtools → queries should have stable keys (no tokens)
4. Verify session exists: `useSession()` should return authenticated

### UploadThing Stuck on "Uploading..."
1. Check `UPLOADTHING_CALLBACK_URL` is publicly accessible
2. Verify ngrok is running (if local)
3. Check server logs for correlation IDs
4. Verify retry mechanism is working

### Session Expiration Issues
1. Check `NEXTAUTH_SECRET` is set correctly
2. Verify token refresh is working (check network tab)
3. Ensure cookies are being set (check Application tab)

## Monitoring

### Key Metrics to Monitor
- Admin login success rate
- Query execution time
- UploadThing success rate
- Session refresh failures

### Logs to Check
- `[UploadThing]` - Upload-related logs
- `[ApiClient]` - API request logs
- `AUTH_SIGNIN` / `AUTH_SIGNOUT` - Auth events
- `QUERY_AUTH_MISSING` - Query auth failures

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is strong and unique
- [ ] All environment variables are set
- [ ] HTTPS is enabled in production
- [ ] Cookies are HTTP-only and Secure
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled

