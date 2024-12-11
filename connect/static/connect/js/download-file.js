import { Configs } from "./configs.js";

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

		// Fetch decoded torrent data
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

				// Fetch peer list from tracker
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
