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
	"user": {
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
			"current directory": "current_dir_1",
			"peer id": "peer_id_1",
			"file path": "file_path_1"
		},
		{
			"current directory": "current_dir_2",
			"peer id": "peer_id_2",
			"file path": "file_path_2"
		}
	]
}
```
