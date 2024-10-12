const socket = io();
const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const loadRoomsButton = document.querySelector("#loadRoomsButton"); // Nút Load Rooms
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');
let username = localStorage.getItem('username');
const passwordModal = document.getElementById('passwordModal');
const closeModal = document.querySelector('.close');
const modalJoinButton = document.getElementById('modalJoinButton');
let roomNameToJoin = "";
let micAllowed = 1;
let camAllowed = 1;

let mediaConstraints = { video: true, audio: true };

navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(localstream => {
        videoCont.srcObject = localstream;
    })
    
const createroomtext = 'Creating Room...';

createButton.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (!username || username.trim() === '') {
        console.error("Username không hợp lệ, vui lòng nhập tên hợp lệ");
        alert("Please enter a valid username.");
        return;
    }
    
    const roomName = document.getElementById("roomName").value.trim();
    const roomPassword = document.getElementById("roomPassword").value.trim();

    if (!roomName || !roomPassword) {
        alert("Please enter both room name and password.");
        return;
    }

    // Emit sự kiện để tạo phòng
    socket.emit("create room", roomName, roomPassword);

    const sessionId = new Date().getTime();  // Tạo session ID đơn giản
    localStorage.setItem('sessionId', sessionId);

    alert("Room created successfully!");
});

modalJoinButton.addEventListener('click', () => {
    const roomPassword = document.getElementById('modalPassword').value.trim();
    console.log("Attempting to join room:", roomNameToJoin, "with password:", roomPassword);
    
    if (!roomPassword) {
        alert("Please enter the password.");
        return;
    }

    const sessionId = localStorage.getItem('sessionId');
    const username = localStorage.getItem('username');
    if (!username || !sessionId) {
        console.error("User not authenticated, redirecting to login");
        location.href = "login.html";
        return;
    }

    // Gửi yêu cầu xác thực tới server
    socket.emit("check room password", roomNameToJoin, roomPassword, (isValid) => {
        console.log("Password check result for room:", roomNameToJoin, "isValid:", isValid);
        if (isValid) {
            console.log("Redirecting to room.html");
            location.href = `/room.html?room=${roomNameToJoin}&username=${encodeURIComponent(username)}&session=${sessionId}&password=${roomPassword}`;
        } else {
            alert("Incorrect password for the room. Please try again.");
        }
    });
});
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('join-room-btn')) {
        roomNameToJoin = event.target.dataset.roomName;
        passwordModal.style.display = "block";
        document.getElementById('modalPassword').focus(); // Đặt focus vào input mật khẩu khi modal hiện
    }
});

// Đóng modal khi nhấn dấu "x"
closeModal.addEventListener('click', () => {
    passwordModal.style.display = "none";
});
loadRoomsButton.addEventListener('click', () => {
    // Yêu cầu server gửi lại danh sách các phòng hiện có
    socket.emit("get rooms list");
});
// Cập nhật danh sách phòng khi server gửi sự kiện "update rooms list"
// Lắng nghe sự kiện từ server để cập nhật danh sách phòng
socket.on("update rooms list", (rooms) => {
    console.log("Received updated rooms list:", rooms); // Log để kiểm tra danh sách phòng
    const roomsListContainer = document.getElementById("roomsList");
    roomsListContainer.innerHTML = ""; // Clear current list

    rooms.forEach(room => {
        roomsListContainer.innerHTML += `
        <div class="list-group-item room-item">
            <span>${room.name}</span>
            <button class="btn btn-primary join-room-btn" data-room-name="${room.name}">Join</button>
        </div>`;
    });
});

cam.addEventListener('click', () => {
    if (camAllowed) {
        mediaConstraints = { video: false, audio: micAllowed ? true : false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        cam.classList = "nodevice";
        cam.innerHTML = `<i class="fas fa-video-slash"></i>`;
        camAllowed = 0;
    }
    else {
        mediaConstraints = { video: true, audio: micAllowed ? true : false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        cam.classList = "device";
        cam.innerHTML = `<i class="fas fa-video"></i>`;
        camAllowed = 1;
    }
})

mic.addEventListener('click', () => {
    if (micAllowed) {
        mediaConstraints = { video: camAllowed ? true : false, audio: false };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        mic.classList = "nodevice";
        mic.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        micAllowed = 0;
    }
    else {
        mediaConstraints = { video: camAllowed ? true : false, audio: true };
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        mic.innerHTML = `<i class="fas fa-microphone"></i>`;
        mic.classList = "device";
        micAllowed = 1;
    }
})
