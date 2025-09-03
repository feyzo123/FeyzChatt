# Chat Application

## Overview

This is a real-time chat application built with Node.js and Socket.io, designed to be a single-file, portable solution that works immediately on Replit or local Node.js environments. The application features a dual interface system - a modern WhatsApp-like interface and a classic Nokia-style interface - allowing users to choose their preferred chat experience. The system supports room-based chat with password protection, file sharing, emoji support, message replies, and real-time user presence tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Single-File Architecture
The entire application is contained within one JavaScript file with embedded HTML, CSS, and client-side JavaScript. This design ensures maximum portability and zero-configuration deployment. All assets including styles, scripts, and static content are inlined to eliminate external dependencies.

### Real-Time Communication
Socket.io handles bidirectional communication between clients and server, enabling instant message delivery, user presence updates, and room management. The WebSocket-based architecture ensures low-latency communication for chat functionality.

### Dual Interface System
Two distinct user interfaces cater to different user preferences:
- **Modern Interface**: WhatsApp Web-inspired design with advanced features like message replies, emoji support, file previews, and rich media handling
- **Nokia Interface**: Minimalist, retro design focusing on basic text messaging with simple file download capabilities

### Room-Based Chat System
Users can create password-protected chat rooms or join existing ones. Each room maintains its own message history (last 20 messages), user list, and isolated chat environment. Room management includes user join/leave notifications and basic moderation capabilities.

### File Handling
Server-side file upload and storage system supports multiple media types (images, videos, audio, documents). Files are processed through the Node.js server and shared via Socket.io, ensuring consistent delivery across all connected clients.

### Message Management
Comprehensive message system with features including:
- Message deletion with "this message was deleted" placeholders
- Reply-to-message functionality in modern interface
- Emoji support and rich text formatting
- Voice message recording and playback
- System messages for user join/leave events

### User Presence System
Real-time tracking of user activity including:
- Online/offline status indicators
- Last seen timestamps
- Active user lists per room
- Join/leave notifications

## External Dependencies

### Core Runtime Dependencies
- **Node.js**: Server runtime environment
- **Socket.io**: Real-time bidirectional event-based communication library

### Client-Side Libraries (Embedded)
- **Socket.io Client**: Embedded within the HTML for WebSocket communication
- **Native Web APIs**: File API, MediaRecorder API, and other browser-native APIs for media handling

### No External Services
The application is designed to be completely self-contained without requiring external databases, cloud storage, or third-party APIs. All data is stored in-memory during runtime, making it suitable for development and testing environments.