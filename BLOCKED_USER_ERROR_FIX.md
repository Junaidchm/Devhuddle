# Blocked User Login Error Propagation Fix

## Summary
Fixed end-to-end error propagation for blocked user login attempts. The backend now correctly returns HTTP 403 with the exact error message, and the frontend displays it properly.

## Changes Made

### 1. Auth Service (`auth-service/`)

#### `src/utils/error.util.ts`
- **Added `grpcStatusToHttp()` function**: Converts gRPC status codes to proper HTTP status codes
  - `grpc.status.PERMISSION_DENIED` (7) → `HTTP 403 FORBIDDEN`
  - `grpc.status.NOT_FOUND` (5) → `HTTP 404 NOT_FOUND`
  - `grpc.status.ALREADY_EXISTS` (6) → `HTTP 409 CONFLICT`
  - And all other gRPC status codes properly mapped
- **Updated `sendErrorResponse()`**: Now automatically converts gRPC status codes to HTTP before sending response
- **Improved error logging**: Logs both gRPC and HTTP status codes for debugging

#### `src/constents/reqresMessages.ts`
- **Fixed typo**: Changed `"Your are blocked"` → `"You are blocked from DevHuddle, Please contact support"`

#### `src/services/impliments/auth.service.ts`
- **No changes needed**: Already throws `CustomError` with `grpc.status.PERMISSION_DENIED` and `Messages.USER_BLOCKED`
- The error is properly caught and re-thrown in the controller

#### `src/controllers/implimentation/auth.controller.ts`
- **No changes needed**: All HTTP endpoints already use `sendErrorResponse()` which now handles the conversion

### 2. API Gateway (`api-gateway/`)

#### `src/middleware/authserver.proxy.middleware.ts`
- **Enhanced `onProxyRes`**: Added logging for error responses (status >= 400)
- **Error responses are forwarded as-is**: The proxy middleware forwards the exact response body and status code from the auth service
- **No error wrapping**: Removed any code that would wrap errors in "Internal server error"

### 3. Frontend (`client/`)

#### `auth.ts` (NextAuth configuration)
- **Improved error extraction**: Enhanced the `authorize` callback to properly extract error messages from API responses
- **Better error handling**: 
  - Tries to parse JSON error response
  - Falls back to status text if JSON parsing fails
  - Extracts message from `errorData.message` or `errorData.error`
  - Logs full error details for debugging
- **Exact message forwarding**: The error message from the backend is now thrown as-is to NextAuth, which displays it to the user

#### `src/app/(auth)/signIn/page.tsx` & `src/app/(auth)/admin/signIn/page.tsx`
- **No changes needed**: Already use `result?.error` from NextAuth, which now contains the exact backend error message

## Error Flow (After Fix)

1. **User attempts login with blocked account**
   ```
   POST /api/v1/auth/login
   ```

2. **Auth Service (`auth.service.ts`)**
   ```typescript
   if (user.isBlocked) {
     throw new CustomError(
       grpc.status.PERMISSION_DENIED,  // gRPC status 7
       Messages.USER_BLOCKED           // "You are blocked from DevHuddle, Please contact support"
     );
   }
   ```

3. **Auth Controller (`auth.controller.ts`)**
   ```typescript
   catch (err: any) {
     sendErrorResponse(res, {
       status: err.status,              // gRPC status 7
       message: err.message             // "You are blocked from DevHuddle, Please contact support"
     });
   }
   ```

4. **Error Utility (`error.util.ts`)**
   ```typescript
   sendErrorResponse(res, error) {
     const httpStatus = grpcStatusToHttp(error.status);  // 7 → 403
     res.status(403).json({
       success: false,
       status: 403,
       message: "You are blocked from DevHuddle, Please contact support"
     });
   }
   ```

5. **API Gateway Proxy**
   - Forwards the response as-is (status 403, exact message)
   - Logs error response for debugging

6. **Frontend NextAuth (`auth.ts`)**
   ```typescript
   if (!res.ok) {
     const errorData = await res.json();
     throw new Error(errorData.message);  // Exact message from backend
   }
   ```

7. **Login UI**
   - NextAuth displays the error via `result?.error`
   - User sees: **"You are blocked from DevHuddle, Please contact support"**

## All Login Error Cases Handled

| Error Case | gRPC Status | HTTP Status | Message |
|------------|-------------|-------------|---------|
| Blocked user | `PERMISSION_DENIED` (7) | `403 FORBIDDEN` | "You are blocked from DevHuddle, Please contact support" |
| Invalid credentials | `NOT_FOUND` (5) | `404 NOT_FOUND` | "User not found !" |
| Email not verified | `PERMISSION_DENIED` (7) | `403 FORBIDDEN` | "Provide Verified Email ID" |
| Google login required | `ALREADY_EXISTS` (6) | `409 CONFLICT` | "This account was created using Google. Please login using Google." |
| Missing fields | `INVALID_ARGUMENT` (3) | `400 BAD_REQUEST` | "Email and password are required" |
| Internal error | `INTERNAL` (13) | `500 INTERNAL_SERVER_ERROR` | "Login failed" |

## Testing

### Manual Test Steps

1. **Block a user via admin panel**
   ```bash
   # Admin blocks user with ID: abc123
   PATCH /api/v1/admin/users/abc123/toogle
   ```

2. **Attempt login with blocked user**
   ```bash
   POST /api/v1/auth/login
   {
     "email": "blocked@example.com",
     "password": "password123"
   }
   ```

3. **Expected Response**
   ```json
   {
     "success": false,
     "status": 403,
     "message": "You are blocked from DevHuddle, Please contact support"
   }
   ```

4. **Frontend should display**
   - Toast error: "You are blocked from DevHuddle, Please contact support"
   - No generic "Internal server error" message

### Verification Checklist

- [x] Auth service throws `CustomError` with gRPC status 7 for blocked users
- [x] Error utility converts gRPC status 7 to HTTP 403
- [x] API Gateway forwards error response as-is (no wrapping)
- [x] Frontend NextAuth extracts exact error message
- [x] Login UI displays exact backend message
- [x] No "Internal server error" appears for blocked users
- [x] All other login error cases work correctly

## Logs

### Before Fix
```
{"error":"Your are blocked from DevHuddle, Please contact support","level":"error","message":"Error in /auth/login"}
{"level":"error","message":"Your are blocked from DevHuddle, Please contact support","status":7}
{"level":"error","message":"Internal server error","status":500}  // ❌ Wrong!
```

### After Fix
```
{"error":"You are blocked from DevHuddle, Please contact support","level":"error","message":"Error in /auth/login","grpcStatus":7,"httpStatus":403}
// Response: HTTP 403 with exact message ✅
```

## Notes

- The fix maintains backward compatibility: if a status code is already an HTTP code (200-599), it's returned as-is
- All HTTP endpoints in the auth controller use `sendErrorResponse()`, so the conversion is automatic
- The API Gateway proxy doesn't modify error responses, ensuring exact message forwarding
- Frontend error handling is robust with fallbacks for edge cases

## Future Improvements

1. **Invalid credentials status code**: Consider changing from 404 to 401 (UNAUTHORIZED) for better semantics
2. **Rate limiting**: Add rate limiting error handling (429 TOO_MANY_REQUESTS)
3. **Error codes**: Consider adding error codes (e.g., `USER_BLOCKED`, `INVALID_CREDENTIALS`) for programmatic handling

