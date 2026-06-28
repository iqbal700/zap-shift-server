const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 3000;
const { connectDB } = require('./config/db');



 
// =-= Import Routes =-=
const userRoutes = require('./routes/user.routes');
const riderRoutes = require('./routes/rider.routes');
const parcelRoutes = require('./routes/parcel.routes');
const paymentRoutes = require('./routes/payment.routes');
const statsRoutes = require('./routes/stats.routes');

// =-= Middleware =-=  
 app.use(express.json());
 app.use(cors());
  
// ==-== Connect App Routes ==-==
app.use('/users', userRoutes);
app.use('/riders', riderRoutes);
app.use('/', parcelRoutes); 
app.use('/', paymentRoutes);
app.use('/', statsRoutes);

app.get('/', (req, res) => {
    res.send('zap shifting')
});



app.get('/', (req, res) => {
    res.send('zap shifting')
});


// ==-== Connect DB & Start Server ==-==
connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is listening on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("Database connection failed:", err);
    });





