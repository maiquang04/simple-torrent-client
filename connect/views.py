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
import base64


def index(request):
    return render(request, "connect/index.html")


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


@csrf_exempt
def read_torrent(request):
    if request.method == "POST" and request.FILES.get("torrent_file"):
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
            decoded_data = decode_bytes(torrent_data)

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
