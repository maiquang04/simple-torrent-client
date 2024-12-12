import { Configs } from "./configs.js";

let peer = null;
let connections = {};

document.addEventListener("DOMContentLoaded", function () {
	const downloadButton = document.getElementById("download-btn");
	const torrentForm = document.getElementById("torrent-form");
	const statusMessage = document.getElementById("status-message");
	const torrentFile = document.getElementById("torrent-file");

	let isFetching = false; // Flag to track if a fetch request is in progress

	downloadButton.addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();

		if (isFetching) {
			statusMessage.innerText = "A request is already in progress. Please wait.";
			return;
		}

		// Ensure no default form submission
		if (torrentForm.onsubmit) {
			torrentForm.onsubmit = function (e) {
				console.log("Here");
				e.preventDefault();
				return false;
			};
		}

		// console.log("Create peer");

		// const peer = new Peer("2-e389746d269843b09b62470f182e451aa");

		// let conn = peer.connect("3-c64dadbc55c34a2691412ed9708e08eb");

		// conn.on("open", () => {
		// 	console.log("Connected to:", "3-c64dadbc55c34a2691412ed9708e08eb");
		// });

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
	// Ensure Peer is properly initialized
	if (window.Peer) {
		peer = new Peer({
			debug: 2, // Enables all logging
		});

		// Listen for incoming connections
		peer.on("connection", (conn) => {
			console.log("Incoming connection from peer:", conn.peer);

			conn.on("data", (data) => {
				console.log("Received data from peer:", data);
				// Handle incoming data
			});

			conn.on("close", () => {
				console.log("Connection closed with peer:", conn.peer);
			});
		});

		peer.on("open", (id) => {
			console.log(`Download peer initialized with ID: ${id}`);
		});

		peer.on("error", (err) => {
			console.error("Peer error:", err);
			statusMessage.textContent = `Peer Error: ${err.message}`;
		});
	} else {
		console.error("PeerJS library not loaded");
		statusMessage.textContent = "PeerJS library not loaded";
	}
}

function requestPiecesFromPeers(peers, torrentData) {
	if (!peer) {
		console.error("Peer not initialized");
		return;
	}

	const torrentInfo = torrentData["info"];
	const pieces = torrentInfo["pieces"];
	const pieceLength = torrentInfo["piece length"];
	const fileLength = torrentInfo["length"];
	const filename = torrentInfo["name"];

	console.log("Torrent info:", torrentInfo);
	console.log("Pieces:", pieces);

	// Fetch the current peer ID
	fetch("/get-peer-id")
		.then((response) => response.json())
		.then((peerIdData) => {
			if (peerIdData.error) {
				throw new Error(peerIdData.error);
			}

			const senderPeerId = peerIdData.peerId;
			console.log("Sender peer ID:", senderPeerId);

			pieces.forEach((pieceHash, index) => {
				// Select peer in a round-robin fashion
				const peerInfo = peers[index % peers.length];
				const peerId = peerInfo["peer_id"];
				const peerFileDirectory = peerInfo["file_directory"];
				const peerFilePath = peerInfo["file_path"];

				// Establish connection to each peer
				let conn = peer.connect(peerId, {
					reliable: true, // Ensure reliable connection
				});

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
				});

				conn.on("data", (response) => {
					console.log(`Download peer received:`, response);
					// Handle the received piece data
				});

				conn.on("error", (err) => {
					console.error(`Connection error with peer ${peerId}:`, err);
				});
			});
		})
		.catch((error) => {
			console.error("Error in requesting pieces:", error);
		});
}
