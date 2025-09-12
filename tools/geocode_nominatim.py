#!/usr/bin/env python3
"""
Optional helper: geocode addresses using OpenStreetMap Nominatim.
Requires network access. Use modest rate limiting to respect usage policy.

Usage examples:
  python3 tools/geocode_nominatim.py --input address_keys.csv --output geocoded_cache.json --city Albuquerque --limit 50
  python3 tools/geocode_nominatim.py --input address_keys.csv --output geocoded_cache.json
"""
import csv
import json
import time
import argparse
import urllib.parse
import urllib.request


def nominatim_search(query):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'addressdetails': 0,
        'limit': 1
    })
    req = urllib.request.Request(url, headers={
        'User-Agent': 'dispomap-geocoder/1.0 (contact: maps-contact@example.com)'
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        if not data:
            return None
        return {
            'lat': float(data[0]['lat']),
            'lng': float(data[0]['lon'])
        }


import re

def only_digits(s: str) -> str:
    return ''.join(ch for ch in s if ch.isdigit())

def normalize_query(address: str, city: str, zip_code: str) -> str:
    # Strip and collapse whitespace
    def clean(x):
        x = (x or '').strip()
        # remove duplicate punctuation spacing
        x = re.sub(r"\s+", " ", x)
        return x
    address = clean(address)
    city = clean(city)
    zip_digits = only_digits(zip_code or '')

    parts = [p for p in [address, city, 'NM'] if p]
    if zip_digits:
        parts.append(zip_digits)
    parts.append('USA')
    query = ', '.join(parts)
    # minor cleanup: remove duplicate commas/spaces
    query = re.sub(r",\s*,", ", ", query)
    query = re.sub(r"\s+", " ", query)
    return query.strip(' ,')

def generate_address_variants(address: str) -> list:
    """Generate relaxed address variants to improve geocoding hit rate.
    Removes suite/unit identifiers and trailing letters.
    """
    import re
    a = (address or '')
    variants = []
    base = a.strip()
    variants.append(base)
    # Remove Suite/Ste/Unit and following text
    v = re.sub(r"\b(Suite|Ste\.?|Unit)\b.*", "", base, flags=re.IGNORECASE).strip(', ').strip()
    if v and v not in variants:
        variants.append(v)
    # Remove trailing single letter (e.g., "Mallard Way B")
    v2 = re.sub(r"\s+[A-Za-z]$", "", v or base).strip(', ').strip()
    if v2 and v2 not in variants:
        variants.append(v2)
    # Remove content after comma (keep street only)
    v3 = (v2 or base).split(',')[0].strip()
    if v3 and v3 not in variants:
        variants.append(v3)
    return variants

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', default='address_keys.csv')
    ap.add_argument('--output', default='geocoded_cache.json')
    ap.add_argument('--city', default=None, help='Only geocode rows matching this city')
    ap.add_argument('--limit', type=int, default=None, help='Max number of rows to geocode')
    ap.add_argument('--sleep', type=float, default=1.2, help='Seconds to sleep between requests')
    args = ap.parse_args()

    # Load existing cache if present
    cache = {}
    try:
        with open(args.output, 'r') as f:
            cache = json.load(f)
    except Exception:
        cache = {}

    # Read CSV
    with open(args.input, 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Filter rows by city/limit
    filtered = []
    for r in rows:
        city = (r.get('city') or '').strip()
        if args.city and city.lower() != args.city.lower():
            continue
        filtered.append(r)
    if args.limit is not None:
        filtered = filtered[:args.limit]

    geocoded = 0
    for i, r in enumerate(filtered, 1):
        key_zip = (r.get('key_with_zip') or '').strip()
        key_no_zip = (r.get('key_no_zip') or '').strip()
        address = (r.get('address') or '').strip()
        city = (r.get('city') or '').strip()
        zip_code = (r.get('zip') or '').strip()

        requested = False
        # Skip if already cached
        if key_zip in cache or key_no_zip in cache:
            pass
        else:
            # Try progressive variants of the address
            variants = generate_address_variants(address)
            tried = []
            result = None
            for addr_variant in variants:
                query = normalize_query(addr_variant, city, zip_code)
                tried.append(query)
                try:
                    result = nominatim_search(query)
                    requested = True
                except Exception as e:
                    print(f"[{i}/{len(filtered)}] ERROR: {query} -> {e}")
                    result = None
                if result:
                    break
                time.sleep(args.sleep)

            if not result:
                print(f"[{i}/{len(filtered)}] NOT FOUND after variants:\n  " + "\n  ".join(tried))
            else:
                cache[key_no_zip] = result
                if key_zip:
                    cache[key_zip] = result
                geocoded += 1
                print(f"[{i}/{len(filtered)}] OK: {query} -> {result['lat']:.6f}, {result['lng']:.6f}")

        if requested:
            time.sleep(args.sleep)

    with open(args.output, 'w') as f:
        json.dump(cache, f, indent=2)

    print(f"Updated {args.output} with {geocoded} new results (total {len(cache)} keys)")

if __name__ == '__main__':
    main()
