from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.core.files.storage import FileSystemStorage
from django.views.decorators.csrf import csrf_exempt

import os
import bencodepy
import json
import requests
import hashlib


from . import torrent_utils
from .configs import CONFIGS


def index(request):
    # Get peer info from session
    peer_id = request.session.get("peer_id", None)
    peer_directory = request.session.get("peer_directory", None)

    # Pass peer info to template
    return render(
        request,
        "connect/index.html",
        {"peer_id": peer_id, "peer_directory": peer_directory},
    )


@csrf_exempt
def set_peer_info(request):
    if request.method == "POST":
        peer_id = request.POST.get("peer-id")
        peer_directory = request.POST.get("peer-directory")

        # Save peer info to session
        request.session["peer_id"] = peer_id
        request.session["peer_directory"] = peer_directory

        return JsonResponse({"success": True})

    return JsonResponse({"success": False})


# Clear peer info if requested
@csrf_exempt
def clear_peer_info(request):
    if request.method == "POST":
        # Remove peer info from session
        if "peer_id" in request.session:
            del request.session["peer_id"]
        if "peer_directory" in request.session:
            del request.session["peer_directory"]

        return JsonResponse({"success": True})

    return JsonResponse({"success": False})


@csrf_exempt
def read_torrent(request):
    if request.method == "POST" and request.FILES.get("torrent_file"):
        print("At read_torrent")
        torrent_file = request.FILES["torrent_file"]

        # Save the torrent file temporarily
        fs = FileSystemStorage()
        filename = fs.save(torrent_file.name, torrent_file)
        file_path = fs.path(filename)  # Get the correct file path

        try:
            # Read and decode the torrent file
            with open(file_path, "rb") as f:
                torrent_data = bencodepy.decode(f.read())

            # Recursively decode byte keys to strings where possible
            decoded_data = torrent_utils.decode_bytes(torrent_data)

            # Remove the temporary file after processing
            os.remove(file_path)

            # Return the torrent data as JSON
            return JsonResponse(decoded_data, safe=False)

        except Exception as e:
            # Remove the temporary file if an error occurs
            if os.path.exists(file_path):
                os.remove(file_path)

            return JsonResponse({"error": str(e)}, status=400)

    return render(request, "connect/read-torrent.html")


@csrf_exempt
def create_torrent(request):
    # Get peer info from session
    peer_id = request.session.get("peer_id", None)
    peer_directory = request.session.get("peer_directory", None)

    if request.method == "POST":
        filename = request.POST.get("filename")
        print(filename)
        if filename:
            torrent_data = torrent_utils.create_torrent_data(
                peer_id=peer_id, current_dir=peer_directory, filename=filename
            )
            print("Torrent data: ")
            print(torrent_data)

            is_success, creation_date_or_message = (
                torrent_utils.upload_torrent_data_to_tracker(torrent_data)
            )
            print(
                "is success:", is_success, "message:", creation_date_or_message
            )

            if is_success:
                # Add creation date to torrent_data
                torrent_data["creation date"] = creation_date_or_message

                torrent_file_path = torrent_utils.save_torrent_file_to_dir(
                    torrent_data=torrent_data, destination_dir=peer_directory
                )
                print("Torrent file path: " + torrent_file_path)

                return JsonResponse({"success": True})
            else:
                print("Error: ", creation_date_or_message)
                return JsonResponse(
                    {"success": False, "error": creation_date_or_message}
                )

        return JsonResponse({"success": False, "error": "Filename is required"})

    return render(
        request,
        "connect/create-torrent.html",
        {"peer_id": peer_id, "peer_directory": peer_directory},
    )


def download_file(request):
    # Get peer info from session
    peer_id = request.session.get("peer_id", None)
    peer_directory = request.session.get("peer_directory", None)

    return render(
        request,
        "connect/download-file.html",
        {"peer_id": peer_id, "peer_directory": peer_directory},
    )


def get_peer_id(request):
    peer_id = request.session.get("peer_id", None)

    if peer_id:
        return JsonResponse({"peerId": request.session["peer_id"]}, status=200)
    return JsonResponse({"error": "Peer ID not found"}, status=400)


def file_transfer(request):
    peer_id = request.session.get("peer_id", None)

    return render(request, "connect/file-transfer.html", {"peer_id": peer_id})


@csrf_exempt
def get_piece(request):
    """
    Serves a specific piece of a file based on the requested byte range.
    """
    if request.method == "POST":
        try:
            # Parse JSON data from the request body
            data = json.loads(request.body)

            # Extract required fields from the parsed data
            file_path = data.get("filePath")
            piece_length = int(data.get("pieceLength", 0))
            piece_index = int(data.get("pieceIndex", 0))
            piece_hash = data.get("pieceHash")

            print("File path:", file_path)
            print("Piece length:", piece_length)
            print("Piece index", piece_index)
            print("Piece hash", piece_hash)

            if not file_path or not piece_hash:
                return JsonResponse(
                    {"error": "Missing required parametes"}, status=400
                )

            try:
                # Calculate byte range for the requested piece
                offset = piece_index * piece_length

                # Read the piece from the file
                with open(file_path, "rb") as file:
                    file.seek(offset)
                    piece_data = file.read(piece_length)

                # Verify the integrity of the piece
                computed_hash = hashlib.sha1(piece_data).hexdigest()
                if computed_hash != piece_hash:
                    return JsonResponse(
                        {"error": "Piece hash mismatch"}, status=400
                    )

                # Return the piece data as a binary response
                response = HttpResponse(
                    piece_data, content_type="application/octet-stream"
                )
                response["Content-Disposition"] = (
                    f'attachment; filename="{piece_hash}.bin"'
                )
                return response

            except FileNotFoundError:
                return JsonResponse({"error": "File not found"}, status=404)
            except Exception as e:
                return JsonResponse({"error": str(e)}, status=500)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def handle_received_piece(request):
    """
    Handles a received piece, saves it as a file, and assembles the original file if all pieces are present.
    """
    if request.method == "POST":
        try:
            # Extract data from the request
            piece_data = request.FILES.get("piece_data")
            piece_hash = request.POST.get("piece_hash")
            piece_hashes = request.POST.getlist("piece_hashes")
            filename = request.POST.get("filename")

            print("Piece data:", piece_data)
            print("Piece hash:", piece_hash)
            print("Piece hashes:", piece_hashes)
            print("Filename:", filename)

            if (
                not piece_data
                or not piece_hash
                or not piece_hashes
                or not filename
            ):
                return JsonResponse(
                    {"error": "Missing required data."}, status=400
                )

            # Save the piece as a binary file
            peer_directory = request.session.get("peer_directory", None)
            piece_file_path = os.path.join(peer_directory, f"{piece_hash}.bin")
            with open(piece_file_path, "wb") as f:
                for chunk in piece_data.chunks():
                    f.write(chunk)

            assembled_file_path = os.path.join(peer_directory, filename)
            if all(
                os.path.exists(os.path.join(peer_directory, f"{h}.bin"))
                for h in piece_hashes
            ):
                # Assemble the file from all pieces
                with open(assembled_file_path, "wb") as assembled_file:
                    for h in piece_hashes:
                        piece_path = os.path.join(peer_directory, f"{h}.bin")
                        with open(piece_path, "rb") as piece_file:
                            assembled_file.write(piece_file.read())

                # Optionally, clean up the individual piece files
                for h in piece_hashes:
                    os.remove(os.path.join(peer_directory, f"{h}.bin"))

                # Send request to tracker to seed file
                # Test
                return JsonResponse(
                    {
                        "message": "File assembled and seeded successfully.",
                        "file_path": assembled_file_path,
                    }
                )

                # TODO
                success, message = (
                    torrent_utils.send_request_to_seed_file_to_tracker(
                        peer_id=request.session.get("peer_id"),
                        current_directory=peer_directory,
                        file_path=assembled_file_path,
                        file_length=os.path.getsize(assembled_file_path),
                        piece_length=CONFIGS["PIECE_LENGTH"],
                        pieces=piece_hashes,
                    )
                )

                if success:
                    return JsonResponse(
                        {
                            "message": "File assembled and seeded successfully.",
                            "file_path": assembled_file_path,
                        }
                    )
                else:
                    return JsonResponse(
                        {
                            "message": "File assembled but failed to seed.",
                            "error": message,
                        },
                        status=500,
                    )

            return JsonResponse(
                {"message": "Piece received and saved successfully."}
            )

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Invalid request method."}, status=405)
