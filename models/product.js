const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    id: String,
    type:String,
    name: String,
    priceInCents: String
});

mongoose.model('Product', ProductSchema);