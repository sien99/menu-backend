const mongoose = require('mongoose');
const router = require('express').Router();   
const User = mongoose.model('User'); //or import User from./models/user
const utils = require('../lib/utils');

// TODO 3. Secure routes using authMiddleware
// Middleware: passport.authenticate('jwt',{session:false})
router.get('/protected/:id', utils.authMiddleware , (req, res, next) => {
    res.status(200).json({success: true, msg: 'Retrieved User Secret'})
});

// TODO 4. Update user customer id
router.put('/update/:id',utils.authMiddleware, (req, res, next) => {
    const { id } = req.params   
    const { customer_id } = req.body
    console.log("Id: ",id);
    console.log("Body: ",req.body);

    const updateCustomerId = {
        customer_id: customer_id
    }
    // https://mongoosejs.com/docs/tutorials/findoneandupdate.html
    User.findOneAndUpdate({ _id: id }, updateCustomerId, { new:true }) 
    // new:true return updated User data
        .then((updatedUser)=>{
            console.log(updatedUser);
            if(updatedUser.customer_id){
                res.status(200).json({msg: "Successfully updated customer id."})
            }else{
                res.status(500).json({msg: "Failed to update customer id."})
            }
        })
        .catch((err)=>{
            console.error(err)
            res.status(500).json({err})
        })
});

// TODO 2. Verify user pw and issueJWT
router.post('/signin', (req, res, next) => {

    const { email, password } = req.body

    User.findOne({ username:email })
        .then((user) => {
            if(!user){
                res.status(404).json({
                    success: false,
                    msg: "user not found"
                });
            }else{
                const isValid = utils.validPassword(password, user.hash, user.salt) 

                if(isValid){
                    const tokenObj = utils.issueJWT(user)
                    res.status(200).json({
                        success: true,
                        user: user,
                        token: tokenObj.token,
                        expires: tokenObj.expires
                    })
                }else{
                    res.status(401).json({
                        success: false,
                        msg: "wrong password"
                    })
                }
            }
        })
        .catch(err=>{next(err)}) //pass error to next middleware
    
});

// TODO 1. Gen pw hash & salt, 
router.post('/signup', (req, res, next) => {

    const { email, password } = req.body
    
    const { hash, salt } = utils.genPassword(password);
    
    //* Check Username
    User.findOne({ username:email })
    .then((user) => {
        if(user){
            res.status(404).json({
                success: false,
                msg: "username already exist"
            });
            
        }else{

            const newUser = new User({
                username: email,
                hash: hash,
                salt: salt
            });

            newUser.save()
                .then((user)=>{
                    const jwt = utils.issueJWT(user);
                    res.json({
                        success:true, 
                        user:user, 
                        token:jwt.token, // issue Jwt to user after reg
                        expiresIn:jwt.expires
                    });
                })
                .catch((err)=>{
                    next(err)
                })
        }
    })
});

module.exports = router;