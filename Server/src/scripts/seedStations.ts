import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Station } from '../models/Station';
import { Connector } from '../models/Connector';
import { User } from '../models/User';
import { ConnectorType, ConnectorStandard, ConnectorStatus } from '@chargebd/shared';

dotenv.config();

const demoStations = [
  {
    name: 'Dhaka City Center Charging Hub',
    address: {
      street: '12 Gulshan Avenue',
      area: 'Gulshan',
      city: 'Dhaka',
      division: 'Dhaka',
      postalCode: '1212',
    },
    location: {
      type: 'Point' as const,
      coordinates: [90.4125, 23.7806], // [longitude, latitude]
    },
    amenities: ['WiFi', 'Cafe', 'Restrooms', 'Waiting Area', '24/7 Access', 'Security'],
    photos: [
      'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '00:00', close: '23:59' },
      tuesday: { open: '00:00', close: '23:59' },
      wednesday: { open: '00:00', close: '23:59' },
      thursday: { open: '00:00', close: '23:59' },
      friday: { open: '00:00', close: '23:59' },
      saturday: { open: '00:00', close: '23:59' },
      sunday: { open: '00:00', close: '23:59' },
    },
    connectors: [
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 22, pricePerKWhBDT: 18, pricePerMinuteBDT: 2, sessionFeeBDT: 50, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 22, pricePerKWhBDT: 18, pricePerMinuteBDT: 2, sessionFeeBDT: 50, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CCS2, maxKw: 150, pricePerKWhBDT: 35, pricePerMinuteBDT: 5, sessionFeeBDT: 100, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CHADEMO, maxKw: 100, pricePerKWhBDT: 32, pricePerMinuteBDT: 4, sessionFeeBDT: 100, status: ConnectorStatus.OCCUPIED },
    ],
  },
  {
    name: 'Banani Premium Charging Station',
    address: {
      street: 'Road 27, Block A',
      area: 'Banani',
      city: 'Dhaka',
      division: 'Dhaka',
      postalCode: '1213',
    },
    location: {
      type: 'Point' as const,
      coordinates: [90.4036, 23.7937],
    },
    amenities: ['WiFi', 'Restaurant', 'Shopping', 'Wheelchair Accessible', 'EV Lounge', 'Air Conditioning'],
    photos: [
      'https://images.unsplash.com/photo-1595524534304-86ff7f8ac5e8?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '06:00', close: '22:00' },
      tuesday: { open: '06:00', close: '22:00' },
      wednesday: { open: '06:00', close: '22:00' },
      thursday: { open: '06:00', close: '22:00' },
      friday: { open: '06:00', close: '22:00' },
      saturday: { open: '08:00', close: '22:00' },
      sunday: { open: '08:00', close: '22:00' },
    },
    connectors: [
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 7, pricePerKWhBDT: 15, pricePerMinuteBDT: 1.5, sessionFeeBDT: 30, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CCS2, maxKw: 50, pricePerKWhBDT: 28, pricePerMinuteBDT: 3, sessionFeeBDT: 80, status: ConnectorStatus.AVAILABLE },
    ],
  },
  {
    name: 'Uttara Expressway Charging Point',
    address: {
      street: 'Dhaka-Mymensingh Highway',
      area: 'Uttara',
      city: 'Dhaka',
      division: 'Dhaka',
      postalCode: '1230',
    },
    location: {
      type: 'Point' as const,
      coordinates: [90.3977, 23.8753],
    },
    amenities: ['Restrooms', 'Vending Machine', 'Parking', '24/7 Access'],
    photos: [
      'https://images.unsplash.com/photo-1571609177926-dbe0592b2696?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '00:00', close: '23:59' },
      tuesday: { open: '00:00', close: '23:59' },
      wednesday: { open: '00:00', close: '23:59' },
      thursday: { open: '00:00', close: '23:59' },
      friday: { open: '00:00', close: '23:59' },
      saturday: { open: '00:00', close: '23:59' },
      sunday: { open: '00:00', close: '23:59' },
    },
    connectors: [
      { type: ConnectorType.DC, standard: ConnectorStandard.CCS2, maxKw: 180, pricePerKWhBDT: 40, pricePerMinuteBDT: 6, sessionFeeBDT: 120, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CHADEMO, maxKw: 150, pricePerKWhBDT: 38, pricePerMinuteBDT: 5, sessionFeeBDT: 100, status: ConnectorStatus.AVAILABLE },
    ],
  },
  {
    name: 'Dhanmondi Lake View Charging',
    address: {
      street: 'Road 8/A',
      area: 'Dhanmondi',
      city: 'Dhaka',
      division: 'Dhaka',
      postalCode: '1209',
    },
    location: {
      type: 'Point' as const,
      coordinates: [90.3753, 23.7461],
    },
    amenities: ['WiFi', 'Cafe', 'Waiting Area', 'Security'],
    photos: [
      'https://images.unsplash.com/photo-1593941707445-9c2e9a4e0c60?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '07:00', close: '21:00' },
      tuesday: { open: '07:00', close: '21:00' },
      wednesday: { open: '07:00', close: '21:00' },
      thursday: { open: '07:00', close: '21:00' },
      friday: { open: '07:00', close: '21:00' },
      saturday: { open: '09:00', close: '21:00' },
      sunday: { open: '09:00', close: '21:00' },
    },
    connectors: [
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 11, pricePerKWhBDT: 16, pricePerMinuteBDT: 1.8, sessionFeeBDT: 40, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 11, pricePerKWhBDT: 16, pricePerMinuteBDT: 1.8, sessionFeeBDT: 40, status: ConnectorStatus.MAINTENANCE },
    ],
  },
  {
    name: 'Motijheel Business District Charging',
    address: {
      street: 'Dilkusha Commercial Area',
      area: 'Motijheel',
      city: 'Dhaka',
      division: 'Dhaka',
      postalCode: '1000',
    },
    location: {
      type: 'Point' as const,
      coordinates: [90.4175, 23.7330],
    },
    amenities: ['WiFi', 'Restaurant', 'ATM', 'Security', 'Waiting Area'],
    photos: [
      'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '08:00', close: '20:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { open: '08:00', close: '20:00' },
      thursday: { open: '08:00', close: '20:00' },
      friday: { open: '10:00', close: '18:00' },
      saturday: { open: '08:00', close: '20:00' },
      sunday: { open: '08:00', close: '20:00' },
    },
    connectors: [
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 22, pricePerKWhBDT: 20, pricePerMinuteBDT: 2.5, sessionFeeBDT: 60, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CCS2, maxKw: 100, pricePerKWhBDT: 33, pricePerMinuteBDT: 4.5, sessionFeeBDT: 90, status: ConnectorStatus.AVAILABLE },
    ],
  },
  {
    name: 'Chattogram Port City Charging Hub',
    address: {
      street: 'Agrabad Access Road',
      area: 'Agrabad',
      city: 'Chattogram',
      division: 'Chattogram',
      postalCode: '4100',
    },
    location: {
      type: 'Point' as const,
      coordinates: [91.8123, 22.3569],
    },
    amenities: ['WiFi', 'Cafe', 'Restrooms', 'Parking', 'Security'],
    photos: [
      'https://images.unsplash.com/photo-1617704548623-340376564e68?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '06:00', close: '22:00' },
      tuesday: { open: '06:00', close: '22:00' },
      wednesday: { open: '06:00', close: '22:00' },
      thursday: { open: '06:00', close: '22:00' },
      friday: { open: '06:00', close: '22:00' },
      saturday: { open: '06:00', close: '22:00' },
      sunday: { open: '06:00', close: '22:00' },
    },
    connectors: [
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 22, pricePerKWhBDT: 17, pricePerMinuteBDT: 2, sessionFeeBDT: 45, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CCS2, maxKw: 120, pricePerKWhBDT: 34, pricePerMinuteBDT: 4.8, sessionFeeBDT: 95, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CHADEMO, maxKw: 100, pricePerKWhBDT: 32, pricePerMinuteBDT: 4.2, sessionFeeBDT: 90, status: ConnectorStatus.OFFLINE },
    ],
  },
  {
    name: 'Sylhet Tea Garden Charging Station',
    address: {
      street: 'Zindabazar Main Road',
      area: 'Zindabazar',
      city: 'Sylhet',
      division: 'Sylhet',
      postalCode: '3100',
    },
    location: {
      type: 'Point' as const,
      coordinates: [91.8697, 24.8949],
    },
    amenities: ['WiFi', 'Cafe', 'Restrooms', 'Wheelchair Accessible', 'Air Conditioning'],
    photos: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '07:00', close: '21:00' },
      tuesday: { open: '07:00', close: '21:00' },
      wednesday: { open: '07:00', close: '21:00' },
      thursday: { open: '07:00', close: '21:00' },
      friday: { open: '07:00', close: '21:00' },
      saturday: { open: '07:00', close: '21:00' },
      sunday: { open: '07:00', close: '21:00' },
    },
    connectors: [
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 7, pricePerKWhBDT: 14, pricePerMinuteBDT: 1.5, sessionFeeBDT: 35, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CCS2, maxKw: 50, pricePerKWhBDT: 26, pricePerMinuteBDT: 3.2, sessionFeeBDT: 75, status: ConnectorStatus.AVAILABLE },
    ],
  },
  {
    name: 'Rajshahi University Area Charging',
    address: {
      street: 'University Campus Road',
      area: 'Motihar',
      city: 'Rajshahi',
      division: 'Rajshahi',
      postalCode: '6205',
    },
    location: {
      type: 'Point' as const,
      coordinates: [88.6295, 24.3745],
    },
    amenities: ['WiFi', 'Cafe', 'Restrooms', 'Waiting Area', 'Vending Machine'],
    photos: [
      'https://images.unsplash.com/photo-1571609177926-dbe0592b2696?w=800',
    ],
    timezone: 'Asia/Dhaka',
    isPublic: true,
    isActive: true,
    openingHours: {
      monday: { open: '08:00', close: '20:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { open: '08:00', close: '20:00' },
      thursday: { open: '08:00', close: '20:00' },
      friday: { open: '10:00', close: '18:00' },
      saturday: { open: '08:00', close: '20:00' },
      sunday: { open: '08:00', close: '20:00' },
    },
    connectors: [
      { type: ConnectorType.AC, standard: ConnectorStandard.TYPE2, maxKw: 11, pricePerKWhBDT: 15, pricePerMinuteBDT: 1.6, sessionFeeBDT: 38, status: ConnectorStatus.AVAILABLE },
      { type: ConnectorType.DC, standard: ConnectorStandard.CCS2, maxKw: 75, pricePerKWhBDT: 30, pricePerMinuteBDT: 3.8, sessionFeeBDT: 85, status: ConnectorStatus.AVAILABLE },
    ],
  },
];

async function seedStations() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chargebd';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find or create a demo operator user
    let operator = await User.findOne({ email: 'operator@amarev.com' });
    
    if (!operator) {
      console.log('Creating demo operator user...');
      operator = await User.create({
        email: 'operator@amarev.com',
        passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyJ3JwQQ9Kz2', // password123
        role: 'operator',
        status: 'active',
        displayName: 'Demo Operator',
        language: 'en',
        isEmailVerified: true,
        isPhoneVerified: false,
      });
      console.log('✅ Demo operator created (email: operator@amarev.com, password: password123)');
    }

    // Clear existing stations and connectors
    await Station.deleteMany({});
    await Connector.deleteMany({});
    console.log('🗑️  Cleared existing stations and connectors');

    // Create demo stations
    for (const stationData of demoStations) {
      const { connectors, ...stationInfo } = stationData;
      
      const station = await Station.create({
        ...stationInfo,
        operatorId: operator._id,
      });

      console.log(`✅ Created station: ${station.name}`);

      // Create connectors for this station
      for (const connectorData of connectors) {
        await Connector.create({
          ...connectorData,
          stationId: station._id,
        });
      }

      console.log(`   ✅ Created ${connectors.length} connector(s)`);
    }

    console.log('\n🎉 Successfully seeded database with demo stations!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Total stations: ${demoStations.length}`);
    console.log(`   - Total connectors: ${demoStations.reduce((sum, s) => sum + s.connectors.length, 0)}`);
    console.log(`   - Operator email: operator@amarev.com`);
    console.log(`   - Operator password: password123`);
    console.log('\n🚀 You can now browse stations at /stations');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

seedStations();
