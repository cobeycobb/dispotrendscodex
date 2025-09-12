#!/usr/bin/env python3
import json
import csv
import os

INPUT_JSON = os.environ.get('INPUT_JSON', 'dispensary_data.json')
OUTPUT_CSV = os.environ.get('OUTPUT_CSV', 'address_keys.csv')

def main():
    with open(INPUT_JSON, 'r') as f:
        data = json.load(f)

    locations = data.get('dispensaries') or data.get('locations', {}).get('data') or []
    if not locations:
        raise SystemExit('No dispensary locations found in JSON.')

    # Build unique address records keyed by (address, city, zip)
    seen = set()
    rows = []
    for d in locations:
        address = (d.get('address') or '').strip()
        city = (d.get('city') or '').strip()
        zip_code = str(d.get('zip') or '').strip()
        licensee = (d.get('licensee') or '').strip()

        key_zip = f"{address}, {city} {zip_code}".strip()
        key_nozip = f"{address}, {city}".strip()
        uniq = (address.lower(), city.lower(), zip_code)
        if uniq in seen:
            continue
        seen.add(uniq)
        rows.append({
            'key_with_zip': key_zip,
            'key_no_zip': key_nozip,
            'address': address,
            'city': city,
            'zip': zip_code,
            'licensee': licensee,
            'lat': '',
            'lng': ''
        })

    # Sort for easier editing: by city then address
    rows.sort(key=lambda r: (r['city'].lower(), r['address'].lower()))

    fieldnames = ['key_with_zip', 'key_no_zip', 'address', 'city', 'zip', 'licensee', 'lat', 'lng']
    with open(OUTPUT_CSV, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} unique addresses to {OUTPUT_CSV}")

if __name__ == '__main__':
    main()

