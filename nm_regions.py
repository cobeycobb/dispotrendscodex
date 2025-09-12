"""
New Mexico regional mappings for dispensary dashboard
"""

# New Mexico regions based on geography and sales territory planning
NM_REGIONS = {
    "Northern New Mexico": [
        "Santa Fe", "Los Alamos", "Taos", "Espanola", "Las Vegas", 
        "White Rock", "Alcalde", "El Prado", "Taos Ski Valley", "Questa",
        "Red River", "Angel Fire", "Chama", "Raton", "Eagle Nest",
        "Mora", "Picuris Pueblo"
    ],
    
    "Central New Mexico": [
        "Albuquerque", "Albquerque", "Rio Rancho", "Bernalillo", "Los Lunas",
        "Belen", "Bosque Farms", "Corrales", "Los Ranchos", "Placitas",
        "Cedar Crest", "Edgewood", "Moriarty", "Estancia", "Madrid",
        "Peralta", "Rio Communities", "Pena Blanca", "San Ysidro"
    ],
    
    "Southern New Mexico": [
        "Las Cruces", "Roswell", "Carlsbad", "Alamogordo", "Las Cruces",
        "Mesilla", "Mesilla Park", "Anthony", "Santa Teresa", "Sunland Park",
        "Hatch", "Arrey", "Truth or Consequences", "Elephant Butte", 
        "Silver City", "Deming", "Columbus", "Lordsburg", "Bayard",
        "San Lorenzo", "Vado", "Tularosa", "Cloudcroft", "Ruidoso",
        "Ruidoso Downs", "Carrizozo", "Capitan", "Alto", "Lovington",
        "Hobbs", "Artesia", "Eunice", "Jal", "Loving", "Tatum"
    ],
    
    "Western New Mexico": [
        "Farmington", "Gallup", "Grants", "Aztec", "Bloomfield", "Kirtland",
        "Cuba", "Milan", "Socorro", "Yah Ta Hey", "Jemez Springs"
    ],
    
    "Eastern New Mexico": [
        "Clovis", "Portales", "Tucumcari", "Fort Sumner", "Santa Rosa",
        "Logan", "Clayton", "Vaughn", "Texico", "Glenrio", "Rodeo",
        "Timberon"
    ]
}

def get_region_for_city(city_name):
    """Get the region for a given city name"""
    if not city_name:
        return "Unknown"
    
    city_clean = city_name.strip()
    
    for region, cities in NM_REGIONS.items():
        if city_clean in cities:
            return region
    
    # If not found in mapping, try to guess based on major cities
    if "Albuquerque" in city_clean or "ABQ" in city_clean.upper():
        return "Central New Mexico"
    elif "Santa Fe" in city_clean:
        return "Northern New Mexico"
    elif "Las Cruces" in city_clean:
        return "Southern New Mexico"
    elif "Farmington" in city_clean:
        return "Western New Mexico"
    
    return "Other"

def get_all_regions():
    """Get list of all regions"""
    return list(NM_REGIONS.keys())

def get_cities_in_region(region_name):
    """Get list of cities in a specific region"""
    return NM_REGIONS.get(region_name, [])

# Region colors for mapping
REGION_COLORS = {
    "Northern New Mexico": "#2563eb",  # Blue
    "Central New Mexico": "#dc2626",   # Red  
    "Southern New Mexico": "#16a34a",  # Green
    "Western New Mexico": "#ca8a04",   # Yellow
    "Eastern New Mexico": "#9333ea",   # Purple
    "Other": "#6b7280"                 # Gray
}