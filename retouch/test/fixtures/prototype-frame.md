`prototype-frame.mp4` is a generated, silent 64×48 H.264 test clip: one second of
red followed by one second of blue. It contains no third-party media. The snapshot
browser test waits for a presented frame in the blue scene before copying it.

Regenerate with:

```sh
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i color=c=red:s=64x48:r=10:d=1 \
  -f lavfi -i color=c=blue:s=64x48:r=10:d=1 \
  -filter_complex '[0:v][1:v]concat=n=2:v=1:a=0[v]' -map '[v]' \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart prototype-frame.mp4
```
