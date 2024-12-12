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
	const str = `Binary data for piece ${pieceIndex}`;
	console.log(str);
	return str;
}

function handleReceivedPiece(pieceData, filename, fileLength, pieceLength, pieceIndex, pieceHash, pieceHashes) {
	console.log(`Storing received piece ${pieceIndex} at your computer`);

	// Implement logic to save the file
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
