// Mongo initialization script for Docker
print("Initializing MongoDB...");

// Create application database
db = db.getSiblingDB('chargebd');

// Create application user
db.createUser({
  user: "chargebd_user",
  pwd: "chargebd_password",
  roles: [
    {
      role: "readWrite",
      db: "chargebd"
    }
  ]
});

// Create collections with validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "passwordHash", "role"],
      properties: {
        email: { bsonType: "string" },
        passwordHash: { bsonType: "string" },
        role: { 
          bsonType: "string",
          enum: ["user", "operator", "admin"]
        }
      }
    }
  }
});

db.createCollection("stations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "location", "operatorId"],
      properties: {
        name: { bsonType: "string" },
        location: {
          bsonType: "object",
          required: ["type", "coordinates"],
          properties: {
            type: { enum: ["Point"] },
            coordinates: {
              bsonType: "array",
              minItems: 2,
              maxItems: 2
            }
          }
        }
      }
    }
  }
});

// Create indexes
print("Creating indexes...");

// User indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "phone": 1 }, { sparse: true });
db.users.createIndex({ "role": 1 });

// Station indexes
db.stations.createIndex({ "location": "2dsphere" });
db.stations.createIndex({ "operatorId": 1 });
db.stations.createIndex({ "isActive": 1, "isPublic": 1 });
db.stations.createIndex({ "name": "text", "address.area": "text", "address.city": "text" });

// Connector indexes
db.connectors.createIndex({ "stationId": 1 });
db.connectors.createIndex({ "stationId": 1, "status": 1 });
db.connectors.createIndex({ "type": 1, "standard": 1 });

// Reservation indexes
db.reservations.createIndex({ "userId": 1, "status": 1 });
db.reservations.createIndex({ "stationId": 1, "connectorId": 1, "startTime": 1 });
db.reservations.createIndex({ "connectorId": 1, "startTime": 1, "endTime": 1, "status": 1 });

// Session indexes
db.sessions.createIndex({ "userId": 1, "status": 1 });
db.sessions.createIndex({ "stationId": 1, "startTime": -1 });
db.sessions.createIndex({ "connectorId": 1, "startTime": -1 });

// Payment indexes
db.payments.createIndex({ "userId": 1, "status": 1 });
db.payments.createIndex({ "transactionId": 1 }, { unique: true });
db.payments.createIndex({ "idempotencyKey": 1 }, { unique: true });

// Review indexes
db.reviews.createIndex({ "stationId": 1, "rating": -1 });
db.reviews.createIndex({ "userId": 1, "stationId": 1 }, { unique: true });

print("MongoDB initialization completed!");