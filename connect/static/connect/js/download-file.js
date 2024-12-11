import { Configs } from "./configs.js";

let peer = null;
let connections = {};

document.addEventListener("DOMContentLoaded", function () {
	const downloadButton = document.getElementById("download-btn");
	const torrentForm = document.getElementById("torrent-form");
	const statusMessage = document.getElementById("status-message");
	const torrentFile = document.getElementById("torrent-file");

	let isFetching = false; // Flag to track if a fetch request is in progress

	downloadButton.addEventListener("click", function () {
		if (isFetching) {
			statusMessage.innerText = "A request is already in progress. Please wait.";
			return;
		}

		isFetching = true; // Set flag to indicate fetch is in progress
		const formData = new FormData(torrentForm);

		// Step 1: Fetch decoded torrent data
		fetch("/read-torrent", {
			method: "POST",
			body: formData,
		})
			.then((response) => response.json())
			.then((data) => {
				// Check if decoded data is returned successfully
				if (data.error) {
					statusMessage.innerText = "Error decoding torrent file: " + data.error;
					return;
				}

				const decodedData = data; // Since data is directly the decoded torrent data

				// Step 2: Fetch peer list from tracker
				fetch(`${Configs.trackerUrl}/get-peer-list`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(decodedData),
				})
					.then((response) => response.json())
					.then((peerData) => {
						if (peerData.success) {
							const peers = peerData.peers;
							console.log("Peers:", peers);
							statusMessage.innerText = "Successfully get peer list!";

							// continue
							initializePeer();
							requestPiecesFromPeers(peers, decodedData);
						} else {
							statusMessage.innerText = "Failed to retrieve peer list.";
						}
					})
					.catch((error) => {
						console.error("Error fetching peers:", error);
						statusMessage.innerText = "Failed to get peer list.";
					});
			})
			.catch((error) => {
				console.error("Error decoding torrent:", error);
				statusMessage.innerText = "Error decoding torrent file.";
			})
			.finally(() => {
				torrentFile.value = "";
				isFetching = false; // Reset flag after the request finishes
			});
	});
});

function initializePeer() {
	peer = new Peer();

	// Listen for incoming connections
	peer.on("connection", (conn) => {
		console.log("Connected to peer:", conn.peer);

		conn.on("data", (data) => {
			console.log("Received data from peer:", data);
		});
	});

	peer.on("open", (id) => {
		console.log(`Download peer initialized with ID: ${id}`);
	});

	peer.on("error", (err) => {
		console.error("Peer error:", err);
	});
}

function requestPiecesFromPeers(peers, torrentData) {
	// Logic here
	const torrentInfo = torrentData["info"];
	const pieces = torrentInfo["pieces"];
	const pieceLength = torrentInfo["piece length"];
	const fileLength = torrentInfo["length"];
	const filename = torrentInfo["name"];

	// Fetch the current peer ID
	fetch("/get-peer-id")
		.then((response) => response.json())
		.then((peerIdData) => {
			if (peerIdData.error) {
				console.error("Error fetching sender_peer_id:", peerIdData.error);
				return;
			}

			const senderPeerId = peerIdData.peerId;

			pieces.forEach((pieceHash, index) => {
				// Select peer in a round-robin fashion
				const peerInfo = peers[index % peers.length];
				const peerId = peerInfo["peer_id"];
				const peerFileDirectory = peerInfo["file_directory"];
				const peerFilePath = peerInfo["file_path"];

				if (!connections[peerId]) {
					connections[peerId] = peer.connect(peerId);
				}

				const conn = connections[peerId];

				conn.on("open", () => {
					console.log(`Requesting piece ${index} from peer: ${peerId}`);

					const requestData = {
						type: "request",
						file_length: fileLength,
						filename: filename,
						file_directory: peerFileDirectory,
						file_path: peerFilePath,
						piece_length: pieceLength,
						piece_hash: pieceHash,
						piece_index: index,
						sender_peer_id: senderPeerId,
					};

					conn.send(requestData);

					// Handle response
					conn.on("data", (response) => {
						console.log(`Download peer received ${response}`);
					});
				});
			});
		})
		.catch((error) => {
			console.error("Error fetching sender_peer_id:", error);
		});
}
