const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email'
    ],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscription: {
    type: String,
    enum: ['free', 'beta', 'single', 'single_promo', 'bundle10', 'bundle10_promo', 'bundle20', 'bundle20_promo', 'additional', 'custom'],
    default: 'free'
  },
  booksRemaining: {
    type: Number,
    default: 1, // Default for free plan is 1 book
  },
  booksAllowed: {
    type: Number,
    default: 1, // Default for free plan is 1 book
  },
  imagesUsed: {
    type: Number,
    default: 0, // Number of images currently uploaded
  },
  imagesAllowed: {
    type: Number,
    default: 2, // Default for free plan (2 images for testing)
  },
  additionalImageSlots: {
    type: Number,
    default: 0, // Additional image slots purchased beyond plan limit
  },
  subscriptionExpires: {
    type: Date,
    default: () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() + 100); // Free subscription "expires" in 100 years
      return date;
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: {
    type: Date
  },
  notifications: [
    {
      title: String,
      message: String,
      read: {
        type: Boolean,
        default: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update books and images remaining after subscription update
UserSchema.methods.updatePlanLimits = function() {
  const bookLimits = {
    'free': 1,
    'beta': 1, // Beta users get 1 book, like free users, but do not pay
    'single': 1,
    'single_promo': 1,
    'bundle10': 10,
    'bundle10_promo': 10,
    'bundle20': 20,
    'bundle20_promo': 20,
    'additional': 1, // Additional book purchase
    'custom': 50 // Default for custom, can be overridden
  };

  const imageLimits = {
    'free': 2,        // Free plan: 2 images max for testing
    'beta': 10,       // Beta users: 10 images (granted by admin)
    'single': 10,
    'single_promo': 12,
    'bundle10': 100,
    'bundle10_promo': 120,
    'bundle20': 200,
    'bundle20_promo': 220,
    'additional': 10,
  };
  
  this.booksAllowed = bookLimits[this.subscription] || 1;
  this.imagesAllowed = imageLimits[this.subscription] || 2; // Default to 2 for free plan
  
  // If this is a new subscription or upgrade, set remaining books to the full allowance
  // If it's a downgrade, make sure we don't exceed the new plan's limit
  if (this.booksRemaining > this.booksAllowed) {
    this.booksRemaining = this.booksAllowed;
  } else if (this.isNew || this.booksRemaining === 0) {
    this.booksRemaining = this.booksAllowed;
  }
  // Otherwise keep the current remaining count
};

// Keep the old method name for backward compatibility
UserSchema.methods.updateBooksAllowance = function() {
  return this.updatePlanLimits();
};

// Method to get total image limit (plan limit + additional slots)
UserSchema.methods.getTotalImageLimit = function() {
  return this.imagesAllowed + this.additionalImageSlots;
};

// Method to check if user can upload more images
UserSchema.methods.canUploadImages = function() {
  return this.imagesUsed < this.getTotalImageLimit();
};

// Method to purchase additional image slots
UserSchema.methods.purchaseImageSlots = function(quantity) {
  this.additionalImageSlots += quantity;
};

// Pre-save hook to update plan limits when subscription changes
UserSchema.pre('save', function(next) {
  if (this.isModified('subscription')) {
    this.updatePlanLimits();
  }
  next();
});

module.exports = mongoose.model('User', UserSchema); 