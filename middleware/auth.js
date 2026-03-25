import jwt from 'jsonwebtoken';

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authorization token required' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Verify the token
        const tokenDecoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach user info to request object
        req.user = {
            id: tokenDecoded.id,
            isAdmin: tokenDecoded.isAdmin || false
        };
        
        // Also keep backward compatibility for existing code
        req.body.userId = tokenDecoded.id;
        
        console.log(`🔐 Authenticated user: ${req.user.id}, isAdmin: ${req.user.isAdmin}`);
        
        next();
    } catch (error) {
        console.log('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token. Please login again.' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired. Please login again.' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Authentication error' 
        });
    }
}

export default authMiddleware;