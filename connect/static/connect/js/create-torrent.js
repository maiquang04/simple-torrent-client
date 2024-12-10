document.addEventListener("DOMContentLoaded", function () {
	const form = document.getElementById("torrent-form");
	const statusMessage = document.getElementById("status-message");
	const statusDiv = document.getElementById("status");

	form.addEventListener("submit", function (event) {
		event.preventDefault();

		const fileInput = document.getElementById("file-input");
		const file = fileInput.files[0];

		if (!file) {
			alert("Please choose a file!");
			return;
		}

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
			});
	});
});
