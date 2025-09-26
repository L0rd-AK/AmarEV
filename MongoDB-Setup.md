# MongoDB Setup Guide

This guide helps you set up MongoDB for the AmarEV project.

## Option 1: MongoDB Atlas (Cloud) - Currently Having Issues

The project is configured to use MongoDB Atlas, but there might be connection issues due to:
- Network connectivity problems
- IP address not whitelisted
- Expired credentials
- Atlas cluster maintenance

## Option 2: Local MongoDB (Recommended for Development)

### Install MongoDB Locally

#### Windows:
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Run the installer and follow the setup wizard
3. Install MongoDB as a Windows Service
4. MongoDB will start automatically

#### Using Docker (Recommended):
```bash
# Pull MongoDB image
docker pull mongo:latest

# Run MongoDB container
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:latest

# Verify MongoDB is running
docker ps
```

#### Using MongoDB Atlas (Alternative):
If you want to continue using Atlas:
1. Check your network connection
2. Whitelist your current IP address in Atlas dashboard
3. Verify credentials are correct
4. Check if the cluster is active

### Update Environment Variables

Current configuration in `.env`:
```bash
# For local MongoDB
MONGO_URI=mongodb://localhost:27017/amar_ev

# For Atlas (if connection issues are resolved)
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/amar_ev
```

### Verify Connection

After starting MongoDB locally, the server should connect successfully without timeout errors.

### MongoDB GUI Tools (Optional)

Install a MongoDB GUI for easier database management:
- **MongoDB Compass**: Official GUI tool
- **Studio 3T**: Feature-rich MongoDB GUI
- **Robo 3T**: Lightweight MongoDB GUI

## Troubleshooting

### Connection Timeout Issues:
- Ensure MongoDB service is running
- Check firewall settings
- Verify the connection string format
- For Atlas: Check IP whitelist and credentials

### Permission Issues:
- Ensure MongoDB has proper read/write permissions
- Check user authentication if enabled

### Port Conflicts:
- Default MongoDB port is 27017
- Make sure no other services are using this port
- Use `netstat -an | findstr 27017` to check port usage

## Database Initialization

The application will automatically create the database and collections when it starts. You don't need to manually create them.

### Sample Data (Optional)

If you want to add sample data, you can use the MongoDB shell or a GUI tool to import test data.

## Production Considerations

For production deployment:
1. Use MongoDB Atlas or a properly configured MongoDB cluster
2. Enable authentication and SSL
3. Configure proper backup strategies
4. Monitor database performance
5. Set up replica sets for high availability