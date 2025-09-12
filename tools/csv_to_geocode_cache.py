#!/usr/bin/env python3
import csv
import json
import os

INPUT_CSV = os.environ.get('INPUT_CSV', 'address_keys.csv')
OUTPUT_JSON = os.environ.get('OUTPUT_JSON', 'geocoded_cache.json')

def parse_float(s):
    try:
        return float(s)
    except Exception:
        return None

def main():
    cache = {}
    with open(INPUT_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            lat = parse_float(row.get('lat', '').strip())
            lng = parse_float(row.get('lng', '').strip())
            if lat is None or lng is None:
                continue  # skip rows without coordinates

            payload = {'lat': lat, 'lng': lng}

            key_zip = (row.get('key_with_zip') or '').strip()
            key_no_zip = (row.get('key_no_zip') or '').strip()

            if key_zip:
                cache[key_zip] = payload
            if key_no_zip:
                cache[key_no_zip] = payload

    with open(OUTPUT_JSON, 'w') as f:
        json.dump(cache, f, indent=2)

    print(f"Wrote {len(cache)} keys to {OUTPUT_JSON}")

if __name__ == '__main__':
    main()

