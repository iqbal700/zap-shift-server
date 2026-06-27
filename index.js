const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRET);

// ==-== old version code  Bring it from firebase service account ==-== 
// const admin = require("firebase-admin");
// const serviceAccount = require("./zap-shift-firebase-adminsdk.json.json");
 // it is download from generate key from service account then transfer this file into backend server then call it in this section 
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// ==-==  Latest version code ==-== //
const { initializeApp, cert } = require("firebase-admin/app");
const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = require("./zap-shift-firebase-adminsdk.json.json");

initializeApp({
  credential: cert(serviceAccount)
});

 // ==-== verify Firebase Token middle ware ==-== //
 const verifyFBToken = async (req, res, next) =>{

      const token = req.headers.authorization;

      if(!token || !token.startsWith('Bearer') ) {
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


// ==-== Function for creating Tracking Id ==-== //
const generateTrackingId = () => {
    const prefix = "ZAP";
    const year = new Date().getFullYear(); 
    const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${year}-${randomChars}`;
};



// =-= Middleware =-=  
 app.use(express.json());
 app.use(cors());

 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w0obvc9.mongodb.net/?appName=Cluster0`;

// ==-== MongoDB client creating ==-==
  

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    // middle ware for verifying admin , checking who is making users admin or delete is he admin or others users , must used after verifyFBToken

    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded_email;
        const query = {email};
        const  user = await userCollection.findOne(query);

        if(!user || user.role !== 'admin') {
            return res.status(403).send({message: 'forbidden to access'})
        }
        next();
    }

// ==-== rider Verifying ==-==
    const verifyRider = async (req, res, next) => {
        const email = req.decoded_email;
        const query = {email};
        const  user = await userCollection.findOne(query);

        if(!user || user.role !== 'rider') {
            return res.status(403).send({message: 'forbidden to access'})
        }
        next();
    }




// ==-== Creating Database Collections ==-== //
    const db = client.db('zap_shift_db');
    const userCollection = db.collection('users');
    const riderCollection = db.collection('riders');
    const parcelsCollection = db.collection('parcels');
    const paymentCollection = db.collection('payments');
    const trackingsCollection = db.collection('trackings');


    // ==-== Functions for Trackings Parcels Status Information ==-== //
    const logTracking = async(trackingId, status) => {
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
    app.get('/trackings/:trackId/logs', async(req, res) => {
        const trackingId = req.params.trackId;
        const query = {trackingId};
        const result = await trackingsCollection.find(query).toArray();
        res.send(result)
    })
    

  // ===--== Users Related APIs Started ===-===-=== //
  app.get('/users', verifyFBToken, async(req, res) => {

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

  app.post('/users', async(req, res) => {
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
                // =-= make or remove admin =-=
    app.patch('/users/role/:id', verifyFBToken, verifyAdmin, async (req, res) => {
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

      app.delete('/users/:id', verifyFBToken, async (req, res) => {
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
      app.get('/users/:email/role', verifyFBToken, async (req, res) => {
          const email = req.params.email;
          const query = {email};
          const user = await userCollection.findOne(query);
          res.send({role : user?.role || 'user'})
      })

  //===== ====== - ===--== Users Related APIs End ===-===-=== ====- = //



 // ==-== ======== ======Riders Related Apis Started ===== =====  ==-== //
 app.get('/riders', verifyRider, async(req, res) =>{
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

 app.post('/riders', verifyRider, async(req, res) => {
    const rider = req.body;
    rider.status = 'pending';
    rider.role = 'user',
    rider.createdAt = new Date();
    const result = await riderCollection.insertOne(rider);
    res.send(result);
    console.log(rider)
 })

    // == rider approve Riders == //
  app.patch('/riders/approve/:id', verifyFBToken, verifyAdmin, async (req, res) => {
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
  app.patch('/riders/reject/:id', verifyFBToken, verifyAdmin, async (req, res) => {
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
  app.delete('/riders/delete/:id', verifyFBToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await riderCollection.deleteOne(query);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// ==-== ===== ===== Riders Related Apis Ended ===== =====  ==-== //




// ==-== Parcels API to get specific items based on email ==-== // 

// ===-=== save parcel to database collection ===-=== //
    app.post('/parcels', async(req, res) => {
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
    app.delete('/parcels/:id', async(req, res) => {
       const id = req.params.id;
       const query = { _id: new ObjectId(id) };
       const result = await parcelsCollection.deleteOne(query);
       res.send(result);
    })

  app.get('/parcels', async (req, res) => {
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


app.get('/parcels/rider', async (req, res) => {
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
    app.get('/parcels/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await parcelsCollection.findOne(query);
        res.send(result);
    })

// =-= Api for parcels "Assign to rider" =-= //
     app.patch('/parcels/:id', async(req, res) => {
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
    app.patch('/parcels/status/:id', async (req, res) => {
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




// ===  === ==-== Payment Method Stripe Api Add ==-== ===  ===  ====  //

    app.post('/create-checkout-session', async(req, res) => {
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.cost) * 100
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
               price_data: {
                 currency: 'USD',
                  unit_amount: amount,
                 product_data : {
                   name: paymentInfo.parcelName
                 },
               },
              quantity: 1,
            },
          ],
           customer_email : paymentInfo.senderEmail,
           mode: 'payment',
           metadata: {
              parcelId : paymentInfo.parcelId,
              parcelName: paymentInfo.parcelName,
              trackingId: paymentInfo.trackingId

           },
           success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
           cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,

        })

        //console.log(session);
        //console.log('information about product:',paymentInfo)
        res.send({url: session.url})
    })

   


    // ===-=== Confirmation Api after completing payment ===-=== //
app.patch('/payment-verify', async (req, res) => {
    try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
            return res.status(400).send({ success: false, message: 'Missing session_id' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // console.log('session retrieve:', session);

        //=====-=== Prevent double time payment history store to database ======-======//
        const transactionId = session.payment_intent;

        const query = { transactionId: transactionId };
        const paymentExist = await paymentCollection.findOne(query);

        if (paymentExist) {
            return res.send({
                success: true, 
                message: 'already exist payment history',
                transactionId,
                trackingId: paymentExist.trackingId
            });
        }
        // ===== ===== ===-=== ==== =======-===-==== =====-===== =======//


        // const trackingId = generateTrackingId(); // cant use double trackId;
        const trackingId = session.metadata.trackingId; //using trackId during the parcel create that time ==-== //

        if (session.payment_status === 'paid') {
            const id = session.metadata.parcelId;
            const query = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    paymentStatus: 'paid',
                    deliveryStatus: 'pending-pickup',
                    paymentAt: new Date()
                }
            };
            const result = await parcelsCollection.updateOne(query, update);

            // for creating payment history store and display;
            const payment = {
                amount: session.amount_total / 100,
                currency: session.currency,
                customerEmail: session.customer_email,
                parcelId: session.metadata.parcelId,
                parcelName: session.metadata.parcelName,
                transactionId: session.payment_intent,
                paymentStatus: session.payment_status,
                trackingId: trackingId,
                paidAt: new Date()
            };

            // ==-== store in the separate collections so that we can show it  later in the separate file ==-== //
            const paymentResult = await paymentCollection.insertOne(payment);

            await logTracking(trackingId, 'pending-pickup');

            return res.send({
                success: true,
                modifyParcel: result,
                paymentInfo: paymentResult,
                trackingId: trackingId,
                transactionId: session.payment_intent
            });
        }

        return res.send({ success: false, message: 'payment not completed yet' });

    } catch (error) {
        console.error("Payment Verify Error:", error);
        return res.status(500).send({ success: false, message: error.message });
    }
});

    // ==-== Get all payment history from database ===-=== //
    app.get('/payments', verifyFBToken, async(req, res) => {
        const email = req.query.email;
        const query = {};

        // console.log('headers : ', req.headers)

        if(email) {
          query.customerEmail = email;

          if(email !== req.decoded_email) {
             return res.status(403).send({message: 'forbidden access'})
          }
        }
        const cursor = paymentCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })


// ==-== Creating PipeLine for the DeliveryStatus ==-== //
    app.get('/parcels/deliveryStatus/stats', async(req, res) => {
        
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
     app.get('/riders/delivery-par-day', async (req, res) => {
        
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





    

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

        

  } catch(error) {
    console.log("Database connection failed:", error)
  }

  
}


run().catch(console.dir); 

    app.get('/', (req, res) => {
        res.send('zap shifting')
        })

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
