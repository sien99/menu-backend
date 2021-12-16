const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: String,
    hash: String,
    salt: String,
    customer_id: {
        type: String,
        default: null,
    }
});

mongoose.model('User', UserSchema);