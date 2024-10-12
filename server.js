const path = require('path');
const express = require('express')
const http = require('http')
const moment = require('moment');
const socketio = require('socket.io');
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};
let socketroom = {};
let socketname = {};
let micSocket = {};
let videoSocket = {};
let roomBoard = {};
let clientLogs = [];

io.on('connect', socket => {
    // Tạo phòng với mật khẩu
    socket.on("create room", (roomName, roomPassword) => {
        if (rooms[roomName]) {
            socket.emit('message', 'Room already exists. Please choose a different name.', 'Bot');
            return;
        }
    
        // Lưu trữ thông tin phòng, bao gồm mật khẩu và danh sách socket (ở dạng mảng)
        rooms[roomName] = {
            password: roomPassword,
            sockets: [] // Đảm bảo đây là mảng để lưu danh sách socket của phòng
        };
    
        socket.emit('message', `Room ${roomName} created successfully!`, 'Bot');
    
        // Cập nhật danh sách phòng cho tất cả người dùng
        io.emit("update rooms list", Object.keys(rooms).map(name => ({ name })));
    });
    
    // Kiểm tra mật khẩu phòng
    socket.on("check room password", (roomName, roomPassword, callback) => {
        if (!rooms[roomName]) {
            console.log(`Room ${roomName} does not exist.`);
            callback(false);
            return;
        }

        if (rooms[roomName].password !== roomPassword) {
            console.log(`Incorrect password for room ${roomName}`);
            callback(false);
            return;
        }

        // Nếu tên phòng và mật khẩu đúng
        callback(true);
    });

    // Tham gia phòng
    socket.on("join room", (roomid, username, sessionId) => {
        if (!username || !roomid || !sessionId) {
            console.log("Error: Missing roomid, username, or sessionId when user joins the room");
            return;
        }

        console.log(`User ${username} with session ID ${sessionId} is joining room ${roomid}`);
        const joinTime = moment().format("h:mm:ss a");
        clientLogs.push({ 
            id: socket.id, 
            sessionId: sessionId,
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

        rooms[roomid].sockets.push(socket.id);
        socket.to(roomid).emit('message', `${username} joined the room.`, 'Bot', moment().format("h:mm a"));
        io.to(socket.id).emit('join room', rooms[roomid].sockets.filter(pid => pid != socket.id), socketname, micSocket, videoSocket);

        io.to(roomid).emit('user count', rooms[roomid].sockets.length);
    });
    socket.on("get rooms list", () => {
        socket.emit("update rooms list", Object.keys(rooms).map(name => ({ name })));
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

    socket.on('message', (msg, username, roomid) => {
        io.to(roomid).emit('message', msg, username, moment().format(
            "h:mm a"
        ));
    })
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
    
        // Gửi thông báo đến phòng rằng người dùng đã rời đi
        const roomid = socketroom[socket.id];
        socket.to(roomid).emit('message', `${socketname[socket.id]} left the chat.`, `Bot`, moment().format("h:mm a"));
        socket.to(roomid).emit('remove peer', socket.id);
    
        // Xóa người dùng khỏi phòng
        if (rooms[roomid] && Array.isArray(rooms[roomid])) {
            const index = rooms[roomid].indexOf(socket.id);
            if (index !== -1) {
                rooms[roomid].splice(index, 1);
            }
    
            // Cập nhật số lượng người dùng còn lại trong phòng
            io.to(roomid).emit('user count', rooms[roomid].length);
        } else {
            console.error(`Room with id ${roomid} is not valid or not an array.`);
        }
    
        // Xóa các thông tin lưu trữ của socket sau khi ngắt kết nối
        delete socketroom[socket.id];
        delete socketname[socket.id];
        delete micSocket[socket.id];
        delete videoSocket[socket.id];
    
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


server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));