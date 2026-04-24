# CodeSync — Real-Time Collaborative Coding Platform

CodeSync is a real-time collaborative code editor that allows multiple users to edit and synchronize code simultaneously with minimal latency.

## Features
- Real-time multi-user collaboration
- Conflict-free editing using CRDT (Y.js)
- WebSocket-based communication (Socket.io)
- Room-based user sessions
- Scalable backend architecture
- Cloud deployment using AWS ECS

## System Design Highlights
- CRDT-based synchronization ensures consistency without conflicts
- WebSocket event-driven architecture for real-time updates
- Microservices-inspired deployment using Docker containers
- Optimized builds using multi-stage Docker pipelines

## 🛠 Tech Stack
- Frontend: React.js
- Backend: Node.js, Express.js
- Real-Time: Y.js, Socket.io
- DevOps: Docker
- Cloud: AWS ECS

## Setup
git clone <repo-url>
cd codesync
npm install
npm run dev
cd codesync
npm install
npm run dev
