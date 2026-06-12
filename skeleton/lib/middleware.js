const rateLimitMap = new Map()

// Simple rate limiter middleware
// Default: 10 requests per minute per IP
function rateLimiter(limit = 10, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const now = Date.now()

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, [])
    }

    const timestamps = rateLimitMap.get(ip)
    // Filter out old timestamps
    const activeTimestamps = timestamps.filter(t => now - t < windowMs)
    
    if (activeTimestamps.length >= limit) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      })
    }

    activeTimestamps.push(now)
    rateLimitMap.set(ip, activeTimestamps)
    next()
  }
}

// Simple authentication middleware using API keys
function authenticateFarmer(req, res, next) {
  // In a real production app, we would verify a JWT or signed session.
  // For the MVP, we gate edits with a header token.
  const token = req.headers['x-farmer-token']
  const expectedToken = process.env.FARMER_TOKEN || 'sabi_farmer_default_token'

  // We allow GET passport requests without auth (public profile)
  if (req.method === 'GET' && req.path.startsWith('/passport')) {
    return next()
  }

  // Gate profile updates and invoice creations
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!token || token !== expectedToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid farmer API token required to modify profiles or request invoices.'
      })
    }
  }
  next()
}

module.exports = { rateLimiter, authenticateFarmer }
