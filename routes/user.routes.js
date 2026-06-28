const express = require('express');
const router = express.Router();
const {ObjectId} = require('mongodb');
const {verifyFBToken, verifyAdmin} = require('../middlewares/auth')
const { getCollection } = require('../config/db'); // db.js থেকে ইমপোর্ট করা হলো



// ===--== Users Related APIs Started ===-===-=== //
  router.get('/', verifyFBToken, async(req, res) => {
      const userCollection = getCollection('users'); // কালেকশন কল করা হলো

      const searchUser = req.query.searchUser;
      const query = {};

      if(searchUser){
            // query.displayName = { $regex: searchUser, $options: 'i'};

            // for search filter with capital , small and with email matching name 
            query.$or = [
                {displayName : {$regex : searchUser, $options: 'i'}},
                { email : {$regex : searchUser, $options: 'i'}},
            ]
      }

      const cursor = userCollection.find(query).sort({createdAt: -1}).limit(5);
      const result = await cursor.toArray();
      res.send(result); 
  })


  // =======---======== ===  ----    =============== //
    router.post('/', async(req, res) => {
        const userCollection = getCollection('users'); // কালেকশন কল করা হলো
        const user = req.body;
        user.role = 'user';
        user.createdAt = new Date();
        const email = user.email;
  
          // =-= checking is user exist or not =-= // 
            const userExist = await userCollection.findOne({email});
            console.log( 'userExisting information : ' ,userExist);
  
            if(userExist) {
              return res.send({message: 'user already exist'})
            }
        const result = await userCollection.insertOne(user);
        res.send(result);
    })


    // ====-======== =-= make or remove admin =-= ============= //
                
        router.patch('/role/:id', verifyFBToken, verifyAdmin, async (req, res) => {
            const userCollection = getCollection('users'); // কালেকশন কল করা হলো
            try {
                const id = req.params.id;
                const { role } = req.body; 
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: { role: role },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

 // ========-=========== --- ============ //

         router.delete('/:id', verifyFBToken, async (req, res) => {
          const userCollection = getCollection('users'); // কালেকশন কল করা হলো
          try {
              const id = req.params.id;
              const query = { _id: new ObjectId(id) };
              const result = await userCollection.deleteOne(query);
              res.send(result);
          } catch (error) {
              res.status(500).send({ message: error.message });
          }
      });


      // ==-== For verifying users role security purpose ==-== //
      router.get('/:email/role', verifyFBToken, async (req, res) => {
          const userCollection = getCollection('users'); // কালেকশন কল করা হলো
          const email = req.params.email;
          const query = {email};
          const user = await userCollection.findOne(query);
          res.send({role : user?.role || 'user'})
      })


      module.exports = router;