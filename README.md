# Health Check API Documentation



## Overview
This repository contains a Node.js/Express application that implements a health check endpoint. The health check endpoint monitors the application's database connectivity and downstream API calls.


## Prerequisites
- Node.js (v14 or higher)
- MySQL Server
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Manikhandan-CSYE6225/webapp.git
```

2. Install dependencies:
```bash
npm install
```

3. Set up your database configuration in `config/config.json`:
```json
{
  "development": {
    "username": "your_username",
    "password": "your_password",
    "database": "your_database",
    "host": "127.0.0.1",
    "dialect": "mysql"
  }
}
```

4. Start the application:
```bash
npm index.js
```

5. Endpoint:
```
    http://localhost:3001/healthz
```

6. To run the application on a droplet - digitalocean
```
    create droplet
    file transfer the scripts/main.sh and webapp.zip file to droplet /tmp directory
    
    cd /tmp
    chmod +x main.sh
    sed -i 's/\r$//' main.sh (if vm is not able to locate the script file)
    ./main.sh
    
```

## API Specification

### Health Check Endpoint

#### GET /healthz

Checks the health status of the application and its database connection.

**Request**
- Method: GET
- URL: `/healthz`
- No parameters allowed
- No request body allowed

**Response Headers**
- `Cache-Control: no-cache, no-store, must-revalidate`
- `Pragma: no-cache`
- `X-Content-Type-Options: nosniff`

**Response Codes**
- `200 OK`: Application is healthy and database is connected
- `400 Bad Request`: Request contains query parameters, URL parameters, or body content
- `405 Method Not Allowed`: Request method is not GET
- `503 Service Unavailable`: Database connection failed or database operation error

