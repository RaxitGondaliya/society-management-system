# 📋 SocietySphere API Documentation

**Base URL:** `http://localhost:5000/api/v1`

All responses follow the unified response format:
```json
{
  "success": true,
  "message": "Description message",
  "data": { ... }
}
```

Error response structure:
```json
{
  "success": false,
  "message": "Error message description",
  "error": [ ... ]
}
```

---

## 🏢 Module 1: Society Onboarding & Architecture

### 1. Register Society & Auto-Generate Layout
* **Short Endpoint:** `/societies/register`
* **HTTP Method:** `POST`
* **Name / Action Description:** Registers a new society, generates its unique society code (e.g., `SHIV-7890`), auto-generates SectionWings and Units based on the property layout (`FLAT`, `ROW_HOUSE`, or `VILLA`), creates the Super Admin User account, and links the Admin as primary head of the first unit.
* **Request Headers:**
  ```http
  Content-Type: application/json
  ```

#### Request Body Samples:

##### Option A: Flat Society Layout
```json
{
  "name": "Shivaji Heights Co-operative Housing Society",
  "propertyType": "FLAT",
  "address": "Plot 42, Shivaji Park, Dadar West, Mumbai - 400028",
  "latitude": 19.0269,
  "longitude": 72.8397,
  "bankAccountNo": "987654321012",
  "bankIfsc": "HDFC0001234",
  "bankBeneficiaryName": "Shivaji Heights CHS Ltd",
  "upiId": "shivajiheights@okaxis",
  "layout": {
    "wings": ["A", "B"],
    "floorsPerWing": 4,
    "unitsPerFloor": 4
  },
  "admin": {
    "fullName": "Rajesh Sharma",
    "phone": "+919876543210",
    "email": "rajesh.sharma@example.com"
  }
}
```

##### Option B: Villa / Row House Society Layout
```json
{
  "name": "Green Valley Villas",
  "propertyType": "VILLA",
  "address": "Survey No. 88, Near Hill View Club, Whitefield, Bengaluru - 560066",
  "latitude": 12.9698,
  "longitude": 77.7499,
  "bankAccountNo": "112233445566",
  "bankIfsc": "ICIC0000456",
  "bankBeneficiaryName": "Green Valley Resident Welfare Association",
  "upiId": "greenvalley@icici",
  "layout": {
    "totalUnits": 20,
    "unitPrefix": "Villa-",
    "sections": ["Phase 1", "Phase 2"]
  },
  "admin": {
    "fullName": "Sunil Verma",
    "phone": "+919812345678",
    "email": "sunil.verma@example.com"
  }
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Society registered and layout generated successfully",
  "data": {
    "society": {
      "id": "7b3ecf6b-3e5e-4916-b8e9-866fa7a49f85",
      "name": "Shivaji Heights Co-operative Housing Society",
      "code": "SHIV-7890",
      "propertyType": "FLAT",
      "address": "Plot 42, Shivaji Park, Dadar West, Mumbai - 400028",
      "subscriptionPlan": "ACTIVE",
      "bankAccountNo": "987654321012",
      "bankIfsc": "HDFC0001234",
      "bankBeneficiaryName": "Shivaji Heights CHS Ltd",
      "upiId": "shivajiheights@okaxis",
      "createdAt": "2026-10-23T14:00:00.000Z"
    },
    "admin": {
      "id": "e81d89e5-9c88-4f51-b844-3c8b9db876c1",
      "fullName": "Rajesh Sharma",
      "phone": "+919876543210",
      "email": "rajesh.sharma@example.com",
      "role": "SUPER_ADMIN"
    },
    "assignedUnit": {
      "id": "61a299c8-dfb9-4f9e-aef5-fafe32b95c02",
      "unitNumber": "101",
      "sectionWingId": "5dfca2d0-0ef5-4927-aa31-155e8b4e477e",
      "sectionWingName": "Wing A",
      "occupancyStatus": "OCCUPIED_OWNER"
    },
    "layoutSummary": {
      "totalSections": 2,
      "totalUnits": 32,
      "sectionBreakdown": [
        {
          "id": "5dfca2d0-0ef5-4927-aa31-155e8b4e477e",
          "name": "Wing A",
          "unitCount": 16
        },
        {
          "id": "8f8b8dc9-1d4a-4a25-9df0-7612f0e69ba3",
          "name": "Wing B",
          "unitCount": 16
        }
      ]
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "layout.wings",
      "message": "Wings list is required for FLAT property type (e.g. ['A', 'B'])"
    },
    {
      "field": "admin.phone",
      "message": "Invalid phone number format. Must be 10-15 digits"
    }
  ]
}
```

* **HTTP Status:** `403 Forbidden` (Admin Account Deactivated)
```json
{
  "success": false,
  "message": "User account with this phone number is currently deactivated."
}
```

* **HTTP Status:** `409 Conflict` (Duplicate Email Conflict)
```json
{
  "success": false,
  "message": "A user with email 'rajesh.sharma@example.com' already exists."
}
```

* **HTTP Status:** `500 Internal Server Error`
```json
{
  "success": false,
  "message": "Failed to initialize society units layout."
}
```

---

### 2. Get Public Society Layout by Code
* **Short Endpoint:** `/societies/code/:code`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches basic public society details along with organized section wings and unit listings using the unique society code (e.g., `SHIV-7890`). Used by the frontend resident onboarding screens ("Join My Society") for wing and unit selection.
* **Request Headers:**
  * None required (Public endpoint)
* **URL Parameter:**
  * `code` (string, required): The unique alphanumeric society code (case-insensitive).
* **Request Body:**
  * None

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Society retrieved successfully",
  "data": {
    "id": "7b3ecf6b-3e5e-4916-b8e9-866fa7a49f85",
    "name": "Shivaji Heights Co-operative Housing Society",
    "code": "SHIV-7890",
    "propertyType": "FLAT",
    "address": "Plot 42, Shivaji Park, Dadar West, Mumbai - 400028",
    "subscriptionPlan": "ACTIVE",
    "createdAt": "2026-10-23T14:00:00.000Z",
    "sections": [
      {
        "id": "5dfca2d0-0ef5-4927-aa31-155e8b4e477e",
        "name": "Wing A",
        "units": [
          {
            "id": "61a299c8-dfb9-4f9e-aef5-fafe32b95c02",
            "unitNumber": "101",
            "floorNumber": 1,
            "occupancyStatus": "OCCUPIED_OWNER"
          },
          {
            "id": "2bc820f4-5262-4217-bfd1-a3fbe39691b0",
            "unitNumber": "102",
            "floorNumber": 1,
            "occupancyStatus": "VACANT"
          },
          {
            "id": "6fa99e90-333e-4d43-8515-5283fc36b694",
            "unitNumber": "201",
            "floorNumber": 2,
            "occupancyStatus": "VACANT"
          }
        ]
      },
      {
        "id": "8f8b8dc9-1d4a-4a25-9df0-7612f0e69ba3",
        "name": "Wing B",
        "units": [
          {
            "id": "713ba241-15dc-443b-8255-a0cfa9dfba77",
            "unitNumber": "101",
            "floorNumber": 1,
            "occupancyStatus": "VACANT"
          }
        ]
      }
    ]
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Invalid Society Code Parameter)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "code",
      "message": "Society code must be at least 3 characters"
    }
  ]
}
```

* **HTTP Status:** `404 Not Found` (Society Code Not Found)
```json
{
  "success": false,
  "message": "Society with code 'UNKNOWN-1234' not found."
}
```

* **HTTP Status:** `500 Internal Server Error`
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 🔐 Module 1: Authentication Engine (Step 2)

### 3. User Login
* **Short Endpoint:** `/auth/login`
* **HTTP Method:** `POST`
* **Name / Action Description:** Authenticates a user using their registered phone number, validates active account status, resolves society and unit associations via `UnitMember`, and issues a signed JWT access token.
* **Request Headers:**
  ```http
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "phone": "+919988776655",
  "otp": "123456"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "55051701-dc42-4839-b052-f8fbb8a73069",
      "phone": "+919988776655",
      "email": "bhide@gokuldham.org",
      "fullName": "Aatmaram Bhide",
      "role": "SUPER_ADMIN",
      "isActive": true,
      "createdAt": "2026-10-23T08:35:48.633Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU1MDUxNzAxLWRjNDItNDgzOS1iMDUyLWY4ZmJiOGE3MzA2OSIsInBob25lIjoiKzkxOTk4ODc3NjY1NSIsInJvbGUiOiJTVVBFUl9BRE1JTiIsInNvY2lldHlJZCI6ImIzYThlYmYzLTgyYWUtNDA5ZC1hNjVjLWJhZmRmYTc1NjhhMiIsInVuaXRJZCI6ImM4NTI3ZTFkLTJlMmYtNGMxNi04M2E4LTMwMTc3Y2U3NjRiOCIsImlhdCI6MTc5Mjc0NDU0OCwiZXhwIjoxNzkzMzQ5MzQ4fQ.Q7LU_vBztCX6BbqPWe8F_5T9ipbQKWepQR_LUPBOHmw",
    "primarySocietyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "primaryUnitId": "c8527e1d-2e2f-4c16-83a8-30177ce764b8",
    "memberships": [
      {
        "id": "546a4c61-e15f-4c1a-99a6-440872925062",
        "memberType": "OWNER",
        "isPrimaryHead": true,
        "approvalStatus": "APPROVED",
        "unit": {
          "id": "c8527e1d-2e2f-4c16-83a8-30177ce764b8",
          "unitNumber": "101",
          "floorNumber": 1,
          "occupancyStatus": "OCCUPIED_OWNER",
          "sectionWingId": "b80d992c-b2c2-403f-82eb-8dc3b66fb7be",
          "sectionWingName": "Wing A",
          "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
          "societyName": "Gokuldham Co-operative Housing Society",
          "societyCode": "GOKU-CVX2",
          "propertyType": "FLAT",
          "address": "Powai, Mumbai - 400076"
        }
      }
    ]
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "phone",
      "message": "Phone number is required"
    }
  ]
}
```

* **HTTP Status:** `403 Forbidden` (Account Deactivated)
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact society administration."
}
```

* **HTTP Status:** `404 Not Found` (User Not Found)
```json
{
  "success": false,
  "message": "User account not found with the provided phone number."
}
```

* **HTTP Status:** `500 Internal Server Error`
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

### 4. Get Current Authenticated User Profile
* **Short Endpoint:** `/auth/me`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches the full active profile of the currently logged-in user from the JWT bearer token, including active unit memberships, society metadata, and approval statuses.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Request Body:**
  * None

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Current user profile retrieved successfully",
  "data": {
    "user": {
      "id": "55051701-dc42-4839-b052-f8fbb8a73069",
      "phone": "+919988776655",
      "email": "bhide@gokuldham.org",
      "fullName": "Aatmaram Bhide",
      "role": "SUPER_ADMIN",
      "isActive": true,
      "createdAt": "2026-10-23T08:35:48.633Z"
    },
    "primarySocietyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "primaryUnitId": "c8527e1d-2e2f-4c16-83a8-30177ce764b8",
    "memberships": [
      {
        "id": "546a4c61-e15f-4c1a-99a6-440872925062",
        "memberType": "OWNER",
        "isPrimaryHead": true,
        "approvalStatus": "APPROVED",
        "unit": {
          "id": "c8527e1d-2e2f-4c16-83a8-30177ce764b8",
          "unitNumber": "101",
          "floorNumber": 1,
          "occupancyStatus": "OCCUPIED_OWNER",
          "sectionWingId": "b80d992c-b2c2-403f-82eb-8dc3b66fb7be",
          "sectionWingName": "Wing A",
          "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
          "societyName": "Gokuldham Co-operative Housing Society",
          "societyCode": "GOKU-CVX2",
          "propertyType": "FLAT",
          "address": "Powai, Mumbai - 400076"
        }
      }
    ]
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `401 Unauthorized` (Missing or Invalid Bearer Token)
```json
{
  "success": false,
  "message": "Authorization token is missing or malformed"
}
```

* **HTTP Status:** `403 Forbidden` (Token Belongs to Deactivated Account)
```json
{
  "success": false,
  "message": "User account is deactivated. Access revoked."
}
```

* **HTTP Status:** `404 Not Found` (User Account No Longer Exists)
```json
{
  "success": false,
  "message": "User profile not found."
}
```

* **HTTP Status:** `500 Internal Server Error`
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 👥 Module 1: Resident Onboarding, Admin Approval & Directory (Step 3)

### 5. Submit Resident Join Request
* **Short Endpoint:** `/users/join`
* **HTTP Method:** `POST`
* **Name / Action Description:** Submits a resident onboarding request to join a specific society unit as either an `OWNER` or `TENANT`. Links optional family members and places the request into the society admin's `PENDING` verification queue.
* **Request Headers:**
  ```http
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "societyCode": "GOKU-CVX2",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "fullName": "Jethalal Gada",
  "phone": "+919820011223",
  "email": "jethalal@gadaelectronics.com",
  "memberType": "TENANT",
  "familyMembers": [
    {
      "fullName": "Tipendra Gada",
      "relation": "Son",
      "age": 16,
      "phone": "+919820099881",
      "isEmergencyContact": false
    },
    {
      "fullName": "Champaklal Gada",
      "relation": "Father",
      "age": 70,
      "phone": "+919820099882",
      "isEmergencyContact": true
    }
  ]
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Join request submitted successfully. Awaiting admin approval.",
  "data": {
    "requestId": "a4d382be-0f5a-4b07-a9a9-3995f7c32bf1",
    "status": "PENDING",
    "memberType": "TENANT",
    "society": {
      "id": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "name": "Gokuldham Co-operative Housing Society",
      "code": "GOKU-CVX2"
    },
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "wing": "Wing A"
    },
    "user": {
      "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "fullName": "Jethalal Gada",
      "phone": "+919820011223",
      "email": "jethalal@gadaelectronics.com"
    },
    "submittedAt": "2026-10-23T10:32:00.000Z"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "phone",
      "message": "Invalid phone number format. Must be 10-15 digits"
    },
    {
      "field": "memberType",
      "message": "memberType must be either OWNER or TENANT"
    }
  ]
}
```

* **HTTP Status:** `404 Not Found` (Society or Unit Not Found)
```json
{
  "success": false,
  "message": "Society not found with the specified ID or Society Code."
}
```

* **HTTP Status:** `409 Conflict` (Existing Approved Member or Duplicate Pending Request)
```json
{
  "success": false,
  "message": "A pending join request for this unit is already awaiting admin approval."
}
```

* **HTTP Status:** `500 Internal Server Error`
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

### 6. List Pending Join Requests
* **Short Endpoint:** `/users/pending-approvals`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches all pending resident join requests awaiting verification, scoped to the authenticated Super Admin / Sub-Admin's society.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  ```
* **Query Parameters:**
  * `societyId` (optional UUID): Explicit society ID if admin manages multiple societies. Defaults to admin's token society context.
* **Request Body:**
  * None

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Pending join requests retrieved successfully",
  "data": [
    {
      "membershipId": "a4d382be-0f5a-4b07-a9a9-3995f7c32bf1",
      "memberType": "TENANT",
      "approvalStatus": "PENDING",
      "createdAt": "2026-10-23T10:32:00.000Z",
      "user": {
        "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
        "fullName": "Jethalal Gada",
        "phone": "+919820011223",
        "email": "jethalal@gadaelectronics.com",
        "role": "RESIDENT",
        "createdAt": "2026-10-23T10:32:00.000Z"
      },
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "floorNumber": 1,
        "occupancyStatus": "VACANT",
        "sectionWing": {
          "id": "b80d992c-b2c2-403f-82eb-8dc3b66fb7be",
          "name": "Wing A"
        }
      },
      "familyMembers": [
        {
          "id": "8bbdc187-bb56-42d1-9da0-d3e910074211",
          "fullName": "Tipendra Gada",
          "relation": "Son",
          "age": 16,
          "phone": "+919820099881",
          "isEmergencyContact": false
        },
        {
          "id": "7acfa190-21be-49cf-8988-cb9401765c82",
          "fullName": "Champaklal Gada",
          "relation": "Father",
          "age": 70,
          "phone": "+919820099882",
          "isEmergencyContact": true
        }
      ]
    }
  ]
}
```

#### Error Response Samples:

* **HTTP Status:** `401 Unauthorized` (Missing / Invalid Token)
```json
{
  "success": false,
  "message": "Authorization token is missing or malformed"
}
```

* **HTTP Status:** `403 Forbidden` (Insufficient Role Privileges)
```json
{
  "success": false,
  "message": "Forbidden: Role 'RESIDENT' is not authorized to access this resource"
}
```

---

### 7. Review Join Request (Approve / Reject)
* **Short Endpoint:** `/users/memberships/:membershipId/decision`
* **HTTP Method:** `PATCH`
* **Name / Action Description:** Atomically approves or rejects a resident's join request. If approved, sets membership status to `APPROVED`, marks as primary head if applicable, and updates the unit's `occupancyStatus` to `OCCUPIED_OWNER` or `OCCUPIED_TENANT`.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `membershipId` (UUID, required): The unique ID of the pending UnitMember record.

#### Request Body Sample:
```json
{
  "status": "APPROVED",
  "rejectionReason": null
}
```

*(Or for rejection: `{"status": "REJECTED", "rejectionReason": "Ownership documents verification failed"}`)*

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Resident join request approved successfully.",
  "data": {
    "message": "Resident join request approved successfully.",
    "membershipId": "a4d382be-0f5a-4b07-a9a9-3995f7c32bf1",
    "approvalStatus": "APPROVED",
    "isPrimaryHead": true,
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "occupancyStatus": "OCCUPIED_TENANT",
      "sectionWing": "Wing A"
    },
    "user": {
      "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "fullName": "Jethalal Gada",
      "phone": "+919820011223",
      "email": "jethalal@gadaelectronics.com",
      "role": "RESIDENT"
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Already Processed or Invalid Status)
```json
{
  "success": false,
  "message": "This join request has already been processed with status 'APPROVED'."
}
```

* **HTTP Status:** `403 Forbidden` (Admin Scoped to Different Society)
```json
{
  "success": false,
  "message": "Forbidden: You are not authorized to review requests for this society."
}
```

* **HTTP Status:** `404 Not Found` (Join Request ID Not Found)
```json
{
  "success": false,
  "message": "Join request not found."
}
```

---

### 8. Get Society Resident Directory
* **Short Endpoint:** `/users/directory`
* **HTTP Method:** `GET`
* **Name / Action Description:** Retrieves the full verified resident directory for the society, hierarchically organized by `Wings/Sections -> Units -> Verified Residents -> Linked Family Members`.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Query Parameters:**
  * `societyId` (optional UUID): Scoped society ID (defaults to authenticated user's society context).
* **Request Body:**
  * None

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Society directory retrieved successfully",
  "data": {
    "society": {
      "id": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "name": "Gokuldham Co-operative Housing Society",
      "code": "GOKU-CVX2",
      "propertyType": "FLAT",
      "address": "Powai, Mumbai - 400076"
    },
    "sections": [
      {
        "id": "b80d992c-b2c2-403f-82eb-8dc3b66fb7be",
        "name": "Wing A",
        "totalUnits": 4,
        "units": [
          {
            "id": "c8527e1d-2e2f-4c16-83a8-30177ce764b8",
            "unitNumber": "101",
            "floorNumber": 1,
            "occupancyStatus": "OCCUPIED_OWNER",
            "primaryResident": {
              "id": "55051701-dc42-4839-b052-f8fbb8a73069",
              "fullName": "Aatmaram Bhide",
              "phone": "+919988776655",
              "memberType": "OWNER"
            },
            "members": [
              {
                "id": "546a4c61-e15f-4c1a-99a6-440872925062",
                "memberType": "OWNER",
                "isPrimaryHead": true,
                "user": {
                  "id": "55051701-dc42-4839-b052-f8fbb8a73069",
                  "fullName": "Aatmaram Bhide",
                  "phone": "+919988776655",
                  "email": "bhide@gokuldham.org",
                  "role": "SUPER_ADMIN"
                }
              }
            ],
            "familyMembers": []
          },
          {
            "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
            "unitNumber": "102",
            "floorNumber": 1,
            "occupancyStatus": "OCCUPIED_TENANT",
            "primaryResident": {
              "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
              "fullName": "Jethalal Gada",
              "phone": "+919820011223",
              "memberType": "TENANT"
            },
            "members": [
              {
                "id": "a4d382be-0f5a-4b07-a9a9-3995f7c32bf1",
                "memberType": "TENANT",
                "isPrimaryHead": true,
                "user": {
                  "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
                  "fullName": "Jethalal Gada",
                  "phone": "+919820011223",
                  "email": "jethalal@gadaelectronics.com",
                  "role": "RESIDENT"
                }
              }
            ],
            "familyMembers": [
              {
                "id": "8bbdc187-bb56-42d1-9da0-d3e910074211",
                "fullName": "Tipendra Gada",
                "relation": "Son",
                "age": 16,
                "phone": "+919820099881",
                "isEmergencyContact": false
              },
              {
                "id": "7acfa190-21be-49cf-8988-cb9401765c82",
                "fullName": "Champaklal Gada",
                "relation": "Father",
                "age": 70,
                "phone": "+919820099882",
                "isEmergencyContact": true
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `401 Unauthorized` (Token Missing or Expired)
```json
{
  "success": false,
  "message": "Authorization token is missing or malformed"
}
```

* **HTTP Status:** `404 Not Found` (Society Not Found)
```json
{
  "success": false,
  "message": "Society not found."
}
```

---

### 9. Update Unit Occupancy
* **Short Endpoint:** `/users/units/:unitId/occupancy`
* **HTTP Method:** `PATCH`
* **Name / Action Description:** Directly updates a unit's occupancy status (`OCCUPIED_OWNER`, `OCCUPIED_TENANT`, or `VACANT`).
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `unitId` (UUID, required): The unique ID of the Unit record.

#### Request Body Sample:
```json
{
  "occupancyStatus": "VACANT"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Unit occupancy updated successfully.",
  "data": {
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "floorNumber": 1,
      "occupancyStatus": "VACANT",
      "wing": "Wing A"
    }
  }
}
```

---

## 💳 Module 2: Maintenance Billing & Financial Accounting Engine

### 10. Generate Monthly Maintenance Bills
* **Short Endpoint:** `/billing/generate`
* **HTTP Method:** `POST`
* **Name / Action Description:** Generates maintenance bills for all units of a society for a specified month/year. Enforces anti double-billing protection and assigns unique invoice numbers.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "billingMonth": 10,
  "billingYear": 2026,
  "amount": 2000,
  "numberOfMonths": 1,
  "billingMode": "FLAT_RATE",
  "dueDate": "2026-10-15T00:00:00.000Z",
  "description": "Monthly Society Maintenance - October 2026",
  "penaltyGraceDays": 15
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Maintenance bills generated successfully.",
  "data": {
    "message": "Maintenance bills generated successfully.",
    "society": {
      "id": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "name": "Gokuldham Co-operative Housing Society",
      "code": "GOKU-CVX2"
    },
    "billingPeriod": {
      "month": 10,
      "year": 2026,
      "monthsCovered": ["2026-10"],
      "numberOfMonths": 1
    },
    "billingMode": "FLAT_RATE",
    "ratePerMonth": 2000,
    "totalAmountPerUnit": 2000,
    "totalUnitsBilled": 8,
    "totalBilledAmount": 16000,
    "status": "PENDING"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "amount",
      "message": "Amount must be greater than 0"
    },
    {
      "field": "billingMonth",
      "message": "Billing month must be between 1 and 12"
    }
  ]
}
```

* **HTTP Status:** `409 Conflict` (Bills Already Generated for Period)
```json
{
  "success": false,
  "message": "Maintenance bills for period '2026-10' have already been generated for this society."
}
```

---

### 11. Record Bill Payment
* **Short Endpoint:** `/billing/:billId/pay`
* **HTTP Method:** `POST`
* **Name / Action Description:** Records full payment for a maintenance bill via UPI, Cash, Bank Transfer, or Cheque. Atomically updates status to `PAID`, assigns payment metadata, and generates a verified receipt number.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `billId` (UUID, required): The unique ID of the MaintenanceBill record.

#### Request Body Sample:
```json
{
  "amountPaid": 2000,
  "paymentMethod": "UPI",
  "transactionReference": "UPI-REF-998811",
  "paymentDate": "2026-10-23T10:00:00.000Z"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Payment recorded successfully.",
  "data": {
    "message": "Payment recorded successfully.",
    "billId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "receiptNumber": "RCPT-MVKUHP7I-WingB-101",
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "101",
      "wing": "Wing B"
    },
    "paymentDetails": {
      "amountPaid": 2000,
      "paymentMode": "UPI",
      "transactionReference": "UPI-REF-998811",
      "paidAt": "2026-10-23T10:00:00.000Z",
      "status": "PAID"
    },
    "paidBy": null,
    "cashCollector": null
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Bill Already Paid)
```json
{
  "success": false,
  "message": "This maintenance bill is already marked as PAID (Receipt No: RCPT-MVKUHP7I-WingB-101)."
}
```

* **HTTP Status:** `404 Not Found` (Bill ID Not Found)
```json
{
  "success": false,
  "message": "Maintenance bill not found."
}
```

---

### 12. Get My Unit Bills
* **Short Endpoint:** `/billing/my-bills`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches all past and pending maintenance bills for units associated with the authenticated resident.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  ```
* **Request Body:**
  * None

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Personal unit billing history retrieved successfully",
  "data": {
    "totalUnits": 1,
    "units": [
      {
        "unit": {
          "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
          "unitNumber": "102",
          "wing": "Wing A",
          "occupancyStatus": "OCCUPIED_TENANT"
        },
        "society": {
          "id": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
          "name": "Gokuldham Co-operative Housing Society",
          "code": "GOKU-CVX2"
        },
        "summary": {
          "totalBills": 1,
          "pendingBillsCount": 1,
          "totalDues": 2000,
          "totalPaid": 0
        },
        "bills": [
          {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "receiptNo": "INV-202610-WingA-102",
            "monthsCovered": ["2026-10"],
            "numberOfMonths": 1,
            "amountPerMonth": 2000,
            "totalAmount": 2000,
            "paymentMode": "PENDING",
            "status": "PENDING",
            "utrReference": null,
            "paidAt": "2026-10-23T10:30:00.000Z",
            "paidBy": null,
            "cashCollector": null
          }
        ]
      }
    ]
  }
}
```

---

### 13. List All Society Bills
* **Short Endpoint:** `/billing/all`
* **HTTP Method:** `GET`
* **Name / Action Description:** Allows society administrators to view, filter, and paginate through all generated maintenance bills.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  ```
* **Query Parameters:**
  * `status` (optional enum: `PAID`, `PENDING`, `OVERDUE`)
  * `unitId` (optional UUID)
  * `societyId` (optional UUID, defaults to admin context)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Maintenance bills retrieved successfully",
  "data": {
    "bills": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "receiptNo": "INV-202610-WingA-101",
        "unit": {
          "id": "c8527e1d-2e2f-4c16-83a8-30177ce764b8",
          "unitNumber": "101",
          "wing": "Wing A",
          "occupancyStatus": "OCCUPIED_OWNER"
        },
        "monthsCovered": ["2026-10"],
        "numberOfMonths": 1,
        "amountPerMonth": 2000,
        "totalAmount": 2000,
        "paymentMode": "PENDING",
        "status": "PENDING",
        "utrReference": null,
        "paidAt": "2026-10-23T10:30:00.000Z",
        "paidBy": null,
        "cashCollector": null
      }
    ],
    "pagination": {
      "totalRecords": 8,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 14. Get Society Financial Overview & Defaulters List
* **Short Endpoint:** `/billing/summary`
* **HTTP Method:** `GET`
* **Name / Action Description:** Computes society-level financial accounting analytics: total billed, total collected, outstanding dues, overall collection rate percentage, and an aggregated list of defaulter units with primary resident contact details.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  ```
* **Query Parameters:**
  * `societyId` (optional UUID, defaults to admin context)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Society financial overview and defaulter list retrieved successfully",
  "data": {
    "society": {
      "id": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "name": "Gokuldham Co-operative Housing Society",
      "code": "GOKU-CVX2"
    },
    "summary": {
      "totalBilledAmount": 16000,
      "totalCollectedAmount": 2000,
      "totalPendingAmount": 14000,
      "collectionRatePercentage": 12.5,
      "totalBillsCount": 8,
      "paidBillsCount": 1,
      "pendingBillsCount": 7
    },
    "defaultersCount": 7,
    "defaulters": [
      {
        "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "wing": "Wing A",
        "pendingAmount": 2000,
        "pendingMonths": ["2026-10"],
        "primaryResident": {
          "fullName": "Jethalal Gada",
          "phone": "+919820011223",
          "email": "jethalal@gadaelectronics.com",
          "memberType": "TENANT"
        }
      }
    ]
  }
}
```

---

## 🛡️ Module 3: Security & Visitor Management Engine

### 15. Log Visitor Entry at Gate
* **Short Endpoint:** `/visitors/entry`
* **HTTP Method:** `POST`
* **Name / Action Description:** Guard or Admin logs incoming visitor entry at the gate. If a resident's pre-approved passcode/pass matches, auto-authorizes entry. Otherwise, creates entry with status `PENDING_APPROVAL` and alerts unit residents.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "visitorName": "Sunderlal",
  "phone": "+919820099000",
  "purpose": "Relative Visit",
  "category": "GUEST",
  "vehicleNumber": "MH-02-AB-1234",
  "vehicleType": "FOUR_WHEELER"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Visitor entry logged. Approval request sent to resident.",
  "data": {
    "isPreApproved": false,
    "status": "PENDING_APPROVAL",
    "visitor": {
      "id": "7fa123bc-11aa-4cde-8899-bbcc22114455",
      "visitorName": "Sunderlal",
      "phone": "+919820099000",
      "category": "GUEST",
      "vehicleNumber": "MH-02-AB-1234",
      "status": "PENDING_APPROVAL",
      "entryTime": "2026-10-23T11:00:00.000Z",
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "wing": "Wing A"
      }
    },
    "targetResidents": [
      {
        "id": "546a4c61-e15f-4c1a-99a6-440872925062",
        "isPrimaryHead": true,
        "memberType": "TENANT",
        "user": {
          "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
          "fullName": "Jethalal Gada",
          "phone": "+919820011223",
          "email": "jethalal@gadaelectronics.com"
        }
      }
    ]
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "phone",
      "message": "Invalid phone number format. Must be 10-15 digits"
    }
  ]
}
```

* **HTTP Status:** `403 Forbidden` (Insufficient Role Privileges)
```json
{
  "success": false,
  "message": "Forbidden: Role 'RESIDENT' is not authorized to access this resource"
}
```

* **HTTP Status:** `404 Not Found` (Target Unit Not Found)
```json
{
  "success": false,
  "message": "Target unit was not found within this society."
}
```

---

### 16. Pre-Approve Visitor / Delivery Pass
* **Short Endpoint:** `/visitors/pre-approve`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an authenticated resident to pre-approve expected guests, cabs, or parcel deliveries by generating a secure 6-digit access passcode.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "visitorName": "Amazon Delivery Agent",
  "phone": "+919876500111",
  "category": "DELIVERY",
  "expectedArrival": "2026-10-23T14:00:00.000Z"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Visitor pre-approved successfully.",
  "data": {
    "passcode": "426012",
    "visitor": {
      "id": "8bb3321a-22cc-4fee-9988-ddaa33221100",
      "visitorName": "Amazon Delivery Agent",
      "phone": "+919876500111",
      "category": "DELIVERY",
      "vehicleNumber": null,
      "status": "APPROVED",
      "expectedArrival": "2026-10-23T14:00:00.000Z",
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "wing": "Wing A"
      }
    }
  }
}
```

---

### 17. Resident Decision on Visitor Entry
* **Short Endpoint:** `/visitors/:visitorId/decision`
* **HTTP Method:** `PATCH`
* **Name / Action Description:** Unit residents can approve, deny, or select `LEAVE_AT_GATE` for walk-in visitors in real time.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `visitorId` (UUID, required): The unique ID of the Visitor record.

#### Request Body Sample:
```json
{
  "status": "APPROVED"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Visitor entry approved.",
  "data": {
    "status": "APPROVED",
    "visitor": {
      "id": "7fa123bc-11aa-4cde-8899-bbcc22114455",
      "visitorName": "Sunderlal",
      "phone": "+919820099000",
      "status": "APPROVED",
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "wing": "Wing A"
      }
    }
  }
}
```

---

### 18. Checkout Visitor at Gate
* **Short Endpoint:** `/visitors/:visitorId/checkout`
* **HTTP Method:** `POST`
* **Name / Action Description:** Guard or Admin logs visitor exit, records checkout timestamp, and automatically calculates total on-premises stay duration.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  ```
* **URL Parameter:**
  * `visitorId` (UUID, required): The unique ID of the active Visitor record.

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Visitor checkout recorded successfully.",
  "data": {
    "visitorId": "7fa123bc-11aa-4cde-8899-bbcc22114455",
    "visitorName": "Sunderlal",
    "entryTime": "2026-10-23T11:00:00.000Z",
    "exitTime": "2026-10-23T11:45:00.000Z",
    "durationMinutes": 45,
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "wing": "Wing A"
    }
  }
}
```

---

### 19. List Active On-Premises Visitors
* **Short Endpoint:** `/visitors/active`
* **HTTP Method:** `GET`
* **Name / Action Description:** Security dashboard view displaying all visitors currently inside the society premises.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  ```
* **Query Parameters:**
  * `societyId` (optional UUID, defaults to guard context)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Active on-premises visitors retrieved successfully",
  "data": {
    "totalActiveVisitors": 2,
    "visitors": [
      {
        "id": "8bb3321a-22cc-4fee-9988-ddaa33221100",
        "visitorName": "Amazon Delivery Agent",
        "phone": "+919876500111",
        "category": "DELIVERY",
        "vehicleNumber": null,
        "status": "APPROVED",
        "entryTime": "2026-10-23T11:15:00.000Z",
        "unit": {
          "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
          "unitNumber": "102",
          "wing": "Wing A"
        },
        "loggedByGuard": "Security Guard Rampal"
      }
    ]
  }
}
```

---

### 20. Get Unit Visitor History
* **Short Endpoint:** `/visitors/my-unit`
* **HTTP Method:** `GET`
* **Name / Action Description:** Resident view of all past and current visitors logged for their flat.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  ```
* **Query Parameters:**
  * `unitId` (optional UUID, defaults to resident's approved unit)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Unit visitor history retrieved successfully",
  "data": {
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "wing": "Wing A"
    },
    "totalVisitors": 2,
    "visitors": [
      {
        "id": "7fa123bc-11aa-4cde-8899-bbcc22114455",
        "visitorName": "Sunderlal",
        "phone": "+919820099000",
        "category": "GUEST",
        "vehicleNumber": "MH-02-AB-1234",
        "status": "APPROVED",
        "passcode": null,
        "entryTime": "2026-10-23T11:00:00.000Z",
        "exitTime": "2026-10-23T11:45:00.000Z",
        "loggedByGuard": "Security Guard Rampal"
      }
    ]
  }
}
```

---

### 21. List All Society Visitor Logs
* **Short Endpoint:** `/visitors/history`
* **HTTP Method:** `GET`
* **Name / Action Description:** Comprehensive visitor log search with date range, unit, and status filters for administrative auditing.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  ```
* **Query Parameters:**
  * `status` (optional enum: `PENDING_APPROVAL`, `APPROVED`, `DENIED`, `CHECKED_OUT`, `LEAVE_AT_GATE`)
  * `unitId` (optional UUID)
  * `startDate` (optional ISO Date)
  * `endDate` (optional ISO Date)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Visitor log history retrieved successfully",
  "data": {
    "visitors": [
      {
        "id": "7fa123bc-11aa-4cde-8899-bbcc22114455",
        "visitorName": "Sunderlal",
        "phone": "+919820099000",
        "category": "GUEST",
        "vehicleNumber": "MH-02-AB-1234",
        "status": "APPROVED",
        "entryTime": "2026-10-23T11:00:00.000Z",
        "exitTime": "2026-10-23T11:45:00.000Z",
        "unit": {
          "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
          "unitNumber": "102",
          "wing": "Wing A"
        },
        "loggedByGuard": "Security Guard Rampal"
      }
    ],
    "pagination": {
      "totalRecords": 2,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## 🎫 Module 4: Helpdesk & Grievance Redressal Engine

### 22. Lodge a New Complaint / Helpdesk Ticket
* **Short Endpoint:** `/complaints`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows a resident or administrator to lodge a new service or maintenance complaint. For personal unit scope, validates flat occupancy. For community scope (e.g. lift, common generator, street lighting), detects if an active ticket already exists and returns a duplicate issue warning while logging the request with a unique human-readable Ticket ID (e.g. `TKT-202610-0001-274`) and SLA limit metrics.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample (Personal Flat Issue):
```json
{
  "title": "Kitchen Sink Leakage",
  "description": "Water leaking constantly beneath the kitchen sink pipe causing flooding.",
  "category": "PLUMBING",
  "priority": "HIGH",
  "scope": "PERSONAL",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "images": [
    "https://storage.example.com/society/complaints/sink_leak.jpg"
  ]
}
```

#### Request Body Sample (Community Issue):
```json
{
  "title": "Wing A Passenger Lift Breakdown",
  "description": "The main passenger elevator in Wing A got stuck between 3rd and 4th floors.",
  "category": "LIFT",
  "priority": "URGENT",
  "scope": "COMMUNITY"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Complaint lodged successfully. Ticket ID generated.",
  "data": {
    "complaint": {
      "id": "e83f2a1b-90cb-4a21-9988-511bbcc44001",
      "ticketNumber": "TKT-202610-0001-274",
      "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "raisedByUserId": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "scope": "PERSONAL",
      "category": "PLUMBING",
      "priority": "HIGH",
      "title": "Kitchen Sink Leakage",
      "description": "Water leaking constantly beneath the kitchen sink pipe causing flooding.",
      "photoUrl": "https://storage.example.com/society/complaints/sink_leak.jpg",
      "status": "OPEN",
      "assignedStaffId": null,
      "resolutionNotes": null,
      "resolutionProofUrl": null,
      "resolvedAt": null,
      "rating": null,
      "feedback": null,
      "createdAt": "2026-10-23T11:40:00.000Z",
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "sectionWing": {
          "id": "84a1e944-77bf-463e-a894-3a5e84000101",
          "name": "Wing A"
        }
      },
      "raisedByUser": {
        "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
        "fullName": "Jethalal Gada",
        "phone": "+919820011223",
        "role": "RESIDENT"
      },
      "sla": {
        "timeOpenHours": 0,
        "slaLimitHours": 24,
        "isOverdue": false
      }
    },
    "duplicateWarning": null
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "title",
      "message": "Title must be at least 5 characters long"
    },
    {
      "field": "unitId",
      "message": "unitId is required when scope is 'PERSONAL'"
    }
  ]
}
```

* **HTTP Status:** `403 Forbidden` (Unauthorized Unit Access)
```json
{
  "success": false,
  "message": "You can only raise personal complaints for your own unit."
}
```

* **HTTP Status:** `404 Not Found` (Target Unit Not Found)
```json
{
  "success": false,
  "message": "Target unit not found in this society."
}
```

---

### 23. Update Ticket Status & Assign Staff
* **Short Endpoint:** `/complaints/:ticketId/status`
* **HTTP Method:** `PATCH`
* **Name / Action Description:** Security staff or administrators update complaint progression (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REJECTED`), assign technicians/staff members, add resolution notes, attach work completion proof URLs, and automatically timestamp `resolvedAt`.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `ticketId` (UUID or Ticket Number, required): Unique Complaint UUID or formatted Ticket Number (`TKT-YYYYMM-XXXX`).

#### Request Body Sample:
```json
{
  "status": "RESOLVED",
  "assignedToStaffId": "5c90b022-7711-40ff-9922-11aaff332211",
  "resolutionNotes": "Replaced faulty washer and tight-sealed connection pipe.",
  "resolutionProofUrl": "https://storage.example.com/society/proofs/fixed_pipe.jpg"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Complaint status and assignment updated successfully.",
  "data": {
    "id": "e83f2a1b-90cb-4a21-9988-511bbcc44001",
    "ticketNumber": "TKT-202610-0001-274",
    "status": "RESOLVED",
    "assignedStaffId": "5c90b022-7711-40ff-9922-11aaff332211",
    "resolutionNotes": "Replaced faulty washer and tight-sealed connection pipe.",
    "resolutionProofUrl": "https://storage.example.com/society/proofs/fixed_pipe.jpg",
    "resolvedAt": "2026-10-23T12:15:00.000Z",
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "id": "84a1e944-77bf-463e-a894-3a5e84000101",
        "name": "Wing A"
      }
    },
    "raisedByUser": {
      "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "fullName": "Jethalal Gada",
      "phone": "+919820011223"
    },
    "assignedStaff": {
      "id": "5c90b022-7711-40ff-9922-11aaff332211",
      "fullName": "Ramesh Carpenter",
      "phone": "+919820055443",
      "role": "SUB_ADMIN"
    },
    "sla": {
      "timeOpenHours": 0.6,
      "slaLimitHours": 24,
      "isOverdue": false
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `403 Forbidden` (Insufficient Privileges)
```json
{
  "success": false,
  "message": "Forbidden: Role 'RESIDENT' is not authorized to access this resource"
}
```

* **HTTP Status:** `404 Not Found` (Ticket Not Found)
```json
{
  "success": false,
  "message": "Complaint ticket not found."
}
```

---

### 24. Submit Resident Rating & Feedback
* **Short Endpoint:** `/complaints/:ticketId/feedback`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows the complainant or flat resident to submit a 1 to 5 star satisfaction rating and review comments once a complaint has been marked `RESOLVED`. Upon submission, automatically transitions ticket status to `CLOSED`.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `ticketId` (UUID or Ticket Number, required): Unique Complaint UUID or formatted Ticket Number.

#### Request Body Sample:
```json
{
  "rating": 5,
  "feedback": "Super prompt response and clean repair work! Very satisfied."
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Feedback submitted and complaint ticket closed successfully.",
  "data": {
    "id": "e83f2a1b-90cb-4a21-9988-511bbcc44001",
    "ticketNumber": "TKT-202610-0001-274",
    "rating": 5,
    "feedback": "Super prompt response and clean repair work! Very satisfied.",
    "status": "CLOSED",
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "id": "84a1e944-77bf-463e-a894-3a5e84000101",
        "name": "Wing A"
      }
    },
    "assignedStaff": {
      "id": "5c90b022-7711-40ff-9922-11aaff332211",
      "fullName": "Ramesh Carpenter",
      "phone": "+919820055443"
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Premature Feedback)
```json
{
  "success": false,
  "message": "Feedback can only be submitted for resolved or closed tickets (current status: IN_PROGRESS)."
}
```

* **HTTP Status:** `403 Forbidden` (Unauthorized Resident)
```json
{
  "success": false,
  "message": "Only the complainant or unit resident can provide feedback on this ticket."
}
```

---

### 25. Get My Complaints
* **Short Endpoint:** `/complaints/my-complaints`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches all complaints raised by the authenticated user or logged against any flats where the caller is an active registered resident.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "My complaints retrieved successfully.",
  "data": [
    {
      "id": "e83f2a1b-90cb-4a21-9988-511bbcc44001",
      "ticketNumber": "TKT-202610-0001-274",
      "title": "Kitchen Sink Leakage",
      "category": "PLUMBING",
      "priority": "HIGH",
      "scope": "PERSONAL",
      "status": "CLOSED",
      "rating": 5,
      "feedback": "Super prompt response and clean repair work! Very satisfied.",
      "createdAt": "2026-10-23T11:40:00.000Z",
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "sectionWing": {
          "id": "84a1e944-77bf-463e-a894-3a5e84000101",
          "name": "Wing A"
        }
      },
      "assignedStaff": {
        "id": "5c90b022-7711-40ff-9922-11aaff332211",
        "fullName": "Ramesh Carpenter",
        "phone": "+919820055443"
      },
      "sla": {
        "timeOpenHours": 0.6,
        "slaLimitHours": 24,
        "isOverdue": false
      }
    }
  ]
}
```

---

### 26. List Society Complaints with Multi-Filter & SLA Tracking
* **Short Endpoint:** `/complaints/all`
* **HTTP Method:** `GET`
* **Name / Action Description:** Security dashboard and administrative overview of all complaints across the society. Includes SLA tracking metrics (total records and count of overdue tickets exceeding resolution thresholds) with pagination and filters.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  ```
* **Query Parameters:**
  * `status` (optional enum: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REJECTED`)
  * `category` (optional enum: `PLUMBING`, `ELECTRICAL`, `CARPENTRY`, `LIFT`, `SECURITY`, `PARKING`, `NOISE`, `COMMON_AREA`, `OTHER`)
  * `priority` (optional enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`)
  * `scope` (optional enum: `PERSONAL`, `COMMUNITY`)
  * `unitId` (optional UUID)
  * `assignedTo` (optional UUID)
  * `startDate` (optional ISO Date format: `YYYY-MM-DD`)
  * `endDate` (optional ISO Date format: `YYYY-MM-DD`)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Society complaints retrieved successfully.",
  "data": {
    "complaints": [
      {
        "id": "e83f2a1b-90cb-4a21-9988-511bbcc44001",
        "ticketNumber": "TKT-202610-0001-274",
        "title": "Kitchen Sink Leakage",
        "category": "PLUMBING",
        "priority": "HIGH",
        "scope": "PERSONAL",
        "status": "CLOSED",
        "createdAt": "2026-10-23T11:40:00.000Z",
        "unit": {
          "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
          "unitNumber": "102",
          "sectionWing": {
            "id": "84a1e944-77bf-463e-a894-3a5e84000101",
            "name": "Wing A"
          }
        },
        "raisedByUser": {
          "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
          "fullName": "Jethalal Gada",
          "phone": "+919820011223",
          "role": "RESIDENT"
        },
        "assignedStaff": {
          "id": "5c90b022-7711-40ff-9922-11aaff332211",
          "fullName": "Ramesh Carpenter",
          "phone": "+919820055443"
        },
        "sla": {
          "timeOpenHours": 0.6,
          "slaLimitHours": 24,
          "isOverdue": false
        }
      }
    ],
    "metrics": {
      "totalRecords": 1,
      "overdueCount": 0
    },
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 27. Get Complaint Details by ID or Ticket Number
* **Short Endpoint:** `/complaints/:ticketId`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches comprehensive ticket details including complainant profile, assigned technician, unit address with wing, photo attachments, resolution notes with proof URLs, feedback, and SLA calculation.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```
* **URL Parameter:**
  * `ticketId` (UUID or Ticket Number, required): Unique Complaint UUID or formatted Ticket Number (`TKT-YYYYMM-XXXX`).

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Complaint details retrieved successfully.",
  "data": {
    "id": "e83f2a1b-90cb-4a21-9988-511bbcc44001",
    "ticketNumber": "TKT-202610-0001-274",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
    "raisedByUserId": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
    "scope": "PERSONAL",
    "category": "PLUMBING",
    "priority": "HIGH",
    "title": "Kitchen Sink Leakage",
    "description": "Water leaking constantly beneath the kitchen sink pipe causing flooding.",
    "photoUrl": "https://storage.example.com/society/complaints/sink_leak.jpg",
    "status": "CLOSED",
    "assignedStaffId": "5c90b022-7711-40ff-9922-11aaff332211",
    "resolutionNotes": "Replaced faulty washer and tight-sealed connection pipe.",
    "resolutionProofUrl": "https://storage.example.com/society/proofs/fixed_pipe.jpg",
    "resolvedAt": "2026-10-23T12:15:00.000Z",
    "rating": 5,
    "feedback": "Super prompt response and clean repair work! Very satisfied.",
    "createdAt": "2026-10-23T11:40:00.000Z",
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "floorNumber": 1,
      "sectionWing": {
        "id": "84a1e944-77bf-463e-a894-3a5e84000101",
        "name": "Wing A"
      }
    },
    "raisedByUser": {
      "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "fullName": "Jethalal Gada",
      "phone": "+919820011223",
      "email": "jethalal@gadaelectronics.com",
      "role": "RESIDENT"
    },
    "assignedStaff": {
      "id": "5c90b022-7711-40ff-9922-11aaff332211",
      "fullName": "Ramesh Carpenter",
      "phone": "+919820055443",
      "role": "SUB_ADMIN"
    },
    "sla": {
      "timeOpenHours": 0.6,
      "slaLimitHours": 24,
      "isOverdue": false
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `403 Forbidden` (Unauthorized Access)
```json
{
  "success": false,
  "message": "Unauthorized access to this ticket."
}
```

* **HTTP Status:** `404 Not Found` (Ticket Not Found)
```json
{
  "success": false,
  "message": "Complaint ticket not found."
```

---

## 🏊 Module 5: Amenities & Facility Booking Engine

### 28. Register a Society Facility / Amenity
* **Short Endpoint:** `/amenities`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator (`SUPER_ADMIN`, `SUB_ADMIN`) to onboard a new society amenity or facility (e.g. Clubhouse, Badminton Court, Swimming Pool, Gym, Rooftop BBQ Area). Enforces unique amenity names within the society, operating hours, capacity limits, pricing structure (`SLOT_BASED` or `FULL_DAY`), security deposits, and house rules.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```

#### Request Body Sample (Slot-Based Facility):
```json
{
  "name": "Badminton Court 1",
  "description": "Synthetic indoor wooden floor court.",
  "bookingType": "SLOT_BASED",
  "capacity": 4,
  "feePerHour": 150,
  "securityDeposit": 0,
  "openTime": "06:00",
  "closeTime": "22:00",
  "rules": [
    "Non-marking rubber sole shoes only",
    "Bring your own racquets and shuttlecocks"
  ]
}
```

#### Request Body Sample (Full-Day Facility):
```json
{
  "name": "Grand Banquet Hall",
  "description": "Air-conditioned banquet hall with sound system and seating for 200.",
  "bookingType": "FULL_DAY",
  "capacity": 200,
  "feePerDay": 5000,
  "securityDeposit": 2000,
  "openTime": "08:00",
  "closeTime": "23:00",
  "rules": [
    "No loud music after 10 PM",
    "Post-event cleaning to be arranged by host"
  ]
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Amenity facility registered successfully.",
  "data": {
    "id": "78a1bc22-55dd-43aa-8811-ccaabb223344",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "name": "Badminton Court 1",
    "description": "Synthetic indoor wooden floor court.",
    "bookingType": "SLOT_BASED",
    "chargeType": "PAID",
    "capacity": 4,
    "feePerHour": 150,
    "feePerDay": 0,
    "rentalFee": 150,
    "securityDeposit": 0,
    "cautionDeposit": 0,
    "openTime": "06:00",
    "closeTime": "22:00",
    "rules": [
      "Non-marking rubber sole shoes only",
      "Bring your own racquets and shuttlecocks"
    ],
    "cancellationCutoffDays": 2,
    "isActive": true,
    "createdAt": "2026-10-23T12:00:00.000Z"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "name",
      "message": "Amenity name must be at least 3 characters long"
    },
    {
      "field": "openTime",
      "message": "openTime must be in HH:mm 24-hour format (e.g. '06:00')"
    }
  ]
}
```

* **HTTP Status:** `409 Conflict` (Duplicate Facility Name)
```json
{
  "success": false,
  "message": "An amenity named 'Badminton Court 1' already exists in this society."
}
```

---

### 29. List All Society Facilities / Amenities
* **Short Endpoint:** `/amenities`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches all active facilities and amenities available in the authenticated user's society with pricing, operating hours, capacity, and house rules.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Society amenities retrieved successfully.",
  "data": [
    {
      "id": "78a1bc22-55dd-43aa-8811-ccaabb223344",
      "name": "Badminton Court 1",
      "description": "Synthetic indoor wooden floor court.",
      "bookingType": "SLOT_BASED",
      "chargeType": "PAID",
      "capacity": 4,
      "feePerHour": 150,
      "feePerDay": 0,
      "securityDeposit": 0,
      "openTime": "06:00",
      "closeTime": "22:00",
      "rules": [
        "Non-marking rubber sole shoes only"
      ],
      "isActive": true
    }
  ]
}
```

---

### 30. Book Facility / Amenity Slot
* **Short Endpoint:** `/amenities/book`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an authenticated resident to reserve a facility for their registered flat. Validates operating hours, checks future dates, prevents double-booking clashes inside an ACID transaction, calculates total fees and refundable deposits, and creates an `AmenityBooking` record with a unique reference number (e.g. `BKG-202610-0001-652`).
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  Content-Type: application/json
  ```

#### Request Body Sample (Slot-Based Booking):
```json
{
  "amenityId": "78a1bc22-55dd-43aa-8811-ccaabb223344",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "bookingDate": "2026-10-24",
  "startTime": "10:00",
  "endTime": "12:00",
  "purpose": "Weekend practice match",
  "attendeesCount": 4
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Amenity booked successfully.",
  "data": {
    "id": "55bb3322-11aa-4cde-8899-ffaabb221100",
    "bookingReference": "BKG-202610-0001-652",
    "amenityId": "78a1bc22-55dd-43aa-8811-ccaabb223344",
    "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
    "bookingDate": "2026-10-24T00:00:00.000Z",
    "slotDetails": "10:00-12:00",
    "startTime": "10:00",
    "endTime": "12:00",
    "purpose": "Weekend practice match",
    "attendeesCount": 4,
    "rentalAmount": 300,
    "cautionDeposit": 0,
    "totalPaid": 300,
    "paymentMode": "ONLINE",
    "status": "CONFIRMED",
    "depositRefundStatus": "NA",
    "createdAt": "2026-10-23T12:05:00.000Z",
    "amenity": {
      "id": "78a1bc22-55dd-43aa-8811-ccaabb223344",
      "name": "Badminton Court 1",
      "bookingType": "SLOT_BASED",
      "chargeType": "PAID"
    },
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "name": "Wing A"
      }
    },
    "bookedByUser": {
      "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "fullName": "Jethalal Gada",
      "phone": "+919820011223",
      "email": "jethalal@gadaelectronics.com"
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Past Date or Outside Hours)
```json
{
  "success": false,
  "message": "Requested slot (04:00 - 06:00) falls outside facility operating hours (06:00 - 22:00)."
}
```

* **HTTP Status:** `403 Forbidden` (Unauthorized Unit Booking)
```json
{
  "success": false,
  "message": "You can only book amenities for your own registered flat."
}
```

* **HTTP Status:** `404 Not Found` (Facility Not Found)
```json
{
  "success": false,
  "message": "Amenity facility not found."
}
```

* **HTTP Status:** `409 Conflict` (Double-Booking Conflict)
```json
{
  "success": false,
  "message": "Double-Booking Conflict: The time slot (10:00 - 12:00) on 2026-10-24 is already booked by Flat 102."
}
```

---

### 31. Get My Facility Bookings
* **Short Endpoint:** `/amenities/my-bookings`
* **HTTP Method:** `GET`
* **Name / Action Description:** Resident retrieves their full facility booking history (upcoming, active, completed, and cancelled bookings) across all flats where they hold approved memberships.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "My amenity bookings retrieved successfully.",
  "data": [
    {
      "id": "55bb3322-11aa-4cde-8899-ffaabb221100",
      "bookingReference": "BKG-202610-0001-652",
      "bookingDate": "2026-10-24T00:00:00.000Z",
      "slotDetails": "10:00-12:00",
      "startTime": "10:00",
      "endTime": "12:00",
      "purpose": "Weekend practice match",
      "rentalAmount": 300,
      "cautionDeposit": 0,
      "totalPaid": 300,
      "status": "CONFIRMED",
      "amenity": {
        "id": "78a1bc22-55dd-43aa-8811-ccaabb223344",
        "name": "Badminton Court 1",
        "bookingType": "SLOT_BASED",
        "chargeType": "PAID",
        "openTime": "06:00",
        "closeTime": "22:00"
      },
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "sectionWing": {
          "name": "Wing A"
        }
      }
    }
  ]
}
```

---

### 32. Cancel or Update Facility Booking
* **Short Endpoint:** `/amenities/bookings/:bookingId/decision`
* **HTTP Method:** `PATCH`
* **Name / Action Description:** Allows a resident to cancel an upcoming reservation (releasing the slot and triggering automatic refund for security deposits), or an administrator to confirm/reject/cancel bookings with formal reason logs.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `bookingId` (UUID or Booking Reference, required): Unique Booking UUID or formatted Booking Reference (`BKG-YYYYMM-XXXX-RRR`).

#### Request Body Sample:
```json
{
  "status": "CANCELLED",
  "cancellationReason": "Change of plans due to heavy rain."
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Amenity booking updated successfully.",
  "data": {
    "id": "55bb3322-11aa-4cde-8899-ffaabb221100",
    "bookingReference": "BKG-202610-0001-652",
    "status": "CANCELLED",
    "cancellationReason": "Change of plans due to heavy rain.",
    "depositRefundStatus": "NA",
    "amenity": {
      "id": "78a1bc22-55dd-43aa-8811-ccaabb223344",
      "name": "Badminton Court 1",
      "bookingType": "SLOT_BASED"
    },
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "name": "Wing A"
      }
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Past Booking Cancellation)
```json
{
  "success": false,
  "message": "Past bookings cannot be cancelled."
}
```

* **HTTP Status:** `403 Forbidden` (Unauthorized Resident)
```json
{
  "success": false,
  "message": "You can only cancel your own amenity bookings."
}
```

* **HTTP Status:** `404 Not Found` (Booking Not Found)
```json
{
  "success": false,
  "message": "Booking record not found."
}
```

---

### 33. Get Amenity Real-Time Schedule Calendar
* **Short Endpoint:** `/amenities/:amenityId/schedule`
* **HTTP Method:** `GET`
* **Name / Action Description:** Real-time slot calendar for an amenity on a selected date. Shows operating hours, capacity, whether the date is fully booked, total reservations count, and all already-reserved time windows with flat details.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```
* **URL Parameter:**
  * `amenityId` (UUID, required): Unique Amenity UUID.
* **Query Parameters:**
  * `date` (optional ISO Date format: `YYYY-MM-DD`, defaults to today)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Amenity schedule and slot availability retrieved successfully.",
  "data": {
    "amenity": {
      "id": "78a1bc22-55dd-43aa-8811-ccaabb223344",
      "name": "Badminton Court 1",
      "bookingType": "SLOT_BASED",
      "chargeType": "PAID",
      "feePerHour": 150,
      "feePerDay": 0,
      "securityDeposit": 0,
      "openTime": "06:00",
      "closeTime": "22:00",
      "capacity": 4
    },
    "date": "2026-10-24",
    "isFullyBooked": false,
    "totalReservations": 1,
    "reservedSlots": [
      {
        "bookingReference": "BKG-202610-0001-652",
        "slotDetails": "10:00-12:00",
        "startTime": "10:00",
        "endTime": "12:00",
        "bookedByUnit": "Wing A - 102"
      }
    ]
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `404 Not Found` (Facility Not Found)
```json
{
  "success": false,
  "message": "Amenity facility not found."
}
```

---

## 📢 Module 6: Notice Board, Announcements & Community Polls Engine

### 34. Publish Notice / Announcement
* **Short Endpoint:** `/notices`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator (`SUPER_ADMIN`, `SUB_ADMIN`) to broadcast digital announcements and emergency alerts across the society or to specific wings. Notices can be categorized, prioritized (`NORMAL`, `URGENT`, `EMERGENCY`), equipped with file attachments, and configured with automated expiration dates.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```

#### Request Body Sample (Emergency Society Notice):
```json
{
  "title": "Urgent: Water Tank Cleaning Tomorrow",
  "content": "Main overhead water supply will be paused between 9 AM and 2 PM tomorrow for tank cleaning.",
  "category": "MAINTENANCE",
  "priority": "EMERGENCY",
  "expiryDate": "2026-10-30",
  "attachments": [
    "https://example.com/notices/water_tank.pdf"
  ]
}
```

#### Request Body Sample (Wing-Targeted Notice):
```json
{
  "title": "Wing A Lift Servicing Notice",
  "content": "Quarterly OTIS maintenance scheduled for Wing A lifts this Saturday.",
  "category": "MAINTENANCE",
  "priority": "NORMAL",
  "targetWings": [
    "Wing A"
  ],
  "expiryDate": "2026-10-28"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Notice published successfully.",
  "data": {
    "id": "54cdbe96-433c-4727-8cf6-de494908f6ca",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "title": "Urgent: Water Tank Cleaning Tomorrow",
    "content": "Main overhead water supply will be paused between 9 AM and 2 PM tomorrow for tank cleaning.",
    "category": "MAINTENANCE",
    "priority": "EMERGENCY",
    "targetAudience": "ALL",
    "targetWings": [],
    "attachmentUrl": "https://example.com/notices/water_tank.pdf",
    "attachments": [
      "https://example.com/notices/water_tank.pdf"
    ],
    "expiresAt": "2026-10-30T23:59:59.999Z",
    "publishedByUserId": "11bb22cc-33dd-44ee-55ff-66aa77bb8899",
    "isActive": true,
    "createdAt": "2026-10-23T12:30:00.000Z",
    "isEmergency": true,
    "isPinned": true
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "title",
      "message": "Title must be at least 5 characters long"
    },
    {
      "field": "content",
      "message": "Content must be at least 10 characters long"
    }
  ]
}
```

* **HTTP Status:** `403 Forbidden` (Insufficient Privileges)
```json
{
  "success": false,
  "message": "Forbidden: Role 'RESIDENT' is not authorized to access this resource"
}
```

---

### 35. Get Notices & Announcements Feed
* **Short Endpoint:** `/notices`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches active announcements and notice board posts for residents and administrators. Automatically filters out expired notices when `activeOnly=true` and delivers relevant notices according to the resident's registered wing.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```
* **Query Parameters:**
  * `category` (optional enum: `GENERAL`, `MAINTENANCE`, `EVENT`, `EMERGENCY`, `FINANCIAL`, `RULES`)
  * `priority` (optional enum: `NORMAL`, `URGENT`, `EMERGENCY`)
  * `activeOnly` (optional boolean, default: `true`)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Notices feed retrieved successfully.",
  "data": {
    "notices": [
      {
        "id": "54cdbe96-433c-4727-8cf6-de494908f6ca",
        "title": "Urgent: Water Tank Cleaning Tomorrow",
        "content": "Main overhead water supply will be paused between 9 AM and 2 PM tomorrow for tank cleaning.",
        "category": "MAINTENANCE",
        "priority": "EMERGENCY",
        "targetAudience": "ALL",
        "targetWings": [],
        "attachmentUrl": "https://example.com/notices/water_tank.pdf",
        "attachments": [
          "https://example.com/notices/water_tank.pdf"
        ],
        "expiresAt": "2026-10-30T23:59:59.999Z",
        "isEmergency": true,
        "isPinned": true,
        "createdAt": "2026-10-23T12:30:00.000Z"
      }
    ],
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 36. Unpublish / Delete Notice
* **Short Endpoint:** `/notices/:noticeId`
* **HTTP Method:** `DELETE`
* **Name / Action Description:** Allows an administrator to soft-delete / unpublish an announcement from the active notice feed.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  ```
* **URL Parameter:**
  * `noticeId` (UUID, required): Unique Notice UUID.

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Notice unpublished successfully.",
  "data": {
    "id": "54cdbe96-433c-4727-8cf6-de494908f6ca",
    "message": "Notice unpublished successfully."
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `404 Not Found` (Notice Not Found)
```json
{
  "success": false,
  "message": "Notice not found."
}
```

---

### 37. Create Community Poll
* **Short Endpoint:** `/notices/polls`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator to launch a democratic community poll (e.g., painting colors, security vendors, EV charger installations). Supports public transparent ballots or anonymous secret ballots with strict anti-duplicate voting rules (`ONE_VOTE_PER_UNIT` or `ONE_VOTE_PER_MEMBER`).
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_access_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "question": "Should the society install EV fast charging stations in Basement 1?",
  "description": "Estimated cost is ₹2,50,000 to be funded from the society sinking fund.",
  "options": [
    "Yes, strongly approve",
    "No, unnecessary expense",
    "Neutral / Abstain"
  ],
  "endDate": "2026-10-30",
  "isSecret": true,
  "votingScope": "ONE_VOTE_PER_UNIT"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Community poll launched successfully.",
  "data": {
    "id": "aa112233-4455-6677-8899-00aabbccdde1",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "question": "Should the society install EV fast charging stations in Basement 1?",
    "description": "Estimated cost is ₹2,50,000 to be funded from the society sinking fund.",
    "pollPrivacyType": "ANONYMOUS_SECRET_BALLOT",
    "isSecret": true,
    "votingScope": "ONE_VOTE_PER_UNIT",
    "startDate": "2026-10-23T12:35:00.000Z",
    "endDate": "2026-10-30T00:00:00.000Z",
    "cutoffTimestamp": "2026-10-30T00:00:00.000Z",
    "status": "ACTIVE",
    "options": [
      {
        "id": "3a4face1-e375-47b3-ac9b-97442bdd2ac2",
        "optionText": "Yes, strongly approve",
        "voteCount": 0
      },
      {
        "id": "b4ca9743-0c8c-4a7c-bb01-38654c4ee8cc",
        "optionText": "No, unnecessary expense",
        "voteCount": 0
      },
      {
        "id": "7be5237a-93fe-4a4e-bb70-dc10921370a8",
        "optionText": "Neutral / Abstain",
        "voteCount": 0
      }
    ],
    "totalVotes": 0,
    "remainingHours": 155.4
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Invalid Choices Count)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "options",
      "message": "Poll must have at least 2 choices"
    }
  ]
}
```

---

### 38. Cast Vote on Community Poll
* **Short Endpoint:** `/notices/polls/:pollId/vote`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows a resident to cast their ballot on an open community poll. Operates inside an ACID transaction to prevent race conditions and rejects duplicate ballots from the same unit with an **HTTP 409 Conflict**.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `pollId` (UUID, required): Unique Poll UUID.

#### Request Body Sample:
```json
{
  "optionIndex": 0,
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Vote recorded successfully.",
  "data": {
    "pollId": "aa112233-4455-6677-8899-00aabbccdde1",
    "question": "Should the society install EV fast charging stations in Basement 1?",
    "votedOption": {
      "id": "3a4face1-e375-47b3-ac9b-97442bdd2ac2",
      "optionText": "Yes, strongly approve"
    },
    "totalVotes": 1,
    "options": [
      {
        "id": "3a4face1-e375-47b3-ac9b-97442bdd2ac2",
        "optionText": "Yes, strongly approve",
        "voteCount": 1,
        "percentage": 100
      },
      {
        "id": "b4ca9743-0c8c-4a7c-bb01-38654c4ee8cc",
        "optionText": "No, unnecessary expense",
        "voteCount": 0,
        "percentage": 0
      },
      {
        "id": "7be5237a-93fe-4a4e-bb70-dc10921370a8",
        "optionText": "Neutral / Abstain",
        "voteCount": 0,
        "percentage": 0
      }
    ]
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Poll Closed or Not Started)
```json
{
  "success": false,
  "message": "Voting for this poll is closed."
}
```

* **HTTP Status:** `403 Forbidden` (Unauthorized Unit)
```json
{
  "success": false,
  "message": "You can only cast a ballot on behalf of your own registered flat."
}
```

* **HTTP Status:** `409 Conflict` (Duplicate Vote Attempt)
```json
{
  "success": false,
  "message": "Your flat has already participated in this poll."
}
```

---

### 39. List Community Polls
* **Short Endpoint:** `/notices/polls`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches all active and past polls for the society with total vote tallies, percentage distributions, and time remaining.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Community polls retrieved successfully.",
  "data": [
    {
      "id": "aa112233-4455-6677-8899-00aabbccdde1",
      "question": "Should the society install EV fast charging stations in Basement 1?",
      "description": "Estimated cost is ₹2,50,000 to be funded from the society sinking fund.",
      "isSecret": true,
      "votingScope": "ONE_VOTE_PER_UNIT",
      "startDate": "2026-10-23T12:35:00.000Z",
      "endDate": "2026-10-30T00:00:00.000Z",
      "isClosed": false,
      "remainingHours": 155.4,
      "totalVotes": 1,
      "options": [
        {
          "id": "3a4face1-e375-47b3-ac9b-97442bdd2ac2",
          "optionText": "Yes, strongly approve",
          "voteCount": 1,
          "percentage": 100
        },
        {
          "id": "b4ca9743-0c8c-4a7c-bb01-38654c4ee8cc",
          "optionText": "No, unnecessary expense",
          "voteCount": 0,
          "percentage": 0
        },
        {
          "id": "7be5237a-93fe-4a4e-bb70-dc10921370a8",
          "optionText": "Neutral / Abstain",
          "voteCount": 0,
          "percentage": 0
        }
      ]
    }
  ]
}
```

---

### 40. Get Poll Breakdown & Live Results
* **Short Endpoint:** `/notices/polls/:pollId/results`
* **HTTP Method:** `GET`
* **Name / Action Description:** Retrieves complete voting analytics for a poll. If `isSecret: true`, individual voter identities and flat numbers are completely masked for total anonymity.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```
* **URL Parameter:**
  * `pollId` (UUID, required): Unique Poll UUID.

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Poll results retrieved successfully.",
  "data": {
    "id": "aa112233-4455-6677-8899-00aabbccdde1",
    "question": "Should the society install EV fast charging stations in Basement 1?",
    "description": "Estimated cost is ₹2,50,000 to be funded from the society sinking fund.",
    "isSecret": true,
    "pollPrivacyType": "ANONYMOUS_SECRET_BALLOT",
    "votingScope": "ONE_VOTE_PER_UNIT",
    "startDate": "2026-10-23T12:35:00.000Z",
    "endDate": "2026-10-30T00:00:00.000Z",
    "isClosed": false,
    "remainingHours": 155.4,
    "totalVotes": 1,
    "options": [
      {
        "id": "3a4face1-e375-47b3-ac9b-97442bdd2ac2",
        "optionText": "Yes, strongly approve",
        "voteCount": 1,
        "percentage": 100
      },
      {
        "id": "b4ca9743-0c8c-4a7c-bb01-38654c4ee8cc",
        "optionText": "No, unnecessary expense",
        "voteCount": 0,
        "percentage": 0
      },
      {
        "id": "7be5237a-93fe-4a4e-bb70-dc10921370a8",
        "optionText": "Neutral / Abstain",
        "voteCount": 0,
        "percentage": 0
      }
    ],
    "publicBallots": []
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `404 Not Found` (Poll Not Found)
```

---

## 👷 Module 7: Staff, Domestic Help & Vendor Management Engine

### 41. Register Staff Member / Domestic Helper
* **Short Endpoint:** `/staff`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator or resident to register daily domestic helpers, maids, cooks, drivers, security personnel, gardeners, or technicians within the society. Generates a unique 6-digit identification pass/code (e.g. `STF-0001`), verifies phone uniqueness within the role, records ID proofs and police verification status, and optionally maps the staff to the resident's unit immediately upon registration.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "fullName": "Shantabai Kamble",
  "phone": "+919820011224",
  "staffType": "MAID",
  "idProofType": "AADHAAR",
  "idProofNumber": "1234-5678-9012",
  "policeVerificationStatus": "VERIFIED",
  "emergencyContact": "+919820011999",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "jobDescription": "Morning cleaning, dusting, and vessel washing"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Staff member registered successfully.",
  "data": {
    "staff": {
      "id": "67a123cc-88ff-4cee-9900-112233aabbcc",
      "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "staffCode": "STF-0001",
      "fullName": "Shantabai Kamble",
      "phone": "+919820011224",
      "staffType": "MAID",
      "idProofType": "AADHAAR",
      "idProofNumber": "1234-5678-9012",
      "policeVerificationStatus": "VERIFIED",
      "photoUrl": null,
      "emergencyContact": "+919820011999",
      "rating": 0,
      "totalReviews": 0,
      "isActive": true,
      "createdAt": "2026-10-23T12:45:00.000Z"
    },
    "initialAssignment": {
      "id": "99aa88bb-77cc-44dd-88ee-112233445566",
      "staffId": "67a123cc-88ff-4cee-9900-112233aabbcc",
      "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "jobDescription": "Morning cleaning, dusting, and vessel washing",
      "isActive": true,
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "sectionWing": {
          "name": "Wing A"
        }
      }
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "phone",
      "message": "Phone number must be between 10 and 15 digits"
    }
  ]
}
```

* **HTTP Status:** `409 Conflict` (Duplicate Staff Member)
```json
{
  "success": false,
  "message": "A staff member with phone '+919820011224' is already registered as 'MAID' in this society."
}
```

---

### 42. Search Society Staff Directory
* **Short Endpoint:** `/staff`
* **HTTP Method:** `GET`
* **Name / Action Description:** Searchable society directory of all domestic helpers and service personnel with assigned flats, verification status, and ratings.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```
* **Query Parameters:**
  * `staffType` (optional enum: `MAID`, `DRIVER`, `COOK`, `CLEANER`, `GARDENER`, `SECURITY_GUARD`, `TECHNICIAN`, `OTHER`)
  * `policeVerificationStatus` (optional enum: `PENDING`, `VERIFIED`, `REJECTED`)
  * `isActive` (optional boolean, default: `true`)
  * `unitId` (optional UUID to find all helpers working in a specific flat)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Society staff directory retrieved successfully.",
  "data": {
    "staff": [
      {
        "id": "67a123cc-88ff-4cee-9900-112233aabbcc",
        "staffCode": "STF-0001",
        "fullName": "Shantabai Kamble",
        "phone": "+919820011224",
        "staffType": "MAID",
        "idProofType": "AADHAAR",
        "policeVerificationStatus": "VERIFIED",
        "rating": 5,
        "totalReviews": 1,
        "isActive": true,
        "assignedUnits": [
          {
            "unitStaffId": "99aa88bb-77cc-44dd-88ee-112233445566",
            "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
            "unitNumber": "102",
            "wing": "Wing A",
            "jobDescription": "Morning cleaning, dusting, and vessel washing"
          }
        ]
      }
    ],
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 43. Assign Staff Member to Flat
* **Short Endpoint:** `/staff/assign-flat`
* **HTTP Method:** `POST`
* **Name / Action Description:** Maps a domestic helper to a specific flat (`UnitStaff` link). Enables multi-flat mapping (e.g. the same maid serving multiple flats across the society).
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "staffId": "67a123cc-88ff-4cee-9900-112233aabbcc",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "jobDescription": "Daily cooking & afternoon cleaning"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Staff assigned to flat successfully.",
  "data": {
    "id": "99aa88bb-77cc-44dd-88ee-112233445566",
    "staffId": "67a123cc-88ff-4cee-9900-112233aabbcc",
    "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
    "jobDescription": "Daily cooking & afternoon cleaning",
    "isActive": true,
    "staff": {
      "id": "67a123cc-88ff-4cee-9900-112233aabbcc",
      "staffCode": "STF-0001",
      "fullName": "Shantabai Kamble",
      "staffType": "MAID",
      "phone": "+919820011224"
    },
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "name": "Wing A"
      }
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `403 Forbidden` (Unauthorized Flat Assignment)
```json
{
  "success": false,
  "message": "You can only assign staff to your own registered flat."
}
```

* **HTTP Status:** `409 Conflict` (Already Assigned)
```json
{
  "success": false,
  "message": "This staff member is already assigned to this flat."
}
```

---

### 44. Unassign Staff Member from Flat
* **Short Endpoint:** `/staff/unassign-flat/:unitStaffId`
* **HTTP Method:** `DELETE`
* **Name / Action Description:** Unlinks a domestic helper from a specific flat when their service terminates.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  ```
* **URL Parameter:**
  * `unitStaffId` (UUID, required): Unique Flat Assignment UUID.

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Staff unassigned from flat successfully.",
  "data": {
    "message": "Staff 'Shantabai Kamble' unassigned from Flat 102.",
    "unitStaffId": "99aa88bb-77cc-44dd-88ee-112233445566"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `404 Not Found` (Assignment Not Found)
```json
{
  "success": false,
  "message": "Staff flat assignment not found."
}
```

---

### 45. Record Staff Gate Attendance Check-In / Check-Out
* **Short Endpoint:** `/staff/attendance`
* **HTTP Method:** `POST`
* **Name / Action Description:** Used by security guards at the gate (or automated kiosk) to log staff entry and exit via their unique staff passcode (e.g. `STF-0001`) or UUID. Automatically computes total working duration inside campus on checkout.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample (Check-In):
```json
{
  "passcode": "STF-0001",
  "action": "CHECK_IN"
}
```

#### Request Body Sample (Check-Out):
```json
{
  "staffId": "67a123cc-88ff-4cee-9900-112233aabbcc",
  "action": "CHECK_OUT"
}
```

#### Success Response Sample (Check-In):
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Staff attendance recorded successfully.",
  "data": {
    "action": "CHECKED_IN",
    "staff": {
      "id": "67a123cc-88ff-4cee-9900-112233aabbcc",
      "staffCode": "STF-0001",
      "fullName": "Shantabai Kamble",
      "staffType": "MAID",
      "phone": "+919820011224",
      "photoUrl": null
    },
    "checkInTime": "2026-10-23T07:30:00.000Z",
    "attendanceId": "bb112233-4455-6677-8899-00aabbccdde1"
  }
}
```

#### Success Response Sample (Check-Out):
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Staff attendance recorded successfully.",
  "data": {
    "action": "CHECKED_OUT",
    "staff": {
      "id": "67a123cc-88ff-4cee-9900-112233aabbcc",
      "staffCode": "STF-0001",
      "fullName": "Shantabai Kamble",
      "staffType": "MAID",
      "phone": "+919820011224"
    },
    "checkInTime": "2026-10-23T07:30:00.000Z",
    "checkOutTime": "2026-10-23T11:45:00.000Z",
    "durationMinutes": 255,
    "attendanceId": "bb112233-4455-6677-8899-00aabbccdde1"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `404 Not Found` (No Active Check-In on Check-Out)
```json
{
  "success": false,
  "message": "Staff 'Shantabai Kamble' (STF-0001) does not have an active check-in record for today."
}
```

* **HTTP Status:** `409 Conflict` (Already Checked In)
```json
{
  "success": false,
  "message": "Staff 'Shantabai Kamble' (STF-0001) is already checked in at 2026-10-23T07:30:00.000Z."
}
```

---

### 46. Get Active Staff Currently on Premises
* **Short Endpoint:** `/staff/active-on-premises`
* **HTTP Method:** `GET`
* **Name / Action Description:** Real-time security dashboard view showing all daily workers and domestic staff currently inside the society premises, including entry times, elapsed minutes inside, and assigned flats.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Active staff on premises retrieved successfully.",
  "data": {
    "totalActiveStaff": 1,
    "staffList": [
      {
        "attendanceId": "bb112233-4455-6677-8899-00aabbccdde1",
        "staffId": "67a123cc-88ff-4cee-9900-112233aabbcc",
        "staffCode": "STF-0001",
        "fullName": "Shantabai Kamble",
        "staffType": "MAID",
        "phone": "+919820011224",
        "photoUrl": null,
        "checkInTime": "2026-10-23T07:30:00.000Z",
        "minutesInside": 255,
        "assignedFlats": [
          "Wing A - 102"
        ]
      }
    ]
  }
}
```

---

### 47. Submit Rating & Review for Staff
* **Short Endpoint:** `/staff/:staffId/rating`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows a resident to submit a 1 to 5 star rating and review comments for a staff member who is assigned to their flat. Automatically recalculates the staff profile's cumulative average rating.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_access_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `staffId` (UUID, required): Unique Staff UUID.

#### Request Body Sample:
```json
{
  "rating": 5,
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "review": "Extremely punctual and thorough cleaning. Very trustworthy!"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Staff review and rating submitted successfully.",
  "data": {
    "review": {
      "id": "cc112233-4455-6677-8899-aabbccddeeff",
      "staffId": "67a123cc-88ff-4cee-9900-112233aabbcc",
      "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "userId": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "rating": 5,
      "review": "Extremely punctual and thorough cleaning. Very trustworthy!",
      "createdAt": "2026-10-23T12:55:00.000Z"
    },
    "staff": {
      "id": "67a123cc-88ff-4cee-9900-112233aabbcc",
      "fullName": "Shantabai Kamble",
      "rating": 5,
      "totalReviews": 1
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `403 Forbidden` (Staff Not Assigned to Flat)
```json
{
  "success": false,
  "message": "You can only submit reviews for staff members who are currently assigned to your flat."
}
```

---

## ⚙️ Module 8: Asset, Equipment & Inventory Management Engine

### 48. Register Physical Equipment / Asset
* **Short Endpoint:** `/assets`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator (`SUPER_ADMIN`, `SUB_ADMIN`) to register physical society equipment, machinery, and community assets (e.g., diesel generators, lifts, water pumps, CCTV systems, fire equipment, gym gear). Generates a unique category-prefixed asset code (e.g. `AST-ELEC-0001`), records warranty expiration, and saves vendor AMC service details.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "name": "Diesel Generator 50kVA",
  "category": "ELECTRICAL",
  "location": "Basement Block B",
  "serialNumber": "KIR-DG50-2026-X1",
  "modelNumber": "Kirloskar KG50",
  "manufacturer": "Kirloskar Electric",
  "purchaseDate": "2025-01-15T00:00:00.000Z",
  "purchaseCost": 450000,
  "warrantyExpiry": "2027-01-15T00:00:00.000Z",
  "amcDetails": {
    "vendorName": "PowerTech Energy Solutions",
    "vendorPhone": "+919820011888",
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-12-31T23:59:59.000Z",
    "cost": 35000
  }
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Asset registered successfully.",
  "data": {
    "id": "27c3d18e-4a11-4f40-8b09-fa98c36e451b",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "assetCode": "AST-ELEC-0001",
    "name": "Diesel Generator 50kVA",
    "category": "ELECTRICAL",
    "location": "Basement Block B",
    "serialNumber": "KIR-DG50-2026-X1",
    "modelNumber": "Kirloskar KG50",
    "manufacturer": "Kirloskar Electric",
    "purchaseDate": "2025-01-15T00:00:00.000Z",
    "purchaseCost": 450000,
    "warrantyExpiry": "2027-01-15T00:00:00.000Z",
    "status": "OPERATIONAL",
    "nextServiceDue": null,
    "amcVendorName": "PowerTech Energy Solutions",
    "amcVendorPhone": "+919820011888",
    "amcStartDate": "2026-01-01T00:00:00.000Z",
    "amcEndDate": "2026-12-31T23:59:59.000Z",
    "amcCost": 35000,
    "createdAt": "2026-10-23T13:00:00.000Z",
    "updatedAt": "2026-10-23T13:00:00.000Z"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "category",
      "message": "Category must be one of: ELECTRICAL, PLUMBING, ELEVATOR, SECURITY_SYSTEM, FIRE_SAFETY, GYM_EQUIPMENT, OTHER"
    }
  ]
}
```

* **HTTP Status:** `409 Conflict` (Duplicate Serial Number)
```json
{
  "success": false,
  "message": "An asset with serial number 'KIR-DG50-2026-X1' is already registered in this society."
}
```

---

### 49. Search Society Assets & Equipment
* **Short Endpoint:** `/assets`
* **HTTP Method:** `GET`
* **Name / Action Description:** Filter and list physical assets across the society with operational status indicators, active warranty badges, days until AMC expiration, and the latest routine service log.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Query Parameters:**
  * `category` (optional enum: `ELECTRICAL`, `PLUMBING`, `ELEVATOR`, `SECURITY_SYSTEM`, `FIRE_SAFETY`, `GYM_EQUIPMENT`, `OTHER`)
  * `status` (optional enum: `OPERATIONAL`, `UNDER_MAINTENANCE`, `DECOMMISSIONED`)
  * `search` (optional string: name, assetCode, location, or serialNumber)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Society assets retrieved successfully.",
  "data": {
    "assets": [
      {
        "id": "27c3d18e-4a11-4f40-8b09-fa98c36e451b",
        "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
        "assetCode": "AST-ELEC-0001",
        "name": "Diesel Generator 50kVA",
        "category": "ELECTRICAL",
        "location": "Basement Block B",
        "serialNumber": "KIR-DG50-2026-X1",
        "modelNumber": "Kirloskar KG50",
        "manufacturer": "Kirloskar Electric",
        "purchaseDate": "2025-01-15T00:00:00.000Z",
        "purchaseCost": 450000,
        "warrantyExpiry": "2027-01-15T00:00:00.000Z",
        "status": "OPERATIONAL",
        "nextServiceDue": "2026-11-05T00:00:00.000Z",
        "amcVendorName": "PowerTech Energy Solutions",
        "amcVendorPhone": "+919820011888",
        "amcStartDate": "2026-01-01T00:00:00.000Z",
        "amcEndDate": "2026-12-31T23:59:59.000Z",
        "amcCost": 35000,
        "isWarrantyActive": true,
        "isAmcActive": true,
        "daysUntilAmcExpiry": 69,
        "daysUntilNextService": 13,
        "lastService": {
          "id": "89dd22bb-66cc-44aa-99bb-1122334455aa",
          "maintenanceType": "ROUTINE_INSPECTION",
          "serviceDate": "2026-10-23T13:10:00.000Z",
          "servicedBy": "Sunil Sharma (Senior Tech)",
          "cost": 3500
        }
      }
    ],
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 50. Log Asset Maintenance / Service Record
* **Short Endpoint:** `/assets/:assetId/maintenance`
* **HTTP Method:** `POST`
* **Name / Action Description:** Logs a routine inspection, preventive AMC checkup, or emergency breakdown repair for a physical asset. Automatically updates the asset's operational status and schedules the next inspection due date inside an ACID transaction.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `assetId` (UUID, required): Unique Asset ID.

#### Request Body Sample:
```json
{
  "maintenanceType": "ROUTINE_INSPECTION",
  "serviceDate": "2026-10-23T13:10:00.000Z",
  "cost": 3500,
  "servicedBy": "Sunil Sharma (Senior Tech)",
  "notes": "Oil filter replaced and battery health verified. Coolant topped up.",
  "invoiceNumber": "INV-2026-8819",
  "nextServiceDue": "2026-11-05T00:00:00.000Z",
  "updateAssetStatus": "OPERATIONAL"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Maintenance record logged successfully.",
  "data": {
    "maintenanceRecord": {
      "id": "89dd22bb-66cc-44aa-99bb-1122334455aa",
      "assetId": "27c3d18e-4a11-4f40-8b09-fa98c36e451b",
      "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "maintenanceType": "ROUTINE_INSPECTION",
      "serviceDate": "2026-10-23T13:10:00.000Z",
      "cost": 3500,
      "servicedBy": "Sunil Sharma (Senior Tech)",
      "notes": "Oil filter replaced and battery health verified. Coolant topped up.",
      "invoiceNumber": "INV-2026-8819",
      "nextServiceDue": "2026-11-05T00:00:00.000Z",
      "loggedByUserId": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "createdAt": "2026-10-23T13:10:00.000Z",
      "loggedBy": {
        "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
        "fullName": "Admin User",
        "role": "SUPER_ADMIN"
      }
    },
    "updatedAsset": {
      "id": "27c3d18e-4a11-4f40-8b09-fa98c36e451b",
      "assetCode": "AST-ELEC-0001",
      "name": "Diesel Generator 50kVA",
      "status": "OPERATIONAL",
      "nextServiceDue": "2026-11-05T00:00:00.000Z"
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `404 Not Found` (Asset Not Found)
```json
{
  "success": false,
  "message": "Asset not found in this society."
}
```

---

### 51. Get Upcoming Maintenance, Warranty & AMC Alerts
* **Short Endpoint:** `/assets/maintenance/alerts`
* **HTTP Method:** `GET`
* **Name / Action Description:** Real-time preventive maintenance dashboard querying all society equipment with AMCs expiring in the next 30 days, warranties expiring in 30 days, or routine service checkups overdue or approaching.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Maintenance and warranty alerts retrieved successfully.",
  "data": {
    "totalAlerts": 3,
    "expiringAmc": [
      {
        "id": "27c3d18e-4a11-4f40-8b09-fa98c36e451b",
        "assetCode": "AST-ELEC-0001",
        "name": "Diesel Generator 50kVA",
        "category": "ELECTRICAL",
        "location": "Basement Block B",
        "amcVendorName": "PowerTech Energy Solutions",
        "amcVendorPhone": "+919820011888",
        "amcEndDate": "2026-11-15T00:00:00.000Z",
        "amcCost": 35000,
        "daysRemaining": 23
      }
    ],
    "upcomingServices": [
      {
        "id": "27c3d18e-4a11-4f40-8b09-fa98c36e451b",
        "assetCode": "AST-ELEC-0001",
        "name": "Diesel Generator 50kVA",
        "category": "ELECTRICAL",
        "location": "Basement Block B",
        "status": "OPERATIONAL",
        "nextServiceDue": "2026-11-05T00:00:00.000Z",
        "isOverdue": false,
        "daysRemaining": 13
      }
    ],
    "expiringWarranties": [
      {
        "id": "27c3d18e-4a11-4f40-8b09-fa98c36e451b",
        "assetCode": "AST-ELEC-0001",
        "name": "Diesel Generator 50kVA",
        "category": "ELECTRICAL",
        "manufacturer": "Kirloskar Electric",
        "warrantyExpiry": "2026-11-10T00:00:00.000Z",
        "daysRemaining": 18
      }
    ]
  }
}
```

---

### 52. Add / Update Inventory Consumable Item
* **Short Endpoint:** `/assets/inventory`
* **HTTP Method:** `POST`
* **Name / Action Description:** Adds a new consumable inventory item (e.g., LED bulbs, chlorine powder, PVC pipes, cleaning chemicals) or updates an existing item. Defines minimum threshold levels for automated low-stock warnings.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "itemName": "LED Bulb 15W Philips",
  "category": "LIGHTING",
  "quantity": 20,
  "unitOfMeasure": "PIECES",
  "minimumThreshold": 5,
  "unitCost": 150
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Inventory item created successfully.",
  "data": {
    "id": "11bb33dd-55ee-77ff-99aa-224466880011",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "itemCode": "INV-0001",
    "itemName": "LED Bulb 15W Philips",
    "category": "LIGHTING",
    "quantity": 20,
    "unitOfMeasure": "PIECES",
    "minimumThreshold": 5,
    "unitCost": 150,
    "isLowStock": false,
    "createdAt": "2026-10-23T13:15:00.000Z",
    "updatedAt": "2026-10-23T13:15:00.000Z"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "unitOfMeasure",
      "message": "Unit of measure must be one of: PIECES, KG, LITERS, BOXES, METERS"
    }
  ]
}
```

---

### 53. Adjust Inventory Stock (Usage or Replenishment)
* **Short Endpoint:** `/assets/inventory/:itemId/adjust`
* **HTTP Method:** `PATCH`
* **Name / Action Description:** Safely adjusts inventory stock inside an ACID transaction. Positive integers replenish stock; negative integers record consumption. Automatically validates that stock cannot drop below 0, records an audit ledger entry with the reason, and triggers `isLowStock: true` when remaining quantity reaches or falls below the minimum threshold.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `itemId` (UUID, required): Unique Inventory Item ID.

#### Request Body Sample (Stock Consumption):
```json
{
  "quantityChange": -16,
  "reason": "Replacement of fused corridor lights across Wing A & B"
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Inventory stock adjusted successfully.",
  "data": {
    "item": {
      "id": "11bb33dd-55ee-77ff-99aa-224466880011",
      "itemCode": "INV-0001",
      "itemName": "LED Bulb 15W Philips",
      "category": "LIGHTING",
      "quantity": 4,
      "unitOfMeasure": "PIECES",
      "minimumThreshold": 5,
      "isLowStock": true
    },
    "stockLog": {
      "id": "44ee66aa-88bb-00cc-22dd-1133557799aa",
      "inventoryItemId": "11bb33dd-55ee-77ff-99aa-224466880011",
      "quantityChange": -16,
      "quantityAfter": 4,
      "reason": "Replacement of fused corridor lights across Wing A & B",
      "adjustedByUserId": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "createdAt": "2026-10-23T13:20:00.000Z",
      "adjustedByUser": {
        "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
        "fullName": "Admin User",
        "role": "SUPER_ADMIN"
      }
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Insufficient Stock)
```json
{
  "success": false,
  "message": "Insufficient stock for 'LED Bulb 15W Philips'. Current stock is 4 PIECES, cannot consume 10."
}
```

* **HTTP Status:** `404 Not Found` (Item Not Found)
```json
{
  "success": false,
  "message": "Inventory item not found in this society."
}
```

---

### 54. Query Inventory Status & Threshold Warnings
* **Short Endpoint:** `/assets/inventory`
* **HTTP Method:** `GET`
* **Name / Action Description:** Retrieves consumable inventory items with stock threshold warnings (`isLowStock: true`) and recent stock movement logs.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  ```
* **Query Parameters:**
  * `category` (optional enum: `LIGHTING`, `PLUMBING_PARTS`, `CLEANING_CHEMICALS`, `ELECTRICAL_PARTS`, `STATIONERY`, `OTHER`)
  * `lowStockOnly` (optional boolean, e.g. `true`)
  * `search` (optional string: itemName or itemCode)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Inventory status retrieved successfully.",
  "data": {
    "summary": {
      "totalUniqueItems": 1,
      "lowStockAlertCount": 1
    },
    "items": [
      {
        "id": "11bb33dd-55ee-77ff-99aa-224466880011",
        "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
        "itemCode": "INV-0001",
        "itemName": "LED Bulb 15W Philips",
        "category": "LIGHTING",
        "quantity": 4,
        "unitOfMeasure": "PIECES",
        "minimumThreshold": 5,
        "unitCost": 150,
        "isLowStock": true,
        "createdAt": "2026-10-23T13:15:00.000Z",
        "updatedAt": "2026-10-23T13:20:00.000Z",
        "stockLogs": [
          {
            "id": "44ee66aa-88bb-00cc-22dd-1133557799aa",
            "quantityChange": -16,
            "quantityAfter": 4,
            "reason": "Replacement of fused corridor lights across Wing A & B",
            "createdAt": "2026-10-23T13:20:00.000Z"
          }
        ]
      }
    ],
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## 🚗 Module 9: Parking Space Allocation & Vehicle Tracking Engine

### 55. Create Parking Slot / Bay
* **Short Endpoint:** `/parking/slots`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator (`SUPER_ADMIN`, `SUB_ADMIN`) to define a new physical parking bay or slot within the society (e.g. `B1-P102`), specifying its zone location, vehicle compatibility, slot purpose (resident, visitor, commercial), and optional EV charging provision.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "slotNumber": "B1-P102",
  "zone": "BASEMENT_1",
  "vehicleType": "FOUR_WHEELER",
  "slotType": "DEDICATED_RESIDENT",
  "hasEvCharging": true
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Parking slot created successfully.",
  "data": {
    "id": "71fa33dd-11aa-4cee-99bb-1122334455aa",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "slotNumber": "B1-P102",
    "zone": "BASEMENT_1",
    "vehicleType": "FOUR_WHEELER",
    "slotType": "DEDICATED_RESIDENT",
    "hasEvCharging": true,
    "isAllocated": false,
    "allocatedUnitId": null,
    "allocationType": null,
    "monthlyFee": 0,
    "allocatedAt": null,
    "createdAt": "2026-10-23T13:30:00.000Z",
    "updatedAt": "2026-10-23T13:30:00.000Z"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "zone",
      "message": "Invalid enum value. Expected 'BASEMENT_1' | 'BASEMENT_2' | 'GROUND' | 'STILT' | 'OPEN_PODIUM'"
    }
  ]
}
```

* **HTTP Status:** `409 Conflict` (Duplicate Slot)
```json
{
  "success": false,
  "message": "Parking slot 'B1-P102' is already defined in this society."
}
```

---

### 56. Search & List Parking Slots
* **Short Endpoint:** `/parking/slots`
* **HTTP Method:** `GET`
* **Name / Action Description:** Filter and query society parking bays by zone, allocation status, EV charging provision, vehicle type, and search keyword.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Query Parameters:**
  * `zone` (optional enum: `BASEMENT_1`, `BASEMENT_2`, `GROUND`, `STILT`, `OPEN_PODIUM`)
  * `vehicleType` (optional enum: `TWO_WHEELER`, `FOUR_WHEELER`, `HEAVY_VEHICLE`)
  * `slotType` (optional enum: `DEDICATED_RESIDENT`, `GUEST_VISITOR`, `COMMERCIAL_SERVICE`)
  * `isAllocated` (optional boolean, e.g. `true` or `false`)
  * `hasEvCharging` (optional boolean, e.g. `true`)
  * `unitId` (optional UUID)
  * `search` (optional string: slotNumber or unitNumber)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Parking slots retrieved successfully.",
  "data": {
    "slots": [
      {
        "id": "71fa33dd-11aa-4cee-99bb-1122334455aa",
        "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
        "slotNumber": "B1-P102",
        "zone": "BASEMENT_1",
        "vehicleType": "FOUR_WHEELER",
        "slotType": "DEDICATED_RESIDENT",
        "hasEvCharging": true,
        "isAllocated": true,
        "allocatedUnitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "allocationType": "PERMANENT_DEEDED",
        "monthlyFee": 0,
        "allocatedAt": "2026-10-23T13:35:00.000Z",
        "allocatedUnit": {
          "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
          "unitNumber": "102",
          "sectionWing": {
            "name": "Wing A"
          }
        },
        "vehicles": [
          {
            "id": "99dd33aa-44bb-55cc-66dd-778899001122",
            "licensePlate": "GJ01AB1234",
            "makeModel": "Honda City White",
            "vehicleType": "FOUR_WHEELER"
          }
        ]
      }
    ],
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 57. Allocate Parking Slot to Flat
* **Short Endpoint:** `/parking/allocate`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator (`SUPER_ADMIN`, `SUB_ADMIN`) to assign an unallocated parking bay to a resident flat with permanent deeded ownership, annual lease, or temporary allocation terms inside an ACID transaction.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "slotId": "71fa33dd-11aa-4cee-99bb-1122334455aa",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "allocationType": "PERMANENT_DEEDED",
  "monthlyFee": 0
}
```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Parking slot allocated to unit successfully.",
  "data": {
    "id": "71fa33dd-11aa-4cee-99bb-1122334455aa",
    "slotNumber": "B1-P102",
    "isAllocated": true,
    "allocatedUnitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
    "allocationType": "PERMANENT_DEEDED",
    "monthlyFee": 0,
    "allocatedAt": "2026-10-23T13:35:00.000Z",
    "allocatedUnit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "name": "Wing A"
      }
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `409 Conflict` (Slot Already Allocated)
```json
{
  "success": false,
  "message": "Parking slot 'B1-P102' is already allocated to another unit."
}
```

---

### 58. Register Resident Vehicle
* **Short Endpoint:** `/parking/vehicles`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows a resident (for their approved flat) or society administrator to register a vehicle (two-wheeler or four-wheeler) with license plate number, make/model, Fastag/RFID code, and optional link to an assigned parking bay.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "licensePlate": "GJ01AB1234",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "vehicleType": "FOUR_WHEELER",
  "makeModel": "Honda City White",
  "rfidTag": "RFID-881920",
  "fastagId": "FTG-992011",
  "parkingSlotId": "71fa33dd-11aa-4cee-99bb-1122334455aa"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Vehicle registered successfully.",
  "data": {
    "id": "99dd33aa-44bb-55cc-66dd-778899001122",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
    "parkingSlotId": "71fa33dd-11aa-4cee-99bb-1122334455aa",
    "licensePlate": "GJ01AB1234",
    "vehicleType": "FOUR_WHEELER",
    "makeModel": "Honda City White",
    "rfidTag": "RFID-881920",
    "fastagId": "FTG-992011",
    "isActive": true,
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "name": "Wing A"
      }
    },
    "parkingSlot": {
      "id": "71fa33dd-11aa-4cee-99bb-1122334455aa",
      "slotNumber": "B1-P102",
      "zone": "BASEMENT_1",
      "hasEvCharging": true
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `403 Forbidden` (Unauthorized Flat Vehicle Registration)
```json
{
  "success": false,
  "message": "You can only register vehicles for your own approved unit."
}
```

* **HTTP Status:** `409 Conflict` (Duplicate License Plate)
```json
{
  "success": false,
  "message": "Vehicle with license plate 'GJ01AB1234' is already registered in this society."
}
```

---

### 59. View Resident Parking Bays & Vehicles
* **Short Endpoint:** `/parking/my-parking`
* **HTTP Method:** `GET`
* **Name / Action Description:** Allows an authenticated resident to view their flat's allocated parking slots, all registered family vehicles, and recent parking violation notices.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Resident parking details retrieved successfully.",
  "data": {
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "wing": "Wing A"
    },
    "allocatedSlots": [
      {
        "id": "71fa33dd-11aa-4cee-99bb-1122334455aa",
        "slotNumber": "B1-P102",
        "zone": "BASEMENT_1",
        "vehicleType": "FOUR_WHEELER",
        "hasEvCharging": true,
        "allocationType": "PERMANENT_DEEDED",
        "monthlyFee": 0
      }
    ],
    "registeredVehicles": [
      {
        "id": "99dd33aa-44bb-55cc-66dd-778899001122",
        "licensePlate": "GJ01AB1234",
        "makeModel": "Honda City White",
        "vehicleType": "FOUR_WHEELER",
        "parkingSlot": {
          "slotNumber": "B1-P102",
          "zone": "BASEMENT_1"
        }
      }
    ],
    "recentViolations": []
  }
}
```

---

### 60. Log Vehicle Gate Movement (ANPR / RFID / Guard Check)
* **Short Endpoint:** `/parking/gate-movement`
* **HTTP Method:** `POST`
* **Name / Action Description:** Used by security guards or automated barrier systems (ANPR cameras, RFID scanners) to record vehicle entry or exit. Instantly checks whether the license plate belongs to an authorized resident or an approved visitor, and raises an unscheduled entry flag if neither matches.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "licensePlate": "GJ01AB1234",
  "action": "ENTRY",
  "gateNumber": "MAIN_GATE_1"
}
```

#### Success Response Sample (Registered Resident Vehicle):
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Vehicle gate movement logged successfully.",
  "data": {
    "movementLog": {
      "id": "bb224466-88aa-00cc-22dd-1133557799aa",
      "licensePlate": "GJ01AB1234",
      "action": "ENTRY",
      "gateNumber": "MAIN_GATE_1",
      "isAuthorized": true,
      "authorizationType": "REGISTERED_RESIDENT",
      "timestamp": "2026-10-23T13:40:00.000Z"
    },
    "status": "AUTHORIZED",
    "vehicleType": "REGISTERED_RESIDENT",
    "vehicleDetails": {
      "licensePlate": "GJ01AB1234",
      "makeModel": "Honda City White",
      "unitNumber": "102",
      "wing": "Wing A",
      "slotNumber": "B1-P102"
    }
  }
}
```

#### Success Response Sample (Unscheduled / Unregistered Vehicle):
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Vehicle gate movement logged successfully.",
  "data": {
    "movementLog": {
      "id": "cc335577-99bb-11dd-33ee-2244668800bb",
      "licensePlate": "MH12UN9999",
      "action": "ENTRY",
      "gateNumber": "GATE_2",
      "isAuthorized": false,
      "authorizationType": "VISITOR_UNSCHEDULED",
      "timestamp": "2026-10-23T13:42:00.000Z"
    },
    "status": "WARNING_UNSCHEDULED",
    "vehicleType": "UNREGISTERED",
    "warningMessage": "Vehicle is neither registered to a resident nor pre-approved as a visitor."
  }
}
```

---

### 61. Report Illegal / Unauthorized Parking Violation
* **Short Endpoint:** `/parking/violations`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows security guards or residents to report unauthorized vehicles occupying private resident bays, blocking driveways, or misusing EV charging slots. Automatically attaches the incident to the offending resident flat if the license plate is registered in the system.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_or_guard_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "vehicleNumber": "MH12UN9999",
  "slotId": "71fa33dd-11aa-4cee-99bb-1122334455aa",
  "violationType": "UNAUTHORIZED_SLOT",
  "penaltyAmount": 500,
  "photoUrl": "https://s3.amazonaws.com/society-storage/violations/snap-102.jpg",
  "notes": "Unregistered vehicle blocked reserved slot B1-P102 without resident permit"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Parking violation reported successfully.",
  "data": {
    "id": "7d458cc7-cf2d-420f-b66b-7f5bac961690",
    "slotId": "71fa33dd-11aa-4cee-99bb-1122334455aa",
    "vehicleNumber": "MH12UN9999",
    "unitId": null,
    "violationType": "UNAUTHORIZED_SLOT",
    "penaltyAmount": 500,
    "status": "REPORTED",
    "photoUrl": "https://s3.amazonaws.com/society-storage/violations/snap-102.jpg",
    "notes": "Unregistered vehicle blocked reserved slot B1-P102 without resident permit",
    "createdAt": "2026-10-23T13:45:00.000Z",
    "slot": {
      "slotNumber": "B1-P102",
      "zone": "BASEMENT_1"
    },
    "reportedByUser": {
      "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "fullName": "Admin User",
      "role": "SUPER_ADMIN"
    }
  }
}
```

---

### 62. Real-Time Parking Capacity & Metrics Overview
* **Short Endpoint:** `/parking/overview`
* **HTTP Method:** `GET`
* **Name / Action Description:** Real-time society parking dashboard for administrators displaying total bays, allocated slots, vacant visitor bays, EV charging count, occupancy percentage, and zone-by-zone breakdown.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Parking overview retrieved successfully.",
  "data": {
    "capacity": {
      "totalSlots": 120,
      "allocatedSlots": 96,
      "vacantSlots": 24,
      "occupancyRate": 80,
      "evChargingSlots": 15
    },
    "slotTypes": {
      "dedicatedResidentSlots": 100,
      "guestVisitorSlots": 15,
      "commercialServiceSlots": 5
    },
    "vehicles": {
      "totalRegisteredVehicles": 110,
      "twoWheelers": 45,
      "fourWheelers": 65
    },
    "zoneBreakdown": [
      {
        "zone": "BASEMENT_1",
        "total": 60,
        "allocated": 52,
        "vacant": 8
      },
      {
        "zone": "BASEMENT_2",
        "total": 40,
        "allocated": 36,
        "vacant": 4
      },
      {
        "zone": "OPEN_PODIUM",
        "total": 20,
        "allocated": 8,
        "vacant": 12
      }
    ]
  }
}
```

---

## 📁 Module 10: Legal, Document & Contract Repository Engine

### 63. Upload Document Record
* **Short Endpoint:** `/documents`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator or verified resident to register document metadata records in the society cloud repository. Supports society-wide public documents (`PUBLIC_RESIDENTS`), administrator-confidential documents (`ADMIN_ONLY`), and flat-specific private documents (`UNIT_PRIVATE`, such as registered rent agreements, sale deeds, possession letters, and KYC identity proofs).
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```

#### Request Body Sample (Society Byelaws - Public):
```json
{
  "title": "Society Model Byelaws 2026",
  "documentType": "SOCIETY_BYELAWS",
  "accessLevel": "PUBLIC_RESIDENTS",
  "fileUrl": "https://storage.example.com/docs/society-byelaws-2026.pdf",
  "fileSizeBytes": 2048500,
  "mimeType": "application/pdf",
  "description": "Official registered model byelaws of the cooperative housing society.",
  "tags": ["byelaws", "legal", "constitution"]
}
```

#### Request Body Sample (Flat Rent Agreement - Unit Private):
```json
{
  "title": "Registered Rent Agreement 2026",
  "documentType": "RENT_AGREEMENT",
  "accessLevel": "UNIT_PRIVATE",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "fileUrl": "https://storage.example.com/docs/rent-agreement-unit102.pdf",
  "fileSizeBytes": 1048576,
  "mimeType": "application/pdf",
  "description": "11-month registered rent agreement for flat tenant.",
  "tags": ["tenancy", "agreement"]
}
```

#### Request Body Sample (Fire Safety NOC - With Expiry Date):
```json
{
  "title": "Annual Fire Safety Compliance NOC",
  "documentType": "FIRE_SAFETY_NOC",
  "accessLevel": "ADMIN_ONLY",
  "fileUrl": "https://storage.example.com/docs/fire-safety-noc-2026.pdf",
  "expiryDate": "2026-11-15T00:00:00.000Z",
  "description": "Fire department renewal certificate.",
  "tags": ["fire_safety", "compliance", "noc"]
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Document uploaded and registered successfully.",
  "data": {
    "id": "11aa22bb-33cc-44dd-55ee-66ff77889900",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "title": "Registered Rent Agreement 2026",
    "documentType": "RENT_AGREEMENT",
    "accessLevel": "UNIT_PRIVATE",
    "fileUrl": "https://storage.example.com/docs/rent-agreement-unit102.pdf",
    "fileSizeBytes": 1048576,
    "mimeType": "application/pdf",
    "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
    "expiryDate": null,
    "description": "11-month registered rent agreement for flat tenant.",
    "tags": ["tenancy", "agreement"],
    "isArchived": false,
    "archivedAt": null,
    "uploadedByUserId": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
    "createdAt": "2026-10-23T13:50:00.000Z",
    "updatedAt": "2026-10-23T13:50:00.000Z",
    "unit": {
      "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "unitNumber": "102",
      "sectionWing": {
        "name": "Wing A"
      }
    },
    "uploadedByUser": {
      "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "fullName": "Resident User",
      "role": "RESIDENT"
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Missing Unit on Private Doc)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "unitId",
      "message": "unitId is required when accessLevel is 'UNIT_PRIVATE'"
    }
  ]
}
```

* **HTTP Status:** `403 Forbidden` (Unauthorized Unit Document Upload)
```json
{
  "success": false,
  "message": "You can only upload private documents for your own approved unit."
}
```

---

### 64. List Accessible Documents Feed
* **Short Endpoint:** `/documents`
* **HTTP Method:** `GET`
* **Name / Action Description:** Retrieves the document repository feed with strict multi-tenant and role privacy enforcement. Residents automatically receive public circulars/byelaws and private documents of their own flat(s) while admin-confidential files and other residents' private papers remain hidden.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Query Parameters:**
  * `documentType` (optional enum: `SOCIETY_BYELAWS`, `AGM_MOM`, `FIRE_SAFETY_NOC`, `BUILDING_INSURANCE`, `FINANCIAL_AUDIT`, `SALE_DEED`, `RENT_AGREEMENT`, `POSSESSION_LETTER`, `IDENTITY_PROOF`, `OTHER`)
  * `accessLevel` (optional enum: `PUBLIC_RESIDENTS`, `ADMIN_ONLY`, `UNIT_PRIVATE`)
  * `unitId` (optional UUID to filter flat-specific papers)
  * `expiringSoon` (optional boolean, e.g. `true` for documents expiring within 60 days)
  * `search` (optional string: search in title, description, or tags)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Documents retrieved successfully.",
  "data": {
    "documents": [
      {
        "id": "11aa22bb-33cc-44dd-55ee-66ff77889900",
        "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
        "title": "Registered Rent Agreement 2026",
        "documentType": "RENT_AGREEMENT",
        "accessLevel": "UNIT_PRIVATE",
        "fileUrl": "https://storage.example.com/docs/rent-agreement-unit102.pdf",
        "fileSizeBytes": 1048576,
        "mimeType": "application/pdf",
        "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "expiryDate": null,
        "description": "11-month registered rent agreement for flat tenant.",
        "tags": ["tenancy", "agreement"],
        "createdAt": "2026-10-23T13:50:00.000Z",
        "unit": {
          "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
          "unitNumber": "102",
          "sectionWing": {
            "name": "Wing A"
          }
        },
        "uploadedByUser": {
          "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
          "fullName": "Resident User",
          "role": "RESIDENT"
        }
      }
    ],
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 65. Query Compliance Expiry Alerts
* **Short Endpoint:** `/documents/expiring-alerts`
* **HTTP Method:** `GET`
* **Name / Action Description:** Real-time administrative compliance dashboard tracking mandatory statutory documents (Fire Safety NOC, Building Structural Insurance, Lift License, Pollution Control Board approvals) expiring in the next 60 days or overdue for renewal.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Expiring compliance documents retrieved successfully.",
  "data": {
    "totalAlerts": 1,
    "alerts": [
      {
        "id": "22bb33cc-44dd-55ee-66ff-778899001122",
        "title": "Annual Fire Safety Compliance NOC",
        "documentType": "FIRE_SAFETY_NOC",
        "accessLevel": "ADMIN_ONLY",
        "expiryDate": "2026-11-15T00:00:00.000Z",
        "isExpired": false,
        "daysRemaining": 23,
        "fileUrl": "https://storage.example.com/docs/fire-safety-noc-2026.pdf",
        "unit": null,
        "uploadedBy": {
          "id": "88aa99bb-00cc-11dd-22ee-334455667788",
          "fullName": "Admin User",
          "role": "SUPER_ADMIN"
        }
      }
    ]
  }
}
```

---

### 66. Retrieve Document Details by ID
* **Short Endpoint:** `/documents/:documentId`
* **HTTP Method:** `GET`
* **Name / Action Description:** Fetches complete metadata, file URL, uploader info, and unit linkage for a specific document with permission enforcement.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **URL Parameter:**
  * `documentId` (UUID, required): Unique Document UUID.

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Document details retrieved successfully.",
  "data": {
    "id": "11aa22bb-33cc-44dd-55ee-66ff77889900",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "title": "Society Model Byelaws 2026",
    "documentType": "SOCIETY_BYELAWS",
    "accessLevel": "PUBLIC_RESIDENTS",
    "fileUrl": "https://storage.example.com/docs/society-byelaws-2026.pdf",
    "fileSizeBytes": 2048500,
    "mimeType": "application/pdf",
    "unitId": null,
    "expiryDate": null,
    "description": "Official registered model byelaws of the cooperative housing society.",
    "tags": ["byelaws", "legal", "constitution"],
    "isArchived": false,
    "uploadedByUserId": "88aa99bb-00cc-11dd-22ee-334455667788",
    "createdAt": "2026-10-23T13:45:00.000Z",
    "uploadedByUser": {
      "id": "88aa99bb-00cc-11dd-22ee-334455667788",
      "fullName": "Admin User",
      "role": "SUPER_ADMIN"
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `403 Forbidden` (Restricted Document Access)
```json
{
  "success": false,
  "message": "You do not have permission to access this administrator document."
}
```

* **HTTP Status:** `404 Not Found` (Document Not Found)
```json
{
  "success": false,
  "message": "Document not found in this society."
}
```

---

### 67. Archive / Remove Document
* **Short Endpoint:** `/documents/:documentId`
* **HTTP Method:** `DELETE`
* **Name / Action Description:** Soft-deletes / archives a document record. Residents can only delete their own flat's uploads; administrators can manage society-level documents.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **URL Parameter:**
  * `documentId` (UUID, required): Unique Document UUID.

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Document 'Registered Rent Agreement 2026' archived successfully.",
  "data": {
    "message": "Document 'Registered Rent Agreement 2026' archived successfully.",
    "documentId": "11aa22bb-33cc-44dd-55ee-66ff77889900"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `403 Forbidden` (Unauthorized Deletion)
```json
{
  "success": false,
  "message": "You can only archive or delete documents uploaded by your account."
}
```

* **HTTP Status:** `404 Not Found` (Document Not Found)
```json
{
  "success": false,
  "message": "Document not found in this society."
}
```

---

## 🚨 Module 11: Emergency SOS, Panic Alerts & Incident Management Engine

### 68. Trigger Panic SOS Alert
* **Short Endpoint:** `/emergency/sos`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an authenticated resident (or security guard) to trigger an immediate panic/SOS emergency alert from their unit. Generates a unique incident tracking reference code (e.g. `SOS-202610-0001`), marks severity (`CRITICAL` or `HIGH`), and returns an automated emergency dispatch payload containing the flat's exact wing/floor, resident contact numbers, family emergency numbers, and statutory helpline contacts.
* **Request Headers:**
  ```http
  Authorization: Bearer <resident_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "emergencyType": "MEDICAL_EMERGENCY",
  "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
  "severity": "CRITICAL",
  "notes": "Senior citizen collapsed on the floor. Immediate paramedic assistance required!"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Emergency SOS alert broadcasted successfully.",
  "data": {
    "incident": {
      "id": "99aa11bb-22cc-33dd-44ee-55ff66778899",
      "incidentNumber": "SOS-202610-0001",
      "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
      "unitId": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
      "reportedByUserId": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
      "emergencyType": "MEDICAL_EMERGENCY",
      "severity": "CRITICAL",
      "status": "TRIGGERED",
      "notes": "Senior citizen collapsed on the floor. Immediate paramedic assistance required!",
      "acknowledgedByUserId": null,
      "acknowledgedAt": null,
      "resolvedByUserId": null,
      "resolvedAt": null,
      "resolutionNotes": null,
      "responderActionTaken": null,
      "durationMinutes": null,
      "createdAt": "2026-10-23T14:00:00.000Z",
      "updatedAt": "2026-10-23T14:00:00.000Z",
      "unit": {
        "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
        "unitNumber": "102",
        "floorNumber": 1,
        "sectionWing": {
          "name": "Wing A"
        }
      },
      "reportedByUser": {
        "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
        "fullName": "Resident User",
        "phone": "+919820011222",
        "role": "RESIDENT"
      }
    },
    "dispatchDetails": {
      "wing": "Wing A",
      "floorNumber": 1,
      "unitNumber": "102",
      "residentName": "Resident User",
      "residentPhone": "+919820011222",
      "unitContacts": [
        {
          "name": "Resident User",
          "phone": "+919820011222",
          "type": "OWNER"
        },
        {
          "name": "Sita Sharma",
          "phone": "+919820011333",
          "type": "SPOUSE"
        }
      ],
      "societyHelplines": [
        {
          "id": "44aa55bb-66cc-77dd-88ee-99ff00aabbcc",
          "serviceName": "Apollo City Emergency Trauma Care",
          "category": "HOSPITAL",
          "phone": "108"
        }
      ]
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "emergencyType",
      "message": "Invalid enum value. Expected 'MEDICAL_EMERGENCY' | 'FIRE_HAZARD' | 'LIFT_ENTRAPMENT' | 'THEFT_SECURITY_BREACH' | 'GAS_LEAK' | 'OTHER'"
    }
  ]
}
```

* **HTTP Status:** `403 Forbidden` (Unauthorized Flat SOS Trigger)
```json
{
  "success": false,
  "message": "You can only trigger emergency SOS for your own approved unit."
}
```

---

### 69. Update Incident Status (Acknowledge / Responding / Resolve)
* **Short Endpoint:** `/emergency/incidents/:incidentId/status`
* **HTTP Method:** `PATCH`
* **Name / Action Description:** Used by security guards or society administrators to update the lifecycle of an active emergency alert. Transitioning to `ACKNOWLEDGED` or `RESPONDING` records the responder's identity and timestamp; transitioning to `RESOLVED` or `FALSE_ALARM` logs resolution notes, responder action taken, and calculates the total incident response duration in minutes.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  Content-Type: application/json
  ```
* **URL Parameter:**
  * `incidentId` (UUID, required): Unique Incident UUID.

#### Request Body Sample (Acknowledge & Respond):
```json
{
  "status": "RESPONDING",
  "responderActionTaken": "Guard team dispatched with oxygen cylinder and stretcher to flat 102."
}
```

#### Request Body Sample (Resolve Incident):
```json
{
  "status": "RESOLVED",
  "resolutionNotes": "Paramedic team arrived on-site. Patient vitals stabilized and transferred to hospital safely.",
  "responderActionTaken": "Ambulance gate clearance provided in 2 minutes."
}
```

#### Success Response Sample (Acknowledge / Responding):
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Emergency incident transitioned to RESPONDING.",
  "data": {
    "id": "99aa11bb-22cc-33dd-44ee-55ff66778899",
    "incidentNumber": "SOS-202610-0001",
    "status": "RESPONDING",
    "responderActionTaken": "Guard team dispatched with oxygen cylinder and stretcher to flat 102.",
    "acknowledgedAt": "2026-10-23T14:01:00.000Z",
    "acknowledgedByUser": {
      "id": "55bb66cc-77dd-88ee-99ff-00aabbccddee",
      "fullName": "Security Guard Ram Singh",
      "role": "GUARD"
    }
  }
}
```

#### Success Response Sample (Resolve Incident):
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Emergency incident marked as RESOLVED.",
  "data": {
    "id": "99aa11bb-22cc-33dd-44ee-55ff66778899",
    "incidentNumber": "SOS-202610-0001",
    "status": "RESOLVED",
    "durationMinutes": 4,
    "resolutionNotes": "Paramedic team arrived on-site. Patient vitals stabilized and transferred to hospital safely.",
    "responderActionTaken": "Ambulance gate clearance provided in 2 minutes.",
    "resolvedAt": "2026-10-23T14:04:00.000Z",
    "resolvedByUser": {
      "id": "55bb66cc-77dd-88ee-99ff-00aabbccddee",
      "fullName": "Security Guard Ram Singh",
      "role": "GUARD"
    }
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `404 Not Found` (Incident Not Found)
```json
{
  "success": false,
  "message": "Emergency incident not found in this society."
}
```

---

### 70. Real-time Active Emergencies Monitor
* **Short Endpoint:** `/emergency/active`
* **HTTP Method:** `GET`
* **Name / Action Description:** Real-time monitor view for security guards and administrators showing all currently active/unresolved incidents (`TRIGGERED`, `ACKNOWLEDGED`, `RESPONDING`) sorted by urgency and severity.
* **Request Headers:**
  ```http
  Authorization: Bearer <guard_or_admin_token>
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Active emergency incidents retrieved successfully.",
  "data": {
    "totalActive": 1,
    "incidents": [
      {
        "id": "99aa11bb-22cc-33dd-44ee-55ff66778899",
        "incidentNumber": "SOS-202610-0001",
        "emergencyType": "MEDICAL_EMERGENCY",
        "severity": "CRITICAL",
        "status": "RESPONDING",
        "notes": "Senior citizen collapsed on the floor. Immediate paramedic assistance required!",
        "createdAt": "2026-10-23T14:00:00.000Z",
        "unit": {
          "id": "10c3b82e-9c03-475a-b0a3-fd67e28b4243",
          "unitNumber": "102",
          "floorNumber": 1,
          "sectionWing": {
            "name": "Wing A"
          }
        },
        "reportedByUser": {
          "id": "76eb0a45-b44c-42cb-b166-5e5c7ef7815d",
          "fullName": "Resident User",
          "phone": "+919820011222",
          "role": "RESIDENT"
        },
        "acknowledgedByUser": {
          "id": "55bb66cc-77dd-88ee-99ff-00aabbccddee",
          "fullName": "Security Guard Ram Singh",
          "role": "GUARD"
        }
      }
    ]
  }
}
```

---

### 71. Emergency Incident History & Post-Mortem Audit Reports
* **Short Endpoint:** `/emergency/history`
* **HTTP Method:** `GET`
* **Name / Action Description:** Filtered, paginated historical audit logs of past emergency incidents including timestamps, total response durations in minutes, responder actions, and resolution notes.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  ```
* **Query Parameters:**
  * `status` (optional enum: `TRIGGERED`, `ACKNOWLEDGED`, `RESPONDING`, `RESOLVED`, `FALSE_ALARM`)
  * `emergencyType` (optional enum: `MEDICAL_EMERGENCY`, `FIRE_HAZARD`, `LIFT_ENTRAPMENT`, `THEFT_SECURITY_BREACH`, `GAS_LEAK`, `OTHER`)
  * `unitId` (optional UUID)
  * `startDate` (optional ISO date string)
  * `endDate` (optional ISO date string)
  * `page` (optional number, default: 1)
  * `limit` (optional number, default: 20)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Emergency incident history retrieved successfully.",
  "data": {
    "incidents": [
      {
        "id": "99aa11bb-22cc-33dd-44ee-55ff66778899",
        "incidentNumber": "SOS-202610-0001",
        "emergencyType": "MEDICAL_EMERGENCY",
        "severity": "CRITICAL",
        "status": "RESOLVED",
        "durationMinutes": 4,
        "notes": "Senior citizen collapsed on the floor. Immediate paramedic assistance required!",
        "resolutionNotes": "Paramedic team arrived on-site. Patient vitals stabilized and transferred to hospital safely.",
        "responderActionTaken": "Ambulance gate clearance provided in 2 minutes.",
        "createdAt": "2026-10-23T14:00:00.000Z",
        "resolvedAt": "2026-10-23T14:04:00.000Z",
        "unit": {
          "unitNumber": "102",
          "floorNumber": 1,
          "sectionWing": {
            "name": "Wing A"
          }
        },
        "reportedByUser": {
          "fullName": "Resident User",
          "phone": "+919820011222",
          "role": "RESIDENT"
        },
        "resolvedByUser": {
          "fullName": "Security Guard Ram Singh",
          "role": "GUARD"
        }
      }
    ],
    "pagination": {
      "totalRecords": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 72. Add Statutory Emergency Helpline to Directory
* **Short Endpoint:** `/emergency/contacts`
* **HTTP Method:** `POST`
* **Name / Action Description:** Allows an administrator (`SUPER_ADMIN`, `SUB_ADMIN`) to register local emergency numbers, ambulance services, police stations, fire stations, lift maintenance hotlines, and security chiefs in the society directory.
* **Request Headers:**
  ```http
  Authorization: Bearer <admin_token>
  Content-Type: application/json
  ```

#### Request Body Sample:
```json
{
  "serviceName": "Apollo City Emergency Trauma Care",
  "category": "HOSPITAL",
  "phone": "108",
  "alternatePhone": "+919820011222",
  "address": "Plot 45, SG Highway, Ahmedabad",
  "contactPerson": "Dr. A. Mehta (Chief ER Officer)"
}
```

#### Success Response Sample:
* **HTTP Status:** `201 Created`
```json
{
  "success": true,
  "message": "Emergency contact added to directory successfully.",
  "data": {
    "id": "44aa55bb-66cc-77dd-88ee-99ff00aabbcc",
    "societyId": "b3a8ebf3-82ae-409d-a65c-bafdfa7568a2",
    "serviceName": "Apollo City Emergency Trauma Care",
    "category": "HOSPITAL",
    "phone": "108",
    "alternatePhone": "+919820011222",
    "address": "Plot 45, SG Highway, Ahmedabad",
    "contactPerson": "Dr. A. Mehta (Chief ER Officer)",
    "isActive": true,
    "createdAt": "2026-10-23T14:10:00.000Z",
    "updatedAt": "2026-10-23T14:10:00.000Z"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "message": "Validation Error",
  "error": [
    {
      "field": "category",
      "message": "Invalid enum value. Expected 'HOSPITAL' | 'AMBULANCE' | 'POLICE' | 'FIRE_STATION' | 'LIFT_AGENCY' | 'SECURITY_CHIEF' | 'OTHER'"
    }
  ]
}
```

---

### 73. View Society Emergency Directory
* **Short Endpoint:** `/emergency/contacts`
* **HTTP Method:** `GET`
* **Name / Action Description:** Retrieves the society emergency directory and quick-dial helpline numbers for residents and guards, optionally filtered by category.
* **Request Headers:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Query Parameters:**
  * `category` (optional enum: `HOSPITAL`, `AMBULANCE`, `POLICE`, `FIRE_STATION`, `LIFT_AGENCY`, `SECURITY_CHIEF`, `OTHER`)

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "Emergency directory retrieved successfully.",
  "data": {
    "totalContacts": 1,
    "contacts": [
      {
        "id": "44aa55bb-66cc-77dd-88ee-99ff00aabbcc",
        "serviceName": "Apollo City Emergency Trauma Care",
        "category": "HOSPITAL",
        "phone": "108",
        "alternatePhone": "+919820011222",
        "address": "Plot 45, SG Highway, Ahmedabad",
        "contactPerson": "Dr. A. Mehta (Chief ER Officer)",
        "isActive": true
      }
    ]
  }
}
```

---

## 🩺 System Health & Production Diagnostics

### 74. System Health & Infrastructure Audit
* **Short Endpoint:** `/health`
* **HTTP Method:** `GET`
* **Name / Action Description:** Performs a live diagnostic audit of the backend system. Validates active PostgreSQL database connectivity via Prisma ORM, measures database query round-trip latency, and captures Node.js process uptime and memory telemetry (RSS, heap total, heap used, external memory).
* **Request Headers:**
  ```http
  Content-Type: application/json
  ```

#### Success Response Sample:
* **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "message": "System health check passed successfully.",
  "data": {
    "status": "HEALTHY",
    "version": "1.0.0",
    "uptimeSeconds": 1420,
    "timestamp": "2026-10-23T14:00:00.000Z",
    "database": {
      "status": "CONNECTED",
      "latencyMs": 14,
      "client": "PostgreSQL (Prisma ORM)"
    },
    "memory": {
      "rssMb": 98.45,
      "heapTotalMb": 54.12,
      "heapUsedMb": 24.38,
      "externalMb": 5.82
    },
    "environment": "production"
  }
}
```

#### Error Response Samples:

* **HTTP Status:** `503 Service Unavailable` (Database Disconnected)
```json
{
  "success": false,
  "message": "System health check detected degraded database connectivity.",
  "data": {
    "status": "DEGRADED",
    "version": "1.0.0",
    "uptimeSeconds": 1420,
    "timestamp": "2026-10-23T14:00:00.000Z",
    "database": {
      "status": "DISCONNECTED",
      "latencyMs": 0,
      "client": "PostgreSQL (Prisma ORM)"
    },
    "memory": {
      "rssMb": 98.45,
      "heapTotalMb": 54.12,
      "heapUsedMb": 24.38,
      "externalMb": 5.82
    },
    "environment": "production"
  }
}
```






