import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user',
        required: true 
    },
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'product',
        required: true 
    },
    orderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'order',
        required: true 
    },
    rating: { 
        type: Number, 
        required: true,
        min: 1,
        max: 5 
    },
    title: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100 
    },
    description: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 1000 
    },
    images: { 
        type: [String], 
        default: [] 
    },
    verifiedPurchase: { 
        type: Boolean, 
        default: true 
    },
    helpfulVotes: { 
        type: Number, 
        default: 0 
    },
    reports: { 
        type: [{
            userId: mongoose.Schema.Types.ObjectId,
            reason: String,
            date: { type: Date, default: Date.now }
        }], 
        default: [] 
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'spam'],
        default: 'pending' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Update the updatedAt timestamp on save
reviewSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Compound index to ensure one review per product per user per order
reviewSchema.index({ userId: 1, productId: 1, orderId: 1 }, { unique: true });

const reviewModel = mongoose.models.review || mongoose.model("review", reviewSchema);

export default reviewModel;