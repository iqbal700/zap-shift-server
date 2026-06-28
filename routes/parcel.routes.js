const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { generateTrackingId } = require('../utils/helpers');
const { getCollection } = require('../config/db');


    // ==-== Functions for Trackings Parcels Status Information ==-== //
    const logTracking = async(trackingId, status) => {
        const trackingsCollection = getCollection('trackings');
        const log = {
            trackingId,
            status,
            details : status.split('-').join(' '),
            createdAt : new Date()
        }
        const result = await trackingsCollection.insertOne(log);
        return result;
    }


    // ==-= Tracking Related APis ==-== 
    router.get('/trackings/:trackId/logs', async(req, res) => {
        const trackingsCollection = getCollection('trackings');
        const trackingId = req.params.trackId;
        const query = {trackingId};
        const result = await trackingsCollection.find(query).toArray();
        res.send(result)
    })


    
    // ===-=== save parcel to database collection ===-=== //
    router.post('/parcels', async(req, res) => {
        const parcelsCollection = getCollection('parcels');
        const parcel = req.body;
        const trackingId = generateTrackingId();
        //console.log('Data info from sender Parcel Form:' , parcel)
        parcel.createdAt = new Date();
        parcel.deliveryStatus = 'parcel-created'
        parcel.trackingId = trackingId;
        logTracking(trackingId, 'parcel-created' )
        const result = await parcelsCollection.insertOne(parcel);
        res.send(result)
    })
    
    // Delete APi for parcels 
    router.delete('/parcels/:id', async(req, res) => {
       const parcelsCollection = getCollection('parcels');
       const id = req.params.id;
       const query = { _id: new ObjectId(id) };
       const result = await parcelsCollection.deleteOne(query);
       res.send(result);
    })
    
    router.get('/parcels', async (req, res) => {
        const parcelsCollection = getCollection('parcels');
        try {
            const query = {};
            const { email, deliveryStatus } = req.query;
    
            if (email) {
                query.senderEmail = email;
            }
    
            if (deliveryStatus) {
               query.deliveryStatus = { $in: ['pending-pickup', 'rejected'] }
            }
    
            
    
            
            const options = { sort: { createdAt: -1 } };
            const cursor = parcelsCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    });
    
    
    router.get('/parcels/rider', async (req, res) => {
        const parcelsCollection = getCollection('parcels');
        try {
            const { riderEmail, deliveryStatus } = req.query;
            const query = {};
    
            if (riderEmail) {
                query.riderEmail = riderEmail;
            }
    
            if (deliveryStatus === 'assigned to rider') {
                query.deliveryStatus = { $in: ['assigned to rider', 'accepted', 'parcel picked up'] }; 
            } else {
                query.deliveryStatus = deliveryStatus
            }
    
            const options = { sort: { createdAt: -1 } }; 
            const cursor = parcelsCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    });
    
        // ==-== api for specific single product id payment ==-== 
        // its helps us to find out which product we pay for and the information of  this product we can send it backend from front end
        router.get('/parcels/:id', async(req, res) => {
            const parcelsCollection = getCollection('parcels');
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await parcelsCollection.findOne(query);
            res.send(result);
        })
    
    // =-= Api for parcels "Assign to rider" =-= //
        router.patch('/parcels/:id', async(req, res) => {
             const parcelsCollection = getCollection('parcels');
             const riderCollection = getCollection('riders');
             const {riderId, riderName, riderEmail, trackingId} = req.body;
             const id = req.params.id;
             const  query = {_id: new ObjectId(id)};
    
             const updateDoc = {
                $set : {
                    deliveryStatus: 'assigned to rider',
                    riderId : riderId,
                    riderEmail : riderEmail,
                    riderName : riderName 
                }
             }
    
                const result = await parcelsCollection.updateOne(query, updateDoc)
    
                // ==-== now update rider status ==-== //
                const riderQuery = {_id : new ObjectId(riderId)};
                const riderUpdateDoc = {
                    $set : {
                        workStatus: 'in_transit'
                    }
                }
    
                const riderResult = await riderCollection.updateOne(riderQuery, riderUpdateDoc);
    
                // ==-== Log Trackings ==-== //
                logTracking(trackingId, 'assign to rider')
                res.send(riderResult);
    
        })
    
    
        // ==-== api for rider reject or accept parcel ==-== //
        router.patch('/parcels/status/:id', async (req, res) => {
            const parcelsCollection = getCollection('parcels');
            const riderCollection = getCollection('riders');
            try {
                const id = req.params.id;
                const { deliveryStatus, trackingId } = req.body;
                console.log('Incoming deliveryStatus : ', deliveryStatus);
    
                const query = { _id: new ObjectId(id) };
    
                const currentParcel = await parcelsCollection.findOne(query);
                        if (!currentParcel) {
                            return res.status(404).send({ message: "Parcel not found" });
                        }
                
                let updateParcelStatus = {
                    $set: {
                        deliveryStatus: deliveryStatus
                    }
                };
    
                if (deliveryStatus === 'rejected') {
                    updateParcelStatus = {
                    
                        $set: { 
                            deliveryStatus: deliveryStatus 
                        },
                        $unset: {
                            riderEmail: "",
                            riderName: "",
                            riderId: ""
                        }
                    };
                }
    
             // Condition 2: If the parcel is successfully delivered
            if (deliveryStatus === 'parcel delivered') {
                updateParcelStatus = {
                    $set: {
                        deliveryStatus: deliveryStatus,
                        deliveredAt: new Date() 
                    }
                };
    
             // 2. Free up the rider if their email exists
                if (currentParcel.riderEmail) {
                    await riderCollection.updateOne(
                        { email: currentParcel.riderEmail },
                        { $set: { workStatus: 'available' } } 
                    );
                }
            }
    
            const result = await parcelsCollection.updateOne(query, updateParcelStatus);
            // Log Tracking 
            logTracking(trackingId, deliveryStatus);
            res.send(result);
            
        } catch (error) {
            console.error("Error updating status:", error);
            res.status(500).send({ message: error.message });
        }
    });

    module.exports = router;