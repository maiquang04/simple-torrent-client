import { Configs } from "./configs.js";

let peer = null;
let connections = {};
const pollInterval = 1000; // 1 second

function initializePeer(peerId) {
	peer = new Peer(peerId);

	// Listen for incoming connections
	peer.on("connection", (conn) => {
		console.log("Connected to peer:", conn.peer);

		// connections[conn.peer] = conn;

		conn.on("data", (data) => {
			// Handle received requests
			handleIncomingRequest(conn, data);
		});
	});

	peer.on("open", (id) => {
		console.log(`Peer initialized with ID: ${id}`);
	});

	peer.on("error", (err) => {
		console.error("Peer error:", err);
	});
}

function handleIncomingRequest(conn, data) {
	if (data.type === "request") {
		// Logic for handling piece request (JSON data)
		const { file_length, filename, file_directory, file_path, piece_length, piece_range, piece_hashes, sender_peer_id } = data;

		console.log(`Received request from ${sender_peer_id} from piece index: ${piece_range[0]["piece_index"]} to piece index: ${piece_range.at(-1)["piece_index"]}.`);

		// Iterate through piece_range to fetch and send each piece
		piece_range.forEach((piece) => {
			const { piece_index, piece_hash } = piece;
			const pieceData = getPiece(file_length, filename, file_directory, file_path, piece_length, piece_hash, piece_index);

			// Send back the piece data
			conn.send({
				type: "piece",
				piece_data: pieceData,
				filename: filename,
				file_length: file_length,
				piece_length: piece_length,
				piece_index: piece_index,
				piece_hash: piece_hash,
				piece_hashes: piece_hashes,
			});
		});
	} else if (data.type === "piece") {
		// Logic for handling file data (binary file)
		console.log(`Received file data from ${data.sender_peer_id}`);

		// Handle piece data (binary)
		handleReceivedPiece(data.piece_data, data.filename, data.file_length, data.piece_length, data.piece_index, data.piece_hash, data.piece_hashes);
	} else {
		console.error("Unknown data type received:", data);
	}
}

function getPiece(fileLength, filename, fileDirectory, filePath, pieceLength, pieceHash, pieceIndex) {
	// Logic to fetch or generate the requested piece
	// const str = `Binary data for piece ${pieceIndex}`;
	// console.log(str);
	// return str;

	const url = "/get-piece";
	const params = {
		fileLength,
		filename,
		fileDirectory,
		filePath,
		pieceLength,
		pieceHash,
		pieceIndex,
	};

	return fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(params),
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Error fetching piece: ${response.statusText}`);
			}
			return response.arrayBuffer(); // Adjusted to receive binary data
		})
		.then((binaryData) => {
			console.log(`Fetched binary data for piece ${pieceIndex}.`);
			return binaryData;
		})
		.catch((error) => {
			console.error(`Failed to fetch piece ${pieceIndex}:`, error);
			return null;
		});
}

function handleReceivedPiece(pieceData, filename, fileLength, pieceLength, pieceIndex, pieceHash, pieceHashes) {
	const url = "/handle-received-piece";

	const formData = new FormData();
	formData.append("piece_data", new Blob([pieceData]));
	formData.append("filename", filename);
	formData.append("file_length", fileLength);
	formData.append("piece_length", pieceLength);
	formData.append("piece_index", pieceIndex);
	formData.append("piece_hash", pieceHash);
	pieceHashes.forEach((hash) => formData.append("piece_hashes", hash));

	return fetch(url, {
		method: "POST",
		body: formData, // Using FormData to handle binary file upload
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Error sending piece: ${response.statusText}`);
			}
			return response.json();
		})
		.then((result) => {
			console.log(`Server response for piece ${pieceIndex}:`, result);
			return result;
		})
		.catch((error) => {
			console.error(`Failed to send piece ${pieceIndex}:`, error);
			return null;
		});
}

// Poll for peer ID every 1 second
function pollForPeerId() {
	const interval = setInterval(() => {
		console.log("Polling...");

		fetch("/get-peer-id")
			.then((response) => response.json())
			.then((data) => {
				if (data.peerId) {
					console.log("Peer ID trieved:", data.peerId);

					// Initialize PeerJS and stop polling
					initializePeer(data.peerId);

					document.getElementById("peer-init-message").textContent = "Peer initilization successful!";

					clearInterval(interval);
				}
			})
			.catch((err) => {
				console.error("Error fetching peer ID:", err);
			});
	}, pollInterval);
}

// Start polling for peer ID
pollForPeerId();
