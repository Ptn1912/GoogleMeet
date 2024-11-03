const path = require('path');
const express = require('express')
const https = require('https');
const fs = require('fs');
const moment = require('moment');
const socketio = require('socket.io');
const PORT = process.env.PORT || 8080;
const key = fs.readFileSync('key.pem');
const cert = fs.readFileSync('cert.pem');
const app = express();
const server = https.createServer({ key: key, cert: cert }, app); 
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};
let socketroom = {};
let socketname = {};
let micSocket = {};
let videoSocket = {};
let roomBoard = {};
let clientLogs = [];
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',  // Thay bằng user MySQL của bạn
    password: '123456',  // Thay bằng password của bạn
    database: 'Meeting_System'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database!');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);  // Mã hóa mật khẩu

    const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    connection.query(sql, [username, email, hashedPassword], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'User registration failed.' });
        }
        res.status(201).json({ message: 'User registered successfully!' });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password.' });
    }

    const sql = 'SELECT UserID, Username, Email, Password FROM users WHERE email = ?';
    connection.query(sql, [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials db.' });
        }
        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const updateOnlineStatus = 'UPDATE users SET isOnline = 1 WHERE email = ?';
        connection.query(updateOnlineStatus, [email], (err, updateResult) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update online status.' });
            }
            res.json({ message: 'Login successful!', user: user.Username, UserID: user.UserID });
        });
    });
});

app.post('/logout', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Missing username.' });
    }

    // Cập nhật trạng thái IsOnline về 0 khi người dùng logout
    const sql = 'UPDATE users SET IsOnline = 0 WHERE username = ?';
    connection.query(sql, [username], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to update online status.' });
        }
        res.json({ message: 'User logged out and status updated.' });
    });
});

io.on('connect', socket => {
    // Tạo phòng với mật khẩu
    socket.on("create room", async (userid, roomName, roomPassword) => {
        if (rooms[roomName]) {
            socket.emit('message', 'Room already exists. Please choose a different name.', 'Bot');
            return;
        }
        try {
            const hashedPassword = await bcrypt.hash(roomPassword, 10);
    
            const sql = 'INSERT INTO rooms (room_name, room_pwd, UserID) VALUES (?, ?, ?)';
            connection.query(sql, [roomName, hashedPassword, userid], (err, result) => {
                if (err) {
                    console.error('Error saving room to database:', err);
                    socket.emit('message', 'Error creating room. Please try again.', 'Bot');
                    return;
                }
    
                // Store room info in memory after saving to database
                rooms[roomName] = {
                    password: hashedPassword,
                    sockets: []  // List of connected sockets
                };
    
                socket.emit('message', `Room ${roomName} created successfully!`, 'Bot');
                io.emit("update rooms list", Object.keys(rooms).map(name => ({ name })));
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            socket.emit('message', 'Error creating room. Please try again.', 'Bot');
        }
    });
    socket.on("create and join quick room", async (callback) => {
        let roomPassword = Math.random().toString(36).substring(2, 10); // Generate a random password
    
        // Ensure the password is unique by checking existing rooms
        while (rooms[roomPassword]) {
            roomPassword = Math.random().toString(36).substring(2, 10);
        }
    
        // Create a quick room and store only in memory
        rooms[roomPassword] = {
            password: await bcrypt.hash(roomPassword, 10),
            sockets: []
        };
    
        // Join the creator to the room
        socket.join(roomPassword);
        rooms[roomPassword].sockets.push(socket.id);
        socketroom[socket.id] = roomPassword;
        socketname[socket.id] = "Host";
    
        // Return the generated password to the client
        callback(roomPassword);
    });
    
    socket.on("join quick room", async (roomPassword, username) => {
        const room = rooms[roomPassword];
        
        if (!room) {
            socket.emit('message', 'Room not found or has expired.', 'Bot');
            return;
        }
    
        // Join the room and send a welcome message
        socket.join(roomPassword);
        room.sockets.push(socket.id);
        socketname[socket.id] = username;
        socketroom[socket.id] = roomPassword;
    
        socket.emit('message', `Welcome ${username}!`, 'Bot');
        io.to(roomPassword).emit('user joined', `${username} has joined the room.`);
    });
    
    // Kiểm tra mật khẩu phòng
    socket.on("check room password", (roomName, roomPassword, callback) => {
        const sql = 'SELECT*FROM rooms WHERE room_name = ?';
        connection.query(sql, [roomName], async (err, results) => {
            if (err || results.length === 0) {
                console.log(`Room ${roomName} does not exist.`);
                callback(false);
                return;
            }
        const storedPassword = results[0].Room_pwd;
    
            // Ensure both storedPassword and roomPassword are valid
            if (!roomPassword || !storedPassword) {
                console.log(`Password comparison failed for room ${roomName}`);
                callback(false);
                return;
            }
    
            try {
                const isValid = await bcrypt.compare(roomPassword, storedPassword);
                callback(isValid);
            } catch (error) {
                console.error('Error during password comparison:', error);
                callback(false);
            }
        });
    });
    
    
    // Tham gia phòng
    socket.on("join room", (roomid, username) => {
        if (!username) {
            console.log("Error: Missing username");
            return;
        } else if (!roomid) {
            console.log("Error: Missing roomid");
            return;
        }
    
        console.log(`User ${username} is joining room ${roomid}`);
        const joinTime = moment().format("h:mm:ss a");
        clientLogs.push({
            id: socket.id,
            username: username,
            roomid: roomid,
            joinTime: joinTime,
            leaveTime: null
        });
    
        io.emit('client logs', clientLogs);
        socket.join(roomid);
        socketroom[socket.id] = roomid;
        socketname[socket.id] = username;
        micSocket[socket.id] = 'on';
        videoSocket[socket.id] = 'on';
    
        if (!rooms[roomid]) {
            rooms[roomid] = {
                password: null,
                sockets: []
            };
        }
    
        rooms[roomid].sockets.push(socket.id);
        socket.to(roomid).emit('message', `${username} đã tham gia phòng.`, 'Bot', moment().format("h:mm a"));
        io.to(roomid).emit('user count', rooms[roomid].sockets.length);
        io.to(socket.id).emit('join room', rooms[roomid].sockets.filter(pid => pid !== socket.id), socketname, micSocket, videoSocket);
    
        console.log(`Người dùng hiện tại trong phòng ${roomid}:`, rooms[roomid].sockets);
    });
    
    socket.on("get rooms list", () => {
        const sql = 'SELECT * FROM rooms'; // Adjust the query to select the room names
    
        connection.query(sql, (err, results) => {
            if (err) {
                console.error('Error retrieving rooms from database:', err);
                socket.emit("update rooms list", []); // Send an empty array on error
                return;
            }
            // Map results to an array of room objects
            const rooms = results.map(row => ({ name: row.Room_name }));
            // Emit the updated rooms list to the client
            socket.emit("update rooms list", rooms);
        });
    });
    
    socket.on('action', msg => {
        if (msg == 'mute')
            micSocket[socket.id] = 'off';
        else if (msg == 'unmute')
            micSocket[socket.id] = 'on';
        else if (msg == 'videoon')
            videoSocket[socket.id] = 'on';
        else if (msg == 'videooff')
            videoSocket[socket.id] = 'off';

        socket.to(socketroom[socket.id]).emit('action', msg, socket.id);
    })

    socket.on('video-offer', (offer, sid) => {
        socket.to(sid).emit('video-offer', offer, socket.id, socketname[socket.id], micSocket[socket.id], videoSocket[socket.id]);
    })

    socket.on('video-answer', (answer, sid) => {
        socket.to(sid).emit('video-answer', answer, socket.id);
    })

    socket.on('new icecandidate', (candidate, sid) => {
        socket.to(sid).emit('new icecandidate', candidate, socket.id);
    })
    socket.on('fetch messages', (roomid, callback) => {
        const getRoomIdQuery = 'SELECT RoomID FROM rooms WHERE Room_name = ?';
        connection.query(getRoomIdQuery, [roomid], (err, roomResults) => {
            if (err || roomResults.length === 0) {
                console.error('Lỗi khi lấy RoomID từ Room_name:', err);
                callback([]);
                return;
            }

            const actualRoomId = roomResults[0].RoomID;

            // Get all messages for the room
            const getMessagesQuery = 'SELECT users.Username, messages.Content, messages.Timestamp FROM messages JOIN users ON messages.UserID = users.UserID WHERE messages.RoomID = ? ORDER BY messages.Timestamp';
            connection.query(getMessagesQuery, [actualRoomId], (err, messageResults) => {
                if (err) {
                    console.error('Lỗi khi lấy tin nhắn từ cơ sở dữ liệu:', err);
                    callback([]);
                    return;
                }
                
                // Send all messages back to the client
                callback(messageResults);
            });
        });
    });
    socket.on('message', (msg, username, roomid) => {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        
        // Phát tin nhắn đến phòng
        io.to(roomid).emit('message', msg, username, timestamp);
    
        // Lấy RoomID từ Room_name (roomid chính là Room_name)
        const getRoomIdQuery = 'SELECT RoomID FROM rooms WHERE Room_name = ?';
        connection.query(getRoomIdQuery, [roomid], (err, roomResults) => {
            if (err) {
                console.error('Lỗi khi lấy RoomID từ Room_name:', err);
                return;
            }
    
            if (roomResults.length > 0) {
                const actualRoomId = roomResults[0].RoomID;  // RoomID thực sự từ Room_name
    
                // Tiếp tục lấy UserID từ username
                const getUserIdQuery = 'SELECT UserID FROM users WHERE Username = ?';
                connection.query(getUserIdQuery, [username], (err, userResults) => {
                    if (err) {
                        console.error('Lỗi khi lấy UserID:', err);
                        return;
                    }
    
                    if (userResults.length > 0) {
                        const userId = userResults[0].UserID;
    
                        // Lưu tin nhắn vào bảng messages với RoomID thực sự
                        const saveMessageQuery = 'INSERT INTO messages (UserID, RoomID, Content, Timestamp) VALUES (?, ?, ?, ?)';
                        connection.query(saveMessageQuery, [userId, actualRoomId, msg, timestamp], (err, result) => {
                            if (err) {
                                console.error('Lỗi khi lưu tin nhắn vào cơ sở dữ liệu:', err);
                                return;
                            }
                            console.log('Tin nhắn đã được');
                        });
                    } else {
                        console.error('Không tìm thấy UserID cho username:', username);
                    }
                });
            } else {
                console.error('Không tìm thấy RoomID cho Room_name:', roomid);
            }
        });
    });
    
    
    socket.on('file', (fileInfo, username, roomid) => {
        io.to(roomid).emit('file', fileInfo, username, moment().format("h:mm a"));
    });
    socket.on('getCanvas', () => {
        if (roomBoard[socketroom[socket.id]])
            socket.emit('getCanvas', roomBoard[socketroom[socket.id]]);
    });

    socket.on('draw', (newx, newy, prevx, prevy, color, size) => {
        socket.to(socketroom[socket.id]).emit('draw', newx, newy, prevx, prevy, color, size);
    })

    socket.on('clearBoard', () => {
        socket.to(socketroom[socket.id]).emit('clearBoard');
    });

    socket.on('store canvas', url => {
        roomBoard[socketroom[socket.id]] = url;
    })

    socket.on('disconnect', () => {
        if (!socketroom[socket.id]) return;
    
        const roomid = socketroom[socket.id];
        const leaveTime = moment().format("h:mm:ss a");
    
        // Cập nhật clientLogs với thời gian rời khỏi phòng
        clientLogs = clientLogs.map(log => {
            if (log.id === socket.id) {
                log.leaveTime = leaveTime;  // Cập nhật thời gian rời đi
            }
            return log;
        });
    
        // Phát log cập nhật đến tất cả các kết nối
        io.emit('client logs', clientLogs);
    
        // Xóa người dùng khỏi phòng
        if (rooms[roomid] && Array.isArray(rooms[roomid].sockets)) {
            const index = rooms[roomid].sockets.indexOf(socket.id);
            if (index !== -1) {
                rooms[roomid].sockets.splice(index, 1);
            }
    
            // Gửi thông báo đến phòng rằng người dùng đã rời đi
            socket.to(roomid).emit('message', `${socketname[socket.id]} đã rời khỏi phòng.`, 'Bot', moment().format("h:mm a"));
            socket.to(roomid).emit('remove peer', socket.id); // Gửi sự kiện để người dùng khác loại bỏ video
    
            // Cập nhật số lượng người dùng còn lại trong phòng
            io.to(roomid).emit('user count', rooms[roomid].sockets.length);
    
            // Xóa thông tin socket
            delete socketroom[socket.id];
            delete socketname[socket.id];
            delete micSocket[socket.id];
            delete videoSocket[socket.id];
        } else {
            console.error(`Room with id ${roomid} is not valid or not an array.`);
        }
    
        console.log('--------------------');
        console.log(`Người dùng đã rời khỏi phòng ${roomid}`);
        if (rooms[roomid]) {
            console.log(`Người dùng còn lại trong phòng ${roomid}:`, rooms[roomid]);
        }
    });
    
    
    
    socket.on('get client logs', () => {
        socket.emit('client logs', clientLogs);
    });
})


server.listen(PORT, () => console.log(`Server is up and running on port ${PORT} (HTTPS)`));