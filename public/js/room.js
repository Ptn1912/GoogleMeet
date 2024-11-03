const socket = io();
const myvideo = document.querySelector("#vd1");
const chatRoom = document.querySelector(".chat-cont");
const videoContainer = document.querySelector("#vcont");
const videoButt = document.querySelector(".novideo");
const audioButt = document.querySelector(".audio");
const cutCall = document.querySelector(".cutcall");
const screenShareButt = document.querySelector(".screenshare");
const whiteboardButt = document.querySelector(".board-icon");
const { ipcRenderer } = require("electron");
let roomid;
const whiteboardCont = document.querySelector(".whiteboard-cont");
const canvas = document.querySelector("#whiteboard");
const ctx = canvas.getContext("2d");
let boardVisisble = false;
let screenStream; // Luồng chia sẻ màn hình
let localStream;
whiteboardCont.style.visibility = "hidden";

document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  let roomid = params.get("room");
  const username = params.get("username") || localStorage.getItem('username');
  const roomPassword = params.get("password");
  const sendButton = document.querySelector(".chat-send"); // Nút gửi tin nhắn
  const messageField = document.querySelector(".chat-input");
  const fileInput = document.getElementById("chatFileInput");
  const fileButton = document.querySelector(".chat-file-button");
  // if (!roomid || !username || !roomPassword) {
  //   location.href = "/";
  // }

  if (!username) {
    alert("Username not found. Redirecting to login.");
    location.href = "/login.html";
    return;
}
  if (!roomid) {
    roomid = roomPassword; // Use the password as a unique room identifier for quick rooms
}
  const nameTagElement = document.querySelector("#myname");
  if (nameTagElement) {
      nameTagElement.textContent = `${username} (You)`;
    }

  const roomCodeElement = document.querySelector(".roomcode");
  if (roomCodeElement) {
    // roomCodeElement.textContent = `Room ID: ${roomid}, Password: ${roomPassword}`;
    roomCodeElement.textContent = `Password: ${roomPassword}`;
  } else {
    console.error("Không tìm thấy phần tử .roomcode để hiển thị mã phòng.");
  }

  // Kết nối socket và tham gia phòng
  socket.emit("join room", roomid, username);

  sendButton.addEventListener("click", () => {
    const msg = messageField.value;
    if (!msg.trim()) return; // Đảm bảo không gửi tin nhắn rỗng
    messageField.value = ""; // Xóa nội dung trong trường nhập sau khi gửi

    // Gửi tin nhắn qua socket
    socket.emit("message", msg, username, roomid);
  });

  // Bạn cũng có thể thêm sự kiện cho trường nhập để gửi tin nhắn khi nhấn Enter
  messageField.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendButton.click(); // Kích hoạt nút gửi tin nhắn khi nhấn Enter
    }
  });
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      // Create a FileReader to read the file
      const reader = new FileReader();
      reader.onload = () => {
        // Emit the file content and its name through the socket
        socket.emit(
          "file",
          {
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result,
          },
          username,
          roomid
        );
      };
      reader.readAsDataURL(file); // Read the file as Base64
    }
  });
  // Lắng nghe tin nhắn từ server để hiển thị trong giao diện chat
  socket.on("message", (msg, sendername, time) => {
    const chatRoom = document.querySelector(".chat-cont");
    chatRoom.scrollTop = chatRoom.scrollHeight; // Cuộn xuống cuối khung chat
    chatRoom.innerHTML += `
        <div class="message">
            <div class="info">
                <div class="username">${sendername}</div>
                <div class="time">${time}</div>
            </div>
            <div class="content">
                ${msg}
            </div>
        </div>`;
  });
  socket.emit("fetch messages", roomid, (messages) => {
    messages.forEach(message => {
        chatRoom.innerHTML += `
            <div class="message">
                <div class="info">
                    <div class="username">${message.Username}</div>
                    <div class="time">${moment(message.Timestamp).format("h:mm a")}</div>
                </div>
                <div class="content">
                    ${message.Content}
                </div>
            </div>`;
    });
    chatRoom.scrollTop = chatRoom.scrollHeight; // Scroll to the bottom after loading messages
});
  socket.on("file", (fileInfo, sendername, time) => {
    const chatRoom = document.querySelector(".chat-cont");
    chatRoom.scrollTop = chatRoom.scrollHeight; // Scroll to the bottom
    chatRoom.innerHTML += `
        <div class="message">
            <div class="info">
                <div class="username">${sendername}</div>
                <div class="time">${time}</div>
            </div>
            <div class="content">
                File: <a href="${fileInfo.data}" download="${fileInfo.name}">${fileInfo.name}</a>
            </div>
        </div>`;
  });
  cutCall.addEventListener("click", () => {
    socket.emit("disconnect");
    localStorage.setItem("username", username);
    localStorage.removeItem("roomId"); // If applicable, clear any room-specific information
    location.href = `/index.html?username=${encodeURIComponent(username)}`;
  });
});

let isDrawing = 0;
let x = 0;
let y = 0;
let color = "black";
let drawsize = 3;
let colorRemote = "black";
let drawsizeRemote = 3;

function fitToContainer(canvas) {
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

fitToContainer(canvas);

//getCanvas call is under join room call
socket.on("getCanvas", (url) => {
  let img = new Image();
  img.onload = start;
  img.src = url;

  function start() {
    ctx.drawImage(img, 0, 0);
  }

  console.log("got canvas", url);
});

function setColor(newcolor) {
  color = newcolor;
  drawsize = 3;
}

function setEraser() {
  color = "white";
  drawsize = 10;
}

//might remove this
function reportWindowSize() {
  fitToContainer(canvas);
}

window.onresize = reportWindowSize;
//

function clearBoard() {
  if (
    window.confirm(
      "Are you sure you want to clear board? This cannot be undone"
    )
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit("store canvas", canvas.toDataURL());
    socket.emit("clearBoard");
  } else return;
}

socket.on("clearBoard", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function draw(newx, newy, oldx, oldy) {
  ctx.strokeStyle = color;
  ctx.lineWidth = drawsize;
  ctx.beginPath();
  ctx.moveTo(oldx, oldy);
  ctx.lineTo(newx, newy);
  ctx.stroke();
  ctx.closePath();

  socket.emit("store canvas", canvas.toDataURL());
}

function drawRemote(newx, newy, oldx, oldy) {
  ctx.strokeStyle = colorRemote;
  ctx.lineWidth = drawsizeRemote;
  ctx.beginPath();
  ctx.moveTo(oldx, oldy);
  ctx.lineTo(newx, newy);
  ctx.stroke();
  ctx.closePath();
}

canvas.addEventListener("mousedown", (e) => {
  x = e.offsetX;
  y = e.offsetY;
  isDrawing = 1;
});

canvas.addEventListener("mousemove", (e) => {
  if (isDrawing) {
    draw(e.offsetX, e.offsetY, x, y);
    socket.emit("draw", e.offsetX, e.offsetY, x, y, color, drawsize);
    x = e.offsetX;
    y = e.offsetY;
  }
});

window.addEventListener("mouseup", (e) => {
  if (isDrawing) {
    isDrawing = 0;
  }
});

socket.on("draw", (newX, newY, prevX, prevY, color, size) => {
  colorRemote = color;
  drawsizeRemote = size;
  drawRemote(newX, newY, prevX, prevY);
});

//whiteboard js end

let videoAllowed = 1;
let audioAllowed = 1;

let micInfo = {};
let videoInfo = {};

let videoTrackReceived = {};

let mymuteicon = document.querySelector("#mymuteicon");
mymuteicon.style.visibility = "hidden";

let myvideooff = document.querySelector("#myvideooff");
myvideooff.style.visibility = "hidden";

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

const mediaConstraints = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 15, max: 30 },
  },
  audio: true,
};

let connections = {};
let cName = {};
let audioTrackSent = {};
let videoTrackSent = {};

let mystream, myscreenshare;

function CopyClassText() {
  // Tìm phần tử chứa mã phòng
  const textToCopy = document.querySelector(".roomcode");

  if (!textToCopy) {
    console.error("Không tìm thấy phần tử chứa mã phòng");
    return;
  }

  // Lấy văn bản từ phần tử chứa mã phòng
  const roomCode = textToCopy.textContent;

  // Sử dụng Clipboard API để sao chép
  navigator.clipboard
    .writeText(roomCode)
    .then(() => {
      console.log("Sao chép thành công!");
      document.querySelector(".copycode-button").textContent = "Copied!";
      setTimeout(() => {
        document.querySelector(".copycode-button").textContent = "Copy Code";
      }, 3000);
    })
    .catch((err) => {
      console.error("Không thể sao chép vào clipboard:", err);
    });
}

socket.on("user count", (count) => {
  if (count > 1) {
    videoContainer.className = "video-cont";
  } else {
    videoContainer.className = "video-cont-single";
  }
});

let peerConnection;

function handleGetUserMediaError(e) {
  switch (e.name) {
    case "NotFoundError":
      alert(
        "Unable to open your call because no camera and/or microphone" +
          "were found."
      );
      break;
    case "SecurityError":
    case "PermissionDeniedError":
      break;
    default:
      alert("Error opening your camera and/or microphone: " + e.message);
      break;
  }
}

function reportError(e) {
  console.log(e);
  return;
}

function startCall() {
  const mediaConstraints = { video: true, audio: true };

  navigator.mediaDevices
    .getUserMedia(mediaConstraints)
    .then(stream  => {
      localStream = stream;
      mystream = stream;
      myvideo.srcObject = stream;
      myvideo.muted = true; // Để tránh nghe lại âm thanh của chính mình

      // Gửi track cho tất cả các kết nối hiện có
      Object.values(connections).forEach((peerConnection) => {
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });
      });
    })
    .catch((e) => {
      console.error("Lỗi khi truy cập camera và micro:", e);
      alert(
        "Không thể truy cập camera hoặc micro. Vui lòng kiểm tra cài đặt quyền."
      );
    });
}

function handleVideoOffer(offer, sid, cname, micinf, vidinf) {
  console.log("Handling video offer from:", cname);
  console.log("Offer:", offer);
  cName[sid] = cname;
  console.log("video offered recevied");
  micInfo[sid] = micinf;
  videoInfo[sid] = vidinf;
  connections[sid] = new RTCPeerConnection(configuration);
  connections[sid].onicecandidateerror = (event) => {
    console.error(
      `ICE Candidate Error on sid: ${sid} - Code: ${event.errorCode}, Text: ${event.errorText}, Address: ${event.address}`
    );
  };

  connections[sid].onicecandidate = function (event) {
    if (event.candidate) {
      console.log("icecandidate fired");
      socket.emit("new icecandidate", event.candidate, sid);
    }
  };
  connections[sid].oniceconnectionstatechange = function () {
    console.log(
      "ICE state for",
      sid,
      ": ",
      connections[sid].iceConnectionState
    );
    if (
      connections[sid].iceConnectionState === "failed" ||
      connections[sid].iceConnectionState === "disconnected"
    ) {
      console.error(`ICE connection failed for SID: ${sid}`);
    }
  };

  connections[sid].ontrack = function (event) {
    console.log("Track event received from:", sid, event.streams);
    if (!document.getElementById(sid)) {
      console.log("track event fired");
      let vidCont = document.createElement("div");
      let newvideo = document.createElement("video");
      let name = document.createElement("div");
      let muteIcon = document.createElement("div");
      let videoOff = document.createElement("div");
      videoOff.classList.add("video-off");
      muteIcon.classList.add("mute-icon");
      name.classList.add("nametag");
      name.innerHTML = `${cName[sid]}`;
      vidCont.id = sid;
      muteIcon.id = `mute${sid}`;
      videoOff.id = `vidoff${sid}`;
      muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
      videoOff.innerHTML = "Video Off";
      vidCont.classList.add("video-box");
      newvideo.classList.add("video-frame");
      newvideo.autoplay = true;
      newvideo.playsinline = true;
      newvideo.id = `video${sid}`;
      newvideo.srcObject = event.streams[0];

      if (micInfo[sid] == "on") muteIcon.style.visibility = "hidden";
      else muteIcon.style.visibility = "visible";

      if (videoInfo[sid] == "on") videoOff.style.visibility = "hidden";
      else videoOff.style.visibility = "visible";

      vidCont.appendChild(newvideo);
      vidCont.appendChild(name);
      vidCont.appendChild(muteIcon);
      vidCont.appendChild(videoOff);

      videoContainer.appendChild(vidCont);
    }
  };

  connections[sid].onremovetrack = function (event) {
    if (document.getElementById(sid)) {
      document.getElementById(sid).remove();
      console.log("removed a track");
    }
  };

  connections[sid].onnegotiationneeded = function () {
    connections[sid]
      .createOffer()
      .then(function (offer) {
        console.log("Created offer for SID:", sid);
        return connections[sid].setLocalDescription(offer);
      })
      .then(function () {
        socket.emit("video-offer", connections[sid].localDescription, sid);
        // socket.emit('video-offer', connections[sid].localDescription, sid);

        socket.emit("video-offer", connections[sid].localDescription, sid);
      })
      .catch(reportError);
  };

  let desc = new RTCSessionDescription(offer);

  connections[sid]
    .setRemoteDescription(desc)
    .then(() => {
      return navigator.mediaDevices.getUserMedia(mediaConstraints);
    })
    .then((stream) => {
        stream.getTracks().forEach((track) => {
        connections[sid].addTrack(track, stream);
        console.log("added local stream to peer");
        if (track.kind === "audio") {
          audioTrackSent[sid] = track;/////////moi sua
          if (!audioAllowed) audioTrackSent[sid].enabled = false;
        } else {
          videoTrackSent[sid] = track;
          if (!videoAllowed) videoTrackSent[sid].enabled = false;
        }
      });
    })
    .then(() => {
      return connections[sid].createAnswer();
    })
    .then((answer) => {
      return connections[sid].setLocalDescription(answer);
    })
    .then(() => {
      socket.emit("video-answer", connections[sid].localDescription, sid);
    })
    .catch(handleGetUserMediaError);
}

function handleNewIceCandidate(candidate, sid) {
  if (connections[sid]) {
    const newCandidate = new RTCIceCandidate(candidate);
    connections[sid]
      .addIceCandidate(newCandidate)
      .catch((error) =>
        console.error(`Error adding received ICE candidate: ${error}`)
      );
  }
}

function handleVideoAnswer(answer, sid) {
  console.log("answered the offer");
  const ans = new RTCSessionDescription(answer);
  connections[sid].setRemoteDescription(ans);
}

//Thanks to (https://github.com/miroslavpejic85) for ScreenShare Code

let screenshareEnabled = false;

screenShareButt.addEventListener("click", async () => {
  if (!screenshareEnabled) {
    try {
      const inputSources = await ipcRenderer.invoke("get-sources");

      // Hiển thị hộp thoại lựa chọn nguồn
      const source = inputSources[0]; // Ví dụ: luôn chọn nguồn đầu tiên (bạn có thể hiển thị danh sách và chọn)

      // Sử dụng nguồn đã chọn để lấy stream
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: source.id,
            minWidth: 1280,
            maxWidth: 1280,
            minHeight: 720,
            maxHeight: 720,
          },
        },
      });

      // Sau khi có stream, thay thế track video hiện tại
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(connections).forEach(peerConnection => {
        const sender = peerConnection.getSenders().find(s => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });
    //   // Thay thế video track của camera bằng track của màn hình
    //   const sender = localStream.getVideoTracks()[0];
    //   localStream.removeTrack(sender);
    //   localStream.addTrack(screenTrack);

      // Hiển thị video chia sẻ màn hình cho người dùng
      myvideo.srcObject = screenStream;
      myvideo.muted = true;
      screenshareEnabled = true;
      screenShareButt.classList.remove("btn-outline-primary");
      screenShareButt.classList.add("btn-danger");
      screenShareButt.innerHTML = `<i class="fas fa-desktop"style="color:white"></i><span class="tooltiptext">Stop Share Screen</span>`;
      screenShareButt.style.backgroundColor = "#b12c2c";

      // Xử lý khi chia sẻ màn hình kết thúc
      screenTrack.onended = stopScreenShare;
    //   localVideo.srcObject = localStream;
    //   localVideo.classList.add("screen-video");

      // Gửi lại stream mới tới các peer
      
    } catch (e) {
      alert("Unable to get screen stream: " + e.message);
      console.error("Unable to get screen stream", e);
    }
} else {
    stopScreenShare();
  }
});

function stopScreenShare() {
    const cameraTrack = localStream.getVideoTracks()[0];
  
    // Quay lại camera cho tất cả các peer
    Object.values(connections).forEach(peerConnection => {
      const sender = peerConnection.getSenders().find(s => s.track.kind === "video");
      if (sender) {
        sender.replaceTrack(cameraTrack);
      }
    });
  
    // Cập nhật lại video về camera
    myvideo.srcObject = localStream;
  
    screenshareEnabled = false;
    screenShareButt.classList.remove("btn-danger");
    screenShareButt.classList.add("btn-outline-primary");
    screenShareButt.innerHTML = `<i class="fas fa-desktop"style="color:white"></i><span class="tooltiptext">Share Screen</span>`;
    screenShareButt.style.backgroundColor = "#4ECCA3";
  }
socket.on("video-offer", handleVideoOffer);

socket.on("new icecandidate", (candidate, sid) => {
  console.log("Received new ICE candidate for SID:", sid, candidate);
  handleNewIceCandidate(candidate, sid);
});

socket.on("video-answer", handleVideoAnswer);

socket.on("join room", async (conc, cnames, micinfo, videoinfo) => {
  socket.emit("getCanvas");
  if (cnames) cName = cnames;

  if (micinfo) micInfo = micinfo;

  if (videoinfo) videoInfo = videoinfo;

  console.log(cName);
  if (conc) {
    await conc.forEach((sid) => {
      connections[sid] = new RTCPeerConnection(configuration);

      connections[sid].onicecandidate = function (event) {
        if (event.candidate) {
          socket.emit("new icecandidate", event.candidate, sid);
        }
      };

      connections[sid].ontrack = function (event) {
        console.log("Track event received from:", sid, event.streams);
        if (!document.getElementById(sid)) {
          console.log("track event fired");
          let vidCont = document.createElement("div");
          let newvideo = document.createElement("video");
          let name = document.createElement("div");
          let muteIcon = document.createElement("div");
          let videoOff = document.createElement("div");
          videoOff.classList.add("video-off");
          muteIcon.classList.add("mute-icon");
          name.classList.add("nametag");
          name.innerHTML = `${cName[sid]}`;
          vidCont.id = sid;
          muteIcon.id = `mute${sid}`;
          videoOff.id = `vidoff${sid}`;
          muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
          videoOff.innerHTML = "Video Off";
          vidCont.classList.add("video-box");
          newvideo.classList.add("video-frame");
          newvideo.autoplay = true;
          newvideo.playsinline = true;
          newvideo.id = `video${sid}`;
          newvideo.srcObject = event.streams[0];

          if (micInfo[sid] == "on") muteIcon.style.visibility = "hidden";
          else muteIcon.style.visibility = "visible";

          if (videoInfo[sid] == "on") videoOff.style.visibility = "hidden";
          else videoOff.style.visibility = "visible";

          vidCont.appendChild(newvideo);
          vidCont.appendChild(name);
          vidCont.appendChild(muteIcon);
          vidCont.appendChild(videoOff);

          videoContainer.appendChild(vidCont);
        }
      };

      connections[sid].onremovetrack = function (event) {
        if (document.getElementById(sid)) {
          document.getElementById(sid).remove();
        }
      };

      connections[sid].onnegotiationneeded = function () {
        connections[sid]
          .createOffer({ iceRestart: true })
          .then((offer) => connections[sid].setLocalDescription(offer))
          .then(() => {
            socket.emit("video-offer", connections[sid].localDescription, sid);
          })
          .catch(reportError);
      };
    });

    console.log("added all sockets to connections");
    startCall();
  } else {
    console.log("waiting for someone to join");
    navigator.mediaDevices
      .getUserMedia(mediaConstraints)
      .then((localStream) => {
        myvideo.srcObject = localStream;
        mystream = localStream;
        myvideo.muted = true;
      })
      .catch(handleGetUserMediaError);
  }
});

socket.on("remove peer", (socketId) => {
  const peerElement = document.getElementById(socketId);
  if (peerElement) {
      peerElement.remove();
      console.log(`Video của người dùng với socket ID ${socketId} đã bị xóa khỏi giao diện.`);
  } else {
      console.warn(`Không tìm thấy video của socket ID ${socketId} để xóa.`);
  }
});



videoButt.addEventListener("click", () => {
  if (videoAllowed) {
    for (let key in videoTrackSent) {
      videoTrackSent[key].enabled = false;
    }
    videoButt.innerHTML = `<i class="fas fa-video-slash"></i>`;
    videoAllowed = 0;
    videoButt.style.backgroundColor = "#b12c2c";

    if (mystream) {
      mystream.getTracks().forEach((track) => {
        if (track.kind === "video") {
          track.enabled = false;
        }
      });
    }
    myvideooff.style.visibility = "visible";
    socket.emit("action", "videooff");
  } else {
    for (let key in videoTrackSent) {
      videoTrackSent[key].enabled = true;
    }
    videoButt.innerHTML = `<i class="fas fa-video"></i>`;
    videoAllowed = 1;
    videoButt.style.backgroundColor = "#4ECCA3";
    if (mystream) {
      mystream.getTracks().forEach((track) => {
        if (track.kind === "video") track.enabled = true;
      });
    }
    myvideooff.style.visibility = "hidden";
    socket.emit("action", "videoon");
  }
});

audioButt.addEventListener("click", () => {
  if (audioAllowed) {
    for (let key in audioTrackSent) {
      audioTrackSent[key].enabled = false;
    }
    audioButt.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
    audioAllowed = 0;
    audioButt.style.backgroundColor = "#b12c2c";
    if (mystream) {
      mystream.getTracks().forEach((track) => {
        if (track.kind === "audio") track.enabled = false;
      });
    }

    mymuteicon.style.visibility = "visible";

    socket.emit("action", "mute");
  } else {
    for (let key in audioTrackSent) {
      audioTrackSent[key].enabled = true;
    }
    audioButt.innerHTML = `<i class="fas fa-microphone"></i>`;
    audioAllowed = 1;
    audioButt.style.backgroundColor = "#4ECCA3";
    if (mystream) {
      mystream.getTracks().forEach((track) => {
        if (track.kind === "audio") track.enabled = true;
      });
    }

    mymuteicon.style.visibility = "hidden";

    socket.emit("action", "unmute");
  }
});

socket.on("action", (msg, sid) => {
  if (msg == "mute") {
    console.log(sid + " muted themself");
    document.querySelector(`#mute${sid}`).style.visibility = "visible";
    micInfo[sid] = "off";
  } else if (msg == "unmute") {
    console.log(sid + " unmuted themself");
    document.querySelector(`#mute${sid}`).style.visibility = "hidden";
    micInfo[sid] = "on";
  } else if (msg == "videooff") {
    console.log(sid + "turned video off");
    document.querySelector(`#vidoff${sid}`).style.visibility = "visible";
    videoInfo[sid] = "off";
  } else if (msg == "videoon") {
    console.log(sid + "turned video on");
    document.querySelector(`#vidoff${sid}`).style.visibility = "hidden";
    videoInfo[sid] = "on";
  }
});

whiteboardButt.addEventListener("click", () => {
  if (boardVisisble) {
    whiteboardCont.style.visibility = "hidden";
    boardVisisble = false;
  } else {
    whiteboardCont.style.visibility = "visible";
    boardVisisble = true;
  }
});

