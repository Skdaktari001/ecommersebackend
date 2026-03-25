import mongoose from 'mongoose';

const connectDB = async () => {
    mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connected successfully');
    });

    // Use the DB name ONLY from .env
    await mongoose.connect(process.env.MONGODB_URI);
};

export default connectDB;
