# simple-torrent-client

## Specification

-   JSON example torrent

```python
{
	"announce": f"{tracker_url}/announce",
	"info": {
		"length": file_length,
		"name": filename,
		"piece length": piece_length,
		"pieces": pieces,
	},
	"user": { # Person who creates it
		"current directory": current_dir,
		"peer id": peer_id,
		"file path": file_path,
	},
}
```

-   Peer list

```json
{
	"peers": [
		{
			"file_directory": "current_dir_1",
			"peer_id": "peer_id_1",
			"file_path": "file_path_1"
		},
		{
			"file_directory": "current_dir_2",
			"peer_id": "peer_id_2",
			"file_path": "file_path_2"
		}
	]
}
```

-   Peer request

```javascript
{
	"type": "request",
	"file_length": file_length,
	"filename": filename,
	"file_directory": current_dir,
	"file_path": file_path,
	"piece_length": piece_length,
	"piece_range": [
		{
			"piece_hash": piece_hash,
			"piece_index": piece_index,
		},
	],
	"sender_peer_id": peer_id
}
```
