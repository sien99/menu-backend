const express = require('express');
const cors = require('cors');  //4200 to 3000

/**
 * -------------- GENERAL SETUP ----------------
 */

// Gives us access to variables set in the .env file via `process.env.VARIABLE_NAME` syntax
require('dotenv').config();

// Create the Express application
var app = express();

// Configures the database and opens a global connection that can be used in any module with `mongoose.connection`
require('./config/database');

// Must first load the models
require('./models/user');
require('./models/product');

//
require('./database/db');

// Instead of using body-parser middleware, use the new Express implementation of the same thing
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Allows our application to make HTTP requests to Express application
app.use(cors(corsOptions));
const clientUrl = process.env.CLIENT_URL
const corsOptions ={
    origin:clientUrl, 
}
// app.use(express.static(path.join(__dirname, 'public')));

/**
 * -------------- ROUTES ----------------
 */

// Imports all of the routes from ./routes/index.js
app.use(require('./routes'));


/**
 * -------------- SERVER ----------------
 */

// Server listens on http://localhost:3000
const PORT = process.env.PORT|| 5000;
app.listen(PORT, ()=>{
    console.log(`Server running on Port:${PORT}`);
});
