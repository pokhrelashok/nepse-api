# 📟 Frontend API Integration Guide

This guide summarizes the recent changes to the NEPSE Portfolio API to ensure smooth integration with the frontend.

## 1. Standardized Response Format

All API responses now follow a consistent structure. Most importantly, a Boolean `success` field has been added to simplify response handling.

### Success Response
```json
{
  "success": true,
  "status": "success",
  "message": "Detailed message",
  "data": { ... } // Or [ ... ] for list endpoints
}
```

### Error Response
```json
{
  "success": false,
  "status": "error",
  "message": "Explanation of the error",
  "code": 401 // HTTP Status Code
}
```

---

## 2. Authentication Requirements

Most endpoints (except `/api/health`, `/api/admin/login`, etc.) now require either a valid **API Key** or an **Admin Bearer Token**.

### API Key (Recommended for Widgets/Third-party)
Include the API key in the `x-api-key` header of every request.

- **Header**: `x-api-key`
- **Example**: `x-api-key: npt_your_secure_api_key_here`

### JWT Bearer Token (For Admin Dashboard)
For administrative endpoints, use the standard Bearer token acquired from `/api/admin/login`.

- **Header**: `Authorization`
- **Example**: `Bearer long_jwt_token_string`

---

## 3. New & Refactored Endpoints

### 🏛️ Market Indices History (New)
Fetches historical data for NEPSE and sub-indices.
- **Endpoint**: `GET /api/market/indices/history`
- **Query Params**:
    - `range`: `1W`, `1M`, `3M`, `6M`, `1Y`, `ALL` (Default: `1M`)
    - `index_id`: `58` (NEPSE), `57` (Sensitive), `59` (Float)
- **Note**: This endpoint pulls from deep historical archives in MySQL.

### 📅 Script History (Existing)
Correctly refactored to use standardized Boolean status.
- **Endpoint**: `GET /api/history/:symbol`
- **Query Params**: `range` (`1W` to `1Y`)

### ⚡ Live Market Data (Redis Powered)
The following endpoints are now backed by Redis for sub-second latency and reflect 100% live NEPSE data during market hours:
- `GET /api/market/status`
- `GET /api/today-prices`
- `GET /api/scripts/:symbol`
- `POST /api/updates`

---

## 4. Frontend Best Practices

1. **Check `response.data.success` first**: Stop parsing if `false`.
2. **Handle 401/403**: These now return the same standardized error JSON.
3. **Caching**: Live endpoints are already highly optimized with Redis on the backend; local frontend caching is only recommended for "Script History" or "Static Details".
4. **Base URL**: Ensure you are pointing to the correct environment (localhost:3000 for dev, https://api.nepseportfoliotracker.app for prod).
