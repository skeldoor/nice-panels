#!/usr/bin/env python3
"""
Parallel tile downloader & stitcher
"""

import math
import os
import requests
from PIL import Image
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed

# ------------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------------
BASE_URL = (
    "https://maps.runescape.wiki/osrs/versions/2025-05-22_a/tiles/rendered/-1/3"
)
TILE_SIZE   = 256
GRID_SIZE   = 256          # 0..255 inclusive
OUT_FILE    = "full_map.png"
MAX_WORKERS = 64           # tune to your bandwidth / CPU
MAX_RETRIES = 1
TIMEOUT     = 10

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://maps.runescape.wiki/",
}
# ------------------------------------------------------------------

def fetch_tile(x: int, y: int) -> tuple[tuple[int, int], Image.Image]:
    """Return ((x, y), PIL.Image) or transparent placeholder on failure."""
    url = f"{BASE_URL}/0_{x}_{y}.png"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
            return (x, y), Image.open(BytesIO(resp.content)).convert("RGBA")
        except Exception as e:
            if attempt == MAX_RETRIES:
                return (x, y), Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))

def main():
    total = GRID_SIZE * GRID_SIZE
    digits = int(math.log10(total)) + 1
    full_w = full_h = GRID_SIZE * TILE_SIZE
    full_img = Image.new("RGBA", (full_w, full_h))

    print(f"Starting download with {MAX_WORKERS} threads …")
    done = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        # Submit all jobs
        futures = [pool.submit(fetch_tile, x, y)
                   for y in range(GRID_SIZE)
                   for x in range(GRID_SIZE)]

        # Collect results as they finish
        for fut in as_completed(futures):
            (x, y), tile = fut.result()
            full_img.paste(tile, (x * TILE_SIZE, y * TILE_SIZE))
            done += 1
            print(f"\rDownloaded {done:{digits}d}/{total}", end="", flush=True)

    print("\nSaving final image …")
    full_img.save(OUT_FILE)
    print(f"Done → {OUT_FILE} ({full_w}×{full_h})")

if __name__ == "__main__":
    main()