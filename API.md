# StrataNodex Backend — API Reference

> **Base URL:** `https://stratanodex-backend.onrender.com`
>
> This document is the single source of truth for all backend endpoints. It is designed to be consumed by AI agents and developers building the CLI, Web-App, and Mobile App clients.

---

## Table of Contents

- [Authentication Scheme](#authentication-scheme)
- [Rate Limits](#rate-limits)
- [Error Format](#error-format)
- [Enums](#enums)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [OTP](#otp)
  - [Folders](#folders)
  - [Lists](#lists)
  - [Nodes](#nodes)
  - [Tags](#tags)
  - [Daily](#daily)
  - [Scores](#scores)

---

## Authentication Scheme

Protected endpoints require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /api/auth/register` or `POST /api/auth/login`. Tokens expire after the configured `JWT_EXPIRES_IN` (default: `7d`).

---

## Rate Limits

| Scope | Window | Max Requests | Applies To |
|---|---|---|---|
| General | 15 min | 100 | All `/api/*` routes |
| Auth | 15 min | 10 | `/api/auth/*` routes |
| OTP | 10 min | 3 | `/api/otp/*` routes |
| CLI Auth | 1 min | 60 | `/api/auth/cli-session*` routes |

Exceeding the limit returns `429 Too Many Requests`:
```json
{ "error": "Too many attempts, please try again later" }
```

---

## Error Format

All errors return JSON:

```json
{
  "error": "Human-readable error message"
}
```

In production, 5xx errors return a generic message. 4xx errors include the specific validation or business logic message.

---

## Enums

### NodeStatus
`TODO` | `IN_PROGRESS` | `DONE`

### Priority
`LOW` | `MEDIUM` | `HIGH`

### OtpType
`VERIFY_EMAIL` | `VERIFY_PHONE` | `TWO_FACTOR` | `PASSWORD_RESET`

### OtpChannel
`EMAIL` | `SMS`

### TwoFactorMethod
`EMAIL` | `SMS` | `TOTP`

### SubscriptionStatus
`TRIALING` | `ACTIVE` | `PAST_DUE` | `CANCELLED` | `EXPIRED`

### PaymentStatus
`PENDING` | `PAID` | `FAILED`

---

## Endpoints

---

### Health

#### `GET /health`

🔓 **Public**

Returns service status. Used by monitoring and keep-alive pings.

**Response** `200`
```json
{
  "status": "ok",
  "timestamp": "2026-04-17T20:07:24.015Z"
}
```

---

### Auth

All auth routes are under `/api/auth`.

---

#### `POST /api/auth/register`

🔓 **Public**

Create a new account. Sends a VERIFY_EMAIL OTP to the provided email.

**Request Body**
```json
{
  "email": "user@example.com",       // required, valid email
  "password": "securepass123",        // required, min 8 chars
  "name": "John Doe"                 // optional
}
```

**Response** `201`
```json
{
  "user": {
    "id": "cuid",
    "email": "user@example.com",
    "phone": null,
    "name": "John Doe",
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "twoFactorEnabled": false,
    "twoFactorMethod": null,
    "dayStartTime": "09:00",
    "dayEndTime": "21:00",
    "createdAt": "2026-04-17T00:00:00.000Z"
  },
  "message": "Check your email for OTP"
}
```

**Errors**: `400` validation, `500` email already in use

---

#### `POST /api/auth/login`

🔓 **Public**

Authenticate with email + password. Returns a JWT token, or a 2FA challenge if 2FA is enabled.

**Request Body**
```json
{
  "email": "user@example.com",       // required
  "password": "securepass123"         // required
}
```

**Response (no 2FA)** `200`
```json
{
  "user": {
    "id": "cuid",
    "email": "user@example.com",
    "phone": null,
    "name": "John Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "twoFactorEnabled": false,
    "twoFactorMethod": null,
    "dayStartTime": "09:00",
    "dayEndTime": "21:00",
    "createdAt": "2026-04-17T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (2FA enabled)** `200`
```json
{
  "requiresTwoFactor": true,
  "userId": "cuid"
}
```
> When `requiresTwoFactor` is true, call `POST /api/auth/2fa/verify` with the userId and OTP code.

**Errors**: `500` invalid credentials

---

#### `POST /api/auth/phone-login`

🔓 **Public**

Request an OTP to log in via phone number.

**Request Body**
```json
{
  "phone": "+919876543210"            // required, E.164 format
}
```

**Response** `200`
```json
{
  "message": "OTP sent to your phone"
}
```

**Errors**: `500` no account found

---

#### `POST /api/auth/phone-login/verify`

🔓 **Public**

Verify phone OTP to complete phone login.

**Request Body**
```json
{
  "phone": "+919876543210",           // required
  "code": "123456"                    // required, 6 digits
}
```

**Response** `200`
```json
{
  "user": { ... },
  "token": "eyJ..."
}
```

**Errors**: `500` invalid/expired OTP

---

#### `POST /api/auth/forgot-password`

🔓 **Public**

Request a password reset OTP. Does not reveal whether the email exists.

**Request Body**
```json
{
  "email": "user@example.com"         // required
}
```

**Response** `200`
```json
{
  "message": "If the email exists, you will receive an OTP"
}
```

---

#### `POST /api/auth/reset-password`

🔓 **Public**

Reset password using OTP received via email.

**Request Body**
```json
{
  "email": "user@example.com",        // required
  "code": "123456",                   // required, 6 digits
  "newPassword": "newsecurepass"      // required, min 8 chars
}
```

**Response** `200`
```json
{
  "message": "Password reset successful"
}
```

**Errors**: `500` invalid request, invalid/expired OTP

---

#### `POST /api/auth/2fa/verify`

🔓 **Public**

Complete 2FA login by providing the OTP code sent during login.

**Request Body**
```json
{
  "userId": "cuid",                   // required, from login response
  "code": "123456"                    // required, 6 digits
}
```

**Response** `200`
```json
{
  "user": { ... },
  "token": "eyJ..."
}
```

**Errors**: `500` invalid/expired OTP

---

#### `GET /api/auth/me`

🔐 **Protected**

Get current authenticated user's profile.

**Response** `200`
```json
{
  "id": "cuid",
  "email": "user@example.com",
  "phone": null,
  "name": "John Doe",
  "isEmailVerified": true,
  "isPhoneVerified": false,
  "twoFactorEnabled": false,
  "twoFactorMethod": null,
  "dayStartTime": "09:00",
  "dayEndTime": "21:00",
  "createdAt": "2026-04-17T00:00:00.000Z"
}
```

---

#### `POST /api/auth/verify-email`

🔐 **Protected**

Verify email address using OTP sent during registration.

**Request Body**
```json
{
  "code": "123456"                    // required, 6 digits
}
```

**Response** `200`
```json
{
  "message": "Email verified successfully"
}
```

---

#### `POST /api/auth/verify-phone`

🔐 **Protected**

Verify phone number using OTP.

**Request Body**
```json
{
  "code": "123456"                    // required, 6 digits
}
```

**Response** `200`
```json
{
  "message": "Phone verified successfully"
}
```

---

#### `POST /api/auth/resend-otp`

🔐 **Protected**

Resend an OTP for a specific purpose and channel.

**Request Body**
```json
{
  "type": "VERIFY_EMAIL",             // required, OtpType enum
  "channel": "EMAIL"                  // required, OtpChannel enum
}
```

**Response** `200`
```json
{
  "message": "OTP resent"
}
```

---

#### `POST /api/auth/2fa/enable`

🔐 **Protected**

Enable two-factor authentication.

**Request Body**
```json
{
  "method": "EMAIL"                   // required, "EMAIL" | "SMS" | "TOTP"
}
```

**Response** `200`
```json
{
  "id": "cuid",
  "email": "user@example.com",
  "twoFactorEnabled": true,
  "twoFactorMethod": "EMAIL",
  ...
}
```

---

#### `POST /api/auth/2fa/disable`

🔐 **Protected**

Disable two-factor authentication. No request body required.

**Response** `200`
```json
{
  "id": "cuid",
  "email": "user@example.com",
  "twoFactorEnabled": false,
  "twoFactorMethod": null,
  ...
}
```

---

#### `POST /api/auth/cli-session`

🔓 **Public**

Creates a new pending CLI session. This is the first step in the CLI authentication flow.

**Response** `201`
```json
{
  "code": "a1b2c3d4",
  "url": "https://stratanodex-landing-page.vercel.app/#auth?session=a1b2c3d4",
  "expiresAt": "2026-05-02T19:15:00.000Z"
}
```

---

#### `GET /api/auth/cli-session/:code`

🔓 **Public**

Poll endpoint for the CLI to check if the user has completed authentication in the browser.

**URL Params**: `code` — the session code returned from `/api/auth/cli-session`

**Response (pending)** `200`
```json
{
  "pending": true
}
```

**Response (completed)** `200`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**: `404` session not found / expired

---

#### `POST /api/auth/cli-session/:code/complete`

🔐 **Protected via Secret**

Called by the web application after successful user login to complete the CLI session. Requires a shared secret in the headers.

**URL Params**: `code` — the session code

**Headers**
```
x-cli-session-secret: <secret>
```

**Request Body**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** `200`
```json
{
  "success": true
}
```

**Errors**: `400` token missing, `403` forbidden (invalid secret), `404` session not found

---

### OTP

All OTP routes are under `/api/otp`. These are duplicates of the auth OTP routes provided for cleaner API separation.

---

#### `POST /api/otp/verify-email`

🔐 **Protected**

**Request Body**
```json
{
  "code": "123456"                    // required, 6 digits
}
```

**Response** `200`
```json
{
  "message": "Email verified successfully"
}
```

---

#### `POST /api/otp/verify-phone`

🔐 **Protected**

**Request Body**
```json
{
  "code": "123456"                    // required, 6 digits
}
```

**Response** `200`
```json
{
  "message": "Phone verified successfully"
}
```

---

#### `POST /api/otp/resend`

🔐 **Protected**

**Request Body**
```json
{
  "type": "VERIFY_EMAIL",             // required, OtpType enum
  "channel": "EMAIL"                  // required, OtpChannel enum
}
```

**Response** `200`
```json
{
  "message": "OTP resent"
}
```

---

### Folders

All folder routes are under `/api/folders`. All are 🔐 **Protected**.

---

#### `GET /api/folders`

Get all folders for the authenticated user.

**Response** `200`
```json
[
  {
    "id": "cuid",
    "name": "Work",
    "position": 0,
    "userId": "cuid",
    "createdAt": "2026-04-17T00:00:00.000Z",
    "updatedAt": "2026-04-17T00:00:00.000Z"
  }
]
```

---

#### `POST /api/folders`

Create a new folder.

**Request Body**
```json
{
  "name": "Work",                     // required, min 1 char
  "position": 0                       // optional, integer
}
```

**Response** `201`
```json
{
  "id": "cuid",
  "name": "Work",
  "position": 0,
  "userId": "cuid",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

#### `PATCH /api/folders/:id`

Update a folder.

**URL Params**: `id` — folder ID

**Request Body** (all optional)
```json
{
  "name": "Updated Name",
  "position": 1
}
```

**Response** `200` — updated folder object

---

#### `DELETE /api/folders/:id`

Delete a folder and all its lists/nodes.

**URL Params**: `id` — folder ID

**Response** `204` — no content

---

### Lists

List routes use mixed prefixes under `/api`. All are 🔐 **Protected**.

---

#### `GET /api/folders/:folderId/lists`

Get all lists in a folder.

**URL Params**: `folderId` — parent folder ID

**Response** `200`
```json
[
  {
    "id": "cuid",
    "name": "Sprint Tasks",
    "position": 0,
    "folderId": "cuid",
    "userId": "cuid",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

#### `POST /api/lists`

Create a new list.

**Request Body**
```json
{
  "name": "Sprint Tasks",            // required, min 1 char
  "folderId": "cuid",                // required, parent folder ID
  "position": 0                      // optional, integer
}
```

**Response** `201` — created list object

---

#### `PATCH /api/lists/:id`

Update a list.

**URL Params**: `id` — list ID

**Request Body** (all optional)
```json
{
  "name": "Updated List Name",
  "position": 2
}
```

**Response** `200` — updated list object

---

#### `DELETE /api/lists/:id`

Delete a list and all its nodes.

**URL Params**: `id` — list ID

**Response** `204` — no content

---

### Nodes

Node routes use mixed prefixes under `/api`. All are 🔐 **Protected**.

---

#### `GET /api/lists/:listId/nodes`

Get all root nodes in a list. Children are nested inside each root node.

**URL Params**: `listId` — parent list ID

**Response** `200`
```json
[
  {
    "id": "cuid",
    "title": "Build login page",
    "status": "TODO",
    "priority": "HIGH",
    "notes": "Use shadcn/ui",
    "startAt": "2026-04-17T00:00:00.000Z",
    "endAt": "2026-04-20T00:00:00.000Z",
    "reminderAt": null,
    "canvasX": null,
    "canvasY": null,
    "position": 0,
    "parentId": null,
    "listId": "cuid",
    "userId": "cuid",
    "createdAt": "...",
    "updatedAt": "...",
    "children": [],
    "tags": [
      {
        "tag": {
          "id": "cuid",
          "name": "frontend",
          "color": "#3B82F6"
        }
      }
    ]
  }
]
```

---

#### `GET /api/nodes/:id`

Get a single node by ID with children and tags.

**URL Params**: `id` — node ID

**Response** `200` — node object (same shape as above)

---

#### `POST /api/lists/:listId/nodes`

Create a root node in a list.

**URL Params**: `listId` — parent list ID

**Request Body**
```json
{
  "title": "Build login page",       // required, min 1 char
  "listId": "cuid",                  // required, must match URL param
  "parentId": "cuid",                // optional, for creating child inline
  "status": "TODO",                  // optional, default TODO
  "priority": "HIGH",                // optional, default null
  "notes": "Use shadcn/ui",          // optional
  "startAt": "2026-04-17T00:00:00.000Z",  // optional, ISO 8601
  "endAt": "2026-04-20T00:00:00.000Z",    // optional, ISO 8601
  "reminderAt": "2026-04-19T09:00:00.000Z", // optional, ISO 8601
  "canvasX": 100.5,                  // optional, float
  "canvasY": 200.3,                  // optional, float
  "position": 0,                     // optional, integer
  "tagIds": ["cuid1", "cuid2"]       // optional, array of tag IDs
}
```

**Response** `201` — created node object with children and tags

> If `reminderAt` is set, a BullMQ reminder job is automatically scheduled.

---

#### `POST /api/nodes/:parentId/children`

Create a sub-node. The `listId` is inherited from the parent node.

**URL Params**: `parentId` — parent node ID

**Request Body**
```json
{
  "title": "Design mockup",          // required, min 1 char
  "status": "TODO",                  // optional
  "priority": "MEDIUM",              // optional
  "notes": "",                       // optional
  "startAt": null,                   // optional, ISO 8601
  "endAt": null,                     // optional, ISO 8601
  "reminderAt": null,                // optional, ISO 8601
  "canvasX": null,                   // optional
  "canvasY": null,                   // optional
  "position": 0,                     // optional
  "tagIds": []                       // optional
}
```

**Response** `201` — created node object

---

#### `PATCH /api/nodes/:id`

Update a node.

**URL Params**: `id` — node ID

**Request Body** (all optional)
```json
{
  "title": "Updated title",
  "status": "DONE",
  "priority": "LOW",
  "notes": "Updated notes",
  "startAt": "2026-04-17T00:00:00.000Z",
  "endAt": "2026-04-20T00:00:00.000Z",
  "reminderAt": "2026-04-19T09:00:00.000Z",
  "canvasX": 150.0,
  "canvasY": 250.0,
  "position": 1,
  "parentId": "cuid",
  "tagIds": ["cuid1"]
}
```

**Response** `200` — updated node object

> If `reminderAt` changes, the reminder job is re-scheduled.

---

#### `DELETE /api/nodes/:id`

Delete a node and all its children (cascade).

**URL Params**: `id` — node ID

**Response** `204` — no content

---

#### `PATCH /api/nodes/:id/move`

Move a node to a new parent or position.

**URL Params**: `id` — node ID

**Request Body**
```json
{
  "parentId": "cuid",                // required, null = make root node
  "position": 2                      // required, integer
}
```

**Response** `200` — updated node object

---

#### `POST /api/nodes/:id/tags/:tagId`

Attach a tag to a node.

**URL Params**: `id` — node ID, `tagId` — tag ID

**Response** `201`
```json
{
  "nodeId": "cuid",
  "tagId": "cuid"
}
```

---

#### `DELETE /api/nodes/:id/tags/:tagId`

Detach a tag from a node.

**URL Params**: `id` — node ID, `tagId` — tag ID

**Response** `204` — no content

---

### Tags

All tag routes are under `/api/tags`. All are 🔐 **Protected**.

---

#### `GET /api/tags`

Get all tags. Optionally filter by list to include list-scoped tags.

**Query Params**
| Param | Type | Description |
|---|---|---|
| `listId` | string | Optional. If set, returns global tags + tags scoped to this list |

**Response** `200`
```json
[
  {
    "id": "cuid",
    "name": "urgent",
    "color": "#EF4444",
    "listId": null,
    "userId": "cuid",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

#### `POST /api/tags`

Create a new tag.

**Request Body**
```json
{
  "name": "urgent",                   // required, min 1 char
  "color": "#EF4444",                 // optional, hex color (#RRGGBB)
  "listId": "cuid"                    // optional, null = global tag
}
```

**Response** `201` — created tag object

---

#### `PATCH /api/tags/:id`

Update a tag.

**URL Params**: `id` — tag ID

**Request Body** (all optional)
```json
{
  "name": "renamed-tag",
  "color": "#3B82F6"
}
```

**Response** `200` — updated tag object

---

#### `DELETE /api/tags/:id`

Delete a tag. Automatically detaches from all nodes.

**URL Params**: `id` — tag ID

**Response** `204` — no content

---

### Daily

All daily routes are under `/api/daily`. All are 🔐 **Protected**.

---

#### `GET /api/daily/today`

Get all non-DONE nodes whose date range overlaps with today.

**Response** `200`
```json
[
  {
    "id": "cuid",
    "title": "Build login page",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "startAt": "2026-04-17T00:00:00.000Z",
    "endAt": "2026-04-20T00:00:00.000Z",
    ...
  }
]
```

---

#### `GET /api/daily/overdue`

Get all non-DONE nodes whose `endAt` is before today.

**Response** `200` — array of node objects (same shape as today)

---

#### `POST /api/daily/compute`

Enqueue a score computation job for a specific date. Processed asynchronously.

**Request Body**
```json
{
  "date": "2026-04-17",              // required, YYYY-MM-DD format
  "listId": "cuid"                   // optional, scope to a specific list
}
```

**Response** `202`
```json
{
  "message": "Score computation queued",
  "jobId": "1"
}
```

---

#### `GET /api/daily/:date`

Get the stored daily score for a specific date.

**URL Params**: `date` — date string in `YYYY-MM-DD` format

**Response** `200`
```json
{
  "id": "cuid",
  "userId": "cuid",
  "listId": null,
  "date": "2026-04-17T00:00:00.000Z",
  "totalNodes": 10,
  "doneNodes": 7,
  "points": 70,
  "createdAt": "..."
}
```

**Response** `404`
```json
{
  "error": "Score not found for this date"
}
```

---

### Scores

All score routes are under `/api/scores`. All are 🔐 **Protected**.

---

#### `GET /api/scores`

Get score history (daily scores ordered by date descending).

**Query Params**
| Param | Type | Default | Description |
|---|---|---|---|
| `listId` | string | — | Optional. Filter scores by list |
| `limit` | number | 30 | Max number of scores to return |

**Response** `200`
```json
[
  {
    "id": "cuid",
    "userId": "cuid",
    "listId": null,
    "date": "2026-04-17T00:00:00.000Z",
    "totalNodes": 10,
    "doneNodes": 7,
    "points": 70,
    "createdAt": "..."
  }
]
```

---

#### `GET /api/scores/streak`

Get the current consecutive-day streak (days with points > 0).

**Response** `200`
```json
{
  "streak": 5
}
```

---

## Quick Reference Table

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | 🔓 | Service health check |
| `POST` | `/api/auth/register` | 🔓 | Create account |
| `POST` | `/api/auth/login` | 🔓 | Email + password login |
| `POST` | `/api/auth/phone-login` | 🔓 | Request phone OTP |
| `POST` | `/api/auth/phone-login/verify` | 🔓 | Verify phone OTP login |
| `POST` | `/api/auth/forgot-password` | 🔓 | Request password reset OTP |
| `POST` | `/api/auth/reset-password` | 🔓 | Reset password with OTP |
| `POST` | `/api/auth/2fa/verify` | 🔓 | Complete 2FA login |
| `GET` | `/api/auth/me` | 🔐 | Get current user |
| `POST` | `/api/auth/verify-email` | 🔐 | Verify email with OTP |
| `POST` | `/api/auth/verify-phone` | 🔐 | Verify phone with OTP |
| `POST` | `/api/auth/resend-otp` | 🔐 | Resend OTP |
| `POST` | `/api/auth/2fa/enable` | 🔐 | Enable 2FA |
| `POST` | `/api/auth/2fa/disable` | 🔐 | Disable 2FA |
| `POST` | `/api/otp/verify-email` | 🔐 | Verify email (OTP route) |
| `POST` | `/api/otp/verify-phone` | 🔐 | Verify phone (OTP route) |
| `POST` | `/api/otp/resend` | 🔐 | Resend OTP (OTP route) |
| `GET` | `/api/folders` | 🔐 | List all folders |
| `POST` | `/api/folders` | 🔐 | Create folder |
| `PATCH` | `/api/folders/:id` | 🔐 | Update folder |
| `DELETE` | `/api/folders/:id` | 🔐 | Delete folder |
| `GET` | `/api/folders/:folderId/lists` | 🔐 | List all lists in folder |
| `POST` | `/api/lists` | 🔐 | Create list |
| `PATCH` | `/api/lists/:id` | 🔐 | Update list |
| `DELETE` | `/api/lists/:id` | 🔐 | Delete list |
| `GET` | `/api/lists/:listId/nodes` | 🔐 | List root nodes in list |
| `GET` | `/api/nodes/:id` | 🔐 | Get single node |
| `POST` | `/api/lists/:listId/nodes` | 🔐 | Create root node |
| `POST` | `/api/nodes/:parentId/children` | 🔐 | Create sub-node |
| `PATCH` | `/api/nodes/:id` | 🔐 | Update node |
| `DELETE` | `/api/nodes/:id` | 🔐 | Delete node (cascade) |
| `PATCH` | `/api/nodes/:id/move` | 🔐 | Move node |
| `POST` | `/api/nodes/:id/tags/:tagId` | 🔐 | Attach tag to node |
| `DELETE` | `/api/nodes/:id/tags/:tagId` | 🔐 | Detach tag from node |
| `GET` | `/api/tags` | 🔐 | List tags (?listId= optional) |
| `POST` | `/api/tags` | 🔐 | Create tag |
| `PATCH` | `/api/tags/:id` | 🔐 | Update tag |
| `DELETE` | `/api/tags/:id` | 🔐 | Delete tag |
| `GET` | `/api/daily/today` | 🔐 | Today's active nodes |
| `GET` | `/api/daily/overdue` | 🔐 | Overdue nodes |
| `POST` | `/api/daily/compute` | 🔐 | Queue score computation |
| `GET` | `/api/daily/:date` | 🔐 | Get score for date |
| `GET` | `/api/scores` | 🔐 | Score history |
| `GET` | `/api/scores/streak` | 🔐 | Current streak |
