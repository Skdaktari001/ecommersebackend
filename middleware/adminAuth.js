import jwt from 'jsonwebtoken';

const adminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: "Authorization token required" 
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Verify the token
        const tokenDecoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user is admin
        if (!tokenDecoded.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: "Admin access required" 
            });
        }
        
        // Attach user info to request object (consistent with authMiddleware)
        req.user = {
            id: tokenDecoded.id,
            isAdmin: true
        };
        
        // Also keep backward compatibility
        req.body.userId = tokenDecoded.id;
        
        console.log(`👑 Admin access granted: ${req.user.id}`);
        
        next();
    } catch (error) {
        console.log('Admin middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid token" 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: "Token expired" 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
}

export default adminMiddleware;