# Auth Flow Design — 2026-05-16

## Overview

Basic user signup and signin with JWT-based authorization. Two stateless tokens are issued per session: a short-lived access token and a long-lived refresh token, each signed with its own secret. An optional `AuthMiddleware` can be applied per-controller via `@ApplyMiddleware`.

---

## Architecture & Data Flow

```
POST /auth/signup
POST /auth/signin   →  AuthController  →  AuthService  →  UserRepository (MongoDB)
POST /auth/refresh                      ↘  TokenService (JWT sign/verify)

Protected routes:  AuthMiddleware  →  TokenService.verifyAccessToken()
                   (optional, applied per-controller with @ApplyMiddleware)
```

### Token Flow

- `signup` and `signin` return `{ accessToken, refreshToken }` — both stateless JWTs
- `accessToken`: short-lived, signed with `JWT_ACCESS_SECRET`
- `refreshToken`: long-lived, signed with `JWT_REFRESH_SECRET`
- `POST /auth/refresh` accepts a valid refresh JWT and returns a new `{ accessToken }`
- Separate secrets ensure a refresh token cannot be accepted where an access token is expected

---

## Endpoints

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/auth/signup` | No | Create user, return token pair |
| POST | `/auth/signin` | No | Validate credentials, return token pair |
| POST | `/auth/refresh` | No (refresh JWT in body) | Return new access token |

### Request / Response shapes

**POST /auth/signup**
```json
// Request
{ "email": "user@example.com", "password": "secret", "name": "Alice" }

// Response 201
{ "accessToken": "<jwt>", "refreshToken": "<jwt>" }
```

**POST /auth/signin**
```json
// Request
{ "email": "user@example.com", "password": "secret" }

// Response 200
{ "accessToken": "<jwt>", "refreshToken": "<jwt>" }
```

**POST /auth/refresh**
```json
// Request
{ "refreshToken": "<jwt>" }

// Response 200
{ "accessToken": "<jwt>" }
```

---

## Components

### New Files

| File | Purpose |
|------|---------|
| `src/controllers/AuthController.ts` | Handles the three auth endpoints |
| `src/services/AuthService.ts` | Password hashing (bcryptjs), user creation, credential validation |
| `src/services/TokenService.ts` | JWT sign/verify for both token types; injected into AuthService and AuthMiddleware |
| `src/repository/UserRepository/index.ts` | `createUser`, `findByEmail`, `findById` against MongoDB `users` collection |
| `src/repository/UserRepository/types.ts` | `IUser` interface |
| `src/middleware/AuthMiddleware.ts` | Extracts Bearer token, verifies via TokenService, attaches `userId` to request |

### Modified Files

| File | Change |
|------|--------|
| `src/errors.ts` | Add `UnauthorizedError` (401) and `ConflictError` (409) to `ErrorCode` enum and mapping |
| `src/config.ts` | Add `jwtAccessSecret`, `jwtRefreshSecret`, `jwtAccessExpiry` ("15m"), `jwtRefreshExpiry` ("7d") |
| `src/container/AppTypes.ts` | Add `TokenService` symbol |
| `src/container/index.ts` | Bind `AuthController`, `AuthService`, `TokenService`, `UserRepository` |
| `package.json` | Add `jsonwebtoken`, `bcryptjs`, `@types/jsonwebtoken`, `@types/bcryptjs` |

---

## Data Model

**Collection:** `users`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | `ObjectId` | MongoDB default |
| `email` | `string` | Unique index |
| `password` | `string` | bcrypt hash |
| `name` | `string` | Display name |
| `createdAt` | `Date` | Set on insert |
| `updatedAt` | `Date` | Updated on every write |

---

## TokenService Interface

```ts
signAccessToken(userId: string): string
signRefreshToken(userId: string): string
verifyAccessToken(token: string): { userId: string }
verifyRefreshToken(token: string): { userId: string }
```

---

## AuthMiddleware Behaviour

- Applied optionally per-controller: `@ApplyMiddleware(AuthMiddleware)`
- Reads `Authorization: Bearer <token>` header
- Missing header → `401 UnauthorizedError`
- Malformed or expired token → `401 UnauthorizedError`
- Valid token → attaches `userId` to the Fastify request object, calls `next()`

---

## Error Handling

| Scenario | Error Code | HTTP |
|----------|-----------|------|
| Email already registered | `ConflictError` | 409 |
| Wrong email or password | `UnauthorizedError` | 401 |
| Missing / invalid / expired token | `UnauthorizedError` | 401 |

All errors flow through the existing `ApiErrorBuilder` → `ApiErrorHandler` pipeline.

---

## Configuration

New env variables:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `JWT_ACCESS_SECRET` | Yes | — | Signs/verifies access tokens |
| `JWT_REFRESH_SECRET` | Yes | — | Signs/verifies refresh tokens |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token lifetime |
