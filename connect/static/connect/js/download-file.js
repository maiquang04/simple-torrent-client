import { Configs } from "./configs.js";

let connections = {};
let activePeers = [];

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
				e.preventDefault();
				return false;
			};
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

							// Step 3: Get pieces
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

function requestPiecesFromPeers(peers, torrentData) {
	const torrentInfo = torrentData["info"];
	const pieces = torrentInfo["pieces"];
	const pieceLength = torrentInfo["piece length"];
	const fileLength = torrentInfo["length"];
	const filename = torrentInfo["name"];

	const totalPieces = pieces.length;
	const pieceRanges = divideRanges(totalPieces, peers.length);

	peers.forEach((peerInfo, index) => {
		const peerId = peerInfo["peer_id"];
		const fileDirectory = peerInfo["file_directory"]; // Get file_directory from peer list
		const filePath = peerInfo["file_path"]; // Get file_path from peer list
		const pieceRange = pieceRanges[index];

		createPeerForRemoteId(peerId, pieceRange, pieces, {
			fileLength,
			filename,
			pieceLength,
			fileDirectory,
			filePath,
		});
	});
}

function divideRanges(totalPieces, numPeers) {
	const rangeSize = Math.ceil(totalPieces / numPeers);
	const ranges = [];

	for (let i = 0; i < numPeers; i++) {
		const start = i * rangeSize;
		const end = Math.min(start + rangeSize, totalPieces);
		ranges.push({ start, end });
	}

	return ranges;
}

function createPeerForRemoteId(remotePeerId, pieceRange, pieces, torrentMeta) {
	if (connections[remotePeerId]) {
		console.log(`Reusing existing connection for peer ${remotePeerId}`);
		const connection = connections[remotePeerId];
		sendPieceRequest(connection, pieceRange, pieces, torrentMeta);
		return;
	}

	const peer = new Peer();
	activePeers.push(peer); // Add peer to the active list

	peer.on("open", (id) => {
		const connection = peer.connect(remotePeerId);

		connection.on("open", () => {
			console.log(`Connected to remote peer ID: ${remotePeerId}`);
			connections[remotePeerId] = connection; // Save the connection

			sendPieceRequest(connection, pieceRange, pieces, torrentMeta);
		});

		connection.on("data", (response) => {
			console.log(`Received data from remote peer ${remotePeerId}:`, response);
			// Handle the received piece data
		});

		connection.on("error", (err) => {
			console.error(`Connection error with peer ${remotePeerId}:`, err);
		});

		connection.on("close", () => {
			console.log(`Connection closed with peer ${remotePeerId}`);
			delete connections[remotePeerId];
		});
	});
	peer.on("error", (err) => {
		console.error(`Error initializing peer for remote peer ID ${remotePeerId}:`, err);
	});
}

function sendPieceRequest(connection, pieceRange, pieces, torrentMeta) {
	const pieceRangeData =
		pieceRange.start < pieceRange.end
			? pieces.slice(pieceRange.start, pieceRange.end).map((pieceHash, index) => ({
					piece_hash: pieceHash,
					piece_index: pieceRange.start + index,
			  }))
			: [];

	const senderPeerId = JSON.parse(document.getElementById("django-sender-peer-id").textContent);

	const requestData = {
		type: "request",
		file_length: torrentMeta.fileLength,
		filename: torrentMeta.filename,
		file_directory: torrentMeta.fileDirectory,
		file_path: torrentMeta.filePath,
		piece_length: torrentMeta.pieceLength,
		piece_hashes: pieces,
		piece_range: pieceRangeData,
		sender_peer_id: senderPeerId,
	};

	console.log(`Sending request to peer ${connection.peer}:`, requestData);
	connection.send(requestData);
}
