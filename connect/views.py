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
