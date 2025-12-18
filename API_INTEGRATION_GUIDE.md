# API Integration Guide

Secure your application's API requests using the API Key mechanism.

## 1. Obtain an API Key
1.  Log in to the **Admin Panel**.
2.  Navigate to the **API Keys** section.
3.  Click **Generate New Key**.
4.  Copy the key immediately (e.g., `a1b2c3d4...`).

## 2. Authenticate Requests
Include the `x-api-key` header in every HTTP request to the API.

**Header Name:** `x-api-key`
**Value:** `<Your Generated API Key>`

## 3. Code Examples

### JavaScript (Axios)
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://your-api-domain.com/api',
  headers: {
    'x-api-key': 'YOUR_API_KEY_HERE'
  }
});

// Now valid
await api.get('/market/stats');
```

### JavaScript (Fetch)
```javascript
fetch('https://your-api-domain.com/api/market/stats', {
  headers: {
    'x-api-key': 'YOUR_API_KEY_HERE'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### cURL
```bash
curl -H "x-api-key: YOUR_API_KEY_HERE" https://your-api-domain.com/api/market/stats
```

## 4. Handling Errors

| Status Code | Reason | Description |
| :--- | :--- | :--- |
| `200 OK` | Success | Request authorized and processed. |
| `401 Unauthorized` | Missing Key | The `x-api-key` header is missing. |
| `403 Forbidden` | Invalid Key | The provided key is invalid, revoked, or expired. |
