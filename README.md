# Contact Service

This project is a simple Node.js web service to identify and keep track of a customer's identity across multiple purchases. The service exposes an `/identify` endpoint to handle customer identification.

## Endpoint

### POST /identify

**Request Body**:

```json
{
  "email": "newuser@example.com",
  "phoneNumber": 1234567890
}
```

**Response**:

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["newuser@example.com"],
    "phoneNumbers": [1234567890],
    "secondaryContactIds": []
  }
}
```
