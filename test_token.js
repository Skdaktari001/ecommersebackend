import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const createToken = (id, isAdmin = false) => {
  return jwt.sign({ id, isAdmin }, process.env.JWT_SECRET || 'test_secret', { expiresIn: "24h" });
};

const token = createToken('test_id', true);
const decoded = jwt.decode(token);

console.log('Token Decoded:', decoded);
const exp = decoded.exp;
const iat = decoded.iat;
const diff = exp - iat;
console.log('Expiration diff (seconds):', diff);
console.log('Expiration diff (hours):', diff / 3600);

if (diff === 24 * 3600) {
    console.log('✅ Token expiration is exactly 24 hours');
} else {
    console.log('❌ Token expiration is NOT 24 hours');
}
