import sys, pathlib, inspect

# garantir que estamos importando do site-packages, não de um arquivo local
print("Python:", sys.version)

try:
    import youtube_transcript_api
    from youtube_transcript_api import YouTubeTranscriptApi

    print("youtube_transcript_api file:", youtube_transcript_api.__file__)
    print("module attrs:", [a for a in dir(youtube_transcript_api) if a.startswith("YouTube") or a in ("__version__",)])
    print("class attrs:", [a for a in dir(YouTubeTranscriptApi) if not a.startswith("_")])
    print("version attr:", getattr(youtube_transcript_api, "__version__", "unknown"))
except Exception as e:
    print("Import error:", e)
