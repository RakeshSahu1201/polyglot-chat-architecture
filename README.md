# Polyglot Chat Architecture

A real-time chat application built with a **Node.js** core service and a **Go** concurrent broadcast service, using **MongoDB**, **Redis Pub/Sub**, and **Socket.IO**.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React + Vite (frontend)         http://localhost:5173   │
│  - Auth page (register / login)                          │
│  - Chat page with real-time messaging via Socket.IO      │
└──────────────────────┬───────────────────────────────────┘
                       │ WebSocket + REST (JWT)
┌──────────────────────▼───────────────────────────────────┐
│  Node.js / Express + Socket.IO   http://localhost:5000   │
│  - REST: /user (register, login) → issues JWT            │
│  - REST: /conversation (history, media upload)           │
│  - Socket: login_me, send_message, send_media            │
│  - Online presence via Redis (online:<userId>)           │
└──────────┬────────────────────────────┬──────────────────┘
           │                            │
┌──────────▼──────────┐      ┌──────────▼──────────┐
│  MongoDB            │      │  Redis               │
│  - users collection │      │  - Online presence   │
│  - conversations    │      │  - Pub/Sub for Go    │
│    collection       │      │    channel events    │
└─────────────────────┘      └──────────▲──────────┘
                                        │ Pub/Sub
┌───────────────────────────────────────┴──────────┐
│  Go Service (in progress)    http://localhost:8080│
│  - Open / private channel broadcast              │
│  - goroutines + channels for concurrency         │
│  - JWT validation (shared secret)                │
│  - Publishes to Redis → Node fans out to clients │
└───────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Socket.IO client, Axios |
| Node backend | Express, Socket.IO, Mongoose, Multer, JWT, bcrypt |
| Go service | Goroutines, channels, Redis Pub/Sub *(in progress)* |
| Database | MongoDB 7 |
| Cache / Presence | Redis 7 |
| Auth | JWT (shared secret between Node and Go) |

---

## Prerequisites

- **Node.js** ≥ 18
- **Go** ≥ 1.21 *(for the Go service)*
- **MongoDB** 7
- **Redis** 7

---

## Quick Start

### 1. Start required services

```bash
sudo systemctl start mongod redis-server
```

Verify:

```bash
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
redis-cli ping   # → PONG
```

### 2. Backend

```bash
cd backend
cp .env.example .env    # fill in your JWT_SECRET
npm install
npm run dev
```

> Server starts at `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
# .env is already present with VITE_SERVER_URL=http://localhost:5000
npm install
npm run dev
```

> App opens at `http://localhost:5173`

---

## Environment Variables

### `backend/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Node server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/chat-app` |
| `REDIS_URL` | Redis connection URL | `redis://127.0.0.1:6379` |
| `JWT_SECRET` | Signing secret (shared with Go) | *(required)* |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `SERVER_BASE_URL` | Public URL for media links | `http://localhost:5000` |

### `frontend/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SERVER_URL` | Backend URL for REST + Socket | `http://localhost:5000` |

---

## Project Structure

```
polyglot-chat-architecture/
├── backend/
│   ├── db/
│   │   ├── MongoConnection.js
│   │   └── RedisClient.js
│   ├── middleware/
│   │   └── auth.js          # JWT verification
│   ├── model/
│   │   ├── User.js
│   │   └── Conversation.js
│   ├── repository/
│   │   ├── User.js
│   │   └── Conversation.js
│   ├── router/
│   │   ├── User.js          # /user/register-user, /user/login-user
│   │   └── Conversation.js  # /conversation (protected)
│   ├── media/               # uploaded files (gitignored)
│   ├── server.js
│   ├── .env                 # gitignored
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/Auth.jsx   # register + login
│   │   │   └── chat/MyChat.jsx # main chat UI
│   │   ├── components/         # InfoBar, Input, Messages, UserContainer
│   │   └── App.jsx
│   └── .env
└── README.md
```

---

## API Reference

### Auth (no token required)

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/user/register-user` | `{ name, password }` | `{ user, token }` |
| `POST` | `/user/login-user` | `{ name, password }` | `{ user, token }` |

### Conversations (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/conversation?from=<id>&to=<id>` | Fetch DM history |
| `POST` | `/conversation/from-to` | Fetch DM history (legacy) |
| `POST` | `/conversation/media` | Upload media file |

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `login_me` | `{ logged_user }` | Register online presence in Redis |
| `send_message` | `{ message: { from, to, body } }` | Send a DM |
| `send_media` | `{ media_message }` | Notify peers of uploaded media |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `get_connected_users` | `{ connected_users }` | Broadcast updated online user list |
| `message_sent` | `{ new_message }` | Deliver a message to sender + recipient |

---

## Roadmap

- [x] User registration and login with JWT
- [x] Real-time DM via Socket.IO
- [x] Media file upload and delivery
- [x] Redis-backed online presence with disconnect cleanup
- [ ] **Go service** — open and private channel broadcast
- [ ] Channel schema (`channel_id`, `message_type`) in MongoDB
- [ ] Redis Pub/Sub bridge between Go and Node
- [ ] Channel membership and access control
