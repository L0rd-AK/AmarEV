import mongoose from 'mongoose';
import { Vehicle } from '../models/Vehicle';
import { config } from 'dotenv';

config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/amar_ev';

async function createMissingVehicle() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // The vehicle ID from the reservation
    const vehicleId = '507f1f77bcf86cd799439011';
    
    // Check if vehicle already exists
    const existingVehicle = await Vehicle.findById(vehicleId);
    
    if (existingVehicle) {
      console.log('Vehicle already exists:', existingVehicle);
      return;
    }

    // Get the userId from the reservation
    const Reservation = mongoose.model('Reservation');
    const reservation = await Reservation.findOne({ vehicleId });
    
    if (!reservation) {
      console.log('No reservation found with this vehicleId');
      return;
    }

    console.log('Found reservation with userId:', reservation.userId);

    // Create the vehicle with the specific _id
    const vehicle = new Vehicle({
      _id: new mongoose.Types.ObjectId(vehicleId),
      userId: reservation.userId,
      make: 'Tesla',
      model: 'Model 3',
      year: 2023,
      licensePlate: 'DHK-1234',
      connectorType: ['Type2', 'CCS2'],
      usableKWh: 60,
      maxACkW: 11,
      maxDCkW: 150,
      isDefault: true,
    });

    await vehicle.save();
    console.log('Vehicle created successfully:', vehicle);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createMissingVehicle();
