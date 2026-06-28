
// ==-==  Latest version code ==-== //
const { initializeApp, cert } = require("firebase-admin/app");
const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const {getCollection} = require('../config/db');
const serviceAccount = require("../zap-shift-firebase-adminsdk.json");

initializeApp({
  credential: cert(serviceAccount)
});


 // ==-== verify Firebase Token middle ware ==-== //
 const verifyFBToken = async (req, res, next) =>{

      const token = req.headers.authorization;

      if(!token || !token.startsWith('Bearer ') ) {
        return res.status(401).send({message: 'unauthorized access'})
      }

      try {
          const idToken = token.split(' ')[1];
          const decoded = await getAuth().verifyIdToken(idToken);
          //console.log('decoded in the token :', decoded);
          req.decoded_email = decoded.email;
           next();
      }
      catch(err) {
          console.error('Firebase Auth Error:', err.message);
          return res.status(403).send({ message: 'forbidden access' })
      } 
 }

  // middleware for verifying admin // must used after verifyFBToken

    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded_email;
        const query = {email};

        try {

            const userCollection = getCollection('users');
            const user = await userCollection.findOne(query);

            if (!user || user.role !== 'admin') {
            return res.status(403).send({ message: 'forbidden to access' });
            }
            next();
        } catch (error) {
            return res.status(500).send({ message: 'Internal server error' });
        }
        };

// ==-== rider Verifying ==-==
    const verifyRider = async (req, res, next) => {
        const email = req.decoded_email;
        const query = {email};
        const userCollection = getCollection('users')
        const  user = await userCollection.findOne(query);

        if(!user || user.role !== 'rider') {
            return res.status(403).send({message: 'forbidden to access'})
        }
        next();
    }

    module.exports = {
        verifyFBToken,
        verifyAdmin,
        verifyRider
    };