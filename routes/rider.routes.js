const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyFBToken, verifyAdmin, verifyRider } = require('../middlewares/auth');
const { getCollection } = require('../config/db');


 // ==-== ======== ======Riders Related Apis Started ===== =====  ==-== //
 router.get('/', verifyRider, async(req, res) =>{
     const riderCollection = getCollection('riders');
     const {status, district, workStatus} = req.query;
     const query = {};

     if(status) {
       query.status = status;
     }
     if(district) {
       query.riderDistrict = district;
     }
     if(workStatus) {
       query.workStatus = workStatus;
     }

     console.log("Database Query Object:", query);

     const cursor = riderCollection.find(query);
     const result = await cursor.toArray(); 
     res.send(result);
 })


 
  router.post('/', verifyRider, async(req, res) => {
     const riderCollection = getCollection('riders');
     const rider = req.body;
     rider.status = 'pending';
     rider.role = 'user',
     rider.createdAt = new Date();
     const result = await riderCollection.insertOne(rider);
     res.send(result);
     console.log(rider)
  })


      // == rider approve Riders == //
    router.patch('/approve/:id', verifyFBToken, verifyAdmin, async (req, res) => {
      const riderCollection = getCollection('riders');
      const userCollection = getCollection('users');
      try {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const riderData = await riderCollection.findOne(query);
          if (!riderData) {
              return res.status(404).send({ message: "Rider application not found" });
          }
  
          const updatedDoc = {
              $set: {
                  status: 'approved',
                  role: 'rider',
                  workStatus: 'available'
              }
          };
          const result = await riderCollection.updateOne(query, updatedDoc);
          
              // Both usercollection and riderscollection user role ride set
            if(riderData.email) {
               const userQuery = {email: riderData.email};
               const updatedUserDoc = {
                  $set :{
                     role: 'rider'
                  }
               }
               await userCollection.updateOne(userQuery, updatedUserDoc)
            }
  
          res.send(result);
  
      } catch (error) {
          res.status(500).send({ message: error.message });
      }
  });


 
        // == rider rejected Apis == //
    router.patch('/reject/:id', verifyFBToken, verifyAdmin, async (req, res) => {
      const riderCollection = getCollection('riders');
      try {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const updatedDoc = {
              $set: {
                  status: 'rejected' ,
                  workStatus: '' 
              }
          };
          const result = await riderCollection.updateOne(query, updatedDoc);
          res.send(result);
      } catch (error) {
          res.status(500).send({ message: error.message });
      }
  });
  
      // == riders deleted APis == //
    router.delete('/delete/:id', verifyFBToken, verifyAdmin, async (req, res) => {
      const riderCollection = getCollection('riders');
      try {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const result = await riderCollection.deleteOne(query);
          res.send(result);
      } catch (error) {
          res.status(500).send({ message: error.message });
      }
  });

  module.exports = router;