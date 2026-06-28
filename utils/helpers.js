// ==-== Function for creating Tracking Id ==-== //
const generateTrackingId = () => {
    const prefix = "ZAP";
    const year = new Date().getFullYear(); 
    const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${year}-${randomChars}`;
};

module.exports = { generateTrackingId };