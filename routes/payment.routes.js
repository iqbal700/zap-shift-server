const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const { verifyFBToken } = require('../middlewares/auth');
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



    // ===   === ==-== Payment Method Stripe Api Add ==-== ===   ===    ====  //

    router.post('/create-checkout-session', async(req, res) => {
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
router.patch('/payment-verify', async (req, res) => {
    const paymentCollection = getCollection('payments');
    const parcelsCollection = getCollection('parcels');
    
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
    router.get('/payments', verifyFBToken, async(req, res) => {
        const paymentCollection = getCollection('payments');
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

    module.exports = router;