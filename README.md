# Airbnb Clone - Backend & REST API

This is the backend service for the Airbnb Clone, built with **Express.js**, **MongoDB**, **Mongoose**, **Multer**, and **Express-Session**.

## Features

- **Full REST API** under `/api` for:
  - Authentication (Register, Login, Logout, Current User session)
  - Home listings (Get all with query filters, Get by ID, Download house rules)
  - Bookings & Reservations (Get user bookings, Create reservation, Cancel booking)
  - Favourites (Get favourites, Add favourite, Remove favourite)
  - Host Management (View host homes, Add home with photos & rules, Edit, Delete)
  - User Profile (View profile, Edit profile details & upload avatar)
- **CORS enabled** to allow decoupled frontend applications (React, Vue, mobile apps, or SSR server).
- **Dual Support**: Supports both session cookies and API headers (`x-user-id`).
- **Backward Compatibility**: Fully retains original web controllers and routes without breaking any functionality.

---

## Environment Variables (`.env`)

```env
PORT=5000
DB_PATH="mongodb+srv://<username>:<password>@cluster.mongodb.net/airbnb?retryWrites=true&w=majority"
SESSION_SECRET="your-secret-key"
```

---

## Local Setup

```bash
cd backend
npm install
npm run dev     # Starts with nodemon on port 5000
# or
npm start       # Starts with node on port 5000
```

---

## REST API Documentation

### 1. API Health / Index
- **`GET /api`**: Overview of all available endpoints.

### 2. Authentication (`/api/auth`)
- **`POST /api/auth/signup`**: Register a new user (`firstName`, `lastName`, `email`, `password`, `confirmPassword`, `userType`, `terms`).
- **`POST /api/auth/login`**: Sign in (`email`, `password`).
- **`POST /api/auth/logout`**: Sign out / destroy session.
- **`GET /api/auth/me`**: Get currently authenticated user.

### 3. Homes (`/api/homes`)
- **`GET /api/homes`**: Get all homes (supports `?search=`, `?location=`, `?minPrice=`, `?maxPrice=`).
- **`GET /api/homes/:homeId`**: Get home details by ID.
- **`GET /api/homes/:homeId/rules`**: Download house rules PDF.

### 4. Bookings (`/api/bookings`)
- **`GET /api/bookings`**: Get bookings for current user.
- **`POST /api/bookings/reserve/:homeId`**: Create a new reservation.
- **`DELETE /api/bookings/:bookingId`**: Cancel booking.

### 5. Favourites (`/api/favourites`)
- **`GET /api/favourites`**: Get user's favourite homes.
- **`POST /api/favourites/:homeId`**: Add a home to favourites.
- **`DELETE /api/favourites/:homeId`**: Remove a home from favourites.

### 6. Host Listings (`/api/host`)
- **`GET /api/host/homes`**: Get listings belonging to the authenticated host.
- **`POST /api/host/homes`**: Create a new home listing (multipart/form-data: `photo`, `rules`, `houseName`, `price`, `location`, `rating`, `description`).
- **`GET /api/host/homes/:homeId`**: Get specific host listing.
- **`PUT /api/host/homes/:homeId`**: Update listing.
- **`DELETE /api/host/homes/:homeId`**: Delete listing.

### 7. User Profile (`/api/profile`)
- **`GET /api/profile`**: Get user profile details.
- **`PUT /api/profile`**: Update profile details and optional avatar `profilePic`.
