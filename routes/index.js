const router = require('express').Router();

//* List of routes
router.use('/users', require('./users'));
router.use('/payment', require('./payment'));


module.exports = router;