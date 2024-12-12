from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("set-peer-info", views.set_peer_info, name="set-peer-info"),
    path("clear-peer-info", views.clear_peer_info, name="clear-peer-info"),
    path("read-torrent", views.read_torrent, name="read-torrent"),
    path("create-torrent", views.create_torrent, name="create-torrent"),
    path("download-file", views.download_file, name="download-file"),
    path("get-peer-id", views.get_peer_id, name="get-peer-id"),
    path("file-transfer", views.file_transfer, name="file-transfer"),
]
