// Check admin middleware
const checkAdmin = (req, res, next) => {
    if (req.user['cognito:groups'] && req.user['cognito:groups'].includes('Admin')) {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied: Admins only' });
    }
};

module.exports = checkAdmin;