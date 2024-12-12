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

async function handleIncomingRequest(conn, data) {
	if (data.type === "request") {
		// Logic for handling piece request (JSON data)
		const { file_length, filename, file_directory, file_path, piece_length, piece_range, piece_hashes, sender_peer_id } = data;

		console.log(`Received request from ${sender_peer_id} from piece index: ${piece_range[0]["piece_index"]} to piece index: ${piece_range.at(-1)["piece_index"]}.`);

		// Iterate through piece_range to fetch and send each piece
		for (const piece of piece_range) {
			const { piece_index, piece_hash } = piece;

			try {
				// Await the result of getPiece to resolve the binary data
				const pieceData = await getPiece(file_length, filename, file_directory, file_path, piece_length, piece_hash, piece_index);

				if (pieceData) {
					// Check if we already have a connection to the sender peer
					let senderPeerConn = connections[sender_peer_id];

					// If no connection, establish a new one
					if (!senderPeerConn) {
						// Create a connection to the sender peer (Peer B)
						senderPeerConn = peer.connect(sender_peer_id);

						// Wait for the connection to open
						await new Promise((resolve, reject) => {
							senderPeerConn.on("open", resolve);
							senderPeerConn.on("error", reject);
						});

						// Store the connection in the connections map
						connections[sender_peer_id] = senderPeerConn;
					}

					// Now send the resolved piece data to the sender peer
					senderPeerConn.send({
						type: "piece",
						piece_data: pieceData, // Resolved binary data
						filename: filename,
						file_length: file_length,
						piece_length: piece_length,
						piece_index: piece_index,
						piece_hash: piece_hash,
						piece_hashes: piece_hashes,
					});
				} else {
					// Handle error if piece data is null (failure in fetching)
					conn.send({
						type: "error",
						message: `Failed to fetch piece ${piece_index}`,
					});
				}
			} catch (error) {
				console.error(`Failed to fetch piece ${piece_index}:`, error);
				// Optionally, send an error response back to the requester
				conn.send({
					type: "error",
					message: `Failed to fetch piece ${piece_index}`,
				});
			}
		}
	} else if (data.type === "piece") {
		// Logic for handling file data (binary file)
		console.log(`Received file data from ${data.sender_peer_id}`);
		console.log("Incoming data:", data);
		console.log("Calling handleReceivedPiece...");
		// Handle piece data (binary)
		const result = await handleReceivedPiece(data.piece_data, data.filename, data.file_length, data.piece_length, data.piece_index, data.piece_hash, data.piece_hashes);

		console.log("Result after handle received piece:", result);
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

async function handleReceivedPiece(pieceData, filename, fileLength, pieceLength, pieceIndex, pieceHash, pieceHashes) {
	console.log("Handle received piece.");

	const url = "/handle-received-piece";
	const formData = new FormData();
	formData.append("piece_data", new Blob([pieceData]));
	formData.append("filename", filename);
	formData.append("file_length", fileLength);
	formData.append("piece_length", pieceLength);
	formData.append("piece_index", pieceIndex);
	formData.append("piece_hash", pieceHash);
	pieceHashes.forEach((hash) => formData.append("piece_hashes", hash));

	try {
		const response = await fetch(url, {
			method: "POST",
			body: formData, // Using FormData to handle binary file upload
		});

		if (!response.ok) {
			throw new Error(`Error sending piece: ${response.statusText}`);
		}

		const result = await response.json();
		console.log(`Server response for piece ${pieceIndex}:`, result);
		return result;
	} catch (error) {
		console.error(`Failed to send piece ${pieceIndex}:`, error);
		return null;
	}
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
