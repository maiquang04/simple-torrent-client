import base64
import os
import json
import bencodepy
import hashlib
import requests

from .configs import CONFIGS


# Function to recursively decode byte strings into normal strings or base64 encode bytes
def decode_bytes(data):
    if isinstance(data, dict):
        return {
            decode_bytes(key): decode_bytes(value)
            for key, value in data.items()
        }
    elif isinstance(data, list):
        return [decode_bytes(item) for item in data]
    elif isinstance(data, bytes):
        try:
            # Try decoding bytes to string if it's UTF-8 text
            return data.decode("utf-8")
        except UnicodeDecodeError:
            # If it's not valid UTF-8, base64 encode it to make it JSON serializable
            return base64.b64encode(data).decode("utf-8")
    else:
        return data


def create_torrent_data(peer_id, current_dir, filename):
    piece_length = CONFIGS["PIECE_LENGTH"]
    tracker_url = CONFIGS["TRACKER_URL"]

    file_path = os.path.join(current_dir, filename)
    file_length = os.path.getsize(file_path)

    num_pieces = (file_length + piece_length - 1) // piece_length

    pieces = []

    # Open file in binary mode
    with open(file_path, "rb") as file:
        # Loop through each piece
        for i in range(num_pieces):
            # Read the piece
            piece = file.read(piece_length)

            # Generate SHA1 hash for this piece
            piece_hash = hashlib.sha1(piece).digest()  # SHA1 hash
            pieces.append(
                piece_hash.hex()
            )  # Store the hex representation of the hash

    torrent_data = {
        "announce": f"{tracker_url}/announce",
        "info": {
            "length": file_length,
            "name": filename,
            "piece length": piece_length,
            "pieces": pieces,
        },
        "user": {
            "current directory": current_dir,
            "peer id": peer_id,
            "file path": file_path,
        },
    }

    return torrent_data


def save_torrent_file_to_dir(torrent_data, destination_dir):
    # Convert the torrent data to a bencoded format
    bencoded_data = bencodepy.encode(torrent_data)

    torrent_filename = f"{torrent_data['info']['name']}.torrent"

    torrent_file_path = os.path.join(destination_dir, torrent_filename)

    # Write the bencoded data to the file
    with open(torrent_file_path, "wb") as torrent_file:
        torrent_file.write(bencoded_data)

    return torrent_file_path


def upload_torrent_data_to_tracker(
    torrent_data, tracker_url=CONFIGS["TRACKER_URL"]
):
    # Tracker URL for uploading the torrent data
    upload_url = f"{tracker_url}/upload-torrent"

    # Prepare the payload for the POST request
    payload = {
        "torrent_data": json.dumps(torrent_data)  # Convert data to JSON format
    }

    # Send the POST request with the torrent data
    try:
        response = requests.post(upload_url, json=payload)

        if response.status_code == 200:
            response_data = response.json()
            if response_data.get("success"):
                # Extract creation_date from the response, if available
                creation_date = response_data.get("creation date")
                return True, creation_date
            else:
                return False, "Failed to upload torrent"
        else:
            return (
                False,
                f"Failed to connect to tracker. Status code: {response.status_code}",
            )

    except Exception as e:
        return False, f"Error occured: {str(e)}"


def send_request_to_seed_file_to_tracker(
    peer_id, current_directory, file_path, file_length, piece_length, pieces
):
    """
    Sends a POST request to the tracker to seed the file after successful assembly.
    """
    tracker_url = CONFIGS["TRACKER_URL"]
    seed_file_url = f"{tracker_url}/seed-file"

    # Prepare the info dictionary
    info = {
        "length": file_length,
        "name": os.path.basename(file_path),
        "piece length": piece_length,
        "pieces": pieces,  # List of SHA1 hashes of the pieces
    }

    # Calculate the info_hash as the SHA1 hash of the bencoded info dictionary
    bencoded_info = bencodepy.encode(info)
    info_hash = hashlib.sha1(bencoded_info).hexdigest()

    # Prepare the payload
    payload = {
        "peer_id": peer_id,
        "current_directory": current_directory,
        "file_path": file_path,
        "file_length": file_length,
        "piece_length": piece_length,
        "info": info,
        "info_hash": info_hash,  # Include the calculated info_hash
    }

    try:
        # Send the POST request
        response = requests.post(seed_file_url, json=payload)

        # Check the response status
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get("success"):
                return True, response_data.get(
                    "message", "File seeded successfully."
                )
            else:
                return False, response_data.get("error", "Failed to seed file.")
        else:
            return (
                False,
                f"Failed to connect to tracker. Status code: {response.status_code}",
            )
    except Exception as e:
        return False, f"Error occurred while sending request: {str(e)}"
