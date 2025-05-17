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
    enum: ['free', 'beta', 'author', 'starter', 'growth', 'professional', 'power', 'custom'],
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

// Method to update books remaining after subscription update
UserSchema.methods.updateBooksAllowance = function() {
  const planLimits = {
    'free': 1,
    'beta': 1, // Beta users get 1 book, like free users, but do not pay
    'author': 1,
    'starter': 5,
    'growth': 10,
    'professional': 20,
    'power': 30,
    'custom': 50 // Default for custom, can be overridden
  };
  this.booksAllowed = planLimits[this.subscription] || 1;
  // If this is a new subscription or upgrade, set remaining books to the full allowance
  // If it's a downgrade, make sure we don't exceed the new plan's limit
  if (this.booksRemaining > this.booksAllowed) {
    this.booksRemaining = this.booksAllowed;
  } else if (this.isNew || this.booksRemaining === 0) {
    this.booksRemaining = this.booksAllowed;
  }
  // Otherwise keep the current remaining count
};

// Pre-save hook to update books allowance when subscription changes
UserSchema.pre('save', function(next) {
  if (this.isModified('subscription')) {
    this.updateBooksAllowance();
  }
  next();
});

module.exports = mongoose.model('User', UserSchema); 