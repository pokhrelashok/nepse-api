# Mutual Funds vs Debentures Classification Issue

## Problem
Some records in the database have `instrument_type = 'Mutual Funds'` but are actually **debentures** (bonds issued by banks/insurance companies). This causes confusion because:

1. They appear in mutual fund listings
2. The cleanup script was trying to "fix" them by scraping from NEPSE
3. NEPSE shows the sponsor bank/company name, not the debenture scheme name

## Examples of Misclassified Debentures

| Symbol | Current Name | Sector | Should Be |
|--------|-------------|---------|-----------|
| GBIMESY2 | Global IME Bank Limited | Commercial Banks | Global IME Sammunat Yojana -2 |
| GSY | Garima Bikas Bank Limited | Development Banks | Garima Samriddhi Yojana |
| C30MF | Citizens Bank International Limited | Commercial Banks | Citizens Bank Debenture |
| KSY | Kumari Bank Limited | Commercial Banks | Kumari Samriddhi Yojana |
| HLICF | Himalayan Life Insurance Limited | Life Insurance | Himalayan Life Debenture |

## How to Identify Debentures

**Debentures** have these characteristics:
- ✅ Have maturity dates (bonds mature after a fixed period)
- ✅ Sector is the sponsor's sector (Commercial Banks, Development Banks, Life Insurance)
- ✅ Company name is the sponsor bank/insurance company name
- ❌ NOT in "Mutual Funds" sector

**Actual Mutual Funds** have:
- ✅ May or may not have maturity dates
- ✅ Sector is "Mutual Funds"
- ✅ Company name is the fund name (e.g., "NABIL BALANCED FUND-2")

## Solution Implemented

### Updated `scripts/cleanup-mutual-funds.js`

The script now **excludes debentures** by filtering out records where:
- `sector_name IN ('Commercial Banks', 'Development Banks', 'Life Insurance', 'Finance')`
- `sector_name LIKE '%Bank%'` OR `sector_name LIKE '%Insurance%'`

```sql
SELECT security_id, symbol FROM company_details 
WHERE instrument_type LIKE '%Mutual%' 
AND sector_name NOT IN ('Commercial Banks', 'Development Banks', 'Life Insurance', 'Finance')
AND (sector_name = 'Mutual Funds' OR sector_name NOT LIKE '%Bank%' AND sector_name NOT LIKE '%Insurance%')
```

### Results
- **27 Actual Mutual Funds** - Will be cleaned up ✅
- **13 Debentures** - Will be excluded ✅

## Debentures Excluded from Cleanup

The following 13 debentures will NOT be touched by the cleanup script:

1. C30MF - Citizens Bank International Limited
2. GBIMESY2 - Global IME Bank Limited
3. GSY - Garima Bikas Bank Limited
4. H8020 - Himalayan Bank Limited
5. HLICF - Himalayan Life Insurance Limited
6. KSY - Kumari Bank Limited
7. LVF2 - Laxmi Sunrise Bank Limited
8. MBLEF - Machhapuchhre Bank Limited
9. MNMF1 - Muktinath Bikas Bank Ltd.
10. NIBLSTF - Nepal Investment Mega Bank Limited
11. NICGF2 - NIC Asia Bank Ltd.
12. NMBHF2 - NMB Bank Limited
13. RSY - Reliable Nepal Life Insurance Ltd

## Root Cause

**NEPSE's Data Issue**: NEPSE incorrectly classifies debentures as `instrument_type = 'Mutual Funds'` in their API. This is a data quality issue on NEPSE's side.

## Recommendation

For a complete fix, we should:

1. ✅ **Keep the cleanup script filter** - Only fix actual mutual funds
2. ⚠️ **Manually correct debenture names** - These need to be fixed separately
3. 📝 **Consider reclassifying** - Change `instrument_type` to "Debenture" for these 13 records
4. 🔄 **Update scraper logic** - Add special handling for debentures to extract the correct scheme name

## Testing

Run the updated cleanup script:
```bash
docker-compose exec backend bun scripts/cleanup-mutual-funds.js
```

It should now only process 27 mutual funds and skip the 13 debentures.
