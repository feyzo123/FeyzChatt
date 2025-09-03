const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Bellek içi veri depolama
const rooms = new Map(); // roomId -> { password, messages, users }
const users = new Map(); // socketId -> { username, roomId, lastSeen }

// Dosya yükleme için multer yapılandırması
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ana sayfa - HTML, CSS ve JS hepsi gömülü
app.get('/', (req, res) => {
  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Uygulaması</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f0f2f5;
            height: 100vh;
            overflow: hidden;
        }

        /* Arayüz Seçimi */
        .interface-selector {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: white;
            border-radius: 10px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .interface-btn {
            padding: 8px 15px;
            margin: 0 5px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            background: #f0f0f0;
            transition: all 0.2s;
        }

        .interface-btn.active {
            background: #25d366;
            color: white;
        }

        /* Giriş Ekranı */
        .login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .login-box {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }

        .login-title {
            color: #333;
            margin-bottom: 30px;
            font-size: 28px;
            font-weight: 600;
        }

        .input-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .input-group label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: 500;
        }

        .input-group input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
        }

        .input-group input:focus {
            outline: none;
            border-color: #25d366;
        }

        .login-btn {
            width: 100%;
            padding: 15px;
            background: #25d366;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            margin-top: 10px;
        }

        .login-btn:hover {
            background: #20c157;
        }

        /* Nokia Arayüzü */
        .nokia-interface {
            display: none;
            background: #2e2e2e;
            color: #00ff00;
            font-family: 'Courier New', monospace;
            height: 100vh;
            padding: 10px;
        }

        .nokia-header {
            background: #1a1a1a;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
            text-align: center;
            border: 2px solid #00ff00;
        }

        .nokia-messages {
            height: 60vh;
            overflow-y: auto;
            background: #1a1a1a;
            border: 2px solid #00ff00;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 10px;
        }

        .nokia-message {
            margin-bottom: 10px;
            padding: 5px;
            border-bottom: 1px solid #333;
        }

        .nokia-input-area {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }

        .nokia-input {
            flex: 1;
            background: #1a1a1a;
            border: 2px solid #00ff00;
            color: #00ff00;
            padding: 8px;
            border-radius: 3px;
        }

        .nokia-btn {
            background: #1a1a1a;
            border: 2px solid #00ff00;
            color: #00ff00;
            padding: 8px 15px;
            border-radius: 3px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
        }

        .nokia-btn:hover {
            background: #00ff00;
            color: #1a1a1a;
        }

        .nokia-controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        /* Modern WhatsApp Arayüzü */
        .modern-interface {
            display: flex;
            height: 100vh;
            background: #f0f2f5;
        }

        .chat-sidebar {
            width: 300px;
            background: white;
            border-right: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
        }

        .sidebar-header {
            padding: 20px;
            background: #00bfa5;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #20c157;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }

        .room-list {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }

        .room-item {
            padding: 15px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background 0.2s;
        }

        .room-item:hover {
            background: #f5f5f5;
        }

        .room-item.active {
            background: #e3f2fd;
        }

        .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #e5ddd5;
        }

        .chat-header {
            background: #00bfa5;
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .chat-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .online-users {
            background: rgba(255,255,255,0.2);
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
        }

        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><pattern id="a" patternUnits="userSpaceOnUse" width="100" height="100" patternTransform="translate(0,0) scale(1,1)"><g opacity="0.05"><polygon fill="%23000" points="50 0 60 40 100 50 60 60 50 100 40 60 0 50 40 40"/></g></pattern></defs><rect width="100%" height="100%" fill="url(%23a)"/></svg>');
        }

        .message {
            margin-bottom: 10px;
            max-width: 60%;
            clear: both;
        }

        .message.own {
            float: right;
            margin-left: auto;
        }

        .message.other {
            float: left;
        }

        .message-bubble {
            padding: 8px 12px;
            border-radius: 7px;
            position: relative;
            word-wrap: break-word;
        }

        .message.own .message-bubble {
            background: #dcf8c6;
            border-bottom-right-radius: 2px;
        }

        .message.other .message-bubble {
            background: white;
            border-bottom-left-radius: 2px;
        }

        .message-info {
            font-size: 11px;
            color: #667781;
            margin-top: 5px;
            text-align: right;
        }

        .message.other .message-info {
            text-align: left;
        }

        .message-reply {
            background: rgba(0,0,0,0.1);
            border-left: 4px solid #25d366;
            padding: 5px 8px;
            margin-bottom: 5px;
            border-radius: 5px;
            font-size: 12px;
        }

        .message-actions {
            position: absolute;
            top: -30px;
            right: 10px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            display: none;
            z-index: 100;
        }

        .message:hover .message-actions {
            display: flex;
        }

        .action-btn {
            padding: 5px 10px;
            border: none;
            background: none;
            cursor: pointer;
            border-radius: 15px;
            transition: background 0.2s;
        }

        .action-btn:hover {
            background: #f0f0f0;
        }

        .system-message {
            text-align: center;
            color: #667781;
            font-size: 12px;
            margin: 10px 0;
            font-style: italic;
        }

        .deleted-message {
            font-style: italic;
            color: #999;
        }

        .input-container {
            background: white;
            padding: 10px 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .input-area {
            flex: 1;
            display: flex;
            align-items: center;
            background: #f0f2f5;
            border-radius: 25px;
            padding: 8px 15px;
            gap: 10px;
        }

        .message-input {
            flex: 1;
            border: none;
            outline: none;
            background: none;
            font-size: 16px;
            resize: none;
            max-height: 100px;
        }

        .input-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .input-btn:hover {
            background: rgba(0,0,0,0.1);
        }

        .send-btn {
            background: #25d366;
            color: white;
            border: none;
            border-radius: 50%;
            width: 45px;
            height: 45px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .send-btn:hover {
            background: #20c157;
        }

        .file-preview {
            max-width: 300px;
            max-height: 200px;
            border-radius: 8px;
            margin-bottom: 5px;
        }

        .voice-message {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(0,0,0,0.05);
            padding: 10px;
            border-radius: 10px;
        }

        .voice-btn {
            background: #25d366;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .voice-duration {
            font-size: 12px;
            color: #667781;
        }

        .emoji-picker {
            position: absolute;
            bottom: 60px;
            right: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            padding: 15px;
            display: none;
            max-height: 200px;
            overflow-y: auto;
        }

        .emoji-grid {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 5px;
        }

        .emoji-item {
            padding: 8px;
            cursor: pointer;
            border-radius: 5px;
            text-align: center;
            transition: background 0.2s;
        }

        .emoji-item:hover {
            background: #f0f0f0;
        }

        .file-upload {
            display: none;
        }

        .typing-indicator {
            color: #667781;
            font-style: italic;
            font-size: 12px;
            padding: 10px 20px;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .chat-sidebar {
                width: 100%;
                position: absolute;
                z-index: 999;
                transform: translateX(-100%);
                transition: transform 0.3s;
            }
            
            .chat-sidebar.show {
                transform: translateX(0);
            }
            
            .modern-interface {
                position: relative;
            }
        }

        /* Kullanıcı Listesi */
        .users-list {
            background: rgba(255,255,255,0.9);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 15px;
        }

        .user-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-radius: 8px;
            margin-bottom: 5px;
        }

        .user-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #25d366;
        }

        .user-status.offline {
            background: #ccc;
        }

        /* Dosya Mesajları */
        .file-message {
            background: rgba(255,255,255,0.9);
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 5px;
        }

        .file-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .file-icon {
            width: 40px;
            height: 40px;
            background: #25d366;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }

        .file-details {
            flex: 1;
        }

        .file-name {
            font-weight: 600;
            color: #333;
        }

        .file-size {
            font-size: 12px;
            color: #667781;
        }

        .download-btn {
            background: #25d366;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        }

        .hidden {
            display: none !important;
        }

        /* Modal */
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 500px;
            width: 90%;
        }

        .modal-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #333;
        }
    </style>
</head>
<body>
    <!-- Arayüz Seçici -->
    <div class="interface-selector">
        <button class="interface-btn active" onclick="switchInterface('modern')">Modern</button>
        <button class="interface-btn" onclick="switchInterface('nokia')">Nokia</button>
    </div>

    <!-- Giriş Ekranı -->
    <div id="loginContainer" class="login-container">
        <div class="login-box">
            <h1 class="login-title">💬 Chat Uygulaması</h1>
            <div class="input-group">
                <label>Kullanıcı Adınız</label>
                <input type="text" id="usernameInput" placeholder="Kullanıcı adınızı girin">
            </div>
            <div class="input-group">
                <label>Oda Adı</label>
                <input type="text" id="roomInput" placeholder="Oda adını girin">
            </div>
            <div class="input-group">
                <label>Oda Şifresi (İsteğe bağlı)</label>
                <input type="password" id="passwordInput" placeholder="Oda şifresi">
            </div>
            <button class="login-btn" onclick="joinRoom()">Odaya Katıl</button>
        </div>
    </div>

    <!-- Nokia Arayüzü -->
    <div id="nokiaInterface" class="nokia-interface">
        <div class="nokia-header">
            <div>📱 NOKIA CHAT</div>
            <div>Oda: <span id="nokiaRoomName">-</span> | Kullanıcılar: <span id="nokiaUserCount">0</span></div>
        </div>
        
        <div class="users-list">
            <div><strong>Çevrimiçi Kullanıcılar:</strong></div>
            <div id="nokiaUsersList"></div>
        </div>

        <div id="nokiaMessages" class="nokia-messages"></div>
        
        <div class="nokia-input-area">
            <input type="text" id="nokiaMessageInput" class="nokia-input" placeholder="Mesaj yazın..." maxlength="160">
            <button onclick="sendMessage()" class="nokia-btn">GÖNDER</button>
        </div>
        
        <div class="nokia-controls">
            <button onclick="refreshChat()" class="nokia-btn">YENİLE</button>
            <button onclick="leaveRoom()" class="nokia-btn">ÇIKIŞ</button>
            <input type="file" id="nokiaFileInput" style="display:none" onchange="uploadFile(this)">
            <button onclick="document.getElementById('nokiaFileInput').click()" class="nokia-btn">DOSYA</button>
        </div>
    </div>

    <!-- Modern Arayüzü -->
    <div id="modernInterface" class="modern-interface hidden">
        <div class="chat-sidebar">
            <div class="sidebar-header">
                <div class="user-info">
                    <div class="user-avatar" id="userAvatar">U</div>
                    <div>
                        <div id="currentUsername">Kullanıcı</div>
                        <div style="font-size: 12px; opacity: 0.8;">Çevrimiçi</div>
                    </div>
                </div>
                <button class="input-btn" onclick="leaveRoom()" title="Odadan Çık">🚪</button>
            </div>
            <div class="room-list">
                <div class="users-list">
                    <h3 style="margin-bottom: 10px;">Çevrimiçi Kullanıcılar</h3>
                    <div id="modernUsersList"></div>
                </div>
            </div>
        </div>

        <div class="chat-main">
            <div class="chat-header">
                <div class="chat-info">
                    <div class="user-avatar">R</div>
                    <div>
                        <div id="currentRoomName">Oda</div>
                        <div style="font-size: 12px; opacity: 0.8;">
                            <span id="onlineCount">0</span> çevrimiçi kullanıcı
                        </div>
                    </div>
                </div>
                <div class="online-users" id="onlineUsers"></div>
            </div>

            <div id="messagesContainer" class="messages-container"></div>
            
            <div id="typingIndicator" class="typing-indicator hidden"></div>

            <div class="input-container">
                <input type="file" id="fileInput" class="file-upload" onchange="uploadFile(this)" accept="*/*">
                <button class="input-btn" onclick="document.getElementById('fileInput').click()" title="Dosya Ekle">📎</button>
                <button class="input-btn" onclick="toggleEmojiPicker()" title="Emoji">😊</button>
                <button class="input-btn" id="voiceBtn" onclick="toggleVoiceRecording()" title="Ses Kaydı">🎤</button>
                
                <div class="input-area">
                    <textarea id="messageInput" class="message-input" placeholder="Mesaj yazın..." rows="1" onkeypress="handleKeyPress(event)"></textarea>
                </div>
                
                <button class="send-btn" onclick="sendMessage()" title="Gönder">➤</button>
            </div>
        </div>
    </div>

    <!-- Emoji Picker -->
    <div id="emojiPicker" class="emoji-picker">
        <div class="emoji-grid" id="emojiGrid"></div>
    </div>

    <!-- Socket.io -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
        let socket;
        let currentUser = '';
        let currentRoom = '';
        let currentInterface = 'modern';
        let replyToMessage = null;
        let isRecording = false;
        let mediaRecorder = null;
        let recordedChunks = [];
        let typingTimer = null;

        // Emoji listesi
        const emojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'];

        function switchInterface(type) {
            currentInterface = type;
            const nokiaInterface = document.getElementById('nokiaInterface');
            const modernInterface = document.getElementById('modernInterface');
            const buttons = document.querySelectorAll('.interface-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            
            if (type === 'nokia') {
                nokiaInterface.style.display = 'block';
                modernInterface.classList.add('hidden');
                buttons[1].classList.add('active');
            } else {
                nokiaInterface.style.display = 'none';
                modernInterface.classList.remove('hidden');
                buttons[0].classList.add('active');
            }
            
            // Mesajları yeniden yükle
            if (currentRoom) {
                loadMessages();
            }
        }

        function joinRoom() {
            const username = document.getElementById('usernameInput').value.trim();
            const room = document.getElementById('roomInput').value.trim();
            const password = document.getElementById('passwordInput').value;

            if (!username || !room) {
                alert('Lütfen kullanıcı adı ve oda adını girin!');
                return;
            }

            currentUser = username;
            currentRoom = room;

            // Socket bağlantısını başlat
            socket = io();
            setupSocketEvents();

            socket.emit('join-room', {
                username: username,
                room: room,
                password: password
            });
        }

        function setupSocketEvents() {
            socket.on('room-joined', (data) => {
                document.getElementById('loginContainer').style.display = 'none';
                if (currentInterface === 'nokia') {
                    document.getElementById('nokiaInterface').style.display = 'block';
                } else {
                    document.getElementById('modernInterface').classList.remove('hidden');
                }
                
                updateRoomInfo(data.room, data.users);
                loadMessages();
                
                document.getElementById('currentUsername').textContent = currentUser;
                document.getElementById('userAvatar').textContent = currentUser[0].toUpperCase();
            });

            socket.on('room-error', (error) => {
                alert(error);
            });

            socket.on('new-message', (message) => {
                addMessage(message);
            });

            socket.on('message-deleted', (messageId) => {
                markMessageAsDeleted(messageId);
            });

            socket.on('user-joined', (data) => {
                updateUsersList(data.users);
                addSystemMessage(data.username + ' odaya katıldı');
            });

            socket.on('user-left', (data) => {
                updateUsersList(data.users);
                addSystemMessage(data.username + ' odadan ayrıldı');
            });

            socket.on('users-update', (users) => {
                updateUsersList(users);
            });

            socket.on('typing', (data) => {
                showTypingIndicator(data.username);
            });

            socket.on('stop-typing', () => {
                hideTypingIndicator();
            });

            socket.on('messages-history', (messages) => {
                const nokiaContainer = document.getElementById('nokiaMessages');
                const modernContainer = document.getElementById('messagesContainer');
                
                nokiaContainer.innerHTML = '';
                modernContainer.innerHTML = '';
                
                messages.forEach(message => addMessage(message));
            });
        }

        function sendMessage() {
            const input = currentInterface === 'nokia' ? 
                document.getElementById('nokiaMessageInput') : 
                document.getElementById('messageInput');
            
            const message = input.value.trim();
            if (!message) return;

            const messageData = {
                type: 'text',
                content: message,
                replyTo: replyToMessage
            };

            socket.emit('send-message', messageData);
            input.value = '';
            replyToMessage = null;
            clearReplyPreview();
        }

        function uploadFile(input) {
            const file = input.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('room', currentRoom);

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const messageData = {
                        type: 'file',
                        content: data.fileName,
                        fileInfo: {
                            originalName: file.name,
                            size: file.size,
                            type: file.type,
                            url: data.url
                        }
                    };
                    socket.emit('send-message', messageData);
                }
            })
            .catch(error => {
                console.error('Dosya yükleme hatası:', error);
                alert('Dosya yüklenirken hata oluştu!');
            });

            input.value = '';
        }

        function addMessage(message) {
            if (currentInterface === 'nokia') {
                addNokiaMessage(message);
            } else {
                addModernMessage(message);
            }
        }

        function addNokiaMessage(message) {
            const container = document.getElementById('nokiaMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'nokia-message';
            messageDiv.id = 'msg-' + message.id;

            if (message.deleted) {
                messageDiv.innerHTML = '<span style="color: #666; font-style: italic;">Bu mesaj silindi</span>';
            } else if (message.type === 'file') {
                messageDiv.innerHTML = 
                    '<div><strong>' + message.username + ':</strong> 📎 ' + message.fileInfo.originalName + '</div>' +
                    '<div><button onclick="downloadFile(\'' + message.fileInfo.url + '\', \'' + message.fileInfo.originalName + '\')" class="nokia-btn" style="font-size: 10px; padding: 4px 8px;">İNDİR</button></div>' +
                    '<div style="font-size: 10px; color: #888;">' + new Date(message.timestamp).toLocaleTimeString('tr-TR') + '</div>';
            } else {
                messageDiv.innerHTML = 
                    '<div><strong>' + message.username + ':</strong> ' + message.content + '</div>' +
                    '<div style="font-size: 10px; color: #888;">' + new Date(message.timestamp).toLocaleTimeString('tr-TR') + '</div>';
            }

            container.appendChild(messageDiv);
            container.scrollTop = container.scrollHeight;

            // Son 20 mesajı tut
            const messages = container.children;
            if (messages.length > 20) {
                container.removeChild(messages[0]);
            }
        }

        function addModernMessage(message) {
            const container = document.getElementById('messagesContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (message.username === currentUser ? 'own' : 'other');
            messageDiv.id = 'msg-' + message.id;

            if (message.deleted) {
                messageDiv.innerHTML = 
                    '<div class="message-bubble deleted-message">' +
                        '<div>Bu mesaj silindi</div>' +
                        '<div class="message-info">' + new Date(message.timestamp).toLocaleTimeString('tr-TR') + '</div>' +
                    '</div>';
            } else {
                let content = '';
                
                if (message.replyTo) {
                    content += '<div class="message-reply">↩️ ' + message.replyTo.username + ': ' + message.replyTo.content.substring(0, 50) + '...</div>';
                }

                if (message.type === 'file') {
                    if (message.fileInfo.type.startsWith('image/')) {
                        content += '<img src="' + message.fileInfo.url + '" class="file-preview" alt="' + message.fileInfo.originalName + '">';
                    } else if (message.fileInfo.type.startsWith('video/')) {
                        content += '<video src="' + message.fileInfo.url + '" class="file-preview" controls></video>';
                    } else if (message.fileInfo.type.startsWith('audio/')) {
                        content += '<audio src="' + message.fileInfo.url + '" controls style="width: 100%;"></audio>';
                    } else {
                        content += 
                            '<div class="file-message">' +
                                '<div class="file-info">' +
                                    '<div class="file-icon">📄</div>' +
                                    '<div class="file-details">' +
                                        '<div class="file-name">' + message.fileInfo.originalName + '</div>' +
                                        '<div class="file-size">' + formatFileSize(message.fileInfo.size) + '</div>' +
                                    '</div>' +
                                    '<button onclick="downloadFile(\'' + message.fileInfo.url + '\', \'' + message.fileInfo.originalName + '\')" class="download-btn">İndir</button>' +
                                '</div>' +
                            '</div>';
                    }
                } else if (message.type === 'voice') {
                    content += 
                        '<div class="voice-message">' +
                            '<button class="voice-btn" onclick="playVoice(\'' + message.content + '\')">▶️</button>' +
                            '<div>Ses mesajı</div>' +
                            '<div class="voice-duration">' + (message.duration || '0:00') + '</div>' +
                        '</div>';
                } else {
                    content += message.content;
                }

                const userNameDisplay = message.username !== currentUser ? 
                    '<div style="font-weight: 600; color: #25d366; font-size: 12px; margin-bottom: 3px;">' + message.username + '</div>' : '';
                
                const checkMark = message.username === currentUser ? '<span style="margin-left: 5px;">✓✓</span>' : '';
                
                const deleteBtn = message.username === currentUser ? 
                    '<button class="action-btn" onclick="deleteMessage(\'' + message.id + '\')" title="Sil">🗑️</button>' : '';

                messageDiv.innerHTML = 
                    '<div class="message-bubble">' +
                        userNameDisplay +
                        content +
                        '<div class="message-info">' +
                            new Date(message.timestamp).toLocaleTimeString('tr-TR') +
                            checkMark +
                        '</div>' +
                        '<div class="message-actions">' +
                            '<button class="action-btn" onclick="replyToMessage(\'' + message.id + '\', \'' + message.username + '\', \'' + message.content + '\')" title="Yanıtla">↩️</button>' +
                            deleteBtn +
                        '</div>' +
                    '</div>';
            }

            container.appendChild(messageDiv);
            container.scrollTop = container.scrollHeight;

            // Son 20 mesajı tut
            const messages = container.children;
            if (messages.length > 20) {
                container.removeChild(messages[0]);
            }
        }

        function addSystemMessage(content) {
            if (currentInterface === 'nokia') {
                const container = document.getElementById('nokiaMessages');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'nokia-message';
                messageDiv.innerHTML = '<div style="color: #888; text-align: center; font-style: italic;">*** ' + content + ' ***</div>';
                container.appendChild(messageDiv);
            } else {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'system-message';
                messageDiv.textContent = content;
                container.appendChild(messageDiv);
            }
        }

        function updateRoomInfo(room, users) {
            document.getElementById('nokiaRoomName').textContent = room;
            document.getElementById('currentRoomName').textContent = room;
            updateUsersList(users);
        }

        function updateUsersList(users) {
            const nokiaList = document.getElementById('nokiaUsersList');
            const modernList = document.getElementById('modernUsersList');
            const onlineCount = document.getElementById('onlineCount');
            const onlineUsers = document.getElementById('onlineUsers');

            // Nokia listesi
            nokiaList.innerHTML = users.map(user => 
                '<div>' + user.username + ' ' + (user.online ? '🟢' : '🔴') + '</div>'
            ).join('');

            // Modern listesi
            modernList.innerHTML = users.map(user => 
                '<div class="user-item">' +
                    '<div class="user-status ' + (user.online ? '' : 'offline') + '"></div>' +
                    '<div class="user-avatar">' + user.username[0].toUpperCase() + '</div>' +
                    '<div>' +
                        '<div>' + user.username + '</div>' +
                        '<div style="font-size: 11px; color: #667781;">' +
                            (user.online ? 'Çevrimiçi' : 'Son görülme: ' + new Date(user.lastSeen).toLocaleTimeString('tr-TR')) +
                        '</div>' +
                    '</div>' +
                '</div>'
            ).join('');

            document.getElementById('nokiaUserCount').textContent = users.filter(u => u.online).length;
            if (onlineCount) onlineCount.textContent = users.filter(u => u.online).length;
            if (onlineUsers) onlineUsers.textContent = users.filter(u => u.online).map(u => u.username).join(', ');
        }

        function loadMessages() {
            socket.emit('get-messages');
        }

        function refreshChat() {
            loadMessages();
            socket.emit('get-users');
        }

        function leaveRoom() {
            if (socket) {
                socket.emit('leave-room');
                socket.disconnect();
            }
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('nokiaInterface').style.display = 'none';
            document.getElementById('modernInterface').classList.add('hidden');
            
            // Formu temizle
            document.getElementById('usernameInput').value = '';
            document.getElementById('roomInput').value = '';
            document.getElementById('passwordInput').value = '';
        }

        function deleteMessage(messageId) {
            socket.emit('delete-message', messageId);
        }

        function markMessageAsDeleted(messageId) {
            const messageElement = document.getElementById('msg-' + messageId);
            if (messageElement) {
                if (currentInterface === 'nokia') {
                    messageElement.innerHTML = '<span style="color: #666; font-style: italic;">Bu mesaj silindi</span>';
                } else {
                    messageElement.querySelector('.message-bubble').innerHTML = 
                        '<div class="deleted-message">Bu mesaj silindi</div>' +
                        '<div class="message-info">' + new Date().toLocaleTimeString('tr-TR') + '</div>';
                }
            }
        }

        function replyToMessage(messageId, username, content) {
            replyToMessage = { id: messageId, username, content };
            
            // Reply preview göster
            const preview = document.createElement('div');
            preview.id = 'replyPreview';
            preview.style.cssText = 'background: #f0f0f0; padding: 10px; margin: 10px 20px; border-left: 4px solid #25d366; border-radius: 5px;';
            preview.innerHTML = 
                '<div style="font-size: 12px; color: #25d366; font-weight: 600;">Yanıtlanan mesaj:</div>' +
                '<div style="font-size: 14px; color: #333;">' + username + ': ' + content.substring(0, 50) + '...</div>' +
                '<button onclick="clearReplyPreview()" style="float: right; background: none; border: none; cursor: pointer;">❌</button>';
            
            const inputContainer = document.querySelector('.input-container');
            inputContainer.parentNode.insertBefore(preview, inputContainer);
            
            document.getElementById('messageInput').focus();
        }

        function clearReplyPreview() {
            const preview = document.getElementById('replyPreview');
            if (preview) preview.remove();
            replyToMessage = null;
        }

        function toggleEmojiPicker() {
            const picker = document.getElementById('emojiPicker');
            const grid = document.getElementById('emojiGrid');
            
            if (picker.style.display === 'block') {
                picker.style.display = 'none';
            } else {
                // Emoji grid'i oluştur
                grid.innerHTML = emojis.map(emoji => 
                    '<div class="emoji-item" onclick="addEmoji(\'' + emoji + '\')">' + emoji + '</div>'
                ).join('');
                picker.style.display = 'block';
            }
        }

        function addEmoji(emoji) {
            const input = document.getElementById('messageInput');
            input.value += emoji;
            input.focus();
            document.getElementById('emojiPicker').style.display = 'none';
        }

        function toggleVoiceRecording() {
            if (isRecording) {
                stopVoiceRecording();
            } else {
                startVoiceRecording();
            }
        }

        function startVoiceRecording() {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaRecorder = new MediaRecorder(stream);
                    recordedChunks = [];
                    
                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            recordedChunks.push(event.data);
                        }
                    };
                    
                    mediaRecorder.onstop = () => {
                        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                        uploadVoiceMessage(blob);
                        stream.getTracks().forEach(track => track.stop());
                    };
                    
                    mediaRecorder.start();
                    isRecording = true;
                    document.getElementById('voiceBtn').style.background = '#ff4444';
                    document.getElementById('voiceBtn').textContent = '⏹️';
                })
                .catch(error => {
                    console.error('Mikrofon erişim hatası:', error);
                    alert('Mikrofon erişimi reddedildi!');
                });
        }

        function stopVoiceRecording() {
            if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
                isRecording = false;
                document.getElementById('voiceBtn').style.background = '';
                document.getElementById('voiceBtn').textContent = '🎤';
            }
        }

        function uploadVoiceMessage(blob) {
            const formData = new FormData();
            formData.append('file', blob, 'voice-message.webm');
            formData.append('room', currentRoom);

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const messageData = {
                        type: 'voice',
                        content: data.url,
                        duration: '0:30'
                    };
                    socket.emit('send-message', messageData);
                }
            });
        }

        function playVoice(url) {
            const audio = new Audio(url);
            audio.play();
        }

        function downloadFile(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
            
            // Typing indicator
            if (!typingTimer) {
                socket.emit('typing');
            }
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                socket.emit('stop-typing');
                typingTimer = null;
            }, 1000);
        }

        function showTypingIndicator(username) {
            const indicator = document.getElementById('typingIndicator');
            indicator.textContent = username + ' yazıyor...';
            indicator.classList.remove('hidden');
        }

        function hideTypingIndicator() {
            const indicator = document.getElementById('typingIndicator');
            indicator.classList.add('hidden');
        }

        // Otomatik textarea boyut ayarı
        document.addEventListener('DOMContentLoaded', function() {
            const textarea = document.getElementById('messageInput');
            if (textarea) {
                textarea.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
                });
            }
        });
    </script>
</body>
</html>`;
  res.send(htmlContent);
});

// Dosya yükleme endpoint'i
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Dosya bulunamadı' });
        }

        const fileName = Date.now() + '-' + req.file.originalname;
        const filePath = path.join(__dirname, 'uploads', fileName);
        
        // Uploads klasörünü oluştur
        if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
            fs.mkdirSync(path.join(__dirname, 'uploads'));
        }
        
        fs.writeFileSync(filePath, req.file.buffer);
        
        res.json({
            success: true,
            fileName: fileName,
            url: '/uploads/' + fileName
        });
    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        res.status(500).json({ success: false, error: 'Dosya yüklenirken hata oluştu' });
    }
});

// Socket.io bağlantı yönetimi
io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);

    // Odaya katılma
    socket.on('join-room', (data) => {
        const { username, room, password } = data;
        
        // Oda kontrolü
        if (!rooms.has(room)) {
            rooms.set(room, {
                password: password || null,
                messages: [],
                users: []
            });
        }
        
        const roomData = rooms.get(room);
        
        // Şifre kontrolü
        if (roomData.password && roomData.password !== password) {
            socket.emit('room-error', 'Yanlış şifre!');
            return;
        }
        
        // Kullanıcıyı odaya ekle
        socket.join(room);
        
        // Kullanıcı bilgilerini kaydet
        users.set(socket.id, {
            username,
            room,
            lastSeen: new Date(),
            online: true
        });
        
        // Odadaki kullanıcı listesini güncelle
        roomData.users = roomData.users.filter(u => u.socketId !== socket.id);
        roomData.users.push({
            socketId: socket.id,
            username,
            online: true,
            lastSeen: new Date()
        });
        
        socket.emit('room-joined', {
            room,
            users: roomData.users
        });
        
        // Diğer kullanıcılara bildir
        socket.to(room).emit('user-joined', {
            username,
            users: roomData.users
        });
        
        // Son mesajları gönder
        socket.emit('messages-history', roomData.messages.slice(-20));
        
        console.log(username + ' ' + room + ' odasına katıldı');
    });

    // Mesaj gönderme
    socket.on('send-message', (messageData) => {
        const user = users.get(socket.id);
        if (!user) return;
        
        const roomData = rooms.get(user.room);
        if (!roomData) return;
        
        const message = {
            id: Date.now().toString(),
            username: user.username,
            content: messageData.content,
            type: messageData.type || 'text',
            timestamp: new Date(),
            deleted: false,
            replyTo: messageData.replyTo,
            fileInfo: messageData.fileInfo
        };
        
        roomData.messages.push(message);
        
        // Son 50 mesajı tut (gösterim için 20, depolama için 50)
        if (roomData.messages.length > 50) {
            roomData.messages = roomData.messages.slice(-50);
        }
        
        io.to(user.room).emit('new-message', message);
        console.log(user.username + ': ' + messageData.content);
    });

    // Mesaj silme
    socket.on('delete-message', (messageId) => {
        const user = users.get(socket.id);
        if (!user) return;
        
        const roomData = rooms.get(user.room);
        if (!roomData) return;
        
        const message = roomData.messages.find(m => m.id === messageId);
        if (message && message.username === user.username) {
            message.deleted = true;
            message.content = 'Bu mesaj silindi';
            io.to(user.room).emit('message-deleted', messageId);
        }
    });

    // Yazıyor göstergesi
    socket.on('typing', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(user.room).emit('typing', { username: user.username });
        }
    });

    socket.on('stop-typing', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(user.room).emit('stop-typing');
        }
    });

    // Mesaj geçmişi isteme
    socket.on('get-messages', () => {
        const user = users.get(socket.id);
        if (user) {
            const roomData = rooms.get(user.room);
            if (roomData) {
                socket.emit('messages-history', roomData.messages.slice(-20));
            }
        }
    });

    // Kullanıcı listesi isteme
    socket.on('get-users', () => {
        const user = users.get(socket.id);
        if (user) {
            const roomData = rooms.get(user.room);
            if (roomData) {
                socket.emit('users-update', roomData.users);
            }
        }
    });

    // Bağlantı kopma
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            const roomData = rooms.get(user.room);
            if (roomData) {
                // Kullanıcıyı offline yap
                const userInRoom = roomData.users.find(u => u.socketId === socket.id);
                if (userInRoom) {
                    userInRoom.online = false;
                    userInRoom.lastSeen = new Date();
                }
                
                // Diğer kullanıcılara bildir
                socket.to(user.room).emit('user-left', {
                    username: user.username,
                    users: roomData.users
                });
                
                // 30 saniye sonra kullanıcıyı tamamen kaldır
                setTimeout(() => {
                    if (roomData.users) {
                        roomData.users = roomData.users.filter(u => u.socketId !== socket.id);
                        io.to(user.room).emit('users-update', roomData.users);
                    }
                }, 30000);
            }
            
            users.delete(socket.id);
        }
        
        console.log('Kullanıcı ayrıldı:', socket.id);
    });

    // Oda terk etme
    socket.on('leave-room', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.leave(user.room);
            
            const roomData = rooms.get(user.room);
            if (roomData) {
                roomData.users = roomData.users.filter(u => u.socketId !== socket.id);
                socket.to(user.room).emit('user-left', {
                    username: user.username,
                    users: roomData.users
                });
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('Chat uygulaması http://localhost:' + PORT + ' adresinde çalışıyor');
    console.log('Kullanım: Tarayıcınızla yukarıdaki adrese gidin');
});