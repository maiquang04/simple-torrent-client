document.addEventListener("DOMContentLoaded", function () {
	// const baseUrl = "http://127.0.0.1:8001";

	// Handle form submission
	document.getElementById("peer-info-form").addEventListener("submit", function (event) {
		event.preventDefault();
		const peerId = document.getElementById("peer-id").value;
		const peerDirectory = document.getElementById("peer-directory").value;

		// Send data to the server via POST
		fetch(`/set-peer-info`, {
			method: "POST",
			body: new URLSearchParams({
				"peer-id": peerId,
				"peer-directory": peerDirectory,
			}),
		})
			.then((response) => response.json())
			.then((data) => {
				// Optionally handle the response
				if (data.success) {
					alert("Information saved!");
				} else {
					alert("Error saving information.");
				}
			});

		if (peerId && peerDirectory) {
			document.getElementById("display-peer-id").textContent = peerId;
			document.getElementById("display-peer-directory").textContent = peerDirectory;
			document.getElementById("clear-peer-info").style.display = "inline";
		}
	});

	// Handle clear button click
	clearButton = document.getElementById("clear-peer-info");

	if (clearButton) {
		clearButton.addEventListener("click", function () {
			fetch(`/clear-peer-info`, {
				method: "POST",
				body: new URLSearchParams({
					"peer-id": "",
					"peer-directory": "",
				}),
			})
				.then((response) => response.json())
				.then((data) => {
					// Optionally handle the response
					if (data.success) {
						document.getElementById("peer-info").style.display = "none";
						document.getElementById("clear-peer-info").style.display = "none";
						alert("Information cleared!");
					}
				});
		});
	}
});
