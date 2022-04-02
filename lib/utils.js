const crypto = require('crypto');
const jsonwebtoken = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const pathToPRIVKey = path.join(__dirname, '..', 'id_rsa_priv.pem');
const pathToPUBKey = path.join(__dirname, '..', 'id_rsa_pub.pem');
const PRIV_KEY = fs.readFileSync(pathToPRIVKey, 'utf8');
const PUB_KEY = fs.readFileSync(pathToPUBKey, 'utf8');

//* -------------- HELPER FUNCTIONS ----------------
/**
 * 
 * @param {*} password - The plain text password
 * @param {*} hash - The hash stored in the database
 * @param {*} salt - The salt stored in the database
 * 
 * This function uses the crypto library to decrypt the hash using the salt and then compares
 * the decrypted hash/salt with the password that the user provided at login
 */
function validPassword(password, hash, salt) {
    var hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === hashVerify;
}

/**
 * 
 * @param {*} password - The password string that the user inputs to the password field in the register form
 * 
 * This function takes a plain text password and creates a salt and hash out of it.  Instead of storing the plaintext
 * password in the database, the salt and hash are stored for security
 * 
 * ALTERNATIVE: It would also be acceptable to just use a hashing algorithm to make a hash of the plain text password.
 * You would then store the hashed password in the database and then re-hash it to verify later (similar to what we do here)
 */
function genPassword(password) {
    var salt = crypto.randomBytes(32).toString('hex');
    var genHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex'); 
    
    return {
      salt: salt,
      hash: genHash
    };
}

/**
 * @param {*} user - The user object.  We need this to set the JWT `sub` payload property to the MongoDB user ID
 */
function issueJWT(user) {
  const _id = user._id;

  const expiresIn = Math.floor(Date.now() / 1000) + (60*60)   //in seconds (1hr)

  const payload = {
    sub: _id,
    exp: expiresIn, // mean in jwt time unit in SEC
    iat: Math.floor(Date.now() / 1000)
  };

  const signedToken = jsonwebtoken.sign(payload, PRIV_KEY, {algorithm: 'RS256' });

  return {
    token: "Bearer " + signedToken,
    expires: expiresIn
  }
}

//* -------------- Middleware ----------------
async function authMiddleware(req, res, next) {
  
  if (req.headers.authorization){
    const tokenParts = req.headers.authorization.split(' ');
    if (tokenParts[0] === 'Bearer' && tokenParts[1].match(/\S+\.\S+\.\S+/) !== null) {
      try {
        const verification = await jsonwebtoken.verify(tokenParts[1], PUB_KEY, { algorithms: ['RS256'] },);
        console.log(verification.sub);
        console.log(Date.now()/1000);
        console.log(req.params);
        if(req.params.id !== verification.sub){
          res.status(401).json({msg:"Illegal operation, you are not allow to view/modify data of this user"})
        } else {
          console.log("Checked user_id matched with params.");
        }
        
        next();
        
      } catch(err) {
        console.log(err.name);
        const errorMsg = err.name
        res.status(401).json({msg:errorMsg})
        
      }
      
    } 
  } else {
    res.status(401).json({ 
      success: false, msg: "You are not authorized to visit this route",
      req:req.headers
    });

  }
}

module.exports.validPassword = validPassword;
module.exports.genPassword = genPassword;
module.exports.issueJWT = issueJWT;
module.exports.authMiddleware = authMiddleware;