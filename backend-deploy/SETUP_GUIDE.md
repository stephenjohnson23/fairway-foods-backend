# Fairway Foods Backend - Deployment Guide

## Part 1: MongoDB Atlas Setup (Free Database)

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with email or Google account
3. Choose the FREE tier (M0 Sandbox)

### Step 2: Create a Cluster
1. Click "Build a Database"
2. Select "FREE" tier (M0)
3. Choose cloud provider: AWS
4. Choose region: closest to South Africa (eu-west-1 or similar)
5. Cluster name: fairway-foods
6. Click "Create"

### Step 3: Create Database User
1. Go to "Database Access" in left menu
2. Click "Add New Database User"
3. Username: fairwayfoods
4. Password: (create a strong password - SAVE THIS!)
5. Database User Privileges: "Read and write to any database"
6. Click "Add User"

### Step 4: Allow Network Access
1. Go to "Network Access" in left menu
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for Render.com)
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Database" in left menu
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Driver: Python, Version: 3.12 or later
5. Copy the connection string - it looks like:
   `mongodb+srv://fairwayfoods:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Replace `<password>` with your actual password
7. SAVE THIS CONNECTION STRING!

---

## Part 2: Render.com Deployment

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up (you can use GitHub)

### Step 2: Create New Web Service
1. Click "New" → "Web Service"
2. Choose "Build and deploy from a Git repository"
3. Connect your GitHub account OR
4. Choose "Public Git repository" and paste your repo URL

### Alternative: Deploy without Git
1. Click "New" → "Web Service"  
2. Choose "Deploy an existing image from a registry" → Skip this
3. Or manually upload via Render dashboard

### Step 3: Configure the Service
- Name: fairway-foods-api
- Environment: Python 3
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Instance Type: Free

### Step 4: Add Environment Variables
Go to "Environment" tab and add:

| Key | Value |
|-----|-------|
| MONGO_URL | mongodb+srv://fairwayfoods:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority |
| DB_NAME | fairway_foods |
| JWT_SECRET_KEY | (generate a random string - use: openssl rand -hex 32) |
| RESEND_API_KEY | (your Resend API key) |
| FROM_EMAIL | noreply@fairwayfoods.co.za |
| ADMIN_EMAIL | stephen.johnson23@gmail.com |

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Your API will be live at: `https://fairway-foods-api.onrender.com`

---

## Part 3: Update Your Web App

After deployment, you need to update the web app to use your new API URL.

1. Download the web app ZIP again (I'll create an updated version)
2. Or manually edit the JavaScript files to change the API URL

---

## Part 4: Seed Initial Data

After deployment, you may need to add initial data:

1. Go to your Render dashboard
2. Open the Shell for your service
3. Run: `python seed_data.py`

Or use the API directly to create the first super user.

---

## Test Credentials (after seeding)
- Super User: super@golf.com / super123
- Admin: admin@golf.com / admin123
- Kitchen: kitchen@golf.com / kitchen123
- Cashier: cashier@golf.com / cashier123

---

## Troubleshooting

### "Connection refused" error
- Check MONGO_URL is correct
- Ensure MongoDB Atlas allows access from anywhere

### "Authentication failed"
- Verify MongoDB password is correct
- Check username in connection string

### App not loading
- Check Render logs for errors
- Verify all environment variables are set

---

## Support
If you need help, contact Emergent support or check the Render.com documentation.
