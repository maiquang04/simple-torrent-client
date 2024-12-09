document.addEventListener("DOMContentLoaded", function () {
	const fileInput = document.getElementById("torrent-file-input");
	const torrentInfoDiv = document.getElementById("torrent-info");

	fileInput.addEventListener("change", handleFileSelect);

	function handleFileSelect(event) {
		// Clear the torrent info display
		torrentInfoDiv.textContent = "";

		const file = event.target.files[0];
		if (!file) {
			alert("Please select a torrent file.");
			return;
		}

		const formData = new FormData();
		formData.append("torrent_file", file);

		// Send the file to the backend
		fetch("/read-torrent/", {
			method: "POST",
			body: formData,
		})
			.then((response) => response.json())
			.then((data) => {
				displayTorrentInfo(data); // Show the parsed torrent info
			})
			.catch((error) => {
				console.error("Error uploading torrent file:", error);
			});
	}

	// Display the torrent information as JSON
	function displayTorrentInfo(torrent) {
		if (!torrent) {
			torrentInfoDiv.innerHTML = "<p>Error parsing torrent file.</p>";
			return;
		}

		const json = JSON.stringify(torrent, null, 2); // Format JSON for better readability
		torrentInfoDiv.textContent = json; // Display the formatted JSON
	}
});
