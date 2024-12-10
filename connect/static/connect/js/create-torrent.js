document.addEventListener("DOMContentLoaded", function () {
	const form = document.getElementById("torrent-form");
	const statusMessage = document.getElementById("status-message");
	const statusDiv = document.getElementById("status");

	form.addEventListener("submit", function (event) {
		event.preventDefault();

		statusMessage.textContent = "";
		statusDiv.style.display = "none";

		const fileInput = document.getElementById("file-input");
		const file = fileInput.files[0];

		if (!file) {
			alert("Please choose a file!");
			return;
		}

		// Disable the file input and submit button to prevent further clicks
		fileInput.disabled = true;

		// Optionally, show a loading message or spinner
		statusMessage.textContent = "Creating torrent, please wait...";
		statusDiv.style.display = "block";

		// Send the file to the backend via POST
		fetch("/create-torrent", {
			method: "POST",
			body: new URLSearchParams({
				filename: file.name,
			}),
		})
			.then((response) => response.json())
			.then((data) => {
				if (data.success) {
					statusMessage.textContent = "Torrent created and uploaded successfully!";
					statusDiv.style.display = "block";
				} else {
					statusMessage.textContent = "Error: " + data.error;
					statusDiv.style.display = "block";
				}
			})
			.catch((error) => {
				statusMessage.textContent = "Error: " + error.message;
				statusDiv.style.display = "block";
			})
			.finally(() => {
				// Clear the file input after the process is complete
				fileInput.value = "";

				// Re-enable the file input after the operation is complete
				fileInput.disabled = false;
			});
	});
});
