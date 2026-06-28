const express = require('express');
const router = express.Router();
const { getCollection } = require('../config/db');


// ==-== Creating PipeLine for the DeliveryStatus ==-== //
    router.get('/parcels/deliveryStatus/stats', async(req, res) => {
        const parcelsCollection = getCollection('parcels');
        
        const pipeLine = [
                {
                    $group : {
                        _id : '$deliveryStatus',
                        totalCount: { $sum: 1}
                    }
                }
            ];

        const result = await parcelsCollection.aggregate(pipeLine).toArray();
        res.send(result);
    })

 // ==-== Creating PipeLine for the Delivery per day for riders ==-== //
     router.get('/riders/delivery-par-day', async (req, res) => {
         const parcelsCollection = getCollection('parcels');
        
             const email = req.query.email;

    const pipeLine = [
        // ##1 filter specific rider with parcel delivered status
        {
            $match: {
                riderEmail: email,
                deliveryStatus: 'parcel delivered'
            }
        },
        
        // ##2 Add tracking data
        {
            $lookup: {
                from: 'trackings',
                localField: 'trackingId',
                foreignField: 'trackingId',
                as: 'parcels'
            }
        },

        // ##3 separate date from createdAt according to the day
        {
            $group: {
                _id: { 
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
                },
                totalDelivered: { $sum: 1 }
            }
        },

        {
            $sort: { 
                _id: -1 // Latest Date come first
            }
        }
    ];

    try {
        const result = await parcelsCollection.aggregate(pipeLine).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Error calculating delivery stats", error });
    }
});

module.exports = router;