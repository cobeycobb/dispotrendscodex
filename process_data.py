#!/usr/bin/env python3
"""
Process dispensary sales data from Excel files and create consolidated JSON for web dashboard
"""

import pandas as pd
import json
import os
import glob
from datetime import datetime
import re
from nm_regions import get_region_for_city, get_all_regions
import os

def normalize_company_name(licensee_name):
    """
    Normalize company names to group variations of the same company together.
    Examples:
    - "OCC ABQ LLC - COORS BLVD RETAIL" -> "OCC ABQ LLC"
    - "URBAN WELLNESS - 4TH ST RETAIL" -> "URBAN WELLNESS" 
    - "SCORE 420 - CENTRAL AVE MANUFACTURER" -> "SCORE 420"
    """
    if not licensee_name or pd.isna(licensee_name):
        return licensee_name
    
    # Strip whitespace
    name = licensee_name.strip()
    
    # Common patterns to extract base company name
    patterns = [
        # Pattern: "COMPANY - LOCATION" or "COMPANY- LOCATION"
        r'^(.+?)\s*-\s*.+$',
        # Pattern: "COMPANY LLC - LOCATION" 
        r'^(.+?LLC)\s*-\s*.+$',
        # Pattern: "COMPANY INC - LOCATION"
        r'^(.+?INC)\s*-\s*.+$',
        # Pattern: "COMPANY DISPENSARY LOCATION X" -> "COMPANY" 
        r'^(.+?)\s+DISPENSARY\s+.+$',
        # Pattern: "COMPANY RETAIL LOCATION" -> "COMPANY"
        r'^(.+?)\s+RETAIL\s*.+$',
        # Pattern: "COMPANY MANUFACTURER" -> "COMPANY"  
        r'^(.+?)\s+MANUFACTURER\s*$',
    ]
    
    # Try each pattern
    for pattern in patterns:
        match = re.match(pattern, name, re.IGNORECASE)
        if match:
            base_name = match.group(1).strip()
            # Don't return empty strings
            if base_name and len(base_name) > 2:
                return base_name
    
    # If no patterns match, return original name
    return name

def extract_month_year(filename):
    """Extract month and year from filename"""
    month_mapping = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
    }
    
    filename_lower = filename.lower()
    for month, num in month_mapping.items():
        if month in filename_lower:
            # Extract year from filename (assuming 2025)
            year_match = re.search(r'2025', filename_lower)
            year = '2025' if year_match else '2025'  # default to 2025
            return f"{year}-{num}"
    return None

def process_all_files():
    """Process all Excel and CSV files and create consolidated dataset"""
    all_data = []

    # Get all Excel and CSV files
    excel_files = glob.glob('dispodata/*.xlsx') + glob.glob('dispodata/*.xls') + glob.glob('dispodata/*.csv')

    print(f"Processing {len(excel_files)} files...")

    for file_path in sorted(excel_files):
        filename = os.path.basename(file_path)
        month_year = extract_month_year(filename)

        if not month_year:
            print(f"Warning: Could not extract date from {filename}")
            continue

        print(f"Processing {filename} -> {month_year}")

        try:
            # Read file (Excel or CSV)
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
                # Clean currency formatting from CSV files (remove $ and commas)
                for col in ['Medical Sales', 'Adult-Use Sales', 'Total Sales']:
                    if col in df.columns:
                        df[col] = df[col].replace(r'[\$,]', '', regex=True).replace('', '0')
                        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            else:
                df = pd.read_excel(file_path)

            # Add month column
            df['Month'] = month_year

            # Clean up data - remove rows with empty licensee names or total rows
            df = df.dropna(subset=['Licensee'])  # Remove rows with NaN licensee
            df = df[df['Licensee'].str.strip() != '']  # Remove rows with empty licensee
            df = df[~df['Licensee'].str.contains('TOTAL', case=False, na=False)]  # Remove total rows

            # Fill remaining NaN values with 0
            df = df.fillna(0)

            # Standardize column names
            df.columns = df.columns.str.strip()

            all_data.append(df)

        except Exception as e:
            print(f"Error processing {filename}: {e}")
    
    if not all_data:
        print("No data found!")
        return None
    
    # Combine all dataframes
    combined_df = pd.concat(all_data, ignore_index=True)
    
    print(f"Combined dataset shape: {combined_df.shape}")
    print(f"Months included: {sorted(combined_df['Month'].unique())}")
    
    return combined_df

def calculate_enhanced_trend(aggregated_totals, avg_monthly_sales):
    """
    Enhanced trend calculation with volume-based thresholds and statistical robustness
    """
    import statistics
    
    if len(aggregated_totals) < 4:  # Minimum data requirement
        return 'insufficient_data', 0, 'low'
    
    # Volume-based stability thresholds
    if avg_monthly_sales < 50000:  # Small dispensary
        stability_threshold = 0.25  # 25%
    elif avg_monthly_sales < 200000:  # Medium dispensary  
        stability_threshold = 0.15  # 15%
    else:  # Large dispensary
        stability_threshold = 0.10  # 10%
    
    # Calculate coefficient of variation for volatility assessment
    try:
        mean_sales = statistics.mean(aggregated_totals)
        std_dev = statistics.stdev(aggregated_totals)
        cv = std_dev / mean_sales if mean_sales > 0 else 0
    except:
        cv = 0
        std_dev = 0
        mean_sales = sum(aggregated_totals) / len(aggregated_totals)
    
    # Use weighted moving averages for trend calculation
    # Recent 3 months get higher weight
    if len(aggregated_totals) >= 6:
        recent_months = aggregated_totals[-3:]
        previous_months = aggregated_totals[-6:-3]
        
        # Calculate weighted averages (more weight to recent data)
        recent_weighted = sum(val * weight for val, weight in zip(recent_months, [1.5, 1.25, 1.0]))
        recent_weighted /= sum([1.5, 1.25, 1.0])
        
        previous_weighted = sum(val * weight for val, weight in zip(previous_months, [1.0, 1.25, 1.5]))
        previous_weighted /= sum([1.0, 1.25, 1.5])
        
        # Use median for robustness against outliers
        recent_median = statistics.median(recent_months)
        previous_median = statistics.median(previous_months)
        
        # Combine weighted average and median (60% weighted, 40% median)
        recent_combined = 0.6 * recent_weighted + 0.4 * recent_median
        previous_combined = 0.6 * previous_weighted + 0.4 * previous_median
        
    else:
        # Fallback for 4-5 months: simple comparison
        mid_point = len(aggregated_totals) // 2
        recent_combined = statistics.median(aggregated_totals[mid_point:])
        previous_combined = statistics.median(aggregated_totals[:mid_point])
    
    # Calculate percentage change
    if previous_combined > 0:
        pct_change = (recent_combined - previous_combined) / previous_combined
        growth_rate = pct_change * 100
    else:
        growth_rate = 0
        pct_change = 0
    
    # Statistical significance check: require change to exceed 1.5x standard deviation
    significant_change = abs(recent_combined - previous_combined) > (1.5 * std_dev / len(aggregated_totals)**0.5)
    
    # Determine confidence level based on data quality
    if len(aggregated_totals) >= 6 and cv < 0.5:  # Good data, low volatility
        confidence = 'high'
    elif len(aggregated_totals) >= 4 and cv < 1.0:  # Decent data, moderate volatility
        confidence = 'medium'  
    else:
        confidence = 'low'
    
    # Trend classification with confidence levels
    if not significant_change or abs(pct_change) < stability_threshold:
        trend = 'stable'
    elif pct_change > stability_threshold:
        trend = 'up'
    else:
        trend = 'down'
    
    # Add strong/moderate qualifiers for high-confidence, large changes
    if confidence == 'high' and abs(pct_change) > stability_threshold * 2:
        trend = f"strong_{trend}" if trend != 'stable' else 'stable'
    
    return trend, growth_rate, confidence

def load_geocode_cache(path='geocoded_cache.json'):
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            return {}
    return {}

def calculate_trends(df, geocode_cache=None):
    """Calculate growth trends for each dispensary using enhanced algorithm"""
    trends_data = []
    if geocode_cache is None:
        geocode_cache = {}
    
    # Group by dispensary name AND address to separate multiple locations
    for (licensee, address), group in df.groupby(['Licensee', 'Address']):
        # Sort by month
        group = group.sort_values('Month')
        
        if len(group) < 2:  # Need at least 2 months for trend
            continue
            
        # Get latest location info
        latest_record = group.iloc[-1]
        
        # Aggregate duplicate months by summing their sales
        monthly_aggregated = {}
        for _, row in group.iterrows():
            month = row['Month']
            if month not in monthly_aggregated:
                monthly_aggregated[month] = {
                    'month': month,
                    'total_sales': 0,
                    'medical_sales': 0,
                    'adult_sales': 0
                }
            monthly_aggregated[month]['total_sales'] += row['Total Sales']
            monthly_aggregated[month]['medical_sales'] += row['Medical Sales']
            monthly_aggregated[month]['adult_sales'] += row['Adult-Use Sales']
        
        # Convert back to list and sort by month
        monthly_data_clean = list(monthly_aggregated.values())
        monthly_data_clean.sort(key=lambda x: x['month'])
        
        # Calculate aggregated totals and average
        aggregated_totals = [d['total_sales'] for d in monthly_data_clean]
        avg_monthly_sales = sum(aggregated_totals) / len(aggregated_totals)
        
        # Use enhanced trend calculation
        trend_direction, recent_growth_rate, confidence = calculate_enhanced_trend(
            aggregated_totals, avg_monthly_sales
        )
        
        # Create a unique identifier for multiple locations of same company
        display_name = licensee
        if len(df[df['Licensee'] == licensee]['Address'].unique()) > 1:
            # Multiple locations - add city to distinguish
            display_name = f"{licensee} - {latest_record['City']}"

        # Get region for this dispensary
        region = get_region_for_city(latest_record['City'])

        # Lookup optional lat/lng from cache using address+city+zip key
        zip_str = str(latest_record['Zip']).strip() if 'Zip' in latest_record else ''
        cache_key = f"{latest_record['Address']}, {latest_record['City']} {zip_str}"
        lat_lng = geocode_cache.get(cache_key) or geocode_cache.get(f"{latest_record['Address']}, {latest_record['City']}")

        trend_record = {
            'licensee': display_name,
            'city': latest_record['City'],
            'region': region,
            'address': latest_record['Address'],
            'zip': latest_record['Zip'],
            'latitude': (lat_lng.get('lat') if isinstance(lat_lng, dict) else None) if lat_lng else None,
            'longitude': (lat_lng.get('lng') if isinstance(lat_lng, dict) else None) if lat_lng else None,
            'trend_direction': trend_direction,
            'trend_confidence': confidence,
            'avg_monthly_sales': avg_monthly_sales,
            'total_months': len(monthly_data_clean),
            'latest_sales': aggregated_totals[-1],
            'first_sales': aggregated_totals[0],
            'growth_rate': recent_growth_rate,
            'monthly_data': monthly_data_clean
        }
        
        trends_data.append(trend_record)
    
    return trends_data

def calculate_company_trends(df):
    """Calculate growth trends for each company (aggregating all locations) using enhanced algorithm"""
    company_trends = []
    
    # Add normalized company name column
    df = df.copy()
    df['Company_Name_Normalized'] = df['Licensee'].apply(normalize_company_name)
    
    # Group by normalized company name (not raw licensee name)
    for company_name, group in df.groupby('Company_Name_Normalized'):
        # Sort by month
        group = group.sort_values('Month')
        
        if len(group) < 2:  # Need at least 2 months for trend
            continue
        
        # Get all locations for this company
        locations = group[['Address', 'City']].drop_duplicates()
        primary_city = group['City'].mode().iloc[0] if not group['City'].mode().empty else group['City'].iloc[0]
        primary_region = get_region_for_city(primary_city)
        
        # Aggregate duplicate months by summing across all locations
        monthly_aggregated = {}
        for _, row in group.iterrows():
            month = row['Month']
            if month not in monthly_aggregated:
                monthly_aggregated[month] = {
                    'month': month,
                    'total_sales': 0,
                    'medical_sales': 0,
                    'adult_sales': 0
                }
            monthly_aggregated[month]['total_sales'] += row['Total Sales']
            monthly_aggregated[month]['medical_sales'] += row['Medical Sales']
            monthly_aggregated[month]['adult_sales'] += row['Adult-Use Sales']
        
        # Convert back to list and sort by month
        monthly_data_clean = list(monthly_aggregated.values())
        monthly_data_clean.sort(key=lambda x: x['month'])
        
        # Calculate aggregated totals and average
        aggregated_totals = [d['total_sales'] for d in monthly_data_clean]
        avg_monthly_sales = sum(aggregated_totals) / len(aggregated_totals)
        
        # Use enhanced trend calculation
        trend_direction, recent_growth_rate, confidence = calculate_enhanced_trend(
            aggregated_totals, avg_monthly_sales
        )
        
        # Create company summary
        cities = sorted(locations['City'].unique())
        addresses = sorted(locations['Address'].unique())
        original_licensee_names = sorted(group['Licensee'].unique())
        
        company_record = {
            'licensee': company_name,  # Use normalized name for display
            'company_name': company_name,  # Use normalized name
            'original_licensee_names': original_licensee_names,  # Keep track of original names
            'location_count': len(locations),
            'cities': cities,
            'primary_city': primary_city,
            'region': primary_region,
            'addresses': addresses,
            'trend_direction': trend_direction,
            'trend_confidence': confidence,
            'avg_monthly_sales': avg_monthly_sales,
            'total_months': len(monthly_data_clean),
            'latest_sales': aggregated_totals[-1],
            'first_sales': aggregated_totals[0],
            'growth_rate': recent_growth_rate,
            'monthly_data': monthly_data_clean
        }
        
        company_trends.append(company_record)
    
    return company_trends

def main():
    """Main processing function"""
    # Process all files
    combined_df = process_all_files()
    
    if combined_df is None:
        return
    
    # Calculate trends by location (current method)
    print("Calculating trends by location...")
    geocode_cache = load_geocode_cache()
    if geocode_cache:
        print(f"Loaded {len(geocode_cache)} geocoded locations from cache")
    location_trends = calculate_trends(combined_df, geocode_cache)
    
    print(f"Calculated trends for {len(location_trends)} dispensary locations")
    
    # Calculate trends by company (new aggregated method)
    print("Calculating trends by company...")
    company_trends = calculate_company_trends(combined_df)
    
    print(f"Calculated trends for {len(company_trends)} companies")
    
    # Calculate regional statistics for locations
    regional_stats_locations = {}
    for region in get_all_regions() + ['Other']:
        regional_dispensaries = [d for d in location_trends if d['region'] == region]
        if regional_dispensaries:
            regional_stats_locations[region] = {
                'total_dispensaries': len(regional_dispensaries),
                'trending_up': len([d for d in regional_dispensaries if d['trend_direction'] == 'up']),
                'trending_down': len([d for d in regional_dispensaries if d['trend_direction'] == 'down']),
                'stable': len([d for d in regional_dispensaries if d['trend_direction'] == 'stable']),
                'total_monthly_sales': sum(d['avg_monthly_sales'] for d in regional_dispensaries)
            }

    # Calculate regional statistics for companies
    regional_stats_companies = {}
    for region in get_all_regions() + ['Other']:
        regional_companies = [d for d in company_trends if d['region'] == region]
        if regional_companies:
            regional_stats_companies[region] = {
                'total_companies': len(regional_companies),
                'trending_up': len([d for d in regional_companies if d['trend_direction'] == 'up']),
                'trending_down': len([d for d in regional_companies if d['trend_direction'] == 'down']),
                'stable': len([d for d in regional_companies if d['trend_direction'] == 'stable']),
                'total_monthly_sales': sum(d['avg_monthly_sales'] for d in regional_companies)
            }

    # Save to JSON with both datasets
    output_data = {
        'generated_at': datetime.now().isoformat(),
        'months_covered': sorted(combined_df['Month'].unique()),
        'regions': get_all_regions() + ['Other'],
        'locations': {
            'total_dispensaries': len(location_trends),
            'regional_stats': regional_stats_locations,
            'data': location_trends
        },
        'companies': {
            'total_companies': len(company_trends),
            'regional_stats': regional_stats_companies,
            'data': company_trends
        },
        # Maintain backward compatibility
        'total_dispensaries': len(location_trends),
        'regional_stats': regional_stats_locations,
        'dispensaries': location_trends
    }
    
    with open('dispensary_data.json', 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print("Data saved to dispensary_data.json")
    
    # Print summary stats for locations
    location_trend_counts = {}
    for d in location_trends:
        trend = d['trend_direction']
        location_trend_counts[trend] = location_trend_counts.get(trend, 0) + 1
    
    print(f"\nLocation Trends Summary:")
    for trend, count in location_trend_counts.items():
        print(f"  {trend}: {count} locations")

    # Print summary stats for companies
    company_trend_counts = {}
    for d in company_trends:
        trend = d['trend_direction']
        company_trend_counts[trend] = company_trend_counts.get(trend, 0) + 1
    
    print(f"\nCompany Trends Summary:")
    for trend, count in company_trend_counts.items():
        print(f"  {trend}: {count} companies")

    # Show some examples of multi-location companies
    multi_location_companies = [d for d in company_trends if d['location_count'] > 1]
    multi_location_companies.sort(key=lambda x: x['location_count'], reverse=True)
    
    print(f"\nTop Multi-Location Companies:")
    for company in multi_location_companies[:5]:
        cities_str = ', '.join(company['cities'][:3])
        if len(company['cities']) > 3:
            cities_str += f" +{len(company['cities'])-3} more"
        print(f"  {company['company_name']}: {company['location_count']} locations in {cities_str}")

if __name__ == "__main__":
    main()
