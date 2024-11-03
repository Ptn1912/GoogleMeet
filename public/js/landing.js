const socket = io();
const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const loadRoomsButton = document.querySelector("#loadRoomsButton"); // Nút Load Rooms
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');
// let username = localStorage.getItem('username');
const passwordModal = document.getElementById('passwordModal');
const closeModal = document.querySelector('.close');
const modalJoinButton = document.getElementById('modalJoinButton');
let roomNameToJoin = "";
const joinInput = document.getElementById("joinRoomPassword");
const joinButton = document.getElementById("joinRoomButton");

let micAllowed = 1;
let camAllowed = 1;

let mediaConstraints = { video: true, audio: true };

navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(localstream => {
        videoCont.srcObject = localstream;
    })
joinInput.addEventListener("input", () => {
        if (joinInput.value.trim()) {
            joinButton.classList.add("active");
            joinButton.disabled = false;
        } else {
            joinButton.classList.remove("active");
            joinButton.disabled = true;
        }
});
    
joinButton.addEventListener("click", () => {
        const roomPassword = joinInput.value.trim();
        let username = localStorage.getItem('username');
        
        if (roomPassword) {
            location.href = `/room.html?password=${roomPassword}&username=${encodeURIComponent(localStorage.getItem('username'))}`;
        }
});
document.querySelector("#createQuickRoom").addEventListener('click', () => {
    let username = localStorage.getItem('username');
    
    if (!username) {
        alert("Please log in to create a quick room.");
        location.href = "login.html";
        return;
    }
    socket.emit("create and join quick room", (roomPassword) => {
        // Automatically join the user in the room and show them the password to share
        alert(`Quick Room created successfully! Use this password to invite others: ${roomPassword}`);
        
        // Redirect to the room page with the password for easy access
        location.href = `/room.html?password=${roomPassword}&username=${encodeURIComponent(localStorage.getItem('username'))}`;
    });
});
    
createButton.addEventListener('click', (e) => {
    e.preventDefault();
    const username = localStorage.getItem('username');
    const userid = localStorage.getItem('userid');
    // const 
    if (!username || username.trim() === '') {
        console.error("Username không hợp lệ, vui lòng nhập tên hợp lệ");
        alert("Please enter a valid username.");
        return;
    }
    if (!userid || userid.trim() === '') {
        console.error("userid không hợp lệ, vui lòng nhập tên hợp lệ");
        alert("Please enter a valid userid.");
        return;
    }
    
    const roomName = document.getElementById("roomName").value.trim();
    const roomPassword = document.getElementById("roomPassword").value.trim();

    if (!roomName || !roomPassword) {
        alert("Please enter both room name and password.");
        return;
    }

    // Emit sự kiện để tạo phòng
    socket.emit("create room",userid, roomName, roomPassword);
    console.log("Creating room with name:", roomName);
    console.log("Creating room with password:", roomPassword);
    console.log("Username:", username);

    alert("Room created successfully!");
});

modalJoinButton.addEventListener('click', () => {
    const roomPassword = document.getElementById('modalPassword').value.trim();
    const username = localStorage.getItem('username');
    
    if (!username) {
        location.href = "login.html"; // Redirect if no username found
        return;
    }

    socket.emit("check room password", roomNameToJoin, roomPassword, (isValid) => {
        if (isValid) {
            location.href = `/room.html?room=${roomNameToJoin}&username=${encodeURIComponent(username)}&password=${roomPassword}`;
        } else {
            alert("Incorrect password for the room.");
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
    // Request the server to send the list of available rooms
    socket.emit("get rooms list");
});

// Listen for the event from the server to update the rooms list
socket.on("update rooms list", (rooms) => {
    console.log("Received updated rooms list:", rooms); // Log the received rooms

    const roomsListContainer = document.getElementById("roomsList");
    roomsListContainer.innerHTML = ""; // Clear the current list

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
