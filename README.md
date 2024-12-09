# simple-torrent-client

## Specification

-   JSON example torrent

```json
{
	"announce": "https://stag-caring-notably.ngrok-free.app/announce",
	"info": {
		"length": 2980328,
		"name": "Freak.mp3",
		"piece length": 524288, // 512KB
		"pieces": ["hash-value-piece-0", "hash-value-piece-1", "hash-value-piece-2"]
	},
	"user": {
		"current directory": "D:\\test-torrent\\2-peer",
		"peer id": "2-e389746d269843b09b62470f182e451a"
	}
}
```
